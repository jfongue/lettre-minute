-- Ce que les joueurs font de l'app, et pas seulement de leurs parties :
-- ouvertures (avec ou sans partie), écrans, boutons touchés, pouvoirs et
-- fonctions utilisées, erreurs, temps de chargement. Le client (`src/lib/track.ts`)
-- les met en file et les envoie par lots ; rien n'est relu par le jeu.
--
-- Un appareil se nomme par un identifiant tiré au hasard à sa première
-- ouverture, une ouverture par un autre : c'est ce qui compte les
-- ouvertures sans partie, que `runs` ne voit pas. Le compte n'y est qu'en
-- plus, et s'efface avec lui (`on delete set null`) : l'effacement d'un
-- compte ne laisse que des lignes anonymes. Une fusion de compte anonyme
-- laisse ses lignes sans compte, l'appareil faisant le lien.

create table public.events (
  id bigint generated always as identity primary key,
  player_id uuid references public.profiles on delete set null,
  device text not null,
  session text not null,
  kind text not null,
  props jsonb not null default '{}',
  lang text,
  platform text,
  version text,
  at timestamptz not null,
  created_at timestamptz not null default now()
);

create index events_created_at on public.events (created_at);
create index events_kind_created_at on public.events (kind, created_at);
create index events_device on public.events (device);

alter table public.events enable row level security;
-- Aucune politique : on n'y écrit que par `track`, on n'y lit que par
-- `analytics_snapshot`.

