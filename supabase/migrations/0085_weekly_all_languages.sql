-- Le défi du moment se classe toutes langues confondues : le mode et son unité
-- sont ceux de la semaine pour tout le monde (`weeklyMode` ne lit pas la
-- langue), seuls les mots et les catégories changent. Classés par langue, les
-- trois joueurs français et le joueur anglais de la semaine du 11 octobre ne se
-- voyaient pas : un téléphone en anglais ne montrait que ce dernier. La langue
-- reste écrite sur chaque tentative et chaque réaction, plus rien ne la lit, et
-- `p_lang` reste dans les signatures pour les versions déjà installées. Les
-- tentatives se comptent elles aussi toutes langues confondues : changer de
-- langue ne rend plus de tentative pour un classement devenu commun.
--
-- La semaine du 11 octobre dure deux semaines (`WEEKLY_EXTENDED`,
-- `src/domain/weekly.ts`, à tenir aligné) : `weekly_week` rabat le dimanche
-- 18 octobre sur elle, ce qui couvre aussi un client plus ancien qui croit à
-- une semaine neuve et l'envoie sous son propre dimanche.
--
-- Le défi du 4 octobre, joué avant l'ouverture par son seul auteur, quitte
-- le palmarès : ses tentatives et ses réactions sont effacées.

create function public.weekly_week(p_week_id date) returns date
language sql immutable as $$
  select coalesce(
    (select e.week_id from (values (date '2026-10-11', 2)) e (week_id, weeks)
      where p_week_id > e.week_id and p_week_id < e.week_id + 7 * e.weeks),
    p_week_id)
$$;

revoke execute on function public.weekly_week(date) from public, anon, authenticated;

-- Une semaine prolongée garde ses jours au-delà du septième.
alter table public.weekly_attempts drop constraint weekly_attempts_check;
alter table public.weekly_attempts add constraint weekly_attempts_check check (day between week_id and week_id + 28);

create or replace function public.weekly_window(p_at timestamptz default now())
returns table (week_id date, day date)
language sql stable as $$
  select public.weekly_week(((s at time zone 'Europe/Paris') - interval '21 hours')::date
           - extract(dow from (s at time zone 'Europe/Paris') - interval '21 hours')::integer),
         (s at time zone 'Europe/Paris')::date
  from (select p_at as s) t
$$;

create or replace function public.weekly_start(p_week_id date, p_lang text, p_day date, p_quota integer)
returns table (attempt_id uuid, n integer)
language plpgsql security definer set search_path = public as $$
declare
  v_window record;
  v_week date := public.weekly_week(p_week_id);
  v_used integer;
  v_id uuid;
begin
  if not public.is_named_account() then
    raise exception 'named account required' using errcode = '42501';
  end if;
  if p_lang !~ '^[a-z]{2}$' then
    raise exception 'invalid challenge' using errcode = '22023';
  end if;

  select * into v_window from public.weekly_window();
  if v_week is distinct from v_window.week_id or p_day is distinct from v_window.day then
    return;
  end if;

  -- Deux appels simultanés du même joueur comptent à la suite, pas ensemble.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || v_week || p_day, 0));

  select count(*) into v_used
  from public.weekly_attempts a
  where a.player_id = auth.uid() and a.week_id = v_week and a.day = p_day;
  if v_used >= greatest(0, least(coalesce(p_quota, 0), public.weekly_max_attempts())) then
    return;
  end if;

  insert into public.weekly_attempts (player_id, week_id, lang, day, n)
  values (auth.uid(), v_week, p_lang, p_day, v_used + 1)
  returning id into v_id;
  return query select v_id, v_used + 1;
end;
$$;

create or replace function public.weekly_board(p_week_id date, p_lang text, p_lim integer)
returns table (rank integer, player_id uuid, display_name text, avatar jsonb, value numeric, attempts integer, me boolean)
language sql stable security definer set search_path = public as $$
  with best as (
    select a.player_id, max(a.value) as value, count(*)::integer as attempts
      from public.weekly_attempts a
      join auth.users u on u.id = a.player_id and not u.is_anonymous
     where a.week_id = public.weekly_week(p_week_id) and a.finished_at is not null
       and not exists (select 1 from public.bots b where b.id = a.player_id)
     group by a.player_id
  )
  select (rank() over (order by b.value desc))::integer, b.player_id, p.display_name, p.avatar, b.value, b.attempts, b.player_id = auth.uid()
    from best b
    join public.profiles p on p.id = b.player_id
   order by 1, p.display_name
   limit greatest(1, least(coalesce(p_lim, 50), 100))
