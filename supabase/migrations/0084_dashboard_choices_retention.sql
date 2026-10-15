-- Le tableau de bord apprend cinq choses de plus.
--
-- 1. Les choix de montée de niveau : chaque `category_chosen`, `power_chosen`
--    et `bonus_chosen` porte désormais ce qui était proposé (`offered`) ; la
--    part de fois qu'une carte est prise quand elle sort dit ce que les joueurs
--    préfèrent. Les choix envoyés par une version d'avant ne disent pas l'offre :
--    ils comptent dans `chosen`, pas dans le taux (`picked`).
--
-- 2. La langue de chaque joueur nommé par le relevé (les plus assidus, les
--    dernières inscriptions, les meilleurs inviteurs, le détail d'une barre) :
--    celle de sa dernière trace, sinon celle des mots de sa dernière partie —
--    un mot français a une catégorie nue, les autres la préfixent (`de:tiere`).
--    `analytics_people` recompte ces trois listes avec la langue et le compte,
--    et `analytics_snapshot` les pose par-dessus celles d'`analytics_core` et
--    d'`analytics_extras`, qui ne changent pas.
--
-- 3. Les ouvertures avec ou sans partie, version par version : CrazyGames
--    n'envoyait aucun événement — son invité n'a pas de compte, et `track`
--    n'écrivait que sous un compte. `track` accepte désormais l'invité, sous le
--    rôle `anon`, pour CrazyGames seul et par appareil, avec le même plafond
--    quotidien qu'un compte.
--
-- 4. La rétention : une courbe jour par jour (revenus le jour J, ou à J et
--    après), un tableau des cohortes semaine par semaine, l'adhérence (actifs
--    du jour, de la semaine, du mois) et la rétention par version et par langue.
--    Un jour ne compte que fini : un joueur arrivé hier n'est pas encore « pas
--    revenu le lendemain ».
--
-- 5. Les parties et les joueurs actifs de chaque jour (et de chaque heure
--    d'aujourd'hui), séparés entre les arrivés du jour et les revenants.
--
-- 6. La qualité du jeu, en bas du tableau de bord (`analytics_quality`) :
--    le temps que l'accueil met à se montrer, par version et jour par jour ;
--    les sessions touchées par une erreur, et les erreurs elles-mêmes avec
--    leur source, leur écran et les versions qui les lèvent ; les fermetures
--    brutales — une session qui finit sans s'être cachée, crash ou app tuée
--    au premier plan, que l'ouverture suivante signale (`unclean`) ; et les
--    gels, tâches du fil principal d'une demi-seconde et plus, que chaque
--    `hide` rapporte. Ces deux dernières mesures n'existent que depuis 0084.
--
-- Mêmes exclusions que le relevé : administration, joueurs ordinateur,
-- clients de test et comptes anonymes sans trace (0040, 0042).

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
       or (left(e ->> 'device', 64) = v_device and e ->> 'platform' = 'crazygames'));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.track(jsonb) from public;
grant execute on function public.track(jsonb) to anon, authenticated;

-- La langue d'un joueur : sa dernière trace, sinon les mots de sa dernière partie.
create function public.analytics_player_langs() returns table (player_id uuid, lang text)
language sql stable security definer set search_path = public as $$
  with said as (
    select distinct on (e.player_id) e.player_id, e.lang
      from public.events e
     where e.player_id is not null and not e.test and e.lang ~ '^[a-z]{2}$'
     order by e.player_id, e.created_at desc
  ),
  played as (
    select distinct on (r.player_id) r.player_id,
           case when w.category_id like '%:%' then split_part(w.category_id, ':', 1) else 'fr' end as lang
      from public.runs r join public.run_words w on w.run_id = r.id
     order by r.player_id, r.created_at desc
  )
  select coalesce(s.player_id, p.player_id), coalesce(s.lang, p.lang)
    from said s full join played p on p.player_id = s.player_id;
$$;

create function public.analytics_people(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 180);
  v_since timestamptz := (((now() at time zone 'Europe/Paris')::date - (v_days - 1))::timestamp at time zone 'Europe/Paris');
  v_result jsonb;
