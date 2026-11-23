-- Le 23 novembre, CrazyGames a envoyé cent fois le trafic habituel : 2 386
-- parties et 83 620 événements en un jour, contre une dizaine et quelques
-- milliers. Deux charges y grandissaient avec le nombre de joueurs.
--
-- 1. Chaque classement se recalculait à chaque appel, sur toute la période :
--    l'accueil en demande trois, la fin de partie autant, et l'invité son
--    rang. Ils se calculent désormais toutes les minutes (les découvertes du
--    jour et de la semaine, plus lourdes, toutes les dix) dans `board_cache` :
--    les cinquante premiers et la liste des valeurs, qui donne le rang de
--    n'importe qui. Seule la ligne du joueur qui demande se lit en direct, par
--    ses propres parties : son score vient d'arriver, il doit le voir.
-- 2. Les touches (`tap`) et les écrans (`screen`) faisaient les deux tiers des
--    événements, pour un tableau de bord qui ne s'en sert plus : `track` ne
--    les écrit plus, sauf les touches d'invitation (`invite-…`), que la
--    section des invitations compte. Les clients continuent de les envoyer.

create table public.board_cache (
  stat text not null,
  period text not null,
  -- Les soixante premiers, identifiant compris : le joueur qui demande s'en
  -- retire avant d'y rentrer avec sa valeur du moment.
  top jsonb not null,
  board_values integer[] not null,
  built_at timestamptz not null default now(),
  primary key (stat, period)
);
alter table public.board_cache enable row level security;

-- Les découvertes d'un seul joueur se cherchent mot par mot.
create index run_words_category_word_idx on public.run_words (category_id, word);

create function public.refresh_boards(p_heavy boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_stat text;
  v_period text;
  v_top jsonb;
  v_values integer[];
begin
  if not pg_try_advisory_xact_lock(hashtext('refresh_boards'), case when p_heavy then 1 else 0 end) then
    return;
  end if;
  foreach v_stat in array array['best', 'points', 'runs', 'words', 'discoveries', 'combo', 'added', 'moderation'] loop
    foreach v_period in array array['day', 'week', 'all'] loop
      -- Les découvertes du jour et de la semaine relisent quinze jours de mots :
      -- toutes les dix minutes ; celles de toujours viennent de `discoveries_all`.
      continue when (v_stat = 'discoveries' and v_period <> 'all') <> p_heavy;
      select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.display_name, 'avatar', t.avatar, 'value', t.value)
               order by t.value desc, t.display_name) filter (where t.rn <= 60), '[]'::jsonb),
             coalesce(array_agg(t.value order by t.value desc), '{}')
        into v_top, v_values
        from (
          select p.id, p.display_name, p.avatar, x.value,
                 row_number() over (order by x.value desc, p.display_name) as rn
            from public.leaderboard_values(
              v_stat,
              case when v_period = 'all' then '-infinity'::timestamptz else public.period_start(v_period) end
            ) x
            join public.profiles p on p.id = x.player_id
            join auth.users u on u.id = p.id and not u.is_anonymous
           where x.value > 0
        ) t;
      insert into public.board_cache (stat, period, top, board_values)
      values (v_stat, v_period, v_top, v_values)
      on conflict (stat, period) do update
        set top = excluded.top, board_values = excluded.board_values, built_at = now()
        where board_cache.top is distinct from excluded.top
           or board_cache.board_values is distinct from excluded.board_values;
    end loop;
  end loop;
end;
$$;

-- La valeur d'un seul joueur, mesurée comme `leaderboard_values` la mesure
-- pour tous, mais par ses propres lignes : index sur le joueur, jamais toute
-- la période.
create function public.player_board_value(p_stat text, p_since timestamptz, p_player uuid)
returns integer
language plpgsql stable security definer set search_path = public as $$
declare
  v_value integer;
begin
  if p_player is null then
    return null;
  end if;
  if p_stat = 'discoveries' then
    if p_since = '-infinity'::timestamptz then
      select d.value into v_value from public.discoveries_all d where d.player_id = p_player;
    else
      select count(*)::integer into v_value
        from public.runs r
        join public.run_words w on w.run_id = r.id
       where r.player_id = p_player and r.created_at >= p_since
         and not exists (
           select 1
             from public.run_words w2
             join public.runs r2 on r2.id = w2.run_id
            where w2.category_id = w.category_id
              and w2.word = w.word
              and r2.created_at < r.created_at
              and r2.created_at >= r.created_at - interval '7 days'
         );
    end if;
  elsif p_stat = 'added' then
    select count(*)::integer into v_value
      from public.word_submissions s
      left join public.word_reviews v on v.category_id = s.category_id and v.word = s.word
     where s.player_id = p_player and s.status = 'accepted'
       and coalesce(v.decided_at, s.created_at) >= p_since;
  elsif p_stat = 'moderation' then
    select count(*)::integer into v_value
      from public.moderation_sessions s
     where s.player_id = p_player and s.at >= p_since;
  else
    select (case p_stat
              when 'best' then max(r.score)
              when 'points' then sum(r.score)
              when 'runs' then count(*)
              when 'words' then sum(r.words)
              when 'combo' then max(r.best_combo)
            end)::integer into v_value
      from public.runs r
     where r.player_id = p_player and r.created_at >= p_since;
  end if;
  return v_value;
end;
$$;

revoke execute on function public.refresh_boards(boolean), public.player_board_value(text, timestamptz, uuid)
  from public, anon, authenticated;

