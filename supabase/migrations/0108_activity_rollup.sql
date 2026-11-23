-- Le relevé du tableau de bord relisait `events` en entier à chaque heure
-- (55 Mo, 170 000 lignes) pour en tirer quelques centaines de couples
-- « joueur, jour » : la rétention, les cohortes et la plateforme de chacun.
-- Budget disque épuisé, chaque lecture complète prenait près d'une minute,
-- et `analytics_insights` en faisait plusieurs (le 23 novembre, plus de deux
-- minutes). Ces couples vivent désormais dans `activity_days`, que chaque
-- passage horaire complète de ce qui est arrivé depuis le précédent, par
-- l'index sur `created_at` ; une reconstruction de nuit rattrape les
-- comptes fusionnés ou effacés. Le relevé lit le cumul plus la traîne depuis
-- son dernier passage : ses chiffres restent ceux d'avant.

create table public.activity_days (
  player_id uuid not null,
  day date not null,
  source text not null check (source in ('run', 'event')),
  device text not null,
  platform text not null,
  test boolean not null,
  n integer not null,
  primary key (player_id, day, source, device, platform, test)
);
alter table public.activity_days enable row level security;

create table public.activity_days_mark (
  id boolean primary key default true check (id),
  upto timestamptz not null
);
alter table public.activity_days_mark enable row level security;

-- Sans `security definer` ni `set` pour rester incorporée à la requête qui
-- l'appelle : ses bornes y sont connues et les index sur `created_at` servent.
create function public.activity_rows(p_from timestamptz, p_to timestamptz)
returns table (player_id uuid, day date, source text, device text, platform text, test boolean, n integer)
language sql stable as $$
  select r.player_id, (r.created_at at time zone 'Europe/Paris')::date, 'run'::text, ''::text,
         coalesce(r.platform, ''), r.test, count(*)::integer
    from public.runs r
   where r.created_at >= p_from and r.created_at < p_to
   group by 1, 2, 5, 6
  union all
  select e.player_id, (e.created_at at time zone 'Europe/Paris')::date, 'event'::text, e.device,
         coalesce(e.platform, ''), e.test, count(*)::integer
    from public.events e
   where e.player_id is not null and e.created_at >= p_from and e.created_at < p_to
   group by 1, 2, 4, 5, 6
$$;

-- Cinq minutes de retard : une partie ou un lot d'événements daté du début
-- de sa transaction n'est pas encore visible quand elle commence à peine.
create function public.refresh_activity() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_from timestamptz;
  v_to timestamptz := now() - interval '5 minutes';
begin
  if not pg_try_advisory_xact_lock(hashtext('activity_days')) then
    return;
  end if;
  select upto into v_from from public.activity_days_mark;
  if v_from is null then
    v_from := '-infinity';
    insert into public.activity_days_mark (upto) values (v_from);
  end if;
  if v_to <= v_from then
    return;
  end if;
  insert into public.activity_days (player_id, day, source, device, platform, test, n)
  select * from public.activity_rows(v_from, v_to)
  on conflict (player_id, day, source, device, platform, test)
  do update set n = public.activity_days.n + excluded.n;
  update public.activity_days_mark set upto = v_to;
end;
$$;

create function public.rebuild_activity() returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.activity_days where true;
  delete from public.activity_days_mark where true;
  perform public.refresh_activity();
end;
$$;

revoke execute on function public.activity_rows(timestamptz, timestamptz), public.refresh_activity(),
  public.rebuild_activity() from public, anon, authenticated;

-- Le corps de 0084, avec `test_accounts`, l'activité et la plateforme déclarée
-- tirés du cumul, et les événements de la période lus par leur date.
create or replace function public.analytics_insights(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 180);
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_from date := v_today - (v_days - 1);
  v_since timestamptz := (v_from::timestamp at time zone 'Europe/Paris');
  v_midnight timestamptz := (v_today::timestamp at time zone 'Europe/Paris');
  v_result jsonb;
  v_mark timestamptz := coalesce((select upto from public.activity_days_mark), '-infinity');
