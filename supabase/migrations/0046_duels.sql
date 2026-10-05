-- Le duel en direct, en ligne : deux à quatre joueurs à une table, chacun son
-- tour. Le serveur ne joue pas : il tient la table, ses places, ses
-- invitations, et un journal ordonné de coups (`duel_moves`) daté par son
-- horloge. Chaque appareil rejoue ce journal par le domaine (`src/domain/duelLog.ts`),
-- déterministe à graine et heures égales : tous voient la même partie.
--
-- Pas de Realtime : le client n'en embarque pas (`src/lib/supabase.ts`). Les
-- appareils d'une table relisent `duel_sync` plusieurs fois par seconde, et
-- deux coups concurrents se départagent par leur numéro (`seq`) : le second
-- répond `stale`, relit et rejoue.
--
-- Le serveur fait confiance aux joueurs assis pour la règle — qui a la main,
-- quel mot est juste : il n'a ni dictionnaire ni domaine. Il vérifie en
-- revanche qui parle : un mot ou un passe d'un joueur ne vient que de lui ; un
-- choix forcé, le coup d'un joueur maison ou le temps écoulé d'un absent, de
-- n'importe quel joueur assis — c'est le meneur de la table qui les déclare.

create table public.duel_tables (
  id uuid primary key default gen_random_uuid(),
  host uuid not null references public.profiles on delete cascade,
  lang text not null check (lang ~ '^[a-z]{2}$'),
  seed bigint not null,
  -- Le vivier du draft, celui de l'hôte : identique pour tous les appareils.
  categories text[] not null check (cardinality(categories) between 1 and 60),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'over', 'closed')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  rematch_of uuid references public.duel_tables on delete set null,
  rematch uuid references public.duel_tables on delete set null
);

create table public.duel_seats (
  table_id uuid not null references public.duel_tables on delete cascade,
  player uuid not null references public.profiles on delete cascade,
  is_bot boolean not null default false,
  -- La taille de son catalogue : le plus petit ouvre le draft.
  owned smallint not null default 0 check (owned >= 0),
  ready boolean not null default false,
  -- La place à table, numérotée au lancement dans l'ordre d'arrivée.
  seat smallint check (seat between 0 and 3),
  joined_at timestamptz not null default clock_timestamp(),
  left_at timestamptz,
  kicked_at timestamptz,
  last_seen timestamptz not null default now(),
  primary key (table_id, player)
);

create table public.duel_invites (
  table_id uuid not null references public.duel_tables on delete cascade,
  invitee uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  primary key (table_id, invitee)
);

create index duel_invites_invitee_idx on public.duel_invites (invitee) where answered_at is null;

create table public.duel_moves (
  table_id uuid not null references public.duel_tables on delete cascade,
  seq integer not null check (seq >= 1),
  seat smallint not null check (seat between 0 and 3),
  kind text not null check (kind in ('pick', 'word', 'pass', 'timeout')),
  payload text not null default '' check (char_length(payload) <= 80),
  at timestamptz not null default clock_timestamp(),
  by uuid references public.profiles on delete set null,
  primary key (table_id, seq)
);

-- Aucune politique : tout passe par les fonctions ci-dessous.
alter table public.duel_tables enable row level security;
alter table public.duel_seats enable row level security;
alter table public.duel_invites enable row level security;
alter table public.duel_moves enable row level security;

-- Une invitation vaut un quart d'heure : au-delà, la table est oubliée.
create function public.duel_lobby_open(p_table public.duel_tables) returns boolean
language sql stable as $$
  select p_table.status = 'lobby' and p_table.created_at > now() - interval '15 minutes';
$$;

