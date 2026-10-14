-- Deux choses pour toutes les versions du jeu, qui partagent ce serveur :
--
-- 1. D'où vient une donnée. Le client dit déjà sa version dans `X-Client-Info`
--    (`platform=android`, `web`, `crazygames`, `reddit`) ; un déclencheur la
--    range sur chaque partie et chaque table de duel, sans changer aucune
--    signature, pour qu'on puisse un jour séparer les versions. Une ligne
--    écrite par un client plus ancien reste `null`.
--
-- 2. Le matchmaking du duel : un joueur nommé se met en file, le suivant de
--    sa langue l'apparie. Le serveur ouvre alors la table (l'hôte est celui
--    qui attendait), assoit les deux, et chacun la trouve à sa prochaine
--    lecture ; les deux déclarent « prêt » eux-mêmes, comme à une table
--    d'amis. Un joueur qui ne relit plus la file (`seen_at` vieux de 20 s) en
--    sort, et un joueur bloqué par l'autre ne lui est jamais apparié.

-- ------------------------------------------------------------ plateforme --

create function public.client_platform() returns text
language sql stable as $$
  select substring(
    coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-client-info', '')
    from 'platform=(android|web|crazygames|reddit)'
  );
$$;

alter table public.runs add column platform text check (platform in ('android', 'web', 'crazygames', 'reddit'));
alter table public.duel_tables add column platform text check (platform in ('android', 'web', 'crazygames', 'reddit'));

create function public.tag_platform() returns trigger
language plpgsql as $$
begin
  new.platform := coalesce(new.platform, public.client_platform());
  return new;
end;
$$;

create trigger runs_tag_platform before insert on public.runs
  for each row execute function public.tag_platform();
create trigger duel_tables_tag_platform before insert on public.duel_tables
  for each row execute function public.tag_platform();

-- ----------------------------------------------------------- matchmaking --

create table public.duel_queue (
  player uuid primary key references public.profiles on delete cascade,
  lang text not null check (lang ~ '^[a-z]{2}$'),
  owned smallint not null default 0 check (owned >= 0),
  -- Le vivier du draft, celui de ce joueur : s'il est l'hôte de la table, c'est lui.
  categories text[] not null check (cardinality(categories) between 1 and 60),
  joined_at timestamptz not null default now(),
  seen_at timestamptz not null default now(),
  -- Posée par celui qui l'apparie : la table qui attend ce joueur.
  table_id uuid references public.duel_tables on delete set null
);

create index duel_queue_waiting_idx on public.duel_queue (lang, joined_at) where table_id is null;

alter table public.duel_queue enable row level security;
-- Aucune politique : tout passe par les fonctions ci-dessous.

-- Une lecture par joueur toutes les deux secondes ; au-delà de vingt, il est parti.
create function public.duel_queue_patience() returns interval
language sql immutable as $$ select interval '20 seconds' $$;

-- Se mettre en file, ou relire sa place. Répond
--   {"status": "waiting"}                      tant que personne n'est là,
--   {"status": "matched", "table": "<uuid>"}   une fois apparié, une seule fois.
create function public.duel_matchmake(p_lang text, p_categories text[], p_owned integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me public.duel_queue;
  v_other public.duel_queue;
  v_table uuid;
begin
  if not public.is_named_account() then
    raise exception 'named account required' using errcode = '42501';
  end if;
  if p_lang !~ '^[a-z]{2}$' or coalesce(cardinality(p_categories), 0) not between 1 and 60 then
    raise exception 'invalid queue entry' using errcode = '22023';
  end if;

  -- Les absents quittent la file ; les appariements lus depuis longtemps s'effacent.
  delete from public.duel_queue
   where (table_id is null and seen_at < now() - public.duel_queue_patience())
      or (table_id is not null and seen_at < now() - interval '2 minutes');

  select * into v_me from public.duel_queue where player = auth.uid() for update;
  if found and v_me.table_id is not null then
    delete from public.duel_queue where player = auth.uid();
    if exists (select 1 from public.duel_tables t where t.id = v_me.table_id and public.duel_lobby_open(t)) then
      return jsonb_build_object('status', 'matched', 'table', v_me.table_id);
    end if;
  end if;

  select * into v_other from public.duel_queue q
   where q.table_id is null and q.player <> auth.uid() and q.lang = p_lang
     and not exists (
       select 1 from public.blocks b
        where (b.blocker = auth.uid() and b.blocked = q.player) or (b.blocker = q.player and b.blocked = auth.uid())
     )
   order by q.joined_at
   limit 1
   for update skip locked;

  if not found then
    insert into public.duel_queue (player, lang, owned, categories)
    values (auth.uid(), p_lang, greatest(0, least(coalesce(p_owned, 0), 999)), p_categories)
    on conflict (player) do update
      set lang = excluded.lang, owned = excluded.owned, categories = excluded.categories,
          seen_at = now(), table_id = null;
    return jsonb_build_object('status', 'waiting');
  end if;

  -- L'hôte est celui qui attendait ; les deux sont assis, pas prêts.
  insert into public.duel_tables (host, lang, seed, categories)
  values (v_other.player, v_other.lang, floor(random() * 4294967295)::bigint, v_other.categories)
  returning id into v_table;
  insert into public.duel_seats (table_id, player, owned, joined_at)
  values (v_table, v_other.player, v_other.owned, clock_timestamp()),
         (v_table, auth.uid(), greatest(0, least(coalesce(p_owned, 0), 999)), clock_timestamp() + interval '1 millisecond');
  update public.duel_queue set table_id = v_table, seen_at = now() where player = v_other.player;
  delete from public.duel_queue where player = auth.uid();
  return jsonb_build_object('status', 'matched', 'table', v_table);
end;
$$;

-- Quitter la file avant d'être apparié ; sans effet une fois la table ouverte.
create function public.duel_matchmake_cancel() returns void
language sql security definer set search_path = public as $$
  delete from public.duel_queue where player = auth.uid() and table_id is null;
$$;

revoke execute on function
  public.client_platform(),
  public.tag_platform(),
  public.duel_queue_patience(),
  public.duel_matchmake(text, text[], integer),
  public.duel_matchmake_cancel()
  from public, anon;

grant execute on function
  public.duel_matchmake(text, text[], integer),
  public.duel_matchmake_cancel()
  to authenticated;
