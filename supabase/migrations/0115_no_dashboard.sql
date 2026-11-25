-- Le tableau de bord s'en va, et avec lui le suivi d'usage qui le nourrissait.
--
-- C'était le premier poste d'entrées-sorties de la base : depuis septembre,
-- `refresh_dashboard` seul avait écrit près de 480 Go de fichiers temporaires,
-- `events` (100 Mo, la moitié de la base) avait été relu en entier 900 000
-- fois, et `track` faisait une écriture par lot de chaque appareil. Le budget
-- disque épuisé, c'est tout le reste qui ralentissait : les classements, les
-- notifications de défi, les joueurs maison (23 au 25 novembre 2026).
--
-- Un client déjà installé qui envoie encore ses événements reçoit PGRST202
-- (fonction inconnue) : `track.ts` jette alors son lot au lieu de le garder, et
-- PostgREST répond sans rien demander à la base.
--
-- La fiche d'un joueur (`spy_profile`, 0092) reste : elle perd ce qu'elle lisait
-- dans `events` — dernière ouverture, appareils, ouvertures par plateforme,
-- fonctions touchées — et garde tout ce qui vient des parties et des comptes.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'dashboard-cache') then
    perform cron.unschedule('dashboard-cache');
  end if;
end $$;

drop function if exists public.refresh_dashboard();
drop function if exists public.admin_analytics(integer);
drop function if exists public.admin_slot(date, integer);
drop function if exists public.analytics_snapshot(integer);
drop function if exists public.analytics_core(integer);
drop function if exists public.analytics_extras(integer);
drop function if exists public.analytics_insights(integer);
drop function if exists public.analytics_moderation(integer);
drop function if exists public.analytics_moderation_history(integer);
drop function if exists public.analytics_people(integer);
drop function if exists public.analytics_platforms(integer);
drop function if exists public.analytics_player_langs();
drop function if exists public.analytics_quality(integer);
drop function if exists public.analytics_revenue(integer);
drop function if exists public.analytics_slot(date, integer);
drop function if exists public.analytics_usage(integer);
drop function if exists public.refresh_activity();
drop function if exists public.rebuild_activity();
drop function if exists public.activity_rows(timestamptz, timestamptz);
drop function if exists public.track(jsonb);

drop table if exists public.dashboard_cache;
drop table if exists public.activity_days_mark;
drop table if exists public.activity_days;
drop table if exists public.events;

-- Corps de 0092 sans `events`.
create or replace function public.spy_profile(p_player text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_target uuid;
  v_profile public.profiles;
  v_user auth.users;
  v_since date := (now() at time zone 'Europe/Paris')::date - 89;
begin
  if not public.is_super_moderator(auth.uid()) then
    return null;
  end if;
  v_target := public.spy_target(p_player);
  select * into v_profile from public.profiles where id = v_target;
  if not found then
    return null;
  end if;
  select * into v_user from auth.users where id = v_target;

  return jsonb_build_object(
    'id', v_profile.id,
    'name', v_profile.display_name,
    'avatar', v_profile.avatar,
    'anonymous', coalesce(v_user.is_anonymous, false),
    'providers', coalesce(v_user.raw_app_meta_data -> 'providers', '[]'::jsonb),
    'created_at', v_user.created_at,
    'xp', v_profile.xp,
    'runs_count', v_profile.runs,
    'best', v_profile.best_score,
    'words_found', v_profile.words_found,
    'best_combo', v_profile.best_combo,
    'bot', exists (select 1 from public.bots b where b.id = v_target),
    'last_run_at', (select max(r.created_at) from public.runs r where r.player_id = v_target),
    'platforms', coalesce((
      select jsonb_agg(jsonb_build_object('platform', platform, 'runs', runs, 'last', last) order by last desc nulls last)
        from (select platform, count(*) as runs, max(created_at) as last
                from public.runs where player_id = v_target and platform is not null
               group by platform) r
    ), '[]'::jsonb),
    'premium', jsonb_build_object(
      'purchases', coalesce((
        select jsonb_agg(jsonb_build_object('provider', p.provider, 'state', p.state, 'at', p.created_at) order by p.created_at)
          from public.purchases p
         where p.account = v_target and p.product = 'premium_lifetime'
      ), '[]'::jsonb),
      'grant', (
        select jsonb_build_object('at', g.created_at, 'by', (select b.display_name from public.profiles b where b.id = g.granted_by))
          from public.premium_grants g where g.account = v_target
      ),
      -- Ce que la sauvegarde de l'appareil dit (`plusSince`, en millisecondes) :
      -- un Premium gagné au défi du moment, ou pris quand il était gratuit, n'a
      -- aucun achat derrière lui.
      'saved_since', coalesce((
        select case when jsonb_typeof(g.progress -> 'plusSince') = 'number' then (g.progress ->> 'plusSince')::bigint end
          from public.player_progress g where g.id = v_target
      ), 0)
    ),
    'moderator', (
      select jsonb_build_object(
               'since', m.created_at,
               'super', m.super,
               'lang', m.lang,
               'invited_by', (select i.display_name from public.profiles i where i.id = m.invited_by))
        from public.moderators m where m.id = v_target
    ),
    'friends', (
      select count(*) from public.friendships f
       where f.status = 'accepted' and v_target in (f.requester, f.addressee)
    ),
    'powers', coalesce((
      select jsonb_agg(jsonb_build_object('power', power, 'runs', runs, 'points', points) order by runs desc, power)
        from (
          select p.power, count(*) as runs, sum(r.score) as points
            from public.runs r cross join lateral unnest(r.powers) as p(power)
           where r.player_id = v_target
           group by p.power
        ) used
    ), '[]'::jsonb),
    'without_powers', (
      select jsonb_build_object('runs', count(*), 'points', coalesce(sum(r.score), 0))
        from public.runs r where r.player_id = v_target and cardinality(r.powers) = 0
    ),
    'moderation', jsonb_build_object(
      'sessions', (select count(*) from public.moderation_sessions s where s.player_id = v_target),
      'last_session', (select max(s.at) from public.moderation_sessions s where s.player_id = v_target),
      'votes', (
        select jsonb_object_agg(verdict, n)
          from (select v.verdict, count(*) as n from public.moderation_votes v
                 where v.moderator_id = v_target group by v.verdict) tally
      ),
      'last_vote', (select max(v.created_at) from public.moderation_votes v where v.moderator_id = v_target),
      'proposed', (
        select jsonb_object_agg(status, n)
          from (select s.status, count(*) as n from public.word_submissions s
                 where s.player_id = v_target group by s.status) tally
      )
    ),
    -- Les quatre-vingt-dix derniers jours à l'heure de Paris, les jours sans
    -- partie à zéro pour que le graphique montre les creux.
    'daily', (
      select jsonb_agg(jsonb_build_object('day', d.day::date, 'runs', coalesce(r.runs, 0), 'best', r.best, 'avg', r.avg) order by d.day)
        from generate_series(v_since, (now() at time zone 'Europe/Paris')::date, interval '1 day') as d(day)
        left join (
          select (created_at at time zone 'Europe/Paris')::date as day,
                 count(*) as runs, max(score) as best, round(avg(score))::integer as avg
            from public.runs
           where player_id = v_target and created_at >= v_since::timestamp at time zone 'Europe/Paris'
           group by 1
        ) r on r.day = d.day::date
    )
  );
end;
$$;
