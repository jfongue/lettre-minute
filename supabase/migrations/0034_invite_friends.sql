-- Inviter un ami par e-mail, et le retrouver en ami dès qu'il arrive.
--
-- Le test fermé Android prend désormais pour liste de testeurs un groupe
-- Google public : l'invitation n'a plus à attendre qu'un script inscrive
-- l'adresse à la Play Console. La fonction Edge `invite` l'envoie aussitôt,
-- depuis la boîte Gmail du jeu, au nom de l'inviteur.
--
-- Une adresse qui a déjà un compte ne reçoit pas de mail : son propriétaire
-- reçoit une demande d'ami ordinaire, et l'inviteur lit la même réponse
-- `sent` — le champ ne dit jamais qui joue déjà. Une adresse sans compte
-- attend ici : le compte qui la prendra devient aussitôt ami de l'inviteur.

alter table public.tester_invites
  add column joined_by uuid references public.profiles on delete set null,
  add column joined_at timestamptz;

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
  -- autre adresse retrouve quand même l'inviteur.
  perform public.my_invite_code();
  perform public.kick_invites();
  return 'sent';
end;
$$;

-- Le compte qui prend une adresse invitée — à sa création (Google) ou quand
-- un joueur anonyme la donne en s'inscrivant — devient ami de l'inviteur,
-- sans demande : il a reçu le mail qui le nommait. Rien ici ne doit faire
-- échouer une inscription.
create function public.befriend_invited() returns trigger
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
  if v_inviter is null or v_inviter = new.id
     or not exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;
  delete from public.friendships where requester = new.id and addressee = v_inviter;
  insert into public.friendships (requester, addressee, status)
  values (v_inviter, new.id, 'accepted')
  on conflict (requester, addressee) do update set status = 'accepted';
  return new;
exception when others then
  return new;
end;
$$;

-- Après `on_auth_user_created`, qui crée le profil : les déclencheurs d'une
-- même table passent par ordre alphabétique.
create trigger on_auth_user_invited
  after insert or update of email on auth.users
  for each row execute function public.befriend_invited();

-- ------------------------------------------------------------ envoi --

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'invites_secret') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'invites_secret');
  end if;
end;
$$;

-- Même geste que `ideas_config` (0015) : la fonction Edge inscrit sa propre
-- adresse à chaque appel.
create function public.invites_config(p_url text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'invites_url';
  if v_id is null then
    perform vault.create_secret(p_url, 'invites_url');
  elsif (select decrypted_secret from vault.decrypted_secrets where id = v_id) is distinct from p_url then
    perform vault.update_secret(v_id, p_url);
  end if;
  return (select decrypted_secret from vault.decrypted_secrets where name = 'invites_secret');
end;
$$;

-- Tant que la fonction ne s'est jamais annoncée, l'invitation attend : le
-- réveil horaire la reprendra.
create function public.kick_invites() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'invites_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'invites_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-invites-secret', v_secret),
    body := '{}'::jsonb
  );
exception when others then
  null;
end;
$$;

-- Les invitations à envoyer, avec ce que le mail dit de l'inviteur. Une
-- adresse que trois passes n'ont pas pu joindre est abandonnée.
alter table public.tester_invites add column attempts int not null default 0;

create function public.claim_invites() returns table (
  id uuid, email text, lang text, inviter_name text, inviter_email text, inviter_code text
)
language sql security definer set search_path = public as $$
  update public.tester_invites i set attempts = i.attempts + 1
    from public.profiles p, auth.users u
   where i.mailed_at is null and i.attempts < 3 and i.created_at > now() - interval '7 days'
     and p.id = i.invited_by and u.id = i.invited_by
  returning i.id, i.email, i.lang, p.display_name, u.email,
    (select l.code from public.invite_links l where l.inviter = i.invited_by);
$$;

create function public.finish_invites(p_ids uuid[]) returns void
language sql security definer set search_path = public as $$
  update public.tester_invites set mailed_at = now() where id = any(p_ids);
$$;

revoke execute on function public.invites_config(text), public.kick_invites(), public.claim_invites(),
  public.finish_invites(uuid[]), public.befriend_invited() from public, anon, authenticated;
grant execute on function public.invites_config(text), public.kick_invites(), public.claim_invites(),
  public.finish_invites(uuid[]) to service_role;

select cron.schedule('invites-retry', '17 * * * *', 'select public.kick_invites()');

-- ---------------------------------------------------- par un lien partagé --

-- Un lien de chat ne connaît pas d'adresse : il porte le code de l'inviteur,
-- que la page d'invitation passe au jeu (install referrer de Play, ou
-- l'adresse de la version web). Le compte nommé qui le présente
-- devient aussitôt ami de l'inviteur. Un code, pas l'identifiant du compte :
-- les identifiants circulent dans les listes d'amis, et n'importe qui
-- pourrait alors s'imposer en ami de n'importe qui.
create table public.invite_links (
  code text primary key,
  inviter uuid not null unique references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.invite_links enable row level security;
-- Aucune politique : le code ne se lit que par les fonctions ci-dessous.

create function public.my_invite_code() returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if not public.is_named_account() then
    return null;
  end if;
  select code into v_code from public.invite_links where inviter = auth.uid();
  if v_code is null then
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    insert into public.invite_links (code, inviter) values (v_code, auth.uid());
  end if;
  return v_code;
end;
$$;

-- Répond par le nom de l'inviteur une fois l'amitié faite, null sinon (code
-- inconnu, soi-même, blocage, compte anonyme). Rejouer un code déjà
-- encaissé ne change rien.
create function public.accept_invite(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_inviter uuid;
begin
  if not public.is_named_account() then
    return null;
  end if;
  select inviter into v_inviter from public.invite_links where code = p_code;
  if v_inviter is null or v_inviter = auth.uid() then
    return null;
  end if;
  if exists (
    select 1 from public.blocks
     where (blocker = v_inviter and blocked = auth.uid()) or (blocker = auth.uid() and blocked = v_inviter)
  ) then
    return null;
  end if;
  delete from public.friendships where requester = auth.uid() and addressee = v_inviter;
  insert into public.friendships (requester, addressee, status)
  values (v_inviter, auth.uid(), 'accepted')
  on conflict (requester, addressee) do update set status = 'accepted';
  return (select display_name from public.profiles where id = v_inviter);
end;
$$;

revoke execute on function public.my_invite_code(), public.accept_invite(text) from public, anon;
grant execute on function public.my_invite_code(), public.accept_invite(text) to authenticated;