-- Les places encore occupées : ni parties, ni expulsées.
create function public.duel_active_seats(p_table uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.duel_seats
   where table_id = p_table and left_at is null and kicked_at is null;
$$;

create function public.duel_seated(p_table uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.duel_seats
     where table_id = p_table and player = auth.uid() and left_at is null and kicked_at is null
  );
$$;

-- --------------------------------------------------------------- salon --

-- Ouvre une table dont l'appelant est l'hôte, assis mais pas prêt.
create function public.duel_create(p_lang text, p_categories text[], p_owned integer) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not public.is_named_account() then
    raise exception 'named account required' using errcode = '42501';
  end if;
  if p_lang !~ '^[a-z]{2}$' or coalesce(cardinality(p_categories), 0) not between 1 and 60 then
    raise exception 'invalid table' using errcode = '22023';
  end if;

  insert into public.duel_tables (host, lang, seed, categories)
  values (auth.uid(), p_lang, floor(random() * 4294967295)::bigint, p_categories)
  returning id into v_id;
  insert into public.duel_seats (table_id, player, owned)
  values (v_id, auth.uid(), greatest(0, least(coalesce(p_owned, 0), 999)));
  return v_id;
end;
$$;

-- Qui l'hôte peut inviter : ses amis, et les joueurs maison, qui s'assoient
-- aussitôt invités.
create function public.duel_candidates()
returns table (id uuid, display_name text, avatar jsonb, bot boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar, false
    from public.friendships f
    join public.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
   where auth.uid() in (f.requester, f.addressee) and f.status = 'accepted'
     and not exists (select 1 from public.bots b where b.id = p.id)
  union all
  select p.id, p.display_name, p.avatar, true
    from public.bots b join public.profiles p on p.id = b.id
   where auth.uid() is not null
   order by 4 desc, 2;
$$;

-- 'sent' (invitation écrite, ou tue pour un joueur qui a bloqué l'hôte),
-- 'seated' (un joueur maison s'assoit), 'full', 'closed', 'forbidden'.
create function public.duel_invite(p_table uuid, p_player uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
begin
  select * into v_table from public.duel_tables where id = p_table for update;
  if not found or v_table.host <> auth.uid() then
    return 'forbidden';
  end if;
  if not public.duel_lobby_open(v_table) then
    return 'closed';
  end if;
  if p_player = auth.uid() or exists (
    select 1 from public.duel_seats where table_id = p_table and player = p_player and left_at is null and kicked_at is null
  ) then
    return 'seated';
  end if;
  if public.duel_active_seats(p_table) >= 4 then
    return 'full';
  end if;

  if exists (select 1 from public.bots where id = p_player) then
    insert into public.duel_seats (table_id, player, is_bot, owned, ready)
    values (p_table, p_player, true, 0, true)
    on conflict (table_id, player) do update
      set left_at = null, kicked_at = null, ready = true, joined_at = clock_timestamp();
    return 'seated';
  end if;

  if not exists (
    select 1 from public.friendships f
     where f.status = 'accepted'
       and ((f.requester = auth.uid() and f.addressee = p_player) or (f.addressee = auth.uid() and f.requester = p_player))
  ) then
    return 'forbidden';
  end if;
  -- Un blocage ne se dit jamais au bloqué (0014) : l'hôte lit 'sent'.
  if exists (select 1 from public.blocks where (blocker = p_player and blocked = auth.uid()) or (blocker = auth.uid() and blocked = p_player)) then
    return 'sent';
  end if;

  insert into public.duel_invites (table_id, invitee) values (p_table, p_player)
  on conflict (table_id, invitee) do update set created_at = now(), answered_at = null;
  return 'sent';
end;
$$;

-- Les invitations qui m'attendent, la plus récente d'abord.
create function public.duel_my_invites()
returns table (table_id uuid, host_name text, host_avatar jsonb, players integer, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, p.display_name, p.avatar, public.duel_active_seats(t.id), i.created_at
    from public.duel_invites i
    join public.duel_tables t on t.id = i.table_id
    join public.profiles p on p.id = t.host
   where i.invitee = auth.uid() and i.answered_at is null and public.duel_lobby_open(t)
     and not exists (select 1 from public.duel_seats s where s.table_id = t.id and s.player = auth.uid())
   order by i.created_at desc;
$$;

-- 'joined', 'full', 'closed', 'kicked', 'forbidden' (pas d'invitation).
create function public.duel_join(p_table uuid, p_owned integer) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
  v_seat public.duel_seats;
begin
  if not public.is_named_account() then
    return 'forbidden';
  end if;
  select * into v_table from public.duel_tables where id = p_table for update;
  if not found then
    return 'closed';
  end if;
  select * into v_seat from public.duel_seats where table_id = p_table and player = auth.uid();
  if found and v_seat.kicked_at is not null then
    return 'kicked';
  end if;
  if found and v_seat.left_at is null then
    return 'joined';
  end if;
  if not public.duel_lobby_open(v_table) then
    return 'closed';
  end if;
  if not found and not exists (select 1 from public.duel_invites where table_id = p_table and invitee = auth.uid()) then
    return 'forbidden';
  end if;
  if public.duel_active_seats(p_table) >= 4 then
    return 'full';
  end if;

  insert into public.duel_seats (table_id, player, owned)
  values (p_table, auth.uid(), greatest(0, least(coalesce(p_owned, 0), 999)))
  on conflict (table_id, player) do update
    set left_at = null, ready = false, joined_at = clock_timestamp(), owned = excluded.owned;
  update public.duel_invites set answered_at = now() where table_id = p_table and invitee = auth.uid();
  return 'joined';
end;
$$;

create function public.duel_decline(p_table uuid) returns void
language sql security definer set search_path = public as $$
  update public.duel_invites set answered_at = now()
   where table_id = p_table and invitee = auth.uid() and answered_at is null;
$$;

-- Se déclarer prêt, ou ne plus l'être. Le dernier « prêt » d'une table d'au
-- moins deux joueurs la lance : places numérotées dans l'ordre d'arrivée,
-- invitations en suspens closes. Répond 'waiting', 'started' ou 'closed'.
create function public.duel_ready(p_table uuid, p_ready boolean) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
begin
  select * into v_table from public.duel_tables where id = p_table for update;
  if not found or not public.duel_seated(p_table) then
    return 'closed';
  end if;
  if v_table.status <> 'lobby' then
    return case when v_table.status = 'playing' then 'started' else 'closed' end;
  end if;

  update public.duel_seats set ready = coalesce(p_ready, false), last_seen = now()
   where table_id = p_table and player = auth.uid();

  if public.duel_active_seats(p_table) >= 2 and not exists (
    select 1 from public.duel_seats where table_id = p_table and left_at is null and kicked_at is null and not ready
  ) then
    update public.duel_seats s set seat = numbered.place
      from (
        select player, (row_number() over (order by joined_at, player) - 1)::smallint as place
          from public.duel_seats where table_id = p_table and left_at is null and kicked_at is null
      ) numbered
     where s.table_id = p_table and s.player = numbered.player;
    update public.duel_tables set status = 'playing', started_at = clock_timestamp() where id = p_table;
    update public.duel_invites set answered_at = now() where table_id = p_table and answered_at is null;
    return 'started';
  end if;
  return 'waiting';
end;
$$;

-- L'hôte retire quelqu'un du salon : un joueur assis (qui l'apprend à sa
-- prochaine lecture), un joueur maison, ou une invitation en suspens.
create function public.duel_kick(p_table uuid, p_player uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
begin
  select * into v_table from public.duel_tables where id = p_table for update;
  if not found or v_table.host <> auth.uid() or p_player = auth.uid() then
    return 'forbidden';
  end if;
  if v_table.status <> 'lobby' then
    return 'closed';
  end if;
  update public.duel_seats set kicked_at = now(), ready = false
   where table_id = p_table and player = p_player and kicked_at is null;
  delete from public.duel_invites where table_id = p_table and invitee = p_player;
  -- Ceux qui restent se redéclarent prêts : la table a changé sous eux.
  update public.duel_seats set ready = false
   where table_id = p_table and not is_bot and left_at is null and kicked_at is null;
  return 'kicked';
end;
$$;

-- Quitter : au salon, l'hôte ferme la table ; un invité libère sa place. En
-- partie, la place reste — la réserve du parti coule jusqu'à sa mort.
create function public.duel_leave(p_table uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
begin
  select * into v_table from public.duel_tables where id = p_table for update;
  if not found then
    return;
  end if;
  update public.duel_seats set left_at = now(), ready = false
   where table_id = p_table and player = auth.uid() and left_at is null;
  if v_table.status = 'lobby' and v_table.host = auth.uid() then
    update public.duel_tables set status = 'closed' where id = p_table;
  elsif v_table.status = 'lobby' then
    update public.duel_seats set ready = false
     where table_id = p_table and not is_bot and left_at is null and kicked_at is null;
  end if;
end;
$$;

-- -------------------------------------------------------------- partie --

-- Un coup, au numéro attendu. 'ok', 'stale' (un autre coup a pris ce numéro :
-- relire et rejouer), 'closed' ou 'forbidden'.
create function public.duel_move(p_table uuid, p_seq integer, p_seat integer, p_kind text, p_payload text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
  v_seat public.duel_seats;
  v_last integer;
begin
  select * into v_table from public.duel_tables where id = p_table;
  if not found or not public.duel_seated(p_table) then
    return 'forbidden';
  end if;
  if v_table.status <> 'playing' then
    return 'closed';
  end if;
  if p_kind not in ('pick', 'word', 'pass', 'timeout') or char_length(coalesce(p_payload, '')) > 80 then
    return 'forbidden';
  end if;
  select * into v_seat from public.duel_seats where table_id = p_table and seat = p_seat;
  if not found then
    return 'forbidden';
  end if;
  -- Un mot ou un passe d'un joueur ne vient que de lui.
  if p_kind in ('word', 'pass') and not v_seat.is_bot and v_seat.player <> auth.uid() then
    return 'forbidden';
  end if;

  select coalesce(max(seq), 0) into v_last from public.duel_moves where table_id = p_table;
  if p_seq <> v_last + 1 then
    return 'stale';
  end if;
  begin
    insert into public.duel_moves (table_id, seq, seat, kind, payload, by)
    values (p_table, p_seq, p_seat, p_kind, coalesce(p_payload, ''), auth.uid());
  exception when unique_violation then
    return 'stale';
  end;
  update public.duel_seats set last_seen = now() where table_id = p_table and player = auth.uid();
  return 'ok';
end;
$$;

-- La partie rejouée est finie : la table ne se relit plus qu'au ralenti.
create function public.duel_finish(p_table uuid) returns void
language sql security definer set search_path = public as $$
  update public.duel_tables set status = 'over'
   where id = p_table and status = 'playing' and public.duel_seated(p_table);
$$;

-- Tout ce qu'un appareil assis — ou expulsé, pour l'apprendre — lit de sa
-- table : l'heure du serveur, la table, les places, les invitations en
-- suspens (pour l'hôte) et les coups après `p_after`.
create function public.duel_sync(p_table uuid, p_after integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
begin
  select * into v_table from public.duel_tables where id = p_table;
  if not found or not exists (select 1 from public.duel_seats where table_id = p_table and player = auth.uid()) then
    return null;
  end if;
  update public.duel_seats set last_seen = now()
   where table_id = p_table and player = auth.uid() and left_at is null and kicked_at is null;

  return jsonb_build_object(
    'now', extract(epoch from clock_timestamp()),
    'table', jsonb_build_object(
      'id', v_table.id,
      'host', v_table.host,
      'lang', v_table.lang,
      'seed', v_table.seed,
      'categories', to_jsonb(v_table.categories),
      'status', case when v_table.status = 'lobby' and not public.duel_lobby_open(v_table) then 'closed' else v_table.status end,
      'started_at', extract(epoch from v_table.started_at),
      'rematch', v_table.rematch
    ),
    'seats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player', s.player,
        'name', p.display_name,
        'avatar', p.avatar,
        'bot', s.is_bot,
        'owned', s.owned,
        'ready', s.ready,
        'seat', s.seat,
        'left', s.left_at is not null,
        'kicked', s.kicked_at is not null,
        'seen', extract(epoch from s.last_seen)
      ) order by s.joined_at, s.player)
        from public.duel_seats s join public.profiles p on p.id = s.player
       where s.table_id = p_table
    ), '[]'::jsonb),
    'invites', case when v_table.host = auth.uid() then coalesce((
      select jsonb_agg(jsonb_build_object('player', i.invitee, 'name', p.display_name, 'avatar', p.avatar) order by i.created_at)
        from public.duel_invites i join public.profiles p on p.id = i.invitee
       where i.table_id = p_table and i.answered_at is null
    ), '[]'::jsonb) else '[]'::jsonb end,
    'moves', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seq', m.seq, 'seat', m.seat, 'kind', m.kind, 'payload', m.payload, 'at', extract(epoch from m.at)
      ) order by m.seq)
        from public.duel_moves m where m.table_id = p_table and m.seq > coalesce(p_after, 0)
    ), '[]'::jsonb)
  );
end;
$$;

-- La revanche : une table neuve, une seule par table finie. Les joueurs
-- maison s'y rassoient, les autres y sont invités ; qui l'ouvre en est l'hôte.
create function public.duel_rematch(p_table uuid, p_owned integer) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
  v_id uuid;
begin
  select * into v_table from public.duel_tables where id = p_table for update;
  if not found or not exists (
    select 1 from public.duel_seats where table_id = p_table and player = auth.uid() and kicked_at is null
  ) then
    raise exception 'not at this table' using errcode = '42501';
  end if;
  if v_table.rematch is not null then
    return v_table.rematch;
  end if;

  insert into public.duel_tables (host, lang, seed, categories, rematch_of)
  values (auth.uid(), v_table.lang, floor(random() * 4294967295)::bigint, v_table.categories, p_table)
  returning id into v_id;
  insert into public.duel_seats (table_id, player, owned)
  values (v_id, auth.uid(), greatest(0, least(coalesce(p_owned, 0), 999)));
  insert into public.duel_seats (table_id, player, is_bot, ready)
  select v_id, s.player, true, true
    from public.duel_seats s
   where s.table_id = p_table and s.is_bot and s.kicked_at is null;
  insert into public.duel_invites (table_id, invitee)
  select v_id, s.player
    from public.duel_seats s
   where s.table_id = p_table and not s.is_bot and s.kicked_at is null and s.player <> auth.uid();
  update public.duel_tables set rematch = v_id where id = p_table;
  return v_id;
end;
$$;

revoke execute on function
  public.duel_lobby_open(public.duel_tables),
  public.duel_active_seats(uuid),
  public.duel_seated(uuid)
  from public, anon, authenticated;

revoke execute on function
  public.duel_create(text, text[], integer),
  public.duel_candidates(),
  public.duel_invite(uuid, uuid),
  public.duel_my_invites(),
  public.duel_join(uuid, integer),
  public.duel_decline(uuid),
  public.duel_ready(uuid, boolean),
  public.duel_kick(uuid, uuid),
  public.duel_leave(uuid),
  public.duel_move(uuid, integer, integer, text, text),
  public.duel_finish(uuid),
  public.duel_sync(uuid, integer),
  public.duel_rematch(uuid, integer)
  from public, anon;

grant execute on function
  public.duel_create(text, text[], integer),
  public.duel_candidates(),
  public.duel_invite(uuid, uuid),
  public.duel_my_invites(),
  public.duel_join(uuid, integer),
  public.duel_decline(uuid),
  public.duel_ready(uuid, boolean),
  public.duel_kick(uuid, uuid),
  public.duel_leave(uuid),
  public.duel_move(uuid, integer, integer, text, text),
  public.duel_finish(uuid),
  public.duel_sync(uuid, integer),
  public.duel_rematch(uuid, integer)
  to authenticated;
