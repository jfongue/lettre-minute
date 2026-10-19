-- Le tableau de bord gagne trois lectures :
--
-- 1. `usage` (`analytics_usage`) : ce que les joueurs font vraiment de l'app,
--    fonction par fonction — les événements `feature` que le client envoie
--    (`trackFeature`) et les parties lancées par mode (`run_start`) —, avec
--    pour chacune ses usages et ses utilisateurs sur 1, 7, 14 et 30 jours.
--    Un utilisateur est un compte, ou à défaut un appareil : le même joueur
--    sur deux appareils sans compte compte deux fois, un compte nommé une
--    seule. Les fonctions qui n'ont aucune ligne n'y figurent pas : c'est
--    l'écran qui connaît la liste et montre celles qui ne servent à rien.
--
-- 2. Les sessions de modération au fil du temps (`moderation_history`, de
--    `analytics_moderation_history`) : par jour et par langue, et par heure
--    pour aujourd'hui, depuis `moderation_sessions` (0068, langue 0080).
--
-- 3. La réserve de modération au fil du temps, langue par langue. Aucune
--    tâche ne la photographie : on la reconstruit. Un mot est « en réserve »
--    un jour tant qu'il existe et qu'il n'est pas versé (`released_at`, 0019) ;
--    la date d'entrée manquait, `added_at` la garde désormais. Un mot d'avant
--    cette colonne a un `added_at` nul et compte comme présent depuis toujours,
--    ce qui surévalue la réserve des jours qui précèdent un nouvel ensemencement
--    — les versements, eux, sont exacts.
--
-- Mêmes exclusions que le reste du relevé pour les événements : administration
-- et clients de test (0040).

alter table public.moderation_reserve add column added_at timestamptz;
alter table public.moderation_reserve alter column added_at set default now();

create function public.analytics_usage(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_since timestamptz := ((v_today - 29)::timestamp at time zone 'Europe/Paris');
  v_result jsonb;
begin
  with
  staff as (
    select id from public.admins
  ),
  staff_devices as (
    select distinct device from public.events where player_id in (select id from staff)
  ),
  ev as (
    select e.*, (e.created_at at time zone 'Europe/Paris')::date as day,
           coalesce(e.player_id::text, 'd:' || e.device) as who
      from public.events e
     where not e.test
       and e.created_at >= v_since
       and e.kind in ('feature', 'run_start')
       and not exists (select 1 from staff where staff.id = e.player_id)
       and not exists (select 1 from staff_devices d where d.device = e.device)
  ),
  uses as (
    select props ->> 'name' as name, day, who from ev where kind = 'feature' and props ->> 'name' is not null
    union all
    select 'run_' || coalesce(props ->> 'mode', 'solo'), day, who from ev where kind = 'run_start'
  ),
  windows(days) as (values (1), (7), (14), (30)),
  counted as (
    select u.name, w.days, count(*) as n, count(distinct u.who) as users
      from uses u join windows w on u.day > v_today - w.days
     group by 1, 2
  )
  select jsonb_build_object(
    'features', coalesce(jsonb_agg(jsonb_build_object(
      'name', name,
      'n1', coalesce(n1, 0), 'u1', coalesce(u1, 0),
      'n7', coalesce(n7, 0), 'u7', coalesce(u7, 0),
      'n14', coalesce(n14, 0), 'u14', coalesce(u14, 0),
      'n30', coalesce(n30, 0), 'u30', coalesce(u30, 0)
    ) order by coalesce(n30, 0) desc, name), '[]'::jsonb)
  ) into v_result
  from (
    select name,
           max(n) filter (where days = 1) as n1,  max(users) filter (where days = 1) as u1,
           max(n) filter (where days = 7) as n7,  max(users) filter (where days = 7) as u7,
           max(n) filter (where days = 14) as n14, max(users) filter (where days = 14) as u14,
           max(n) filter (where days = 30) as n30, max(users) filter (where days = 30) as u30
      from counted group by name
  ) f;
  return v_result;
end;
$$;

create function public.analytics_moderation_history(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 180);
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_from date := v_today - (v_days - 1);
  v_since timestamptz := (v_from::timestamp at time zone 'Europe/Paris');
  v_midnight timestamptz := (v_today::timestamp at time zone 'Europe/Paris');
begin
  return jsonb_build_object(
    'sessions_daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'lang', lang, 'n', n) order by day, lang), '[]'::jsonb)
      from (
        select (s.at at time zone 'Europe/Paris')::date as day, coalesce(s.lang, m.lang, 'fr') as lang, count(*) as n
          from public.moderation_sessions s
          left join public.moderators m on m.id = s.player_id
         where s.at >= v_since
         group by 1, 2
      ) d
    ),
    'sessions_today_hourly', (
      select coalesce(jsonb_agg(jsonb_build_object('hour', hour, 'lang', lang, 'n', n) order by hour, lang), '[]'::jsonb)
      from (
        select extract(hour from s.at at time zone 'Europe/Paris')::integer as hour, coalesce(s.lang, m.lang, 'fr') as lang, count(*) as n
          from public.moderation_sessions s
          left join public.moderators m on m.id = s.player_id
         where s.at >= v_midnight
         group by 1, 2
      ) h
    ),
    -- La réserve restante à la fin de chaque jour de Paris.
    'reserve_daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'lang', lang, 'left', n) order by day, lang), '[]'::jsonb)
      from (
        select d.day, public.category_lang(r.category_id) as lang, count(*) as n
          from (select v_from + i as day, ((v_from + i + 1)::timestamp at time zone 'Europe/Paris') as upto
                  from generate_series(0, v_days - 1) as i) d
          join public.moderation_reserve r
            on (r.added_at is null or r.added_at < d.upto)
           and (r.released_at is null or r.released_at >= d.upto)
         group by 1, 2
      ) x
    )
  );
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
    || jsonb_build_object('usage', public.analytics_usage(p_days))
    || jsonb_build_object('moderation_history', public.analytics_moderation_history(p_days))
    || (v_people - 'invite_top');
  if v_snapshot ? 'invites' then
    v_snapshot := jsonb_set(v_snapshot, '{invites,top}', v_people -> 'invite_top');
  end if;
  return v_snapshot;
end;
$$;

revoke execute on function public.analytics_usage(integer), public.analytics_moderation_history(integer),
  public.analytics_snapshot(integer) from public, anon, authenticated;

select public.refresh_dashboard();
