-- Les tests d'un agent n'ont pas leur place dans le tableau de bord. Un
-- navigateur piloté (`navigator.webdriver`), un serveur de développement ou un
-- client que le développeur a marqué comme test (`src/lib/testClient.ts`)
-- étiquette ses parties et ses événements : le relevé les écarte, comme il
-- écarte déjà les joueurs maison (0024) et l'administrateur (0031).
--
-- Sans cela, chaque test créait un compte anonyme neuf — une nouvelle
-- installation ne réutilise aucun identifiant — et comptait comme un joueur,
-- une ouverture et une partie.
--
-- `analytics_core` (0031) et `analytics_extras` (0036) sont recopiées ici pour
-- les seules lignes qui changent : une fonction se remplace en entier, et 0036
-- fusionne les deux sous `analytics_snapshot`.

alter table public.events add column test boolean not null default false;
alter table public.runs add column test boolean not null default false;

create index events_test_idx on public.events (test) where test;
create index runs_test_idx on public.runs (test) where test;

-- Le lot d'événements (0029) reçoit le marqueur. Un envoi d'avant la colonne
-- n'a pas de champ `test` : il retombe sur `false`, comme un vrai client.
create or replace function public.track(p_events jsonb) returns integer
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

  insert into public.events (player_id, device, session, kind, props, lang, platform, version, at, test)
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
              then (e ->> 'at')::timestamptz else now() end,
         coalesce((e ->> 'test')::boolean, false)
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

create or replace function public.analytics_core(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 180);
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_from date := v_today - (v_days - 1);
  v_since timestamptz := (v_from::timestamp at time zone 'Europe/Paris');
  v_midnight timestamptz := (v_today::timestamp at time zone 'Europe/Paris');
  v_result jsonb;
