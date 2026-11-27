-- Le duel classé sans placements, réglé sur sa population :
--
-- - Le départ : Argent III (950) tant que moins de 50 joueurs ont atteint l'Or,
--   puis Bronze III (800) — une échelle vide n'envoie pas les premiers au fond
--   (`duel_start_rating`). Un compte sans partie prend le départ du moment.
-- - Le pas : K 60 sur les dix premières parties, 40 jusqu'à la vingtième, puis
--   20 — doublé tant que moins de dix joueurs sont Diamant, pour que les
--   premiers y arrivent vite (`duel_k_boost`).
-- - Les Maîtres : le top 10 n'existe qu'à partir de dix Diamant
--   (`duel_masters_open`) ; d'ici là, chacun garde sa ligue. Chaque lecture
--   d'un rang le dit (`masters`).
-- - Un joueur entre au classement dès sa première partie classée.
--
-- `src/domain/ranked.ts` en est le double (`kFactor`, `MASTERS_FROM_DIAMONDS`…).

-- Combien ont atteint l'Or, et le Diamant : de quoi régler le départ, le pas et les Maîtres.
create function public.duel_population() returns table (gold integer, diamond integer)
language sql stable security definer set search_path = public as $$
  select count(*) filter (where e.rating >= 1100)::int, count(*) filter (where e.rating >= 1400)::int
    from public.duel_ratings r
    cross join lateral (select public.duel_effective_rating(r.rating, r.last_played_at) as rating) e
   where r.games >= 1 and not exists (select 1 from public.bots b where b.id = r.player)
$$;

create function public.duel_start_rating() returns integer
language sql stable security definer set search_path = public as $$
  select case when gold >= 50 then 800 else 950 end from public.duel_population()
$$;

create function public.duel_masters_open() returns boolean
language sql stable security definer set search_path = public as $$
  select diamond >= 10 from public.duel_population()
$$;

create function public.duel_k_boost() returns integer
language sql stable security definer set search_path = public as $$
  select case when diamond < 10 then 2 else 1 end from public.duel_population()
$$;

-- Les lignes créées sans partie jouée prennent le départ du moment.
update public.duel_ratings set rating = public.duel_start_rating(), peak = public.duel_start_rating() where games = 0;

-- La ligne d'un joueur, créée au départ du moment, et remise à ce départ tant qu'il n'a pas joué.
create or replace function public.duel_rating_of(p_player uuid) returns public.duel_ratings
language plpgsql security definer set search_path = public as $$
declare
  v_row public.duel_ratings;
  v_start integer := public.duel_start_rating();
begin
  insert into public.duel_ratings (player, rating, peak) values (p_player, v_start, v_start) on conflict (player) do nothing;
  update public.duel_ratings set rating = v_start, peak = v_start where player = p_player and games = 0 and rating <> v_start;
  select * into v_row from public.duel_ratings where player = p_player;
  return v_row;
end;
$$;

create or replace function public.duel_k_factor(p_games integer) returns integer
language sql immutable as $$ select case when coalesce(p_games, 0) < 10 then 60 when coalesce(p_games, 0) < 20 then 40 else 20 end $$;

-- Plus de recadrage : seulement le plancher.
create or replace function public.duel_settled_rating(p_rating integer, p_games_after integer) returns integer
language sql immutable as $$ select greatest(100, p_rating) $$;

create or replace function public.duel_rating_json(p_player uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    -- Sans ligne, le départ du moment : l'Elo effectif d'un vide lirait le plancher du déclin.
    'rating', case when r.player is null then public.duel_start_rating() else public.duel_effective_rating(r.rating, r.last_played_at) end,
    'games', coalesce(r.games, 0),
    'wins', coalesce(r.wins, 0),
    'peak', coalesce(r.peak, public.duel_start_rating()),
    'masters', public.duel_masters_open(),
    'rank', case when coalesce(r.games, 0) >= 1 then (
      select count(*) + 1 from public.duel_ratings o
       where o.games >= 1
         and public.duel_effective_rating(o.rating, o.last_played_at) > public.duel_effective_rating(r.rating, r.last_played_at)
    ) end
  )
  from (select p_player as player) me
  left join public.duel_ratings r on r.player = me.player;
