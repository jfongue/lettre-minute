-- Qui a invité chaque compte, une fois pour toutes.
--
-- Un code d'invitation peut se perdre en route (installation hors du lien
-- Play, presse-papiers écrasé, autre appareil). Le jeu demande alors au
-- nouveau compte, une seule fois, qui l'a invité : ce filet ne s'ouvre que
-- tant qu'aucune invitation n'a été encaissée, et seulement les trente
-- premiers jours du compte — sans quoi n'importe quel vieux compte
-- s'imposerait en ami d'un joueur de son choix.

create table public.invite_claims (
  invitee uuid primary key references public.profiles on delete cascade,
  inviter uuid references public.profiles on delete set null,
  via text not null check (via in ('email', 'code', 'name', 'none')),
  created_at timestamptz not null default now()
);

alter table public.invite_claims enable row level security;
-- Aucune politique : lue et écrite par les fonctions de ce fichier seules.

-- L'amitié d'une invitation, sans demande, sauf blocage d'un côté ou de l'autre.
create function public.befriend_inviter(p_invitee uuid, p_inviter uuid, p_via text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_inviter is null or p_inviter = p_invitee then
    return false;
  end if;
  insert into public.invite_claims (invitee, inviter, via) values (p_invitee, p_inviter, p_via)
  on conflict (invitee) do nothing;
  if exists (
    select 1 from public.blocks
     where (blocker = p_inviter and blocked = p_invitee) or (blocker = p_invitee and blocked = p_inviter)
  ) then
    return false;
  end if;
  delete from public.friendships where requester = p_invitee and addressee = p_inviter;
  insert into public.friendships (requester, addressee, status)
  values (p_inviter, p_invitee, 'accepted')
  on conflict (requester, addressee) do update set status = 'accepted';
  return true;
end;
$$;

revoke execute on function public.befriend_inviter(uuid, uuid, text) from public, anon, authenticated;

-- Les deux voies de 0034 passent désormais par elle, et laissent leur trace.
create or replace function public.befriend_invited() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_inviter uuid;
begin
  if new.email is null then
    return new;
  end if;
  update public.tester_invites set joined_by = new.id, joined_at = now()
   where email = lower(new.email) and joined_by is null
  returning invited_by into v_inviter;
  if v_inviter is null or not exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;
  perform public.befriend_inviter(new.id, v_inviter, 'email');
  return new;
exception when others then
  return new;
end;
$$;

create or replace function public.accept_invite(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_inviter uuid;
begin
  if not public.is_named_account() then
    return null;
  end if;
  select inviter into v_inviter from public.invite_links where code = p_code;
  if not public.befriend_inviter(auth.uid(), v_inviter, 'code') then
    return null;
  end if;
  return (select display_name from public.profiles where id = v_inviter);
end;
$$;

-- `ask` tant que le compte peut encore nommer qui l'a invité, `done` sinon.
create function public.invite_status() returns text
language sql stable security definer set search_path = public as $$
  select case
    when not public.is_named_account() then 'done'
    when exists (select 1 from public.invite_claims where invitee = auth.uid()) then 'done'
    when (select created_at from auth.users where id = auth.uid()) < now() - interval '30 days' then 'done'
    else 'ask'
  end;
$$;

-- Le filet : le nom de l'inviteur, tapé par l'invité, ou null pour
-- « personne », qui clôt la question aussi. Répond 'friends', 'unknown',
-- 'self' (on redemande), ou 'done' quand la question était déjà close.
create function public.claim_inviter(p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_inviter uuid;
begin
  if public.invite_status() <> 'ask' then
    return 'done';
  end if;
  if p_name is null then
    insert into public.invite_claims (invitee, via) values (auth.uid(), 'none') on conflict (invitee) do nothing;
    return 'done';
  end if;
  select p.id into v_inviter
    from public.profiles p
    join auth.users u on u.id = p.id and not u.is_anonymous
   where lower(p.display_name) = lower(trim(p_name));
  if v_inviter is null then
    return 'unknown';
  end if;
  if v_inviter = auth.uid() then
    return 'self';
  end if;
  perform public.befriend_inviter(auth.uid(), v_inviter, 'name');
  return 'friends';
end;
$$;

revoke execute on function public.invite_status(), public.claim_inviter(text) from public, anon;
grant execute on function public.invite_status(), public.claim_inviter(text) to authenticated;

-- Les comptes d'avant ce filet ne sont pas venus par une invitation qu'on
-- aurait perdue : on ne leur pose pas la question.
insert into public.invite_claims (invitee, via)
select id, 'none' from public.profiles
on conflict (invitee) do nothing;
