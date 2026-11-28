-- Le duel allégé, après la soirée du 27 novembre : sur l'instance Nano, à
-- court de mémoire, le pic des duels du soir a fait expirer les lectures
-- ordinaires, puis PostgREST n'a plus pu recharger son schéma de 20 h 44 à
-- 0 h 20. Rien de ce qui suit ne change ce qu'un client lit.
--
-- 1. Plus de sonnerie Realtime (0121) : aucun client ne s'abonne, et sans
--    service Realtime branché `realtime.messages` n'a aucune partition — chaque
--    coup ouvrait une sous-transaction pour un `realtime.send` refusé, puis un
--    avertissement renvoyé au client, quatre cents par heure. Les fonctions
--    `duel_ring*`, le canal et sa politique restent : les déclencheurs se
--    recréent tels quels (0121) le jour où un client écoute.
-- 2. `duel_sync`, relu toutes les 450 ms par chaque joueur assis, recomptait
--    la population du classement quatre fois par place (`duel_rating_json`,
--    `duel_masters_open`) : les Maîtres se lisent une fois par appel, l'Elo et
--    le rang d'une place depuis sa ligne, avec les mêmes valeurs qu'avant.
-- 3. Les fonctions SQL qui ne s'insèrent pas dans leur appelant (`security
--    definer`, `set search_path`) se replanifient à chaque appel, et l'Elo
--    effectif lit `game_config_value` cinq fois par ligne : la lecture d'un
--    réglage et la population passent en plpgsql, dont le plan reste en cache
--    pour la session.

drop trigger duel_moves_ring_insert on public.duel_moves;
drop trigger duel_moves_ring_delete on public.duel_moves;
drop trigger duel_tables_ring on public.duel_tables;
drop trigger duel_seats_ring_insert on public.duel_seats;
drop trigger duel_seats_ring_update on public.duel_seats;
drop trigger duel_seats_ring_delete on public.duel_seats;
drop trigger duel_invites_ring_insert on public.duel_invites;
drop trigger duel_invites_ring_update on public.duel_invites;
drop trigger duel_invites_ring_delete on public.duel_invites;

-- ------------------------------------------------------------- réglages --

create or replace function public.game_config_value(p_key text, p_default numeric) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare
  v_value numeric;
begin
  select value into v_value from public.game_config
   where key = p_key and (min is null or value >= min) and (max is null or value <= max);
  return coalesce(v_value, p_default);
end;
$$;

-- ----------------------------------------------------------- population --

create or replace function public.duel_population() returns table (gold integer, diamond integer)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  select count(*) filter (where e.rating >= 1100)::int, count(*) filter (where e.rating >= 1400)::int
    from public.duel_ratings r
    cross join lateral (select public.duel_effective_rating(r.rating, r.last_played_at) as rating) e
   where r.games >= 1 and not exists (select 1 from public.bots b where b.id = r.player);
end;
$$;

create or replace function public.duel_start_rating() returns integer
language plpgsql stable security definer set search_path = public as $$
declare
  v_gold integer;
begin
  select p.gold into v_gold from public.duel_population() p;
  return (case when v_gold >= public.game_config_value('ranked.bronzeStartGold', 50)
               then public.game_config_value('ranked.startLate', 800)
               else public.game_config_value('ranked.startEarly', 950) end)::int;
end;
$$;

create or replace function public.duel_masters_open() returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_diamond integer;
begin
  select p.diamond into v_diamond from public.duel_population() p;
  return v_diamond >= public.game_config_value('ranked.mastersFromDiamonds', 10);
end;
$$;

create or replace function public.duel_k_boost() returns integer
language plpgsql stable security definer set search_path = public as $$
declare
  v_diamond integer;
begin
  select p.diamond into v_diamond from public.duel_population() p;
  return (case when v_diamond < public.game_config_value('ranked.mastersFromDiamonds', 10)
               then public.game_config_value('ranked.boost', 2) else 1 end)::int;
end;
$$;

-- ------------------------------------------------------------ la relecture --

-- Le corps de 0125, sauf les places : `rating` et `games` viennent de la ligne
-- du joueur (nuls sans ligne), `rank` du même compte que `duel_rating_json`
-- (nul sans partie classée, pour un robot ou un compte effacé), `masters` du
-- seul calcul de l'appel.
create or replace function public.duel_sync(p_table uuid, p_after integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
  v_masters boolean;
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
  v_masters := public.duel_masters_open();

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
      'tuning', v_table.tuning,
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
        'rating', r.effective,
        'games', r.games,
        'rank', case when s.player is not null and not s.is_bot and r.games >= 1 then (
          select count(*) + 1 from public.duel_ratings o
           where o.games >= 1 and public.duel_effective_rating(o.rating, o.last_played_at) > r.effective
        ) end,
        'masters', v_masters
      ) order by s.joined_at, s.player)
      from public.duel_seats s
      left join public.profiles p on p.id = s.player
      left join lateral (
        select x.games, public.duel_effective_rating(x.rating, x.last_played_at) as effective
          from public.duel_ratings x where x.player = s.player
      ) r on true
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
