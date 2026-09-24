-- Notifications push des défis, app fermée : une invitation reçue, un bilan
-- prêt.
--
-- La base ne parle pas à Firebase elle-même. Elle écrit ce qu'il faut envoyer
-- dans `push_outbox`, puis réveille la fonction Edge `push` (pg_net), qui lit
-- la file, envoie par FCM et marque ce qui est parti. Chaque minute,
-- pg_cron repasse : un réveil perdu ne retarde un push que d'une minute.
--
-- Rien ici ne doit pouvoir faire échouer une partie : tout ce qui touche au
-- réseau avale ses erreurs. Sans secrets dans le Vault (`push_url`,
-- `push_secret`), la file se remplit et attend, sans bruit.

create extension if not exists pg_net with schema extensions;

-- Un appareil par jeton. Le jeton suit le compte qui s'y est connecté en
-- dernier : deux joueurs sur un même téléphone ne reçoivent que les pushs du
-- second. `lang` choisit la langue du message.
create table public.push_tokens (
  token text primary key,
  player_id uuid not null references public.profiles on delete cascade,
  lang text not null default 'fr' check (lang ~ '^[a-z]{2}$'),
  platform text not null default 'android' check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);

create index push_tokens_player_idx on public.push_tokens (player_id);

create table public.push_outbox (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('invite', 'recap')),
  challenge_id uuid not null references public.challenges on delete cascade,
  created_at timestamptz not null default now(),
  -- Pris par un envoi en cours ; repris par le suivant s'il n'a pas abouti.
  claimed_at timestamptz,
  attempts integer not null default 0,
  sent_at timestamptz
);

create index push_outbox_pending_idx on public.push_outbox (id) where sent_at is null;

-- Le bilan d'un défi ne s'annonce qu'une fois.
alter table public.challenges add column recap_queued_at timestamptz;
-- Les défis déjà clos ne sonnent pas le jour où la migration passe.
update public.challenges set recap_queued_at = now() where public.challenge_finished(id);

alter table public.push_tokens enable row level security;
alter table public.push_outbox enable row level security;
-- Aucune politique : tout passe par les fonctions ci-dessous.

-- ------------------------------------------------------------- jetons --

create function public.save_push_token(p_token text, p_platform text, p_lang text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or length(p_token) not between 20 and 4096 then
    return false;
  end if;
  insert into public.push_tokens (token, player_id, lang, platform)
  values (p_token, auth.uid(), coalesce(nullif(p_lang, ''), 'fr'), p_platform)
  on conflict (token) do update
    set player_id = excluded.player_id, lang = excluded.lang, platform = excluded.platform, updated_at = now();
  return true;
end;
$$;

-- À la déconnexion : le téléphone ne parle plus au nom de ce compte.
create function public.forget_push_token(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_tokens where token = p_token and player_id = auth.uid();
$$;

-- -------------------------------------------------------------- file --

-- Réveille la fonction Edge s'il y a de quoi envoyer. Jamais d'erreur : sans
-- Vault, sans pg_net ou sans secrets, la file attend la prochaine passe.
create function public.kick_push() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.push_outbox where sent_at is null and attempts < 5) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body := '{}'::jsonb
  );
exception when others then
  null;
end;
$$;

-- Les bilans prêts : défis clos depuis la dernière passe, annoncés à ceux
-- qui ont joué. Seuls les défis des quatre derniers jours sont relus.
create function public.queue_recaps(p_challenge uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  for v_id in
    select c.id from public.challenges c
     where c.recap_queued_at is null
       and c.created_at > now() - interval '4 days'
       and (p_challenge is null or c.id = p_challenge)
       for update skip locked
  loop
    if public.challenge_finished(v_id) then
      update public.challenges set recap_queued_at = now() where id = v_id;
      insert into public.push_outbox (player_id, kind, challenge_id)
      select player_id, 'recap', v_id
        from public.challenge_players
       where challenge_id = v_id and played_at is not null;
    end if;
  end loop;
end;
$$;

-- Un invité qui n'a pas encore vu son invitation : le chef, lui, a lancé le
-- défi et n'a rien à apprendre.
create function public.queue_invite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.seen_invite_at is null then
    insert into public.push_outbox (player_id, kind, challenge_id) values (new.player_id, 'invite', new.challenge_id);
  end if;
  return new;
end;
$$;

create trigger challenge_players_push_invite
  after insert on public.challenge_players
  for each row execute function public.queue_invite();

-- La dernière partie d'un défi le clôt : son bilan part aussitôt.
create function public.queue_recap_on_play() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.queue_recaps(new.challenge_id);
  return new;
exception when others then
  return new;
end;
$$;

create trigger challenge_players_push_recap
  after update of played_at on public.challenge_players
  for each row when (new.played_at is not null and old.played_at is null)
  execute function public.queue_recap_on_play();

create function public.kick_push_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.kick_push();
  return null;
end;
$$;

create trigger push_outbox_kick
  after insert on public.push_outbox
  for each statement execute function public.kick_push_trigger();

-- Ce que la fonction Edge envoie : une ligne par message et par appareil,
-- avec de quoi l'écrire dans la langue de l'appareil. Une ligne sans jeton
-- (le joueur n'a pas de téléphone inscrit) revient aussi, pour être close.
create function public.claim_push_batch(p_limit integer default 200)
returns table (id bigint, kind text, challenge_id uuid, token text, lang text, owner_name text, players integer)
language plpgsql security definer set search_path = public as $$
begin
  return query
    with claimed as (
      update public.push_outbox o
         set claimed_at = now(), attempts = o.attempts + 1
       where o.id in (
         select q.id from public.push_outbox q
          where q.sent_at is null
            and q.attempts < 5
            and (q.claimed_at is null or q.claimed_at < now() - interval '2 minutes')
          order by q.id
          limit p_limit
          for update skip locked
       )
      returning o.id, o.kind, o.challenge_id, o.player_id
    )
    select c.id, c.kind, c.challenge_id, t.token, coalesce(t.lang, 'fr'),
           coalesce(p.display_name, ''),
           (select count(*) from public.challenge_players a where a.challenge_id = c.challenge_id)::integer
      from claimed c
      join public.challenges ch on ch.id = c.challenge_id
      left join public.profiles p on p.id = ch.owner
      left join public.push_tokens t on t.player_id = c.player_id;
end;
$$;

-- `p_sent` : les messages partis (ou sans appareil), `p_dead` : les jetons
-- que FCM ne connaît plus, effacés pour ne plus y écrire.
create function public.finish_push_batch(p_sent bigint[], p_dead text[]) returns void
language sql security definer set search_path = public as $$
  update public.push_outbox set sent_at = now() where id = any(p_sent);
  delete from public.push_tokens where token = any(p_dead);
$$;

-- La passe de secours : bilans échus par l'horloge, réveils perdus.
create function public.push_tick() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.queue_recaps();
  perform public.kick_push();
end;
$$;

select cron.schedule('push-challenges', '* * * * *', 'select public.push_tick()');

revoke execute on function
  public.kick_push(),
  public.queue_recaps(uuid),
  public.queue_invite(),
  public.queue_recap_on_play(),
  public.kick_push_trigger(),
  public.claim_push_batch(integer),
  public.finish_push_batch(bigint[], text[]),
  public.push_tick()
  from public, anon, authenticated;
grant execute on function public.claim_push_batch(integer), public.finish_push_batch(bigint[], text[]) to service_role;

revoke execute on function public.save_push_token(text, text, text), public.forget_push_token(text) from public, anon;
grant execute on function public.save_push_token(text, text, text), public.forget_push_token(text) to authenticated;
