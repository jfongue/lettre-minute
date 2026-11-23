-- Correctif de charge (23 novembre 2026), deux causes sans borne :
--
-- 1. Les découvertes (0024, 0070) cherchaient, pour chaque mot de la période,
--    toutes ses occurrences de tous les temps par l'index sur `word` seul, puis
--    leur partie : un coût quadratique, et `fetchMyDiscoveries` le paie sur
--    toute la table (période « all ») après chaque partie de chaque joueur
--    nommé. La règle reste la même — personne ne l'avait écrit dans la
--    catégorie pendant les sept jours d'avant — mais se lit en une passe : la
--    partie précédente du même couple (`lag`), sur la période plus sept jours.
--    Le total « all » se calcule toutes les demi-heures et se lit dans une copie.
-- 2. `dashboard-cache` (0087) recalcule le relevé toutes les dix minutes sous
--    `postgres`, sans limite de temps : un relevé plus long que dix minutes
--    s'empile sur le suivant. Il passe à l'heure, et un calcul encore en cours
--    fait sauter le suivant.

create table public.discoveries_all (
  player_id uuid primary key,
  value integer not null,
  built_at timestamptz not null default now()
);
alter table public.discoveries_all enable row level security;

create function public.discoveries_since(p_since timestamptz)
returns table (player_id uuid, value integer)
language sql stable security definer set search_path = public as $$
  with seen as (
    select r.player_id, r.created_at,
      lag(r.created_at) over (partition by w.category_id, w.word order by r.created_at) as prev
    from public.run_words w
    join public.runs r on r.id = w.run_id
    where r.created_at >= p_since - interval '7 days'
  )
  select s.player_id, count(*)::integer
  from seen s
  where s.created_at >= p_since
    and (s.prev is null or s.prev < s.created_at - interval '7 days')
  group by s.player_id;
$$;
revoke execute on function public.discoveries_since(timestamptz) from public, anon, authenticated;

create function public.refresh_discoveries() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not pg_try_advisory_xact_lock(hashtext('refresh_discoveries')) then
    return;
  end if;
  delete from public.discoveries_all where true;
  insert into public.discoveries_all (player_id, value)
  select d.player_id, d.value from public.discoveries_since('-infinity') d;
end;
$$;
revoke execute on function public.refresh_discoveries() from public, anon, authenticated;

-- leaderboard_values : corps de 0070, seule la branche des découvertes change.
create or replace function public.leaderboard_values(p_stat text, p_since timestamptz)
returns table (player_id uuid, value integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_stat = 'discoveries' then
    if p_since = '-infinity'::timestamptz then
      return query select c.player_id, c.value from public.discoveries_all c;
    else
      return query select d.player_id, d.value from public.discoveries_since(p_since) d;
    end if;
  elsif p_stat = 'added' then
    return query
    select s.player_id, count(*)::integer
    from public.word_submissions s
    left join public.word_reviews v on v.category_id = s.category_id and v.word = s.word
    where s.status = 'accepted'
      and coalesce(v.decided_at, s.created_at) >= p_since
      and not exists (select 1 from public.bots b where b.id = s.player_id)
    group by s.player_id;
  elsif p_stat = 'moderation' then
    return query
    select s.player_id, count(*)::integer
    from public.moderation_sessions s
    where s.at >= p_since
    group by s.player_id;
  else
    return query
    select r.player_id,
      (case p_stat
        when 'best' then max(r.score)
        when 'points' then sum(r.score)
        when 'runs' then count(*)
        when 'words' then sum(r.words)
        when 'combo' then max(r.best_combo)
      end)::integer
    from public.runs r
    where r.created_at >= p_since
      and not exists (select 1 from public.bots b where b.id = r.player_id)
    group by r.player_id;
  end if;
end;
$$;
revoke execute on function public.leaderboard_values(text, timestamptz) from public, anon, authenticated;

-- leaderboard_board : corps de 0024, même changement pour la semaine.
create or replace function public.leaderboard_board(p_board text)
returns table (display_name text, avatar jsonb, value integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_board = 'discoveries' then
    return query
      select p.display_name, p.avatar, d.value
        from public.discoveries_since(public.period_start('week')) d
        join public.profiles p on p.id = d.player_id
        join auth.users u on u.id = p.id and not u.is_anonymous
       order by 3 desc, p.display_name
       limit 50;
  else
    return query
      select p.display_name, p.avatar, max(r.score)::integer
        from public.runs r
        join public.profiles p on p.id = r.player_id
        join auth.users u on u.id = p.id and not u.is_anonymous
       where r.created_at >= public.period_start(case when p_board = 'week' then 'week' else 'day' end)
         and not exists (select 1 from public.bots b where b.id = p.id)
       group by p.id
       order by 3 desc, p.display_name
       limit 50;
  end if;
end;
$$;
-- Droits de 0073 inchangés (anon et authenticated) : create or replace les garde.

create or replace function public.refresh_dashboard() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not pg_try_advisory_xact_lock(hashtext('refresh_dashboard')) then
    return;
  end if;
  insert into public.dashboard_cache (days, snapshot, built_at)
  values (30, public.analytics_snapshot(30), now())
  on conflict (days) do update set snapshot = excluded.snapshot, built_at = excluded.built_at;
end;
$$;
revoke execute on function public.refresh_dashboard() from public, anon, authenticated;

select cron.schedule('dashboard-cache', '3 * * * *', 'select public.refresh_dashboard()');
-- Pas de premier calcul ici : la migration doit passer vite sur une base
-- chargée ; la copie se remplit au prochain passage, d'ici une demi-heure.
select cron.schedule('discoveries-all', '11,41 * * * *', 'select public.refresh_discoveries()');