begin
  with
  -- Le cumul tenu à jour par `refresh_activity`, plus ce qui est arrivé depuis
  -- son dernier passage : les deux se lisent par index, jamais `events` entier.
  act as (
    select a.player_id, a.day, a.source, a.device, a.platform, a.test, a.n from public.activity_days a
    union all
    select t.* from public.activity_rows(v_mark, 'infinity') t
  ),
  flags as (
    select player_id, bool_or(test) as any_test, bool_or(not test) as any_real
      from act group by player_id
  ),
  test_accounts as (
    select u.id from auth.users u left join flags f on f.player_id = u.id
     where (f.any_test and not f.any_real)
        or (u.is_anonymous and f.player_id is null)
  ),
  staff as (
    select id from public.admins
  ),
  staff_devices as (
    select distinct device from public.events where player_id in (select id from staff)
  ),
  ev as (
    select * from public.events e
     where e.created_at >= v_since
       and not e.test
       and not exists (select 1 from staff where staff.id = e.player_id)
       and not exists (select 1 from staff_devices d where d.device = e.device)
  ),
  people as (
    select u.id, (u.created_at at time zone 'Europe/Paris')::date as arrived
      from auth.users u
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
  -- Comme `analytics_core` : une partie envoyée, ou un événement.
  activity as (
    select player_id, (created_at at time zone 'Europe/Paris')::date as day from real_runs
    union
    select a.player_id, a.day from act a
     where a.source = 'event' and not a.test
       and not exists (select 1 from staff where staff.id = a.player_id)
       and not exists (select 1 from staff_devices d where d.device = a.device)
  ),
  days as (
    select generate_series(v_from, v_today, interval '1 day')::date as day
  ),
  -- Ses jours d'activité, comptés depuis son arrivée, pour qui est arrivé ces
  -- quatre-vingt-dix derniers jours.
  arrivals as (
    select id, arrived from people where arrived >= v_today - 90
  ),
  offs as (
    select distinct a.id, x.day - a.arrived as k
      from arrivals a join activity x on x.player_id = a.id
     where x.day > a.arrived
  ),
  reach as (
    select id, max(k) as last from offs group by id
  ),
  said_platform as (
    select a.player_id, a.platform, sum(a.n) as n
      from act a
     where a.source = 'event' and a.platform in ('android', 'web', 'crazygames', 'reddit') and not a.test
     group by 1, 2
  ),
  who as (
    select a.id, a.arrived, coalesce(l.lang, '?') as lang,
           case
             when exists (select 1 from public.crazygames_accounts c where c.player_id = a.id) then 'crazygames'
             else coalesce(
               (select s.platform from said_platform s where s.player_id = a.id order by s.n desc, s.platform limit 1),
               (select r.platform from public.runs r where r.player_id = a.id and r.platform is not null
                 order by r.created_at desc limit 1),
               'inconnu')
           end as platform
      from arrivals a left join public.analytics_player_langs() l on l.player_id = a.id
  ),
  sessions as (
    select session,
           min(created_at) as started,
           coalesce(min(platform) filter (where platform in ('android', 'web', 'crazygames', 'reddit')), 'inconnu') as platform,
           bool_or(kind = 'run_start') as played,
           count(*) filter (where kind = 'run_start') as runs,
           max((props ->> 'seconds')::numeric) filter (where kind = 'hide') as seconds
      from ev
     group by session
  ),
  choice_ev as (
    select c.kind, c.props ->> c.kind as item, c.props -> 'offered' as offered, c.device
      from (
        select split_part(props ->> 'name', '_', 1) as kind, props, device
          from ev
         where kind = 'feature' and props ->> 'name' in ('category_chosen', 'power_chosen', 'bonus_chosen')
      ) c
  ),
  choice_items as (
    select kind, item, 0 as offered, 1 as chosen,
           case when jsonb_typeof(offered) = 'array' then 1 else 0 end as picked, device
      from choice_ev where item is not null
    union all
    select c.kind, o.item, 1, 0, 0, c.device
      from choice_ev c, jsonb_array_elements_text(c.offered) o(item)
     where jsonb_typeof(c.offered) = 'array'
  )
  select jsonb_build_object(
    'choices', jsonb_build_object(
      'kinds', (
        select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'n', n, 'with_offer', with_offer, 'devices', devices) order by kind), '[]'::jsonb)
        from (
          select kind, count(*) as n, count(*) filter (where jsonb_typeof(offered) = 'array') as with_offer,
                 count(distinct device) as devices
            from choice_ev group by kind
        ) k
      ),
      'items', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'kind', kind, 'item', item, 'offered', offered, 'chosen', chosen, 'picked', picked, 'devices', devices)
          order by kind, chosen desc, offered desc), '[]'::jsonb)
        from (
          select kind, item, sum(offered) as offered, sum(chosen) as chosen, sum(picked) as picked,
                 count(distinct device) filter (where chosen = 1) as devices
            from choice_items group by kind, item
        ) i
      )
    ),

    -- Arrivés du jour : le compte est né ce jour-là (heure de Paris). Le reste
    -- de `daily` (parties, joueurs) moins ces chiffres, ce sont les revenants.
    'split', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'runs_new', (select count(*) from real_runs r join people p on p.id = r.player_id
                      where r.created_at >= v_since and (r.created_at at time zone 'Europe/Paris')::date = d.day and p.arrived = d.day),
        'players_new', (select count(distinct a.player_id) from activity a join people p on p.id = a.player_id
                         where a.day = d.day and p.arrived = d.day)
      ) order by d.day), '[]'::jsonb)
      from days d
    ),
    'today_split', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'hour', h.hour,
        'runs_new', (select count(*) from real_runs r join people p on p.id = r.player_id
                      where r.created_at >= v_midnight and p.arrived = v_today
                        and extract(hour from r.created_at at time zone 'Europe/Paris') = h.hour),
        'players_new', (select count(distinct x.player_id) from (
                          select player_id, created_at from real_runs where created_at >= v_midnight
                          union all
                          select player_id, created_at from ev where player_id is not null and created_at >= v_midnight
                        ) x join people p on p.id = x.player_id
                         where p.arrived = v_today and extract(hour from x.created_at at time zone 'Europe/Paris') = h.hour)
      ) order by h.hour), '[]'::jsonb)
      from generate_series(0, extract(hour from now() at time zone 'Europe/Paris')::integer) as h(hour)
    ),

    'sessions_by_platform', jsonb_build_object(
      'totals', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'platform', platform, 'total', total, 'with_run', with_run, 'runs_per_session', per,
          'median_seconds', median) order by total desc), '[]'::jsonb)
        from (
          select platform, count(*) as total, count(*) filter (where played) as with_run,
                 round(avg(runs) filter (where played), 2) as per,
                 percentile_cont(0.5) within group (order by seconds) as median
            from sessions group by platform
        ) t
      ),
      'daily', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'day', day, 'platform', platform, 'with_run', w, 'without_run', wo) order by day, platform), '[]'::jsonb)
        from (
          select (started at time zone 'Europe/Paris')::date as day, platform,
                 count(*) filter (where played) as w, count(*) filter (where not played) as wo
            from sessions group by 1, 2
        ) x
      ),
      'today_hourly', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'hour', hour, 'platform', platform, 'with_run', w, 'without_run', wo) order by hour, platform), '[]'::jsonb)
        from (
          select extract(hour from started at time zone 'Europe/Paris')::integer as hour, platform,
                 count(*) filter (where played) as w, count(*) filter (where not played) as wo
            from sessions where started >= v_midnight group by 1, 2
        ) x
      )
    ),

    -- J1 à J30 : parmi les arrivés dont ce jour est fini, ceux qui sont revenus
    -- ce jour-là, et ceux qui sont revenus ce jour-là ou plus tard.
    'retention_curve', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', k.k,
        'eligible', (select count(*) from arrivals a where a.arrived + k.k < v_today),
        'exact', (select count(*) from offs o join arrivals a on a.id = o.id where o.k = k.k and a.arrived + k.k < v_today),
        'rolling', (select count(*) from reach r join arrivals a on a.id = r.id where r.last >= k.k and a.arrived + k.k < v_today)
      ) order by k.k), '[]'::jsonb)
      from generate_series(1, 30) as k(k)
    ),

    -- Par semaine d'arrivée (douze), la part revenue dans chacune des semaines
    -- qui suivent : S1 = J1 à J7, S2 = J8 à J14… Une case ne compte que les
    -- joueurs dont la semaine a commencé.
    'cohorts', (
      select coalesce(jsonb_agg(jsonb_build_object('week', week, 'size', size, 'cells', cells) order by week), '[]'::jsonb)
      from (
        select c.week, count(*) as size,
               (select jsonb_agg(jsonb_build_object('eligible', e, 'back', b) order by w)
                  from (
                    select w.w,
                           count(*) filter (where cp.arrived + 7 * w.w + 1 < v_today) as e,
                           count(*) filter (where cp.arrived + 7 * w.w + 1 < v_today and exists (
                             select 1 from offs o where o.id = cp.id and o.k between 7 * w.w + 1 and 7 * w.w + 7)) as b
                      from arrivals cp cross join generate_series(0, 11) as w(w)
                     where date_trunc('week', cp.arrived)::date = c.week
                     group by w.w
                  ) z) as cells
          from (select date_trunc('week', arrived)::date as week from arrivals
                 where arrived >= (date_trunc('week', v_today) - interval '11 weeks')::date) c
         group by c.week
      ) x
    ),

    -- L'adhérence : actifs du jour, des sept et des trente derniers jours.
    'stickiness', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'dau', (select count(distinct player_id) from activity a where a.day = d.day),
        'wau', (select count(distinct player_id) from activity a where a.day between d.day - 6 and d.day),
        'mau', (select count(distinct player_id) from activity a where a.day between d.day - 29 and d.day)
      ) order by d.day), '[]'::jsonb)
      from days d
    ),

    'retention_by', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'by', dim, 'value', value, 'size', size,
        'd1_eligible', d1e, 'd1', d1, 'w1_eligible', w1e, 'w1', w1, 'm1_eligible', m1e, 'm1', m1) order by dim, size desc), '[]'::jsonb)
      from (
        select dim, value, count(*) as size,
               count(*) filter (where arrived + 1 < v_today) as d1e,
               count(*) filter (where arrived + 1 < v_today and exists (select 1 from offs o where o.id = g.id and o.k = 1)) as d1,
               count(*) filter (where arrived + 7 < v_today) as w1e,
               count(*) filter (where arrived + 7 < v_today and exists (select 1 from offs o where o.id = g.id and o.k between 1 and 7)) as w1,
               count(*) filter (where arrived + 30 < v_today) as m1e,
               count(*) filter (where arrived + 30 < v_today and exists (select 1 from offs o where o.id = g.id and o.k between 8 and 30)) as m1
          from (
            select 'platform' as dim, platform as value, id, arrived from who
            union all
            select 'lang', lang, id, arrived from who
          ) g
         group by dim, value
      ) r
    )
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.refresh_dashboard() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not pg_try_advisory_xact_lock(hashtext('refresh_dashboard')) then
    return;
  end if;
  perform public.refresh_activity();
  insert into public.dashboard_cache (days, snapshot, built_at)
  values (30, public.analytics_snapshot(30), now())
  on conflict (days) do update set snapshot = excluded.snapshot, built_at = excluded.built_at;
end;
$$;
revoke execute on function public.refresh_dashboard() from public, anon, authenticated;

-- Un relevé qui déraperait s'arrête au bout de deux minutes, et l'ancienne
-- copie reste affichée, plutôt que de tenir la base comme le 23 novembre.
select cron.schedule('dashboard-cache', '3 * * * *',
  'set statement_timeout = ''120s''; select public.refresh_dashboard()');
select cron.schedule('activity-rebuild', '20 3 * * *', 'select public.rebuild_activity()');
-- Le journal de pg_cron gardait chaque passage de chaque minute depuis le début.
select cron.schedule('cron-history-purge', '30 3 * * *',
  'delete from cron.job_run_details where end_time < now() - interval ''7 days''');

select public.rebuild_activity();