$$;

create or replace function public.duel_ladder(p_limit integer) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(row order by (row ->> 'rank')::int, row ->> 'name')
        from (
          select jsonb_build_object(
            'player', r.player, 'name', p.display_name, 'avatar', p.avatar,
            'rating', e.rating, 'games', r.games, 'wins', r.wins,
            'rank', rank() over (order by e.rating desc)
          ) as row
            from public.duel_ratings r join public.profiles p on p.id = r.player
            cross join lateral (select public.duel_effective_rating(r.rating, r.last_played_at) as rating) e
           where r.games >= 1 and not exists (select 1 from public.bots b where b.id = r.player)
           order by e.rating desc
           limit greatest(1, least(coalesce(p_limit, 50), 100))
        ) top
    ), '[]'::jsonb),
    'me', case when auth.uid() is not null then public.duel_rating_json(auth.uid()) end
  );
$$;

create or replace function public.duel_placed() returns table (player uuid, name text, avatar jsonb, rating integer, games integer, wins integer, rk bigint)
language sql stable security definer set search_path = public as $$
  select r.player, p.display_name, to_jsonb(p.avatar), e.rating, r.games, r.wins,
         rank() over (order by e.rating desc)
    from public.duel_ratings r join public.profiles p on p.id = r.player
    cross join lateral (select public.duel_effective_rating(r.rating, r.last_played_at) as rating) e
   where r.games >= 1 and not exists (select 1 from public.bots b where b.id = r.player)
$$;

-- Le temps des tests : une partie contre le bot de niveau, que la file lance
-- faute d'adversaire, compte au classement. Elle se joue sur l'appareil, le
-- serveur n'en connaît que l'issue que le client rapporte — de quoi tricher,
-- donc une porte provisoire : la fonctionnalité `rankedBots` fermée pour tout
-- le monde (`feature_flags`) la referme aussi ici, sans nouvelle version. Le
-- bot a l'Elo du joueur : une victoire rend la moitié du pas, une défaite la
-- coûte. Une partie par minute au plus, contre les envois répétés.
-- 'settled' avec l'avant et l'après, 'closed' (porte fermée), 'too_soon' ou 'forbidden'.
create function public.duel_report_bot(p_won boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_row public.duel_ratings;
  v_before integer;
  v_after integer;
  v_delta integer;
begin
  if not public.is_named_account() then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if exists (select 1 from public.feature_flags where feature = 'rankedBots' and everyone = 'off') then
    return jsonb_build_object('status', 'closed');
  end if;
  v_row := public.duel_rating_of(auth.uid());
  if v_row.last_played_at > now() - interval '1 minute' then
    return jsonb_build_object('status', 'too_soon');
  end if;
  perform 1 from public.duel_ratings where player = auth.uid() for update;
  v_before := public.duel_effective_rating(v_row.rating, v_row.last_played_at);
  v_delta := round(public.duel_k_factor(v_row.games) * public.duel_k_boost() * 0.5);
  v_after := public.duel_settled_rating(v_before + case when coalesce(p_won, false) then v_delta else -v_delta end, v_row.games + 1);
  update public.duel_ratings
     set rating = v_after, games = games + 1, wins = wins + case when coalesce(p_won, false) then 1 else 0 end,
         peak = greatest(peak, v_after), last_played_at = now(), updated_at = now()
   where player = auth.uid();
  return jsonb_build_object('status', 'settled', 'before', v_before, 'after', v_after) || public.duel_rating_json(auth.uid());
end;
$$;

revoke execute on function public.duel_report_bot(boolean) from public, anon;
grant execute on function public.duel_report_bot(boolean) to authenticated;

-- Les rangs des noms d'un classement, qui disent aussi si les Maîtres existent.
create or replace function public.duel_badges(p_names text[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(d.name, jsonb_build_object('rating', d.rating, 'games', d.games, 'rank', d.rk, 'masters', m.open)), '{}'::jsonb)
    from public.duel_placed() d cross join (select public.duel_masters_open() as open) m
   where d.name = any(p_names[1:120]);
$$;

-- Le classement vu d'un rang : sans Maîtres (moins de dix Diamant), le top 10
-- reste dans sa ligue et la vue `master` est vide.
create or replace function public.duel_ladder_view(p_view text, p_limit integer) returns jsonb
language sql stable security definer set search_path = public as $$
  with placed as (select * from public.duel_placed()),
  mine as (select rk from placed where player = auth.uid()),
  open as (select public.duel_masters_open() as masters)
  select jsonb_build_object(
    'masters', (select masters from open),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player', d.player, 'name', d.name, 'avatar', d.avatar, 'rating', d.rating,
        'games', d.games, 'wins', d.wins, 'rank', d.rk, 'masters', (select masters from open)
      ) order by d.rk, d.name)
        from (
          select * from placed d
           where case coalesce(p_view, 'top')
             when 'top' then true
             when 'master' then (select masters from open) and d.rk <= 10
             when 'diamond' then (d.rk > 10 or not (select masters from open)) and d.rating >= 1400
             when 'platinum' then (d.rk > 10 or not (select masters from open)) and d.rating >= 1250 and d.rating < 1400
             when 'gold' then (d.rk > 10 or not (select masters from open)) and d.rating >= 1100 and d.rating < 1250
             when 'silver' then (d.rk > 10 or not (select masters from open)) and d.rating >= 950 and d.rating < 1100
             when 'bronze' then (d.rk > 10 or not (select masters from open)) and d.rating < 950
             when 'me' then d.rk between (select rk from mine) - 7 and (select rk from mine) + 7
             else false
           end
           order by d.rk, d.name
           limit greatest(1, least(coalesce(p_limit, 50), 100))
        ) d
    ), '[]'::jsonb),
    'me', case when auth.uid() is not null then public.duel_rating_json(auth.uid()) end
  );