begin
  with
  -- Un compte qui n'a jamais rien fait qu'en test n'en est pas un : c'est le
  -- compte anonyme neuf qu'un agent se crée, et qui resterait dans le nombre
  -- de joueurs sans y avoir mis ni ouverture, ni partie.
  test_accounts as (
    select u.id from auth.users u
     where (exists (select 1 from public.runs r where r.player_id = u.id and r.test)
         or exists (select 1 from public.events e where e.player_id = u.id and e.test))
       and not exists (select 1 from public.runs r where r.player_id = u.id and not r.test)
       and not exists (select 1 from public.events e where e.player_id = u.id and not e.test)
  ),
  staff as (
    select id from public.admins
  ),
  -- Une fusion de compte anonyme laisse ses événements sans compte : c'est
  -- l'appareil qui les rattache à l'administrateur.
  staff_devices as (
    select distinct device from public.events where player_id in (select id from staff)
  ),
  all_ev as (
    select * from public.events e
     where not e.test
     and not exists (select 1 from staff where staff.id = e.player_id)
     and not exists (select 1 from staff_devices d where d.device = e.device)
  ),
  real_challenges as (
    select * from public.challenges c where not exists (select 1 from staff where staff.id = c.owner)
  ),
  real_players as (
    select cp.* from public.challenge_players cp
    join real_challenges c on c.id = cp.challenge_id
    where not exists (select 1 from staff where staff.id = cp.player_id)
  ),
  people as (
    select u.id, u.created_at, u.is_anonymous, u.email,
           coalesce(u.email_confirmed_at, u.created_at) as named_at,
           p.display_name, p.runs, p.best_score, p.xp
      from auth.users u
      left join public.profiles p on p.id = u.id
     where not exists (select 1 from public.bots b where b.id = u.id)
     and not exists (select 1 from staff where staff.id = u.id)
     and not exists (select 1 from test_accounts t where t.id = u.id)
  ),
  real_runs as (
    select r.* from public.runs r
     where not r.test
     and not exists (select 1 from public.bots b where b.id = r.player_id)
     and not exists (select 1 from staff where staff.id = r.player_id)
     and not exists (select 1 from test_accounts t where t.id = r.player_id)
  ),
  period_runs as (
    select * from real_runs where created_at >= v_since
  ),
  ev as (
    select * from all_ev where created_at >= v_since
  ),
  -- L'activité d'un joueur, un jour : une partie envoyée, ou un événement.
  activity as (
    select player_id, (created_at at time zone 'Europe/Paris')::date as day from real_runs
    union
    select player_id, (created_at at time zone 'Europe/Paris')::date from all_ev where player_id is not null
  ),
  today_activity as (
    select player_id, extract(hour from created_at at time zone 'Europe/Paris')::integer as hour
    from real_runs where created_at >= v_midnight
    union
    select player_id, extract(hour from created_at at time zone 'Europe/Paris')::integer
    from all_ev where player_id is not null and created_at >= v_midnight
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
    'tracking_since', (select min(created_at) from all_ev),

    'totals', jsonb_build_object(
      'players', (select count(*) from people),
      'named', (select count(*) from people where not is_anonymous),
      'anonymous', (select count(*) from people where is_anonymous),
      'runs', (select count(*) from real_runs),
      'words', (select coalesce(sum(words), 0) from real_runs),
      'challenges', (select count(*) from real_challenges),
      'moderators', (select count(*) from public.moderators m where not exists (select 1 from staff where staff.id = m.id)),
      'friendships', (select count(*) from public.friendships f
       where f.status = 'accepted' and not exists (select 1 from staff where staff.id = f.requester) and not exists (select 1 from staff where staff.id = f.addressee)),
      'submissions_pending', (select count(*) from public.word_submissions w where w.status = 'pending' and not exists (select 1 from staff where staff.id = w.player_id)),
      'submissions_accepted', (select count(*) from public.word_submissions w where w.status = 'accepted' and not exists (select 1 from staff where staff.id = w.player_id)),
      'ideas_open', (select count(*) from public.ideas i where i.archived_at is null and not exists (select 1 from staff where staff.id = i.player_id)),
      'push_devices', (select count(*) from public.push_tokens t where not exists (select 1 from staff where staff.id = t.player_id)),
      'devices', (select count(distinct device) from all_ev),
      'events', (select count(*) from all_ev)
    ),

    'today', jsonb_build_object(
      'runs', (select count(*) from real_runs where (created_at at time zone 'Europe/Paris')::date = v_today),
      'players', (select count(distinct player_id) from activity where day = v_today),
      'new_players', (select count(*) from people where (created_at at time zone 'Europe/Paris')::date = v_today),
      'signups', (select count(*) from people where not is_anonymous and (named_at at time zone 'Europe/Paris')::date = v_today),
      'opens', (select count(*) from all_ev where kind = 'open' and (created_at at time zone 'Europe/Paris')::date = v_today)
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
        'challenges', (select count(*) from real_challenges c where (c.created_at at time zone 'Europe/Paris')::date = d.day),
        'submissions', (select count(*) from public.word_submissions w where not exists (select 1 from staff where staff.id = w.player_id) and (w.created_at at time zone 'Europe/Paris')::date = d.day),
        'ideas', (select count(*) from public.ideas i where not exists (select 1 from staff where staff.id = i.player_id) and (i.created_at at time zone 'Europe/Paris')::date = d.day)
      ) order by d.day), '[]'::jsonb)
      from days d
    ),

    -- Aujourd'hui heure par heure, jusqu'à l'heure en cours : les mêmes
    -- colonnes que `daily`, pour que la page les dessine pareil.
    'today_hourly', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', v_today,
        'hour', h.hour,
        'new_players', (select count(*) from people p where p.created_at >= v_midnight and extract(hour from p.created_at at time zone 'Europe/Paris') = h.hour),
        'signups', (select count(*) from people p where not p.is_anonymous and p.named_at >= v_midnight and extract(hour from p.named_at at time zone 'Europe/Paris') = h.hour),
        'runs', (select count(*) from period_runs r where r.created_at >= v_midnight and extract(hour from r.created_at at time zone 'Europe/Paris') = h.hour),
        'players', (select count(distinct a.player_id) from today_activity a where a.hour = h.hour),
        'opens', (select count(*) from ev e where e.kind = 'open' and e.created_at >= v_midnight and extract(hour from e.created_at at time zone 'Europe/Paris') = h.hour),
        'sessions_with_run', (select count(*) from sessions s where s.played and s.started >= v_midnight and extract(hour from s.started at time zone 'Europe/Paris') = h.hour),
        'sessions_without_run', (select count(*) from sessions s where not s.played and s.started >= v_midnight and extract(hour from s.started at time zone 'Europe/Paris') = h.hour),
        'challenges', (select count(*) from real_challenges c where c.created_at >= v_midnight and extract(hour from c.created_at at time zone 'Europe/Paris') = h.hour),
        'submissions', (select count(*) from public.word_submissions w where not exists (select 1 from staff where staff.id = w.player_id) and w.created_at >= v_midnight and extract(hour from w.created_at at time zone 'Europe/Paris') = h.hour),
        'ideas', (select count(*) from public.ideas i where not exists (select 1 from staff where staff.id = i.player_id) and i.created_at >= v_midnight and extract(hour from i.created_at at time zone 'Europe/Paris') = h.hour)
      ) order by h.hour), '[]'::jsonb)
      from generate_series(0, extract(hour from now() at time zone 'Europe/Paris')::integer) as h(hour)
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
      'challenge_runs', (select count(*) from real_players where played_at >= v_since),
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
      'votes', (select count(*) from public.moderation_votes v where v.created_at >= v_since and not exists (select 1 from staff where staff.id = v.moderator_id)),
      'submitted', (select count(*) from public.word_submissions w where w.created_at >= v_since and not exists (select 1 from staff where staff.id = w.player_id)),
      'accepted', (select count(*) from public.word_submissions w where w.created_at >= v_since and not exists (select 1 from staff where staff.id = w.player_id) and status = 'accepted'),
      'rejected', (select count(*) from public.word_submissions w where w.created_at >= v_since and not exists (select 1 from staff where staff.id = w.player_id) and status = 'rejected')
    ),

    'challenges', jsonb_build_object(
      'created', (select count(*) from real_challenges where created_at >= v_since),
      'avg_players', (
        select round(avg(n)::numeric, 1) from (
          select count(*) as n from real_players cp
          join real_challenges c on c.id = cp.challenge_id
          where c.created_at >= v_since group by cp.challenge_id) x),
      'played_share', (
        select round(avg(case when cp.played_at is not null then 1.0 else 0 end), 2)
        from real_players cp join real_challenges c on c.id = cp.challenge_id
        where c.created_at >= v_since)
    )
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.analytics_extras(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 180);
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_from date := v_today - (v_days - 1);
  v_since timestamptz := (v_from::timestamp at time zone 'Europe/Paris');
  v_result jsonb;