$$;

create or replace function public.weekly_recap(p_week_id date, p_lang text) returns jsonb
language sql stable security definer set search_path = public as $$
  with mine as (
    select a.n, a.day, a.value, a.metric, a.finished_at is not null as finished, a.started_at
      from public.weekly_attempts a
     where a.player_id = auth.uid() and a.week_id = public.weekly_week(p_week_id)
  ),
  fin as (
    select a.player_id, a.day, a.value
      from public.weekly_attempts a
      join auth.users u on u.id = a.player_id and not u.is_anonymous
     where a.week_id = public.weekly_week(p_week_id) and a.finished_at is not null
       and not exists (select 1 from public.bots b where b.id = a.player_id)
  ),
  best as (
    select f.player_id, max(f.value) as value from fin f group by f.player_id
  ),
  me as (select value from best where player_id = auth.uid()),
  -- À la fin de chacun de mes jours joués : la meilleure tentative de chaque
  -- joueur qui avait rendu une partie ce jour-là ou avant.
  upto as (
    select d.day, f.player_id, max(f.value) as value
      from (select distinct day from fin where player_id = auth.uid()) d
      join fin f on f.day <= d.day
     group by d.day, f.player_id
  ),
  ranks as (
    select u.day,
           (1 + count(*) filter (where u.value > (select m.value from upto m where m.day = u.day and m.player_id = auth.uid())))::integer as rank,
           count(*)::integer as players
      from upto u
     group by u.day
  )
  select jsonb_build_object(
    'attempts', coalesce((select jsonb_agg(jsonb_build_object(
      'n', m.n, 'day', m.day, 'value', m.value, 'metric', m.metric, 'finished', m.finished) order by m.started_at) from mine m), '[]'::jsonb),
    'best', (select value from me),
    'rank', (select 1 + count(*) from best b where b.value > (select value from me)),
    'players', (select count(*) from best),
    'ranks', coalesce((select jsonb_agg(jsonb_build_object('day', r.day, 'rank', r.rank, 'players', r.players) order by r.day) from ranks r), '[]'::jsonb)
  )
$$;

create or replace function public.weekly_last_played(p_lang text) returns date
language sql stable security definer set search_path = public as $$
  select max(a.week_id)
    from public.weekly_attempts a
   where a.player_id = auth.uid() and a.finished_at is not null
     and a.week_id < (select week_id from public.weekly_window())
$$;

create or replace function public.weekly_winners(p_lang text, p_lim integer default 50)
returns table (week_id date, player_id uuid, display_name text, avatar jsonb, metric text, value numeric)
language sql stable security definer set search_path = public as $$
with closed as (
  select a.week_id, a.player_id, a.metric, a.value, a.finished_at
  from public.weekly_attempts a
  join auth.users u on u.id = a.player_id and not u.is_anonymous
  where a.finished_at is not null and a.value is not null
    and a.week_id < (select week_id from public.weekly_window())
    and not exists (select 1 from public.bots b where b.id = a.player_id)
),
winner as (
  select distinct on (c.week_id) c.week_id, c.player_id, c.metric, c.value
  from closed c
  order by c.week_id desc, c.value desc, c.finished_at, c.player_id
)
select w.week_id, w.player_id, p.display_name, p.avatar, w.metric, w.value
from winner w
join public.profiles p on p.id = w.player_id
order by w.week_id desc
limit greatest(1, least(coalesce(p_lim, 50), 100))
$$;

