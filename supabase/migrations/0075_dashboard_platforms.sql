-- Le tableau de bord sépare les versions du jeu (Android, web, CrazyGames,
-- Reddit) qui partagent ce serveur.
--
-- 1. Les tentatives du défi du moment disent d'où elles viennent, comme les
--    parties et les tables de duel depuis 0072 (`tag_platform`).
--
-- 2. `analytics_platforms` : par version, les parties, les joueurs, les
--    nouveaux comptes, les duels et les tentatives du défi sur la période, et
--    les parties de chaque jour. Une ligne d'avant l'étiquette (ou d'un client
--    qui ne l'envoie pas encore, comme l'app Android d'avant 0072) prend la
--    version de son joueur : CrazyGames s'il a un compte du portail
--    (`crazygames_accounts`), sinon celle que ses événements disent le plus
--    souvent (`events.platform`, Android ou web), sinon « inconnu ». `tagged`
--    compte les parties qui portaient vraiment l'étiquette.
--    `analytics_snapshot` y ajoute cette section sous `by_platform`, sans
--    toucher à `analytics_core` ni à `analytics_extras`. Mêmes exclusions que
--    le relevé : comptes de l'administration, joueurs maison, clients de test.

alter table public.weekly_attempts
  add column platform text check (platform in ('android', 'web', 'crazygames', 'reddit'));

create trigger weekly_attempts_tag_platform before insert on public.weekly_attempts
  for each row execute function public.tag_platform();

create function public.analytics_platforms(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 180);
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_from date := v_today - (v_days - 1);
  v_since timestamptz := (v_from::timestamp at time zone 'Europe/Paris');
  v_result jsonb;
begin
  with
  excluded as (
    select id from public.admins
    union
    select id from public.bots
  ),
  -- La version d'un joueur, pour les lignes qui ne portent pas la leur.
  said as (
    select e.player_id, e.platform, count(*) as n
      from public.events e
     where e.player_id is not null and e.platform in ('android', 'web', 'crazygames', 'reddit') and not e.test
     group by 1, 2
  ),
  player_platform as (
    select p.id,
           case
             when exists (select 1 from public.crazygames_accounts c where c.player_id = p.id) then 'crazygames'
             else coalesce(
               (select s.platform from said s where s.player_id = p.id order by s.n desc, s.platform limit 1),
               (select r.platform from public.runs r where r.player_id = p.id and r.platform is not null
                 order by r.created_at desc limit 1),
               'inconnu')
           end as platform
      from public.profiles p
     where p.id not in (select id from excluded)
  ),
  runs_in as (
    select r.player_id, r.score, r.platform is not null as tagged,
           coalesce(r.platform, pp.platform) as platform,
           (r.created_at at time zone 'Europe/Paris')::date as day
      from public.runs r
      join player_platform pp on pp.id = r.player_id
     where r.created_at >= v_since and not r.test
  ),
  accounts_in as (
    select pp.platform, count(*) as n
      from auth.users u
      join player_platform pp on pp.id = u.id
     where u.created_at >= v_since
     group by 1
  ),
  duels_in as (
    select coalesce(t.platform, pp.platform) as platform, count(*) as n
      from public.duel_tables t
      join player_platform pp on pp.id = t.host
     where t.created_at >= v_since
     group by 1
  ),
  weekly_in as (
    select coalesce(w.platform, pp.platform) as platform, count(*) as n, count(distinct w.player_id) as players
      from public.weekly_attempts w
      join player_platform pp on pp.id = w.player_id
     where w.started_at >= v_since
     group by 1
  ),
  platforms as (
    select platform from runs_in
    union select platform from accounts_in
    union select platform from duels_in
    union select platform from weekly_in
  ),
  rows as (
    select p.platform,
           (select count(*) from runs_in r where r.platform = p.platform) as runs,
           (select count(*) from runs_in r where r.platform = p.platform and r.tagged) as tagged,
           (select count(distinct r.player_id) from runs_in r where r.platform = p.platform) as players,
           (select count(*) from runs_in r where r.platform = p.platform and r.day = v_today) as runs_today,
           (select count(distinct r.player_id) from runs_in r where r.platform = p.platform and r.day = v_today) as players_today,
           (select round(avg(r.score)) from runs_in r where r.platform = p.platform) as avg_score,
           (select max(r.score) from runs_in r where r.platform = p.platform) as best,
           coalesce((select a.n from accounts_in a where a.platform = p.platform), 0) as new_accounts,
           coalesce((select d.n from duels_in d where d.platform = p.platform), 0) as duels,
           coalesce((select w.n from weekly_in w where w.platform = p.platform), 0) as weekly_attempts,
           coalesce((select w.players from weekly_in w where w.platform = p.platform), 0) as weekly_players
      from platforms p
  )
  select jsonb_build_object(
    'by_platform', jsonb_build_object(
      'rows', coalesce((select jsonb_agg(to_jsonb(r) order by r.runs desc, r.platform) from rows r), '[]'),
      'daily', coalesce((
        select jsonb_agg(jsonb_build_object('day', d.day, 'platform', d.platform, 'runs', d.runs) order by d.day, d.platform)
          from (select day, platform, count(*) as runs from runs_in group by 1, 2) d
      ), '[]')
    )
  ) into v_result;
  return v_result;
end;
$$;

revoke execute on function public.analytics_platforms(integer) from public, anon, authenticated;

create or replace function public.analytics_snapshot(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.analytics_core(p_days) || public.analytics_extras(p_days) || public.analytics_platforms(p_days);
$$;