begin
  with
  test_accounts as (
    select u.id from auth.users u
     where (exists (select 1 from public.runs r where r.player_id = u.id and r.test)
         or exists (select 1 from public.events e where e.player_id = u.id and e.test))
       and not exists (select 1 from public.runs r where r.player_id = u.id and not r.test)
       and not exists (select 1 from public.events e where e.player_id = u.id and not e.test)
  ),
  staff as (
    select id from public.admins
  ),
  staff_devices as (
    select distinct device from public.events where player_id in (select id from staff)
  ),
  -- Une adresse qui jouait déjà reçoit une demande d'ami, pas un mail : elle
  -- se reconnaît à `joined_at`, posé dans la même transaction que la ligne.
  mails as (
    select i.*, i.joined_by is not null and i.joined_at = i.created_at as known
      from public.tester_invites i
     where i.invited_by is not null and not exists (select 1 from staff where staff.id = i.invited_by)
  ),
  mail_joins as (
    select invited_by as inviter, joined_by as invitee, joined_at as at
      from mails where joined_by is not null and not known
  ),
  link_joins as (
    select inviter, invitee, created_at as at
      from public.invite_accepts a
     where a.inviter is not null and not exists (select 1 from staff where staff.id = a.inviter)
  ),
  joins as (
    select 'mail' as via, * from mail_joins
    union all
    select 'link', * from link_joins
  ),
  shares as (
    select e.player_id, e.device, e.created_at
      from public.events e
     where e.kind = 'tap' and e.props ->> 'label' like 'invite-%'
       and not e.test
       and not exists (select 1 from staff where staff.id = e.player_id)
       and not exists (select 1 from staff_devices d where d.device = e.device)
       and not exists (select 1 from test_accounts t where t.id = e.player_id)
  ),
  days as (
    select generate_series(v_from, v_today, interval '1 day')::date as day
  ),
  pairs as (
    select s.*, sum(s.dealt) over (partition by s.lang) as lang_dealt
      from public.prompt_stats s where s.dealt > 0
  )
  select jsonb_build_object(
    'invites', jsonb_build_object(
      'mails', (select count(*) from mails where created_at >= v_since and not known),
      'mails_to_players', (select count(*) from mails where created_at >= v_since and known),
      'mail_joins', (select count(*) from mails where created_at >= v_since and not known and joined_by is not null),
      'shares', (select count(*) from shares where created_at >= v_since),
      'sharers', (select count(distinct device) from shares where created_at >= v_since),
      'link_joins', (select count(*) from link_joins where at >= v_since),
      'played', (select count(*) from joins j join public.profiles p on p.id = j.invitee where j.at >= v_since and p.runs > 0),
      'links_since', (select min(created_at) from public.invite_accepts),
      'daily', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'day', d.day,
          'mails', (select count(*) from mails m where not m.known and (m.created_at at time zone 'Europe/Paris')::date = d.day),
          'shares', (select count(*) from shares s where (s.created_at at time zone 'Europe/Paris')::date = d.day),
          'joins', (select count(*) from joins j where (j.at at time zone 'Europe/Paris')::date = d.day)
        ) order by d.day), '[]'::jsonb)
        from days d
      ),
      -- Depuis toujours : sur une période, trop peu d'inviteurs pour un classement.
      'top', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', name, 'anonymous', anonymous, 'mails', mails, 'shares', shares,
          'joins', joins, 'played', played) order by joins desc, played desc, mails + shares desc), '[]'::jsonb)
        from (
          select * from (
            select coalesce(nullif(p.display_name, 'Anonyme'), 'Anonyme ' || left(p.id::text, 4)) as name,
                   u.is_anonymous as anonymous,
                   (select count(*) from mails m where m.invited_by = p.id and not m.known) as mails,
                   (select count(*) from shares s where s.player_id = p.id) as shares,
                   (select count(*) from joins j where j.inviter = p.id) as joins,
                   (select count(*) from joins j join public.profiles q on q.id = j.invitee where j.inviter = p.id and q.runs > 0) as played
              from public.profiles p
              join auth.users u on u.id = p.id
             where not exists (select 1 from staff where staff.id = p.id)
               and not exists (select 1 from public.bots b where b.id = p.id)
               and not exists (select 1 from test_accounts t where t.id = p.id)
               and (exists (select 1 from mails m where m.invited_by = p.id)
                 or exists (select 1 from shares s where s.player_id = p.id)
                 or exists (select 1 from joins j where j.inviter = p.id))
          ) i
          order by joins desc, played desc, mails + shares desc
          limit 20
        ) t
      )
    ),

    -- Les compteurs du tirage (0022) : depuis toujours, toutes parties seules
    -- confondues, administrateur compris — ils ne savent pas qui a joué.
    'prompts', jsonb_build_object(
      'langs', (
        select coalesce(jsonb_agg(jsonb_build_object('lang', lang, 'dealt', dealt, 'passed', passed, 'pairs', pairs) order by dealt desc), '[]'::jsonb)
        from (select lang, sum(dealt) as dealt, sum(passed) as passed, count(*) as pairs from pairs group by lang) l
      ),
      'most_passed', (
        select coalesce(jsonb_agg(row order by passed desc, dealt desc), '[]'::jsonb)
        from (
          select jsonb_build_object('lang', lang, 'category', category_id, 'letter', letter, 'dealt', dealt,
                 'passed', passed, 'words', words, 'points', points, 'lang_dealt', lang_dealt) as row, passed, dealt
            from pairs order by passed desc, dealt desc limit 60
        ) m
      ),
      -- Au moins dix tirages : en dessous, un taux de passe ne dit rien.
      'worst_rate', (
        select coalesce(jsonb_agg(row order by rate desc, dealt desc), '[]'::jsonb)
        from (
          select jsonb_build_object('lang', lang, 'category', category_id, 'letter', letter, 'dealt', dealt,
                 'passed', passed, 'words', words, 'points', points, 'lang_dealt', lang_dealt) as row,
                 passed::numeric / dealt as rate, dealt
            from pairs where dealt >= 10 order by 2 desc, dealt desc limit 60
        ) w
      )
    )
  ) into v_result;
  return v_result;