begin
  with
  test_accounts as (
    select u.id from auth.users u
     where ((exists (select 1 from public.runs r where r.player_id = u.id and r.test)
         or exists (select 1 from public.events e where e.player_id = u.id and e.test))
       and not exists (select 1 from public.runs r where r.player_id = u.id and not r.test)
       and not exists (select 1 from public.events e where e.player_id = u.id and not e.test))
      or (u.is_anonymous
       and not exists (select 1 from public.runs r where r.player_id = u.id)
       and not exists (select 1 from public.events e where e.player_id = u.id))
  ),
  staff as (
    select id from public.admins
  ),
  staff_devices as (
    select distinct device from public.events where player_id in (select id from staff)
  ),
  langs as (
    select * from public.analytics_player_langs()
  ),
  people as (
    select u.id, u.is_anonymous, coalesce(u.email_confirmed_at, u.created_at) as named_at,
           p.display_name, p.runs, p.best_score, l.lang
      from auth.users u
      left join public.profiles p on p.id = u.id
      left join langs l on l.player_id = u.id
     where not exists (select 1 from public.bots b where b.id = u.id)
       and not exists (select 1 from staff where staff.id = u.id)
       and not exists (select 1 from test_accounts t where t.id = u.id)
  ),
  period_runs as (
    select r.* from public.runs r
     where r.created_at >= v_since and not r.test
       and not exists (select 1 from public.bots b where b.id = r.player_id)
       and not exists (select 1 from staff where staff.id = r.player_id)
       and not exists (select 1 from test_accounts t where t.id = r.player_id)
  ),
  mails as (
    select i.*, i.joined_by is not null and i.joined_at = i.created_at as known
      from public.tester_invites i
     where i.invited_by is not null and not exists (select 1 from staff where staff.id = i.invited_by)
  ),
  joins as (
    select invited_by as inviter, joined_by as invitee from mails where joined_by is not null and not known
    union all
    select inviter, invitee from public.invite_accepts a
     where a.inviter is not null and not exists (select 1 from staff where staff.id = a.inviter)
  ),
  shares as (
    select e.player_id
      from public.events e
     where e.kind = 'tap' and e.props ->> 'label' like 'invite-%'
       and not e.test
       and not exists (select 1 from staff where staff.id = e.player_id)
       and not exists (select 1 from staff_devices d where d.device = e.device)
       and not exists (select 1 from test_accounts t where t.id = e.player_id)
  )
  select jsonb_build_object(
    'top_players', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'key', id, 'name', name, 'runs', n, 'best', best, 'anonymous', anonymous, 'lang', lang) order by n desc), '[]'::jsonb)
      from (
        select p.id, coalesce(nullif(p.display_name, 'Anonyme'), 'Anonyme ' || left(p.id::text, 4)) as name,
               p.is_anonymous as anonymous, p.lang, count(*) as n, max(r.score) as best
          from period_runs r join people p on p.id = r.player_id
         group by p.id, p.display_name, p.is_anonymous, p.lang order by 5 desc limit 15
      ) t
    ),
    'recent_signups', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'key', id, 'name', display_name, 'at', named_at, 'runs', coalesce(runs, 0), 'best', coalesce(best_score, 0), 'lang', lang)
        order by named_at desc), '[]'::jsonb)
      from (select * from people where not is_anonymous order by named_at desc limit 15) s
    ),
    -- Les meilleurs inviteurs d'`analytics_extras` (0040), avec leur langue.
    'invite_top', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'key', id, 'name', name, 'anonymous', anonymous, 'lang', lang, 'mails', mails, 'shares', shares,
        'joins', joins, 'played', played) order by joins desc, played desc, mails + shares desc), '[]'::jsonb)
      from (
        select * from (
          select p.id, coalesce(nullif(p.display_name, 'Anonyme'), 'Anonyme ' || left(p.id::text, 4)) as name,
                 p.is_anonymous as anonymous, p.lang,
                 (select count(*) from mails m where m.invited_by = p.id and not m.known) as mails,
                 (select count(*) from shares s where s.player_id = p.id) as shares,
                 (select count(*) from joins j where j.inviter = p.id) as joins,
                 (select count(*) from joins j join public.profiles q on q.id = j.invitee where j.inviter = p.id and q.runs > 0) as played
            from people p
           where exists (select 1 from mails m where m.invited_by = p.id)
              or exists (select 1 from shares s where s.player_id = p.id)
              or exists (select 1 from joins j where j.inviter = p.id)
        ) i
        order by joins desc, played desc, mails + shares desc
        limit 20
      ) t
    )
  ) into v_result;
  return v_result;
end;
$$;