$$;

revoke execute on function
  public.duel_population(),
  public.duel_start_rating(),
  public.duel_masters_open(),
  public.duel_k_boost()
  from public, anon, authenticated;

-- Le règlement de 0122, avec le pas doublé tant que l'échelle est jeune.
create or replace function public.duel_settle(p_table uuid) returns void
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
  v_after integer;
  v_boost integer;
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
    -- L'inactivité se fige ici : la partie repart de l'Elo qui restait.
    v_ratings := v_ratings || public.duel_effective_rating(v_row.rating, v_row.last_played_at);
    v_games := v_games || v_row.games;
  end loop;
  v_deltas := public.duel_elo_deltas(v_ratings, v_games);
  -- Tant que moins de dix joueurs sont Diamant, le pas est doublé.
  v_boost := public.duel_k_boost();
  for i in 1 .. cardinality(v_deltas) loop
    v_deltas[i] := v_deltas[i] * v_boost;
  end loop;

  for i in 1 .. cardinality(v_players) loop
    v_after := public.duel_settled_rating(v_ratings[i] + v_deltas[i], v_games[i] + 1);
    update public.duel_ratings
       set rating = v_after,
           games = games + 1,
           wins = wins + case when i = 1 then 1 else 0 end,
           peak = greatest(peak, v_after),
           last_played_at = now(),
           updated_at = now()
     where player = v_players[i];
    insert into public.duel_rating_changes (table_id, player, place, before, after)
    values (p_table, v_players[i], i, v_ratings[i], v_after);
  end loop;
  update public.duel_tables set settled_at = now() where id = p_table;
end;
$$;


-- La lecture de 0122, qui dit en plus si les Maîtres existent : le bilan ne nomme pas Maître le top 10 d'une échelle sans dix Diamant.
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
      'rules', v_table.rules,
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
        'rating', (select public.duel_effective_rating(r.rating, r.last_played_at) from public.duel_ratings r where r.player = s.player),
        'games', (select r.games from public.duel_ratings r where r.player = s.player),
        'rank', (select (public.duel_rating_json(s.player) ->> 'rank')::int where s.player is not null and not s.is_bot),
        'masters', public.duel_masters_open()
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