-- Les mots se comptent par catégorie et par clé : deux langues n'ont pas les
-- mêmes, un mot n'est donc « suivi » que par ceux de sa langue.
create or replace function public.weekly_measures(p_week_id date, p_lang text)
returns table (
  player_id uuid, display_name text, reached_at timestamptz, attempts integer, climb numeric, best_combo integer,
  original integer, sheep integer,
  rarest_tier integer, rarest_points integer, rarest_word text,
  fastest numeric, fastest_word text,
  longest integer, longest_word text
)
language sql stable security definer set search_path = public as $$
  with fin as (
    select a.player_id, a.lang, a.value, a.best_combo, a.words, a.started_at, a.finished_at
      from public.weekly_attempts a
      join auth.users u on u.id = a.player_id and not u.is_anonymous
     where a.week_id = public.weekly_week(p_week_id) and a.finished_at is not null
       and not exists (select 1 from public.bots b where b.id = a.player_id)
  ),
  raw as (
    select f.player_id,
           f.lang || ':' || (x ->> 'categoryId') as cat, x ->> 'key' as key, x ->> 'display' as display,
           case x ->> 'tier' when 'très rare' then 3 when 'rare' then 2 when 'peu commun' then 1 else 0 end as tier,
           coalesce((x ->> 'points')::integer, 0) as points,
           coalesce((x ->> 'seconds')::numeric, 0) as seconds,
           coalesce((x ->> 'approximate')::boolean, false) as approx
      from fin f, jsonb_array_elements(coalesce(f.words, '[]'::jsonb)) x
     where x ? 'categoryId' and x ? 'key'
  ),
  dw as (
    -- Un mot écrit deux fois garde sa réponse exacte la plus rapide, sans laisser le plan choisir.
    select distinct on (player_id, cat, key) * from raw order by player_id, cat, key, approx, seconds = 0, seconds
  ),
  crowd as (select cat, key, count(*) as n from dw group by cat, key),
  counts as (
    select d.player_id,
           count(*) filter (where c.n = 1)::integer as original,
           count(*) filter (where c.n > 1)::integer as sheep
      from dw d join crowd c using (cat, key)
     group by d.player_id
  ),
  rarest as (
    select distinct on (player_id) player_id, tier, points, display
      from dw where not approx order by player_id, tier desc, points desc, display
  ),
  fastest as (
    select distinct on (player_id) player_id, seconds, display
      from dw where not approx and seconds > 0 order by player_id, seconds, display
  ),
  longest as (
    select distinct on (player_id) player_id, length(regexp_replace(key, '[^[:alpha:]]', '', 'g')) as size, display
      from dw where not approx order by player_id, 2 desc, display
  ),
  best as (
    select distinct on (player_id) player_id, finished_at from fin order by player_id, value desc, finished_at
  ),
  firsts as (
    select distinct on (player_id) player_id, value from fin order by player_id, started_at
  ),
  agg as (
    select player_id, max(value) as best_value, max(fin.best_combo)::integer as best_combo from fin group by player_id
  ),
  tries as (
    select player_id, count(*)::integer as attempts
      from public.weekly_attempts
     where week_id = public.weekly_week(p_week_id) group by player_id
  )
  select g.player_id, p.display_name, b.finished_at, t.attempts,
         greatest(0, g.best_value - f.value), coalesce(g.best_combo, 0),
         coalesce(c.original, 0), coalesce(c.sheep, 0),
         coalesce(r.tier, 0), coalesce(r.points, 0), r.display,
         fa.seconds, fa.display,
         coalesce(l.size, 0), l.display
    from agg g
    join public.profiles p on p.id = g.player_id
    join best b using (player_id)
    join firsts f using (player_id)
    join tries t using (player_id)
    left join counts c using (player_id)
    left join rarest r using (player_id)
    left join fastest fa using (player_id)
    left join longest l using (player_id)
   order by g.player_id
$$;

create or replace function public.weekly_played(p_week_id date, p_lang text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.weekly_attempts
     where player_id = auth.uid() and week_id = public.weekly_week(p_week_id) and finished_at is not null
  )
$$;

-- Une réaction par joueur et par cible, quelle que soit la langue où il l'a posée.
create or replace function public.react_in_weekly(p_week_id date, p_lang text, p_target text, p_emoji text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_week date := public.weekly_week(p_week_id);
begin
  if not public.weekly_played(v_week, p_lang) then
    return false;
  end if;
  delete from public.weekly_reactions
   where week_id = v_week and player_id = auth.uid() and target = p_target and lang <> p_lang;
  if p_emoji is null then
    delete from public.weekly_reactions
     where week_id = v_week and lang = p_lang and player_id = auth.uid() and target = p_target;
    return true;
  end if;
  insert into public.weekly_reactions (week_id, lang, player_id, target, emoji)
    values (v_week, p_lang, auth.uid(), p_target, p_emoji)
    on conflict (week_id, lang, player_id, target) do update set emoji = excluded.emoji, created_at = now();
  return true;
exception when check_violation then
  return false;
end;
$$;

create or replace function public.weekly_reaction_counts(p_week_id date, p_lang text)
returns table (target text, emoji text, n integer, mine boolean)
language sql stable security definer set search_path = public as $$
  select r.target, r.emoji, count(*)::integer, coalesce(bool_or(r.player_id = auth.uid()), false)
    from public.weekly_reactions r
   where r.week_id = public.weekly_week(p_week_id) and public.weekly_played(p_week_id, p_lang)
   group by r.target, r.emoji
   order by r.target, 3 desc, r.emoji
$$;

delete from public.weekly_reactions where week_id = date '2026-10-04';
delete from public.weekly_attempts where week_id = date '2026-10-04';
