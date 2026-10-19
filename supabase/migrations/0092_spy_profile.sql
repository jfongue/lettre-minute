-- La fiche d'un joueur, pour la page d'espionnage d'un super modérateur : ce
-- que `spy_runs` (0079) ne dit pas — son compte, ses plateformes, son Premium
-- et d'où il vient, son rôle de modérateur, ses amis, les pouvoirs qu'il joue,
-- ce qu'il fait de la modération, son rythme jour par jour et les fonctions de
-- l'app qu'il touche. Un seul appel, un seul document : la page l'affiche
-- d'un bloc au-dessus de l'historique.
--
-- Même porte que `spy_runs` : le rôle seul la garde, et elle rend null à
-- quiconque n'est pas super modérateur, ou pour un joueur introuvable.
-- `p_player` est un compte ou un nom ; « Anonyme » ne désigne personne.
--
-- Les événements (0029) n'avaient d'index que par appareil et par date : lire
-- ceux d'un joueur parcourait toute la table. L'index par compte rend ces
-- lectures bon marché, et ne couvre que les lignes qui en ont un.

create index events_player_at on public.events (player_id, at desc) where player_id is not null;

create function public.spy_target(p_player text) returns uuid
language sql stable security definer set search_path = public as $$
  select case
    when p_player ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (select p.id from public.profiles p where p.id = p_player::uuid)
    else (select p.id from public.profiles p
           where lower(p.display_name) = lower(trim(p_player)) and p.display_name <> 'Anonyme')
  end;
$$;

revoke execute on function public.spy_target(text) from public, anon, authenticated;

create function public.spy_profile(p_player text) returns jsonb
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
    'last_open', (
      select jsonb_build_object('at', e.at, 'platform', e.platform, 'version', e.version, 'lang', e.lang)
        from public.events e
       where e.player_id = v_target
       order by e.at desc
       limit 1
    ),
    -- Une partie dit sa plateforme depuis 0072, une ouverture depuis 0029 :
    -- les deux se lisent ensemble, une ligne par plateforme.
    'platforms', coalesce((
      select jsonb_agg(jsonb_build_object('platform', platform, 'runs', runs, 'opens', opens, 'last', last) order by last desc nulls last)
        from (
          select coalesce(r.platform, o.platform) as platform,
                 coalesce(r.runs, 0) as runs,
                 coalesce(o.opens, 0) as opens,
                 greatest(r.last, o.last) as last
            from (select platform, count(*) as runs, max(created_at) as last
                    from public.runs where player_id = v_target and platform is not null
                   group by platform) r
            full join (select platform, count(*) as opens, max(at) as last
                         from public.events where player_id = v_target and kind = 'open' and platform is not null
                        group by platform) o on o.platform = r.platform
        ) both_sides
    ), '[]'::jsonb),
    'devices', (select count(distinct e.device) from public.events e where e.player_id = v_target),
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
    ),
    'features', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'n', n, 'last', last) order by n desc, name)
        from (
          select e.props ->> 'name' as name, count(*) as n, max(e.at) as last
            from public.events e
           where e.player_id = v_target and e.kind = 'feature' and e.at >= now() - interval '90 days'
           group by 1
        ) used
       where name is not null
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.spy_profile(text) from public, anon;
grant execute on function public.spy_profile(text) to authenticated;