-- Même sortie qu'en 0068 : les cinquante premiers, puis le joueur hors du
-- classement (`extra`). Le cache donne les autres, le joueur s'y place avec sa
-- valeur du moment.
create or replace function public.leaderboard_stat(p_stat text, p_period text)
returns table (place integer, display_name text, avatar jsonb, value integer, mine boolean, extra boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_mine integer;
  v_top jsonb;
  v_values integer[];
begin
  if coalesce(p_stat not in ('best', 'points', 'runs', 'words', 'discoveries', 'combo', 'added', 'moderation')
    or p_period not in ('day', 'week', 'all'), true) then
    return;
  end if;
  if p_stat = 'moderation' and not public.is_moderator() then
    return;
  end if;
  select c.top, c.board_values into v_top, v_values
    from public.board_cache c where c.stat = p_stat and c.period = p_period;
  if v_top is null then
    return;
  end if;
  if v_me is not null and exists (select 1 from auth.users u where u.id = v_me and not u.is_anonymous) then
    v_mine := public.player_board_value(
      p_stat, case when p_period = 'all' then '-infinity'::timestamptz else public.period_start(p_period) end, v_me);
  end if;
  return query
  with merged as (
    select (e ->> 'id')::uuid as id, e ->> 'name' as name, e -> 'avatar' as av, (e ->> 'value')::integer as val
      from jsonb_array_elements(v_top) e
     where (e ->> 'id')::uuid is distinct from v_me
    union all
    select p.id, p.display_name, p.avatar, v_mine
      from public.profiles p
     where p.id = v_me and coalesce(v_mine, 0) > 0
  ),
  ranked as (
    select m.*, rank() over (order by m.val desc)::integer as pl,
           row_number() over (order by m.val desc, m.name) as n
      from merged m
  )
  select r.pl, r.name, r.av, r.val, r.id = v_me, false
    from ranked r
   where r.n <= 50
  union all
  select 1 + (select count(*)::integer from unnest(v_values) v where v > v_mine), r.name, r.av, r.val, true, true
    from ranked r
   where r.id = v_me and r.n > 50;
end;
$$;

-- Le tableau de l'accueil (0024) est un classement de `leaderboard_stat` sous
-- un autre nom : la meilleure partie du jour, de la semaine, et les
-- découvertes de la semaine.
create or replace function public.leaderboard_board(p_board text)
returns table (display_name text, avatar jsonb, value integer)
language sql stable security definer set search_path = public as $$
  select s.display_name, s.avatar, s.value
    from public.leaderboard_stat(
      case when p_board = 'discoveries' then 'discoveries' else 'best' end,
      case when p_board in ('week', 'discoveries') then 'week' else 'day' end
    ) s
   where not s.extra;
$$;

create or replace function public.leaderboard_rank(p_stat text, p_period text, p_value integer)
returns integer
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(p_stat not in ('best', 'points', 'runs', 'words', 'discoveries', 'combo', 'added')
    or p_period not in ('day', 'week', 'all') or p_value < 1, true) then
    return null;
  end if;
  return 1 + (
    select count(*)::integer
      from public.board_cache c, unnest(c.board_values) v
     where c.stat = p_stat and c.period = p_period and v > p_value
  );
end;
$$;

-- Corps de 0084 ; seul le filtre de l'échantillon s'ajoute.
create or replace function public.track(p_events jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_player uuid := auth.uid();
  v_device text;
  v_today integer;
  v_room integer;
  v_count integer;
begin
  if jsonb_typeof(p_events) <> 'array' then
    return 0;
  end if;
  if v_player is null then
    -- Un invité sans compte : un seul appareil par lot, le plafond se compte
    -- sur lui.
    v_device := left(p_events -> 0 ->> 'device', 64);
    if coalesce(v_device, '') = '' then
      return 0;
    end if;
    select count(*) into v_today from public.events
     where player_id is null and device = v_device and created_at > now() - interval '1 day';
  else
    select count(*) into v_today from public.events
     where player_id = v_player and created_at > now() - interval '1 day';
  end if;
  v_room := greatest(0, 5000 - v_today);
  if v_room = 0 then
    return 0;
  end if;

  insert into public.events (player_id, device, session, kind, props, lang, platform, version, at, test)
  select v_player,
         left(e ->> 'device', 64),
         left(e ->> 'session', 64),
         e ->> 'kind',
         case when jsonb_typeof(e -> 'props') = 'object' and length((e -> 'props')::text) <= 4000
              then e -> 'props' else '{}' end,
         left(e ->> 'lang', 8),
         left(e ->> 'platform', 16),
         left(e ->> 'version', 32),
         case when (e ->> 'at') ~ '^\d{4}-\d\d-\d\dT'
                   and (e ->> 'at')::timestamptz between now() - interval '30 days' and now() + interval '5 minutes'
              then (e ->> 'at')::timestamptz else now() end,
         coalesce((e ->> 'test')::boolean, false)
    from (select e from jsonb_array_elements(p_events) e limit least(200, v_room)) batch
   where jsonb_typeof(e) = 'object'
     and (e ->> 'kind') ~ '^[a-z][a-z_]{0,31}$'
     and coalesce(e ->> 'device', '') <> ''
     and coalesce(e ->> 'session', '') <> ''
     and (v_player is not null
       or (left(e ->> 'device', 64) = v_device and e ->> 'platform' = 'crazygames'))
     and e ->> 'kind' <> 'screen'
     and (e ->> 'kind' <> 'tap' or coalesce(e -> 'props' ->> 'label', '') like 'invite-%');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

select cron.schedule('boards-cache', '* * * * *', 'set statement_timeout = ''50s''; select public.refresh_boards(false)');
select cron.schedule('boards-cache-heavy', '*/10 * * * *', 'set statement_timeout = ''120s''; select public.refresh_boards(true)');

select public.refresh_boards(false);
select public.refresh_boards(true);
