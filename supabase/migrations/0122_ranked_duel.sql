-- Le duel classé : une file qui dit combien on attendra, une confirmation
-- avant de s'asseoir, un classement Elo, et des abandons qui ne font plus
-- attendre personne.
--
-- 1. La file se raconte (`duel_queue_log`) : une ligne par passage, de l'entrée
--    à l'appariement, au départ ou à l'expiration. C'est d'elle que se tire
--    l'attente estimée (`duel_wait_estimate`) — la médiane des appariements de
--    la langue sur deux heures, sinon de la même heure sur quatorze jours.
--
-- 2. Un appariement n'assoit plus d'office : il propose (`duel_queue_poll`
--    répond `found`), et chacun a `duel_offer_seconds()` pour accepter
--    (`duel_offer_answer`). Accepter, c'est le « prêt » du salon : le second
--    lance la table. Celui qui refuse sort de la file ; l'autre y revient à sa
--    place d'origine. Celui qui laisse passer le délai en sort aussi. Une
--    ligne occupée (`busy` : une partie seule en cours) reste dans la file
--    sans être appariée. `duel_matchmake` (0072, 0097), celui des versions
--    déjà livrées, reste tel quel : il assoit sans demander, sur une table
--    non classée, et ses lignes cohabitent avec les nouvelles.
--
-- 3. L'Elo ne vaut que pour les tables classées : celles que la file ouvre, et
--    leurs revanches — jamais une table d'amis ni un joueur ordinateur. Le
--    serveur ne juge pas les mots, il ne sait donc pas qui a gagné : chaque
--    appareil rapporte l'ordre d'arrivée qu'il a rejoué (`duel_report`), et
--    `duel_settle` ne l'accepte que si les rapports concordent et si le
--    journal le soutient — chaque perdant y a un temps écoulé, un abandon ou
--    une place quittée, le gagnant aucun abandon. Un désaccord annule la
--    partie (`voided`) : un client trafiqué ne gagne rien, il prive au plus
--    la table de son classement. Paires de joueurs : trois parties classées
--    entre les deux mêmes comptes par 24 h, au-delà la partie ne compte plus.
--    Elo par paires, K 40 pendant dix parties puis 20, plancher 100. Le calcul
--    est aussi dans `src/domain/ranked.ts`, que l'écran lit pour annoncer
--    l'enjeu : les deux doivent rester identiques (supabase/tests/50_ranked_duel.sql).
--
-- 4. Abandonner (`duel_resign`) est un coup du journal, `resign` : le joueur
--    meurt tout de suite, au lieu de laisser couler sa réserve. Revenir après
--    une coupure (`duel_rejoin`) reprend sa place tant qu'on n'a pas abandonné.
--    Une table restée `playing` sans personne depuis trois minutes se ferme
--    à la lecture de la file suivante. Trois abandons de partie classée ou
--    propositions manquées en une heure valent cinq minutes hors de la file.

-- ------------------------------------------------------------ le classement --

create table public.duel_ratings (
  player uuid primary key references public.profiles on delete cascade,
  rating integer not null default 1000 check (rating >= 100),
  games integer not null default 0 check (games >= 0),
  wins integer not null default 0 check (wins >= 0),
  peak integer not null default 1000,
  updated_at timestamptz not null default now()
);

create index duel_ratings_ladder_idx on public.duel_ratings (rating desc) where games >= 5;

alter table public.duel_tables
  add column ranked boolean not null default false,
  add column finished_at timestamptz,
  add column settled_at timestamptz,
  add column voided boolean not null default false;

create index duel_tables_playing_idx on public.duel_tables (started_at) where status = 'playing';
create index duel_tables_unsettled_idx on public.duel_tables (finished_at) where ranked and settled_at is null;

-- Ce que chaque appareil a rejoué : les places, du gagnant au premier mort.
create table public.duel_reports (
  table_id uuid not null references public.duel_tables on delete cascade,
  reporter uuid not null references public.profiles on delete cascade,
  ranking smallint[] not null check (cardinality(ranking) between 2 and 4),
  at timestamptz not null default now(),
  primary key (table_id, reporter)
);

create table public.duel_rating_changes (
  table_id uuid not null references public.duel_tables on delete cascade,
  player uuid not null references public.profiles on delete cascade,
  place smallint not null,
  before integer not null,
  after integer not null,
  primary key (table_id, player)
);

create index duel_rating_changes_player_idx on public.duel_rating_changes (player);

alter table public.duel_ratings enable row level security;
alter table public.duel_reports enable row level security;
alter table public.duel_rating_changes enable row level security;
-- Aucune politique : tout passe par les fonctions ci-dessous.

-- ------------------------------------------------------------------ la file --