end;
$$;

-- Le détail d'une barre : mêmes exclusions que le relevé, tests compris.
create or replace function public.analytics_slot(p_day date, p_hour integer default null) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_start timestamptz := (case when p_hour is null then p_day::timestamp
    else p_day::timestamp + make_interval(hours => p_hour) end) at time zone 'Europe/Paris';
  v_end timestamptz := v_start + case when p_hour is null then interval '1 day' else interval '1 hour' end;
  v_result jsonb;
begin
  with
  test_accounts as (
    select u.id from auth.users u
     where (exists (select 1 from public.runs r where r.player_id = u.id and r.test)
         or exists (select 1 from public.events e where e.player_id = u.id and e.test))
       and not exists (select 1 from public.runs r where r.player_id = u.id and not r.test)
       and not exists (select 1 from public.events e where e.player_id = u.id and not e.test)
  ),
  staff as (
    select id from public.admins
  ),
  staff_devices as (
    select distinct device from public.events where player_id in (select id from staff)
  ),
  -- Une session commencée la veille compte le jour où elle commence, comme
  -- dans le relevé : ses événements se lisent donc un jour plus tôt.
  ev as (
    select * from public.events e
     where e.created_at >= v_start - interval '1 day' and e.created_at < v_end
       and not e.test
       and not exists (select 1 from staff where staff.id = e.player_id)
       and not exists (select 1 from staff_devices d where d.device = e.device)
  ),
  sessions as (
    select session,
           (array_agg(player_id) filter (where player_id is not null))[1] as player_id,
           min(device) as device,
           min(created_at) as started,
           bool_or(kind = 'run_start') as played
      from ev group by session
  ),
  -- Un appareil qui n'a que des tests ne se détaille pas non plus. Une session
  -- sans événement (dont l'ouverture est tombée la veille) reste comptée :
  -- elle n'est pas celle d'un test.
  slot_sessions as (
    select * from sessions where started >= v_start and started < v_end and device is not null
  ),
  slot_runs as (
    select r.player_id, count(*) as n, max(r.score) as best, sum(r.words) as words
      from public.runs r
     where r.created_at >= v_start and r.created_at < v_end
       and not r.test
       and not exists (select 1 from public.bots b where b.id = r.player_id)
       and not exists (select 1 from staff where staff.id = r.player_id)
       and not exists (select 1 from test_accounts t where t.id = r.player_id)
     group by r.player_id
  ),
  slot_mails as (
    select invited_by as player_id, count(*) as n from public.tester_invites
     where created_at >= v_start and created_at < v_end and invited_by is not null
       and not (joined_by is not null and joined_at = created_at)
     group by 1
  ),
  slot_shares as (
    select player_id, count(*) as n from ev
     where kind = 'tap' and props ->> 'label' like 'invite-%' and player_id is not null
       and created_at >= v_start
     group by 1
  ),
  slot_invited as (
    select joined_by as player_id, invited_by as inviter from public.tester_invites
     where joined_at >= v_start and joined_at < v_end and joined_at <> created_at
    union
    select invitee, inviter from public.invite_accepts where created_at >= v_start and created_at < v_end
  ),
  ids as (
    select player_id as id from slot_runs
    union select player_id from ev where player_id is not null and created_at >= v_start
    union select player_id from slot_sessions where player_id is not null
    union select u.id from auth.users u where u.created_at >= v_start and u.created_at < v_end
    union select u.id from auth.users u
     where not u.is_anonymous and coalesce(u.email_confirmed_at, u.created_at) >= v_start
       and coalesce(u.email_confirmed_at, u.created_at) < v_end
    union select player_id from slot_mails
    union select player_id from slot_shares
    union select player_id from slot_invited
  ),
  last_seen as (
    select distinct on (player_id) player_id, lang, platform, version
      from public.events where player_id in (select id from ids) and kind = 'open' and not test
     order by player_id, created_at desc
  ),
  people as (
    select jsonb_build_object(
      'key', u.id,
      'name', coalesce(nullif(p.display_name, 'Anonyme'), 'Anonyme ' || left(u.id::text, 4)),
      'anonymous', u.is_anonymous,
      'avatar', p.avatar,
      'xp', coalesce(p.xp, 0),
      'total_runs', coalesce(p.runs, 0),
      'total_best', coalesce(p.best_score, 0),
      'words_found', coalesce(p.words_found, 0),
      'created_at', u.created_at,
      'named_at', case when not u.is_anonymous then coalesce(u.email_confirmed_at, u.created_at) end,
      'moderator', exists (select 1 from public.moderators m where m.id = u.id),
      'friends', (select count(*) from public.friendships f
       where f.status = 'accepted' and (f.requester = u.id or f.addressee = u.id)),
      'lang', ls.lang, 'platform', ls.platform, 'version', ls.version,
      'runs', coalesce(sr.n, 0), 'best', sr.best, 'words', coalesce(sr.words, 0),
      'active', sr.n is not null or exists (select 1 from ev e where e.player_id = u.id and e.created_at >= v_start),
      'arrived', u.created_at >= v_start and u.created_at < v_end,
      'signed', not u.is_anonymous and coalesce(u.email_confirmed_at, u.created_at) >= v_start
        and coalesce(u.email_confirmed_at, u.created_at) < v_end,
      'sessions_with_run', (select count(*) from slot_sessions s where s.player_id = u.id and s.played),
      'sessions_without_run', (select count(*) from slot_sessions s where s.player_id = u.id and not s.played),
      'mails', coalesce(sm.n, 0), 'shares', coalesce(ss.n, 0),
      'invited_by', (select coalesce(nullif(q.display_name, 'Anonyme'), 'Anonyme ' || left(q.id::text, 4))
        from slot_invited i join public.profiles q on q.id = i.inviter
        where i.player_id = u.id limit 1)
    ) as row,
    coalesce(sr.n, 0) as sort
    from ids
    join auth.users u on u.id = ids.id
    left join public.profiles p on p.id = u.id
    left join slot_runs sr on sr.player_id = u.id
    left join slot_mails sm on sm.player_id = u.id
    left join slot_shares ss on ss.player_id = u.id
    left join last_seen ls on ls.player_id = u.id
    where not exists (select 1 from public.bots b where b.id = u.id)
      and not exists (select 1 from staff where staff.id = u.id)
      and not exists (select 1 from test_accounts t where t.id = u.id)
  ),
  devices as (
    select jsonb_build_object(
      'key', 'device:' || device,
      'name', 'Appareil ' || left(device, 4),
      'device', true,
      'sessions_with_run', count(*) filter (where played),
      'sessions_without_run', count(*) filter (where not played)
    ) as row
    from slot_sessions where player_id is null group by device
  )
  select coalesce(jsonb_agg(row order by sort desc, row ->> 'name'), '[]'::jsonb)
      || (select coalesce(jsonb_agg(row), '[]'::jsonb) from devices)
    into v_result
    from people;
  return v_result;
end;
$$;

-- `analytics_snapshot` (0036) relit les deux corps : recréé pour se poser
-- après eux, sans changement.
create or replace function public.analytics_snapshot(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.analytics_core(p_days) || public.analytics_extras(p_days);
$$;

create or replace function public.admin_slot(p_day date, p_hour integer default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then public.analytics_slot(p_day, p_hour) end;
$$;

revoke execute on function public.analytics_core(integer), public.analytics_extras(integer),
  public.analytics_snapshot(integer), public.analytics_slot(date, integer) from public, anon, authenticated;
revoke execute on function public.admin_slot(date, integer) from public, anon;