create function public.analytics_insights(p_days integer default 30) returns jsonb
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
  test_accounts as (
    select u.id from auth.users u
     where ((exists (select 1 from public.runs r where r.player_id = u.id and r.test)
         or exists (select 1 from public.events e where e.player_id = u.id and e.test))
       and not exists (select 1 from public.runs r where r.player_id = u.id and not r.test)
       and not exists (select 1 from public.events e where e.player_id = u.id and not e.test))
      or (u.is_anonymous
       and not exists (select 1 from public.runs r where r.player_id = u.id)
       and not exists (select 1 from public.events e where e.player_id = u.id))
  ),
  staff as (
    select id from public.admins
  ),
  staff_devices as (
    select distinct device from public.events where player_id in (select id from staff)
  ),
  all_ev as (
    select * from public.events e
     where not e.test
       and not exists (select 1 from staff where staff.id = e.player_id)
       and not exists (select 1 from staff_devices d where d.device = e.device)
  ),
  ev as (
    select * from all_ev where created_at >= v_since
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
    select player_id, (created_at at time zone 'Europe/Paris')::date from all_ev where player_id is not null
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
    select e.player_id, e.platform, count(*) as n
      from public.events e
     where e.player_id is not null and e.platform in ('android', 'web', 'crazygames', 'reddit') and not e.test
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
                          select player_id, created_at from all_ev where player_id is not null and created_at >= v_midnight
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

create function public.analytics_quality(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 180);
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_from date := v_today - (v_days - 1);
  v_since timestamptz := (v_from::timestamp at time zone 'Europe/Paris');
  v_result jsonb;
begin
  with
  staff_devices as (
    select distinct device from public.events where player_id in (select id from public.admins)
  ),
  ev as (
    select * from public.events e
     where e.created_at >= v_since and not e.test
       and not exists (select 1 from public.admins a where a.id = e.player_id)
       and not exists (select 1 from staff_devices d where d.device = e.device)
  ),
  sessions as (
    select session,
           min(created_at) as started,
           (min(created_at) at time zone 'Europe/Paris')::date as day,
           coalesce(min(platform) filter (where platform in ('android', 'web', 'crazygames', 'reddit')), 'inconnu') as platform,
           coalesce(min(version), '?') as version,
           min(device) as device,
           count(*) filter (where kind = 'error') as errors,
           bool_or(kind = 'open' and props ->> 'unclean' = 'true') as unclean,
           bool_or(kind = 'open' and props ? 'unclean') as watched,
           min((props ->> 'ms')::numeric) filter (where kind = 'ready') as ready,
           sum((props ->> 'freezes')::integer) filter (where kind = 'hide' and props ? 'freezes') as freezes,
           sum((props ->> 'long_ms')::numeric) filter (where kind = 'hide' and props ? 'long_ms') as long_ms,
           max((props ->> 'long_max')::numeric) filter (where kind = 'hide' and props ? 'long_max') as long_max,
           max((props ->> 'seconds')::numeric) filter (where kind = 'hide') as seconds
      from ev
     group by session
  ),
  days as (
    select generate_series(v_from, v_today, interval '1 day')::date as day
  )
  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'sessions', count(*),
        'error_sessions', count(*) filter (where errors > 0),
        'errors', coalesce(sum(errors), 0),
        'watched', count(*) filter (where watched),
        'unclean', count(*) filter (where unclean),
        'ready_p50', percentile_cont(0.5) within group (order by ready),
        'ready_p90', percentile_cont(0.9) within group (order by ready),
        'ready_p99', percentile_cont(0.99) within group (order by ready),
        'slow_starts', count(*) filter (where ready > 5000),
        'measured', count(*) filter (where freezes is not null),
        'frozen', count(*) filter (where freezes > 0),
        'long_per_minute', round((sum(long_ms) filter (where seconds > 0) / nullif(sum(seconds) filter (where long_ms is not null and seconds > 0), 0) * 60)::numeric, 0),
        'long_max_p90', percentile_cont(0.9) within group (order by long_max)
      ) from sessions
    ),
    'since', jsonb_build_object(
      'unclean', (select min(created_at) from ev where kind = 'open' and props ? 'unclean'),
      'freezes', (select min(created_at) from ev where kind = 'hide' and props ? 'freezes')
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'sessions', (select count(*) from sessions s where s.day = d.day),
        'error_sessions', (select count(*) from sessions s where s.day = d.day and s.errors > 0),
        'errors', (select coalesce(sum(errors), 0) from sessions s where s.day = d.day),
        'watched', (select count(*) from sessions s where s.day = d.day and s.watched),
        'unclean', (select count(*) from sessions s where s.day = d.day and s.unclean),
        'measured', (select count(*) from sessions s where s.day = d.day and s.freezes is not null),
        'frozen', (select count(*) from sessions s where s.day = d.day and s.freezes > 0),
        'ready_p50', (select percentile_cont(0.5) within group (order by ready) from sessions s where s.day = d.day),
        'ready_p90', (select percentile_cont(0.9) within group (order by ready) from sessions s where s.day = d.day)
      ) order by d.day), '[]'::jsonb)
      from days d
    ),
    'by_version', (
      select coalesce(jsonb_agg(row order by n desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'platform', platform, 'version', version, 'sessions', count(*), 'devices', count(distinct device),
          'error_sessions', count(*) filter (where errors > 0),
          'watched', count(*) filter (where watched), 'unclean', count(*) filter (where unclean),
          'measured', count(*) filter (where freezes is not null), 'frozen', count(*) filter (where freezes > 0),
          'ready_p50', percentile_cont(0.5) within group (order by ready),
          'ready_p90', percentile_cont(0.9) within group (order by ready)
        ) as row, count(*) as n
          from sessions group by platform, version order by n desc limit 16
      ) v
    ),
    'errors', (
      select coalesce(jsonb_agg(row order by n desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'message', e.message,
          'source', (array_agg(e.props ->> 'source' order by e.created_at desc))[1],
          'screen', (array_agg(e.props ->> 'screen' order by e.created_at desc) filter (where e.props ? 'screen'))[1],
          'n', count(*), 'devices', count(distinct e.device), 'sessions', count(distinct e.session),
          'first', min(e.created_at), 'last', max(e.created_at),
          'versions', jsonb_agg(distinct coalesce(e.platform, '?') || ' ' || coalesce(e.version, '?'))
        ) as row, count(*) as n
          from (select *, left(props ->> 'message', 200) as message from ev where kind = 'error') e
         group by e.message
         order by n desc limit 25
      ) r
    ),
    'screens', (
      select coalesce(jsonb_agg(jsonb_build_object('screen', screen, 'n', n, 'devices', devices) order by n desc), '[]'::jsonb)
      from (
        select coalesce(props ->> 'screen', '?') as screen, count(*) as n, count(distinct device) as devices
          from ev where kind = 'error' group by 1
      ) s
    )
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.analytics_snapshot(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_people jsonb := public.analytics_people(p_days);
  v_snapshot jsonb;
begin
  v_snapshot := public.analytics_core(p_days) || public.analytics_extras(p_days)
    || public.analytics_platforms(p_days)
    || jsonb_build_object('revenue', public.analytics_revenue(p_days))
    || public.analytics_moderation(p_days)
    || jsonb_build_object('insights', public.analytics_insights(p_days))
    || jsonb_build_object('quality', public.analytics_quality(p_days))
    || (v_people - 'invite_top');
  if v_snapshot ? 'invites' then
    v_snapshot := jsonb_set(v_snapshot, '{invites,top}', v_people -> 'invite_top');
  end if;
  return v_snapshot;
end;
$$;

-- Le détail d'une barre : un appareil sans compte dit sa langue et sa
-- version, et un joueur sans ouverture suivie (un compte CrazyGames d'avant
-- 0084) celle de ses mots.
create or replace function public.admin_slot(p_day date, p_hour integer default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then (
    select coalesce(jsonb_agg(
      case
        when (row ->> 'device')::boolean is true then row || coalesce((
          select jsonb_build_object('lang', e.lang, 'platform', e.platform)
            from public.events e where e.device = substr(row ->> 'key', 8)
           order by e.created_at desc limit 1), '{}')
        when row ->> 'lang' is null then row || jsonb_build_object('lang',
          (select l.lang from public.analytics_player_langs() l where l.player_id = (row ->> 'key')::uuid))
        else row
      end order by ord), '[]'::jsonb)
      from jsonb_array_elements(public.analytics_slot(p_day, p_hour)) with ordinality as t(row, ord)
  ) end;
$$;

revoke execute on function public.analytics_player_langs(), public.analytics_people(integer),
  public.analytics_insights(integer), public.analytics_quality(integer), public.analytics_snapshot(integer)
  from public, anon, authenticated;