create table public.duel_queue_log (
  id bigint generated always as identity primary key,
  player uuid references public.profiles on delete set null,
  lang text not null,
  rating integer,
  platform text,
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  outcome text check (outcome in ('matched', 'cancelled', 'expired', 'declined', 'missed'))
);

create index duel_queue_log_waits_idx on public.duel_queue_log (lang, ended_at) where outcome = 'matched';
create index duel_queue_log_player_idx on public.duel_queue_log (player, ended_at);

alter table public.duel_queue_log enable row level security;

create trigger duel_queue_log_tag_platform before insert on public.duel_queue_log
  for each row execute function public.tag_platform();

alter table public.duel_queue
  add column log_id bigint references public.duel_queue_log on delete set null,
  add column rating integer not null default 1000,
  add column busy boolean not null default false,
  add column offered_at timestamptz;

alter table public.duel_moves drop constraint duel_moves_kind_check;
alter table public.duel_moves add constraint duel_moves_kind_check
  check (kind in ('pick', 'word', 'pass', 'timeout', 'cheer', 'resign'));

create index duel_moves_resign_idx on public.duel_moves (by, at) where kind = 'resign';

-- --------------------------------------------------------------- les règles --

-- Le temps qu'un joueur a pour accepter un adversaire trouvé.
create function public.duel_offer_seconds() returns integer
language sql immutable as $$ select 20 $$;

-- L'écart d'Elo qu'on accepte après tant de secondes d'attente : il s'élargit
-- vite, la file est trop courte pour qu'on attende un adversaire parfait.
create function public.duel_rating_window(p_seconds numeric) returns integer
language sql immutable as $$
  select case when coalesce(p_seconds, 0) >= 30 then 100000 else 100 + 50 * floor(greatest(coalesce(p_seconds, 0), 0) / 5)::int end
$$;

create function public.duel_k_factor(p_games integer) returns integer
language sql immutable as $$ select case when coalesce(p_games, 0) < 10 then 40 else 20 end $$;

-- L'attente probable d'une langue, en secondes, ou null faute d'exemples.
create function public.duel_wait_estimate(p_lang text) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare
  v_samples integer;
  v_median numeric;
  v_hour integer := extract(hour from now() at time zone 'Europe/Paris');
begin
  select count(*), percentile_cont(0.5) within group (order by extract(epoch from ended_at - joined_at))
    into v_samples, v_median
    from public.duel_queue_log
   where lang = p_lang and outcome = 'matched' and ended_at > now() - interval '2 hours';
  if v_samples >= 5 then
    return round(v_median);
  end if;
  select count(*), percentile_cont(0.5) within group (order by extract(epoch from ended_at - joined_at))
    into v_samples, v_median
    from public.duel_queue_log
   where lang = p_lang and outcome = 'matched' and ended_at > now() - interval '14 days'
     and abs(extract(hour from ended_at at time zone 'Europe/Paris') - v_hour) <= 1;
  if v_samples >= 5 then
    return round(v_median);
  end if;
  return null;
end;
$$;

-- La ligne de classement d'un joueur, créée à 1000 au premier besoin.
create function public.duel_rating_of(p_player uuid) returns public.duel_ratings
language plpgsql security definer set search_path = public as $$
declare
  v_row public.duel_ratings;
begin
  insert into public.duel_ratings (player) values (p_player) on conflict (player) do nothing;
  select * into v_row from public.duel_ratings where player = p_player;
  return v_row;
end;
$$;

-- Ce qu'un joueur sait de lui : son Elo, ses parties, sa place au classement.
create function public.duel_rating_json(p_player uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'rating', coalesce(r.rating, 1000),
    'games', coalesce(r.games, 0),
    'wins', coalesce(r.wins, 0),
    'peak', coalesce(r.peak, 1000),
    'rank', case when coalesce(r.games, 0) >= 5 then (
      select count(*) + 1 from public.duel_ratings o where o.games >= 5 and o.rating > r.rating
    ) end
  )
  from (select p_player as player) me
  left join public.duel_ratings r on r.player = me.player;
$$;