-- Un lot d'événements. Tout ce qui n'a pas la forme attendue est jeté, pas
-- refusé : une file d'appareil corrompue ne doit pas bloquer les suivantes.
-- Au plus deux cents par appel et cinq mille par jour et par compte ; une
-- date d'appareil déréglée est ramenée à l'heure du serveur.
create function public.track(p_events jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_today integer;
  v_room integer;
  v_count integer;
begin
  if auth.uid() is null or jsonb_typeof(p_events) <> 'array' then
    return 0;
  end if;
  select count(*) into v_today from public.events
   where player_id = auth.uid() and created_at > now() - interval '1 day';
  v_room := greatest(0, 5000 - v_today);
  if v_room = 0 then
    return 0;
  end if;

  insert into public.events (player_id, device, session, kind, props, lang, platform, version, at)
  select auth.uid(),
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
              then (e ->> 'at')::timestamptz else now() end
    from (select e from jsonb_array_elements(p_events) e limit least(200, v_room)) batch
   where jsonb_typeof(e) = 'object'
     and (e ->> 'kind') ~ '^[a-z][a-z_]{0,31}$'
     and coalesce(e ->> 'device', '') <> ''
     and coalesce(e ->> 'session', '') <> '';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.track(jsonb) from public, anon;
grant execute on function public.track(jsonb) to authenticated;

-- Le tableau de bord de l'administrateur, d'un bloc : tout ce que la page
-- affiche, calculé ici pour qu'elle n'ait qu'un document à lire. L'heure de
-- Paris, comme les classements ; jamais les joueurs maison (`bots`), ni par
-- leurs parties ni par leurs comptes. Personne n'y a droit depuis l'app :
-- `npm run analytics` la lit par `supabase db query --linked`.
create function public.analytics_snapshot(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 180);
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_from date := v_today - (v_days - 1);
  v_since timestamptz := (v_from::timestamp at time zone 'Europe/Paris');
  v_result jsonb;
begin
  with
  people as (
    select u.id, u.created_at, u.is_anonymous, u.email,
           coalesce(u.email_confirmed_at, u.created_at) as named_at,
           p.display_name, p.runs, p.best_score, p.xp
      from auth.users u
      left join public.profiles p on p.id = u.id
     where not exists (select 1 from public.bots b where b.id = u.id)
  ),
  real_runs as (
    select r.* from public.runs r
     where not exists (select 1 from public.bots b where b.id = r.player_id)
  ),
  period_runs as (
    select * from real_runs where created_at >= v_since
  ),
  ev as (
    select * from public.events where created_at >= v_since
  ),
  -- L'activité d'un joueur, un jour : une partie envoyée, ou un événement.
  activity as (
    select player_id, (created_at at time zone 'Europe/Paris')::date as day from real_runs
    union
    select player_id, (created_at at time zone 'Europe/Paris')::date from public.events where player_id is not null
  ),
  days as (
    select generate_series(v_from, v_today, interval '1 day')::date as day
  ),
  sessions as (
    select session,
           min(device) as device,
           min(created_at) as started,
           bool_or(kind = 'run_start') as played,
           count(*) filter (where kind = 'run_start') as runs,
           max((props ->> 'seconds')::numeric) filter (where kind = 'hide') as seconds
      from ev
     group by session
  )
  select jsonb_build_object(
    'generated_at', now(),
    'days', v_days,
    'tracking_since', (select min(created_at) from public.events),

    'totals', jsonb_build_object(
      'players', (select count(*) from people),
      'named', (select count(*) from people where not is_anonymous),
      'anonymous', (select count(*) from people where is_anonymous),
      'runs', (select count(*) from real_runs),
      'words', (select coalesce(sum(words), 0) from real_runs),
      'challenges', (select count(*) from public.challenges),
      'moderators', (select count(*) from public.moderators),
      'friendships', (select count(*) from public.friendships where status = 'accepted'),
      'submissions_pending', (select count(*) from public.word_submissions where status = 'pending'),
      'submissions_accepted', (select count(*) from public.word_submissions where status = 'accepted'),
      'ideas_open', (select count(*) from public.ideas where archived_at is null),
      'push_devices', (select count(*) from public.push_tokens),
      'devices', (select count(distinct device) from public.events),
      'events', (select count(*) from public.events)
    ),

    'today', jsonb_build_object(
      'runs', (select count(*) from real_runs where (created_at at time zone 'Europe/Paris')::date = v_today),
      'players', (select count(distinct player_id) from activity where day = v_today),
      'new_players', (select count(*) from people where (created_at at time zone 'Europe/Paris')::date = v_today),
      'signups', (select count(*) from people where not is_anonymous and (named_at at time zone 'Europe/Paris')::date = v_today),
      'opens', (select count(*) from public.events where kind = 'open' and (created_at at time zone 'Europe/Paris')::date = v_today)
    ),

    'active', jsonb_build_object(
      'dau', (select count(distinct player_id) from activity where day = v_today),
      'wau', (select count(distinct player_id) from activity where day > v_today - 7),
      'mau', (select count(distinct player_id) from activity where day > v_today - 30)
    ),

    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'new_players', (select count(*) from people p where (p.created_at at time zone 'Europe/Paris')::date = d.day),
        'signups', (select count(*) from people p where not p.is_anonymous and (p.named_at at time zone 'Europe/Paris')::date = d.day),
        'runs', (select count(*) from period_runs r where (r.created_at at time zone 'Europe/Paris')::date = d.day),
        'players', (select count(distinct a.player_id) from activity a where a.day = d.day),
        'opens', (select count(*) from ev e where e.kind = 'open' and (e.created_at at time zone 'Europe/Paris')::date = d.day),
        'sessions_with_run', (select count(*) from sessions s where s.played and (s.started at time zone 'Europe/Paris')::date = d.day),
        'sessions_without_run', (select count(*) from sessions s where not s.played and (s.started at time zone 'Europe/Paris')::date = d.day),
        'challenges', (select count(*) from public.challenges c where (c.created_at at time zone 'Europe/Paris')::date = d.day),
        'submissions', (select count(*) from public.word_submissions w where (w.created_at at time zone 'Europe/Paris')::date = d.day),
        'ideas', (select count(*) from public.ideas i where (i.created_at at time zone 'Europe/Paris')::date = d.day)
      ) order by d.day), '[]'::jsonb)
      from days d
    ),

    -- Quand on joue : jour de la semaine (1 = lundi) et heure de Paris.
    'hourly', (
      select coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'hour', hour, 'runs', n) order by dow, hour), '[]'::jsonb)
        from (
          select extract(isodow from created_at at time zone 'Europe/Paris')::integer as dow,
                 extract(hour from created_at at time zone 'Europe/Paris')::integer as hour,
                 count(*) as n
            from period_runs group by 1, 2
        ) h
    ),

    'sessions', jsonb_build_object(
      'total', (select count(*) from sessions),
      'with_run', (select count(*) from sessions where played),
      'without_run', (select count(*) from sessions where not played),
      'runs_per_session', (select round(avg(runs)::numeric, 2) from sessions where played),
      'median_seconds', (select percentile_cont(0.5) within group (order by seconds) from sessions where seconds is not null),
      'ready_p50_ms', (select percentile_cont(0.5) within group (order by (props ->> 'ms')::numeric) from ev where kind = 'ready'),
      'ready_p90_ms', (select percentile_cont(0.9) within group (order by (props ->> 'ms')::numeric) from ev where kind = 'ready'),
      'cold_opens', (select count(*) from ev where kind = 'open' and props ->> 'cold' = 'true'),
      'resumes', (select count(*) from ev where kind = 'open' and props ->> 'cold' = 'false')
    ),

    'kinds', (
      select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'n', n, 'devices', devices) order by n desc), '[]'::jsonb)
        from (select kind, count(*) as n, count(distinct device) as devices from ev group by kind) k
    ),

    'taps', (
      select coalesce(jsonb_agg(jsonb_build_object('screen', screen, 'label', label, 'n', n, 'devices', devices) order by n desc), '[]'::jsonb)
        from (
          select coalesce(props ->> 'screen', '?') as screen, coalesce(props ->> 'label', '?') as label,
                 count(*) as n, count(distinct device) as devices
            from ev where kind = 'tap' group by 1, 2 order by 3 desc limit 80
        ) t
    ),

    'screens', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'n', n, 'devices', devices) order by n desc), '[]'::jsonb)
        from (
          select props ->> 'name' as name, count(*) as n, count(distinct device) as devices
            from ev where kind = 'screen' group by 1
        ) s
    ),

    'features', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'n', n, 'devices', devices) order by n desc), '[]'::jsonb)
        from (
          select props ->> 'name' as name, count(*) as n, count(distinct device) as devices
            from ev where kind = 'feature' group by 1
        ) f
    ),

    'platforms', (
      select coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'version', version, 'devices', devices) order by devices desc), '[]'::jsonb)
        from (
          select coalesce(platform, '?') as platform, coalesce(version, '?') as version, count(distinct device) as devices
            from ev where kind = 'open' group by 1, 2
        ) p
    ),

    'langs', (
      select coalesce(jsonb_agg(jsonb_build_object('lang', lang, 'devices', devices) order by devices desc), '[]'::jsonb)
        from (select coalesce(lang, '?') as lang, count(distinct device) as devices from ev group by 1) l
    ),

    'errors', (
      select coalesce(jsonb_agg(jsonb_build_object('message', message, 'n', n, 'devices', devices, 'last', last) order by n desc), '[]'::jsonb)
        from (
          select left(props ->> 'message', 200) as message, count(*) as n, count(distinct device) as devices, max(created_at) as last
            from ev where kind = 'error' group by 1 order by 2 desc limit 20
        ) e
    ),

    'runs', jsonb_build_object(
      'count', (select count(*) from period_runs),
      'challenge_runs', (select count(*) from public.challenge_players where played_at >= v_since),
      'avg_score', (select round(avg(score)) from period_runs),
      'median_score', (select percentile_cont(0.5) within group (order by score) from period_runs),
      'avg_words', (select round(avg(words)::numeric, 1) from period_runs),
      'avg_skips', (select round(avg(skips)::numeric, 1) from period_runs),
      'scores', (
        select coalesce(jsonb_agg(jsonb_build_object('from', bucket * 50, 'n', n) order by bucket), '[]'::jsonb)
          from (select least(score / 50, 20) as bucket, count(*) as n from period_runs group by 1) b
      ),
      'powers', (
        select coalesce(jsonb_agg(jsonb_build_object('power', power, 'runs', n, 'avg_score', avg_score) order by n desc), '[]'::jsonb)
          from (
            select power, count(*) as n, round(avg(score)) as avg_score
              from period_runs, unnest(coalesce(powers, '{}')) power group by 1
          ) p
      ),
      'categories', (
        select coalesce(jsonb_agg(jsonb_build_object('category', category_id, 'words', n, 'points', points) order by n desc), '[]'::jsonb)
          from (
            select w.category_id, count(*) as n, sum(w.points) as points
              from public.run_words w join period_runs r on r.id = w.run_id group by 1
          ) c
      ),
      'top_words', (
        select coalesce(jsonb_agg(jsonb_build_object('word', word, 'category', category_id, 'n', n) order by n desc), '[]'::jsonb)
          from (
            select w.word, w.category_id, count(*) as n
              from public.run_words w join period_runs r on r.id = w.run_id
             group by 1, 2 order by 3 desc limit 25
          ) t
      )
    ),

    -- Des nouveaux joueurs de la période, combien ont joué une, trois, dix
    -- parties, et combien ont fini par nommer leur compte.
    'funnel', (
      select jsonb_build_object(
        'new_players', count(*),
        'played_1', count(*) filter (where coalesce(runs, 0) >= 1),
        'played_3', count(*) filter (where coalesce(runs, 0) >= 3),
        'played_10', count(*) filter (where coalesce(runs, 0) >= 10),
        'named', count(*) filter (where not is_anonymous)
      )
      from people where created_at >= v_since
    ),

    -- Par semaine d'arrivée : revenus le lendemain, dans la semaine, ou après.
    'retention', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'week', week, 'size', size, 'd1', d1, 'w1', w1, 'later', later) order by week), '[]'::jsonb)
        from (
          select date_trunc('week', p.created_at at time zone 'Europe/Paris')::date as week,
                 count(*) as size,
                 count(*) filter (where exists (
                   select 1 from activity a where a.player_id = p.id
                      and a.day = (p.created_at at time zone 'Europe/Paris')::date + 1)) as d1,
                 count(*) filter (where exists (
                   select 1 from activity a where a.player_id = p.id
                      and a.day between (p.created_at at time zone 'Europe/Paris')::date + 1
                                    and (p.created_at at time zone 'Europe/Paris')::date + 7)) as w1,
                 count(*) filter (where exists (
                   select 1 from activity a where a.player_id = p.id
                      and a.day > (p.created_at at time zone 'Europe/Paris')::date + 7)) as later
            from people p
           where p.created_at >= now() - interval '12 weeks'
           group by 1
        ) c
    ),

    'recent_signups', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', display_name, 'at', named_at, 'runs', coalesce(runs, 0), 'best', coalesce(best_score, 0)) order by named_at desc), '[]'::jsonb)
        from (select * from people where not is_anonymous order by named_at desc limit 15) s
    ),

    'top_players', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', name, 'runs', n, 'best', best, 'anonymous', anonymous) order by n desc), '[]'::jsonb)
        from (
          select coalesce(nullif(p.display_name, 'Anonyme'), 'Anonyme ' || left(p.id::text, 4)) as name,
                 p.is_anonymous as anonymous, count(*) as n, max(r.score) as best
            from period_runs r join people p on p.id = r.player_id
           group by p.id, p.display_name, p.is_anonymous order by 3 desc limit 15
        ) t
    ),

    'moderation', jsonb_build_object(
      'votes', (select count(*) from public.moderation_votes where created_at >= v_since),
      'submitted', (select count(*) from public.word_submissions where created_at >= v_since),
      'accepted', (select count(*) from public.word_submissions where created_at >= v_since and status = 'accepted'),
      'rejected', (select count(*) from public.word_submissions where created_at >= v_since and status = 'rejected')
    ),

    'challenges', jsonb_build_object(
      'created', (select count(*) from public.challenges where created_at >= v_since),
      'avg_players', (
        select round(avg(n)::numeric, 1) from (
          select count(*) as n from public.challenge_players cp
            join public.challenges c on c.id = cp.challenge_id
           where c.created_at >= v_since group by cp.challenge_id) x),
      'played_share', (
        select round(avg(case when cp.played_at is not null then 1.0 else 0 end), 2)
          from public.challenge_players cp join public.challenges c on c.id = cp.challenge_id
         where c.created_at >= v_since)
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.analytics_snapshot(integer) from public, anon, authenticated;
