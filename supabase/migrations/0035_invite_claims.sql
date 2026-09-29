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

-- ------------------------------------------ le mail après le groupe --

-- Un invité qui passe par Google Groups depuis le mail n'y revient pas : le
-- bouton retour le rend à sa messagerie, pas à la page d'invitation. Le mail
-- attend donc que `npm run group:invites` ait mis l'adresse dans le groupe
-- (`listed_at`, qui relance l'envoi), et sa page saute l'étape du groupe.
-- Poste du développeur éteint, il part au bout d'une heure avec les trois
-- étapes.
create or replace function public.invite_tester(p_email text, p_lang text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_owner uuid;
begin
  if not public.is_named_account() then
    return 'anonymous';
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    return 'invalid';
  end if;
  if exists (select 1 from public.tester_invites where email = v_email) then
    return 'already';
  end if;
  if (select count(*) from public.tester_invites
       where invited_by = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    return 'limit';
  end if;

  select u.id into v_owner from auth.users u
    join public.profiles p on p.id = u.id
   where lower(u.email) = v_email and not u.is_anonymous;

  if v_owner = auth.uid() then
    return 'invalid';
  end if;

  if v_owner is not null then
    -- Marquée envoyée : la fonction Edge ne la verra jamais.
    insert into public.tester_invites (email, invited_by, lang, mailed_at, joined_by, joined_at)
    values (v_email, auth.uid(), nullif(p_lang, ''), now(), v_owner, now());
    if not exists (
      select 1 from public.blocks
       where (blocker = v_owner and blocked = auth.uid()) or (blocker = auth.uid() and blocked = v_owner)
    ) and not exists (
      select 1 from public.friendships
       where (requester = auth.uid() and addressee = v_owner) or (requester = v_owner and addressee = auth.uid())
    ) then
      insert into public.friendships (requester, addressee) values (auth.uid(), v_owner);
    end if;
    return 'sent';
  end if;

  insert into public.tester_invites (email, invited_by, lang) values (v_email, auth.uid(), nullif(p_lang, ''));
  -- Le bouton du mail porte aussi le code : l'invité qui s'inscrit sous une
  -- autre adresse retrouve quand même l'inviteur. Le mail, lui, attend que
  -- l'adresse soit dans le groupe des testeurs (claim_invites).
  perform public.my_invite_code();
  return 'sent';
end;
$$;

drop function public.claim_invites();

create function public.claim_invites() returns table (
  id uuid, email text, lang text, inviter_name text, inviter_email text, inviter_code text, listed boolean
)
language sql security definer set search_path = public as $$
  update public.tester_invites i set attempts = i.attempts + 1
    from public.profiles p, auth.users u
   where i.mailed_at is null and i.attempts < 3 and i.created_at > now() - interval '7 days'
     and (i.listed_at is not null or i.created_at < now() - interval '1 hour')
     and p.id = i.invited_by and u.id = i.invited_by
  returning i.id, i.email, i.lang, p.display_name, u.email,
    (select l.code from public.invite_links l where l.inviter = i.invited_by),
    i.listed_at is not null;
$$;

revoke execute on function public.claim_invites() from public, anon, authenticated;
grant execute on function public.claim_invites() to service_role;

-- Tous les quarts d'heure plutôt qu'à chaque heure : c'est lui qui envoie le
-- mail d'une adresse que le groupe n'a pas prise.
select cron.unschedule('invites-retry');
select cron.schedule('invites-retry', '*/15 * * * *', 'select public.kick_invites()');