-- Trois abandons de partie classée ou propositions laissées passer en une
-- heure : cinq minutes hors de la file, comptées depuis le dernier.
create function public.duel_cooldown_until(p_player uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  with strikes as (
    select ended_at as at from public.duel_queue_log
     where player = p_player and outcome = 'missed' and ended_at > now() - interval '1 hour'
    union all
    select m.at from public.duel_moves m join public.duel_tables t on t.id = m.table_id
     where m.by = p_player and m.kind = 'resign' and t.ranked and m.at > now() - interval '1 hour'
  )
  select case when count(*) >= 3 and max(at) + interval '5 minutes' > now() then max(at) + interval '5 minutes' end
    from strikes;
$$;

-- ------------------------------------------------------------- le règlement --

-- Ce que chaque place gagne ou perd : Elo par paires, l'écart divisé par le
-- nombre d'adversaires. `p_ratings` et `p_games` sont dans l'ordre d'arrivée.
create function public.duel_elo_deltas(p_ratings integer[], p_games integer[]) returns integer[]
language plpgsql immutable as $$
declare
  v_n integer := cardinality(p_ratings);
  v_sum numeric[] := array_fill(0::numeric, array[cardinality(p_ratings)]);
  v_expected numeric;
  v_out integer[] := '{}';
begin
  for i in 1 .. v_n loop
    for j in i + 1 .. v_n loop
      -- i a fini devant j.
      v_expected := 1 / (1 + power(10::numeric, (p_ratings[j] - p_ratings[i]) / 400.0));
      v_sum[i] := v_sum[i] + public.duel_k_factor(p_games[i]) * (1 - v_expected) / (v_n - 1);
      v_sum[j] := v_sum[j] - public.duel_k_factor(p_games[j]) * (1 - v_expected) / (v_n - 1);
    end loop;
  end loop;
  for i in 1 .. v_n loop
    v_out := v_out || round(v_sum[i])::integer;
  end loop;
  return v_out;
end;
$$;

-- Règle une table classée finie, une seule fois. Attend le rapport de chaque
-- joueur encore assis, ou trente secondes après la fin.
create function public.duel_settle(p_table uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
  v_seats integer;
  v_ranking smallint[];
  v_distinct integer;
  v_waiting integer;
  v_players uuid[] := '{}';
  v_ratings integer[] := '{}';
  v_games integer[] := '{}';
  v_deltas integer[];
  v_player uuid;
  v_row public.duel_ratings;
  v_valid boolean := true;
begin
  select * into v_table from public.duel_tables where id = p_table for update;
  if not found or not v_table.ranked or v_table.settled_at is not null or v_table.status not in ('over', 'closed') then
    return;
  end if;

  select count(*) into v_seats from public.duel_seats where table_id = p_table and seat is not null;
  -- Un joueur encore là dont le rapport manque : on l'attend, un temps.
  select count(*) into v_waiting
    from public.duel_seats s
   where s.table_id = p_table and s.seat is not null and not s.is_bot and s.player is not null
     and s.left_at is null and s.kicked_at is null
     and not exists (select 1 from public.duel_reports r where r.table_id = p_table and r.reporter = s.player)
     and not exists (select 1 from public.duel_moves m where m.table_id = p_table and m.seat = s.seat and m.kind = 'resign');
  if v_waiting > 0 and coalesce(v_table.finished_at, now()) > now() - interval '30 seconds' then
    return;
  end if;

  select count(distinct ranking) into v_distinct from public.duel_reports where table_id = p_table;
  if v_distinct = 0 then
    -- Personne n'a rien rapporté : rien à classer. La table ne s'attend plus
    -- qu'une heure, le temps qu'un appareil revenu rapporte.
    if coalesce(v_table.finished_at, v_table.started_at) < now() - interval '1 hour' then
      update public.duel_tables set settled_at = now(), voided = true where id = p_table;
    end if;
    return;
  end if;
  select ranking into v_ranking from public.duel_reports where table_id = p_table limit 1;

  -- Le rapport doit être une permutation des places, et le journal le soutenir.
  if v_distinct > 1 or cardinality(v_ranking) <> v_seats or v_seats < 2
     or (select count(distinct x) from unnest(v_ranking) x where x between 0 and v_seats - 1) <> v_seats then
    v_valid := false;
  end if;
  if v_valid and exists (
    select 1 from public.duel_moves m where m.table_id = p_table and m.seat = v_ranking[1] and m.kind = 'resign'
  ) then
    v_valid := false;
  end if;
  if v_valid and exists (
    select 1 from unnest(v_ranking[2:]) loser
     where not exists (select 1 from public.duel_moves m where m.table_id = p_table and m.seat = loser and m.kind in ('timeout', 'resign'))
       and not exists (
         select 1 from public.duel_seats s
          where s.table_id = p_table and s.seat = loser and (s.left_at is not null or s.player is null)
       )
  ) then
    v_valid := false;
  end if;

  if v_valid then
    for i in 1 .. v_seats loop
      select player into v_player from public.duel_seats where table_id = p_table and seat = v_ranking[i];
      if v_player is null or exists (select 1 from public.duel_seats where table_id = p_table and seat = v_ranking[i] and is_bot) then
        v_valid := false;
        exit;
      end if;
      v_players := v_players || v_player;
    end loop;
  end if;

  -- Les mêmes comptes, trois parties classées en un jour : la suivante ne compte plus.
  if v_valid and (
    select count(*) from public.duel_tables t
     where t.ranked and t.settled_at > now() - interval '24 hours' and not t.voided and t.id <> p_table
       and (select array_agg(player order by player) from public.duel_rating_changes c where c.table_id = t.id)
           = (select array_agg(p order by p) from unnest(v_players) p)
  ) >= 3 then
    v_valid := false;
  end if;

  if not v_valid then
    update public.duel_tables set settled_at = now(), voided = true where id = p_table;
    return;
  end if;

  -- Toujours dans le même ordre, pour que deux règlements simultanés ne se bloquent pas.
  perform 1 from public.duel_ratings where player = any(v_players) order by player for update;
  foreach v_player in array v_players loop
    v_row := public.duel_rating_of(v_player);
    v_ratings := v_ratings || v_row.rating;
    v_games := v_games || v_row.games;
  end loop;
  v_deltas := public.duel_elo_deltas(v_ratings, v_games);

  for i in 1 .. cardinality(v_players) loop
    update public.duel_ratings
       set rating = greatest(100, rating + v_deltas[i]),
           games = games + 1,
           wins = wins + case when i = 1 then 1 else 0 end,
           peak = greatest(peak, rating + v_deltas[i]),
           updated_at = now()
     where player = v_players[i];
    insert into public.duel_rating_changes (table_id, player, place, before, after)
    values (p_table, v_players[i], i, v_ratings[i], greatest(100, v_ratings[i] + v_deltas[i]));
  end loop;
  update public.duel_tables set settled_at = now() where id = p_table;
end;
$$;

-- La fin d'une partie, avec l'ordre d'arrivée que cet appareil a rejoué.
create function public.duel_report(p_table uuid, p_ranking integer[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.duel_seats where table_id = p_table and player = auth.uid() and kicked_at is null and seat is not null
  ) then
    return;
  end if;
  update public.duel_tables set status = 'over', finished_at = coalesce(finished_at, now())
   where id = p_table and status = 'playing';
  if coalesce(cardinality(p_ranking), 0) between 2 and 4 then
    insert into public.duel_reports (table_id, reporter, ranking)
    values (p_table, auth.uid(), p_ranking::smallint[])
    on conflict (table_id, reporter) do nothing;
  end if;
  perform public.duel_settle(p_table);
end;
$$;

-- L'ancienne fin, que les versions livrées appellent encore : elle date la fin.
create or replace function public.duel_finish(p_table uuid) returns void
language sql security definer set search_path = public as $$
  update public.duel_tables set status = 'over', finished_at = coalesce(finished_at, now())
   where id = p_table and status = 'playing' and public.duel_seated(p_table);
$$;

-- --------------------------------------------------------- les abandons --

-- Abandonner en partie : un coup `resign` au journal, puis la place quittée.
-- Au salon ou après la fin, c'est le départ ordinaire. Rend 'resigned' ou 'left'.
create function public.duel_resign(p_table uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
  v_seat public.duel_seats;
  v_last integer;
begin
  select * into v_table from public.duel_tables where id = p_table for update;
  if not found then
    return 'left';
  end if;
  select * into v_seat from public.duel_seats where table_id = p_table and player = auth.uid() and kicked_at is null;
  if not found or v_table.status <> 'playing' or v_seat.seat is null then
    perform public.duel_leave(p_table);
    return 'left';
  end if;
  if not exists (select 1 from public.duel_moves where table_id = p_table and seat = v_seat.seat and kind = 'resign') then
    -- La table est tenue : aucun autre coup ne prend ce numéro entre-temps.
    select coalesce(max(seq), 0) into v_last from public.duel_moves where table_id = p_table;
    insert into public.duel_moves (table_id, seq, seat, kind, payload, by)
    values (p_table, v_last + 1, v_seat.seat, 'resign', '', auth.uid());
  end if;
  update public.duel_seats set left_at = coalesce(left_at, now()), ready = false
   where table_id = p_table and player = auth.uid();
  if not exists (
    select 1 from public.duel_seats
     where table_id = p_table and not is_bot and left_at is null and kicked_at is null
  ) then
    update public.duel_tables set status = 'over', finished_at = coalesce(finished_at, now()) where id = p_table;
  end if;
  return 'resigned';
end;
$$;

-- Revenir à une partie en cours après une coupure ou une app fermée : la place
-- se reprend tant qu'on ne l'a pas abandonnée. 'back', 'over' ou 'closed'.
create function public.duel_rejoin(p_table uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
  v_seat public.duel_seats;
begin
  select * into v_table from public.duel_tables where id = p_table;
  if not found then
    return 'closed';
  end if;
  select * into v_seat from public.duel_seats where table_id = p_table and player = auth.uid() and kicked_at is null;
  if not found or v_seat.seat is null then
    return 'closed';
  end if;
  if v_table.status <> 'playing' then
    return case when v_table.status = 'over' then 'over' else 'closed' end;
  end if;
  if exists (select 1 from public.duel_moves where table_id = p_table and seat = v_seat.seat and kind = 'resign') then
    return 'closed';
  end if;
  update public.duel_seats set left_at = null, last_seen = now() where id = v_seat.id;
  return 'back';
end;
$$;

-- Les tables que tout le monde a laissées en pleine partie : fermées après
-- trois minutes sans lecture, pour ne pas compter des joueurs absents.
create function public.duel_close_abandoned() returns void
language sql security definer set search_path = public as $$
  update public.duel_tables t set status = 'over', finished_at = coalesce(t.finished_at, now())
   where t.status = 'playing' and t.started_at < now() - interval '3 minutes'
     and not exists (
       select 1 from public.duel_seats s
        where s.table_id = t.id and not s.is_bot and s.left_at is null and s.kicked_at is null
          and s.last_seen > now() - interval '3 minutes'
     );
$$;

-- --------------------------------------------------------------- la file --

-- La place de l'adversaire proposé, telle que la carte « Adversaire trouvé » la montre.
create function public.duel_offer_json(p_table uuid, p_player uuid, p_offered timestamptz) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'status', 'found',
    'table', t.id,
    'ranked', t.ranked,
    'deadline', extract(epoch from p_offered + make_interval(secs => public.duel_offer_seconds())),
    'now', extract(epoch from clock_timestamp()),
    'accepted', coalesce((select s.ready from public.duel_seats s where s.table_id = t.id and s.player = p_player), false),
    'me', public.duel_rating_json(p_player),
    'opponent', (
      select jsonb_build_object(
        'player', s.player, 'name', p.display_name, 'avatar', p.avatar, 'accepted', s.ready
      ) || public.duel_rating_json(s.player)
        from public.duel_seats s join public.profiles p on p.id = s.player
       where s.table_id = t.id and s.player <> p_player and s.left_at is null and s.kicked_at is null
       order by s.joined_at limit 1
    )
  )
  from public.duel_tables t where t.id = p_table;
$$;

-- Ce que la file dit d'elle-même à qui attend.
create function public.duel_queue_json(p_player uuid, p_lang text, p_status text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'status', p_status,
    'now', extract(epoch from clock_timestamp()),
    'joined', (select extract(epoch from q.joined_at) from public.duel_queue q where q.player = p_player),
    'estimate', public.duel_wait_estimate(p_lang),
    'searching', (
      select count(*) from public.duel_queue q
       where q.lang = p_lang and q.player <> p_player and q.table_id is null
         and q.seen_at > now() - public.duel_queue_patience()
    ),
    'playing', (
      select count(distinct s.player) from public.duel_seats s join public.duel_tables t on t.id = s.table_id
       where t.status = 'playing' and t.lang = p_lang and not s.is_bot and s.left_at is null
         and s.player <> p_player and s.last_seen > now() - interval '30 seconds'
    ),
    'publicTable', (
      select jsonb_build_object('id', o.id, 'seats', public.duel_active_seats(o.id))
        from (select public.duel_open_table_for(p_player, p_lang) as id) o where o.id is not null
    ),
    'me', public.duel_rating_json(p_player)
  );
$$;

-- Relire sa place dans la file classée, y entrer, ou en sortir pour de bon
-- quand une proposition a échoué. Répond :
--   {"status": "waiting", …}     on cherche ; l'estimation et la foule avec,
--   {"status": "found", …}       un adversaire est proposé, jusqu'à `deadline`,
--   {"status": "matched", "table"} les deux ont accepté : la table est lancée,
--   {"status": "missed"}         la proposition est passée sans réponse : hors de la file,
--   {"status": "cooldown", "until"} trop d'abandons récents.
-- `p_busy` : une partie seule en cours, la place se garde sans être appariée.
create function public.duel_queue_poll(p_lang text, p_categories text[], p_owned integer, p_busy boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me public.duel_queue;
  v_other public.duel_queue;
  v_table public.duel_tables;
  v_id uuid;
  v_cooldown timestamptz;
  v_rating public.duel_ratings;
  v_mine boolean;
  v_owned smallint := greatest(0, least(coalesce(p_owned, 0), 999));
  v_log bigint;
  v_has_table boolean;
begin
  if not public.is_named_account() then
    raise exception 'named account required' using errcode = '42501';
  end if;
  if p_lang !~ '^[a-z]{2}$' or coalesce(cardinality(p_categories), 0) not between 1 and 60 then
    raise exception 'invalid queue entry' using errcode = '22023';
  end if;

  perform public.duel_close_abandoned();
  -- Les absents quittent la file, et leur passage se clôt.
  with gone as (
    delete from public.duel_queue
     where (table_id is null and seen_at < now() - public.duel_queue_patience())
        or (table_id is not null and seen_at < now() - interval '2 minutes')
    returning log_id
  )
  update public.duel_queue_log l set outcome = 'expired', ended_at = now()
    from gone where l.id = gone.log_id and l.outcome is null;
  -- Mes parties classées finies et pas encore réglées : celles d'un adversaire parti.
  perform public.duel_settle(t.id)
     from public.duel_tables t join public.duel_seats s on s.table_id = t.id
    where s.player = auth.uid() and t.ranked and t.settled_at is null and t.status in ('over', 'closed')
    limit 3;

  select * into v_me from public.duel_queue where player = auth.uid() for update;

  -- Une proposition en cours, ou qui vient d'aboutir.
  if found and v_me.table_id is not null then
    select * into v_table from public.duel_tables where id = v_me.table_id for update;
    v_has_table := found;
    if v_has_table and v_table.status = 'playing' then
      delete from public.duel_queue where player = auth.uid();
      return jsonb_build_object('status', 'matched', 'table', v_table.id);
    end if;
    -- Une proposition d'une version livrée n'a pas d'heure : elle part d'ici.
    if v_me.offered_at is null then
      update public.duel_queue set offered_at = now() where player = auth.uid() returning * into v_me;
    end if;
    if v_has_table and v_table.status = 'lobby' and public.duel_lobby_open(v_table)
       and now() < v_me.offered_at + make_interval(secs => public.duel_offer_seconds())
       and exists (
         select 1 from public.duel_seats where table_id = v_table.id and player = auth.uid() and left_at is null and kicked_at is null
       ) then
      update public.duel_queue set seen_at = now() where player = auth.uid();
      return public.duel_offer_json(v_table.id, auth.uid(), v_me.offered_at);
    end if;

    -- La proposition a échoué : la table se ferme ; qui avait accepté reprend
    -- sa place dans la file, qui n'a pas répondu en sort.
    -- Une table disparue n'est la faute de personne : la place se garde.
    v_mine := not v_has_table or coalesce((select ready from public.duel_seats where table_id = v_me.table_id and player = auth.uid()), false);
    if v_has_table and v_table.status = 'lobby' then
      update public.duel_tables set status = 'closed' where id = v_table.id;
      update public.duel_queue_log l set outcome = 'missed', ended_at = now()
        from public.duel_queue q join public.duel_seats s on s.table_id = q.table_id and s.player = q.player
       where q.table_id = v_table.id and q.player <> auth.uid() and not s.ready and l.id = q.log_id;
      delete from public.duel_queue q using public.duel_seats s
       where q.table_id = v_table.id and q.player <> auth.uid() and s.table_id = q.table_id and s.player = q.player and not s.ready;
      update public.duel_queue set table_id = null, offered_at = null, seen_at = now()
       where table_id = v_table.id and player <> auth.uid();
    end if;
    if not v_mine then
      update public.duel_queue_log set outcome = 'missed', ended_at = now() where id = v_me.log_id;
      delete from public.duel_queue where player = auth.uid();
      return jsonb_build_object('status', 'missed');
    end if;
    update public.duel_queue set table_id = null, offered_at = null, seen_at = now()
     where player = auth.uid() returning * into v_me;
  end if;

  v_cooldown := public.duel_cooldown_until(auth.uid());
  if v_cooldown is not null then
    if v_me.player is not null then
      update public.duel_queue_log set outcome = 'cancelled', ended_at = now() where id = v_me.log_id and outcome is null;
      delete from public.duel_queue where player = auth.uid();
    end if;
    return jsonb_build_object('status', 'cooldown', 'until', extract(epoch from v_cooldown), 'now', extract(epoch from clock_timestamp()));
  end if;

  v_rating := public.duel_rating_of(auth.uid());
  if v_me.player is null then
    insert into public.duel_queue_log (player, lang, rating) values (auth.uid(), p_lang, v_rating.rating) returning id into v_log;
    insert into public.duel_queue (player, lang, owned, categories, log_id, rating, busy)
    values (auth.uid(), p_lang, v_owned, p_categories, v_log, v_rating.rating, coalesce(p_busy, false))
    returning * into v_me;
  else
    update public.duel_queue
       set lang = p_lang, owned = v_owned, categories = p_categories, seen_at = now(),
           rating = v_rating.rating, busy = coalesce(p_busy, false)
     where player = auth.uid() returning * into v_me;
  end if;
  if v_me.busy then
    return public.duel_queue_json(auth.uid(), p_lang, 'waiting');
  end if;

  -- Le plus ancien qui cherche, dans l'écart d'Elo que l'attente de l'un ou
  -- de l'autre autorise — jamais un joueur occupé ni un blocage.
  select * into v_other from public.duel_queue q
   where q.table_id is null and q.player <> auth.uid() and q.lang = p_lang and not q.busy
     and q.seen_at > now() - public.duel_queue_patience()
     and abs(q.rating - v_me.rating) <= greatest(
       public.duel_rating_window(extract(epoch from now() - v_me.joined_at)),
       public.duel_rating_window(extract(epoch from now() - q.joined_at))
     )
     and not exists (
       select 1 from public.blocks b
        where (b.blocker = auth.uid() and b.blocked = q.player) or (b.blocker = q.player and b.blocked = auth.uid())
     )
   order by q.joined_at
   limit 1
   for update skip locked;
  if not found then
    return public.duel_queue_json(auth.uid(), p_lang, 'waiting');
  end if;

  -- L'hôte est celui qui attendait ; les deux sont assis, pas prêts, et ont
  -- vingt secondes pour accepter.
  insert into public.duel_tables (host, lang, seed, categories, ranked)
  values (v_other.player, v_other.lang, floor(random() * 4294967295)::bigint, v_other.categories, true)
  returning id into v_id;
  insert into public.duel_seats (table_id, player, owned, joined_at)
  values (v_id, v_other.player, v_other.owned, clock_timestamp()),
         (v_id, auth.uid(), v_owned, clock_timestamp() + interval '1 millisecond');
  update public.duel_queue set table_id = v_id, offered_at = now(), seen_at = now()
   where player in (v_other.player, auth.uid());
  update public.duel_queue_log set outcome = 'matched', ended_at = now()
   where id in (v_other.log_id, v_me.log_id) and outcome is null;
  return public.duel_offer_json(v_id, auth.uid(), now());
end;
$$;

-- Répondre à une proposition. Accepter, c'est le « prêt » du salon : le
-- second lance la table ('matched'), le premier attend l'autre ('accepted').
-- Refuser ferme la table et rend sa place à l'autre ('declined'). 'gone'
-- quand il n'y a plus rien à répondre.
create function public.duel_offer_answer(p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me public.duel_queue;
  v_table public.duel_tables;
  v_ready text;
begin
  select * into v_me from public.duel_queue where player = auth.uid() and table_id is not null for update;
  if not found then
    return jsonb_build_object('status', 'gone');
  end if;
  select * into v_table from public.duel_tables where id = v_me.table_id for update;
  if not found or v_table.status not in ('lobby', 'playing') then
    return jsonb_build_object('status', 'gone');
  end if;
  if v_table.status = 'playing' then
    delete from public.duel_queue where player = auth.uid();
    return jsonb_build_object('status', 'matched', 'table', v_table.id);
  end if;

  if not coalesce(p_accept, false) then
    update public.duel_tables set status = 'closed' where id = v_table.id;
    update public.duel_queue set table_id = null, offered_at = null, seen_at = now()
     where table_id = v_table.id and player <> auth.uid();
    update public.duel_queue_log set outcome = 'declined', ended_at = now() where id = v_me.log_id;
    delete from public.duel_queue where player = auth.uid();
    return jsonb_build_object('status', 'declined');
  end if;

  if v_me.offered_at is not null and now() > v_me.offered_at + make_interval(secs => public.duel_offer_seconds() + 2) then
    return jsonb_build_object('status', 'gone');
  end if;
  v_ready := public.duel_ready(v_table.id, true);
  if v_ready = 'started' then
    -- L'autre garde sa ligne : c'est elle qui lui dit, à sa lecture suivante, que la table part.
    delete from public.duel_queue where player = auth.uid();
    return jsonb_build_object('status', 'matched', 'table', v_table.id);
  end if;
  update public.duel_queue set seen_at = now() where player = auth.uid();
  return public.duel_offer_json(v_table.id, auth.uid(), coalesce(v_me.offered_at, now()));
end;
$$;

-- Quitter la file classée, avant comme pendant une proposition.
create function public.duel_queue_leave() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me public.duel_queue;
begin
  select * into v_me from public.duel_queue where player = auth.uid() for update;
  if not found then
    return;
  end if;
  if v_me.table_id is not null then
    perform public.duel_offer_answer(false);
    return;
  end if;
  update public.duel_queue_log set outcome = 'cancelled', ended_at = now() where id = v_me.log_id and outcome is null;
  delete from public.duel_queue where player = auth.uid();
end;
$$;

-- ---------------------------------------------------------- les lectures --

create function public.duel_my_rating() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return null;
  end if;
  perform public.duel_settle(t.id)
     from public.duel_tables t join public.duel_seats s on s.table_id = t.id
    where s.player = auth.uid() and t.ranked and t.settled_at is null and t.status in ('over', 'closed')
    limit 3;
  return public.duel_rating_json(auth.uid());
end;
$$;

-- Le classement du duel : les meilleurs une fois leurs placements joués, et moi.
create function public.duel_ladder(p_limit integer) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(row order by (row ->> 'rank')::int, row ->> 'name')
        from (
          select jsonb_build_object(
            'player', r.player, 'name', p.display_name, 'avatar', p.avatar,
            'rating', r.rating, 'games', r.games, 'wins', r.wins,
            'rank', rank() over (order by r.rating desc)
          ) as row
            from public.duel_ratings r join public.profiles p on p.id = r.player
           where r.games >= 5 and not exists (select 1 from public.bots b where b.id = r.player)
           order by r.rating desc
           limit greatest(1, least(coalesce(p_limit, 50), 100))
        ) top
    ), '[]'::jsonb),
    'me', case when auth.uid() is not null then public.duel_rating_json(auth.uid()) end
  );
$$;

-- La lecture de 0097, qui dit en plus si la table est classée et ce que son
-- règlement a changé, et qui règle elle-même une table finie qui attend.
create or replace function public.duel_sync(p_table uuid, p_after integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
begin
  select * into v_table from public.duel_tables where id = p_table;
  if not found or not exists (select 1 from public.duel_seats where table_id = p_table and player = auth.uid()) then
    return null;
  end if;
  update public.duel_seats set last_seen = now()
   where table_id = p_table and player = auth.uid() and left_at is null and kicked_at is null
     and last_seen < clock_timestamp() - interval '2 seconds';
  if v_table.ranked and v_table.settled_at is null and v_table.status in ('over', 'closed') then
    perform public.duel_settle(p_table);
    select * into v_table from public.duel_tables where id = p_table;
  end if;

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
      'rematch', v_table.rematch,
      'public', v_table.listed,
      'ranked', v_table.ranked,
      'settled', v_table.settled_at is not null,
      'voided', v_table.voided,
      'ratings', coalesce((
        select jsonb_agg(jsonb_build_object('player', c.player, 'place', c.place, 'before', c.before, 'after', c.after) order by c.place)
          from public.duel_rating_changes c where c.table_id = p_table
      ), '[]'::jsonb)
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
        'seen', extract(epoch from s.last_seen),
        'rating', (select r.rating from public.duel_ratings r where r.player = s.player),
        'games', (select r.games from public.duel_ratings r where r.player = s.player)
      ) order by s.joined_at, s.player)
      from public.duel_seats s left join public.profiles p on p.id = s.player
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

-- La revanche de 0046, qui garde le classement de la table qu'elle rejoue.
create or replace function public.duel_rematch(p_table uuid, p_owned integer) returns uuid
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

  insert into public.duel_tables (host, lang, seed, categories, rematch_of, ranked)
  values (auth.uid(), v_table.lang, floor(random() * 4294967295)::bigint, v_table.categories, p_table, v_table.ranked)
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
  public.duel_offer_seconds(),
  public.duel_rating_window(numeric),
  public.duel_k_factor(integer),
  public.duel_wait_estimate(text),
  public.duel_rating_of(uuid),
  public.duel_rating_json(uuid),
  public.duel_cooldown_until(uuid),
  public.duel_elo_deltas(integer[], integer[]),
  public.duel_settle(uuid),
  public.duel_close_abandoned(),
  public.duel_offer_json(uuid, uuid, timestamptz),
  public.duel_queue_json(uuid, text, text)
  from public, anon, authenticated;

revoke execute on function
  public.duel_report(uuid, integer[]),
  public.duel_resign(uuid),
  public.duel_rejoin(uuid),
  public.duel_queue_poll(text, text[], integer, boolean),
  public.duel_offer_answer(boolean),
  public.duel_queue_leave(),
  public.duel_my_rating(),
  public.duel_ladder(integer)
  from public, anon;

grant execute on function
  public.duel_report(uuid, integer[]),
  public.duel_resign(uuid),
  public.duel_rejoin(uuid),
  public.duel_queue_poll(text, text[], integer, boolean),
  public.duel_offer_answer(boolean),
  public.duel_queue_leave(),
  public.duel_my_rating(),
  public.duel_ladder(integer)
  to authenticated;
