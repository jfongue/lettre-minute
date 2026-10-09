-- Le défi du moment : une partie par semaine, la même pour tous (la graine et
-- les catégories viennent du client, `src/domain/weekly.ts`), ouverte du
-- dimanche 21 h au dimanche suivant 21 h, heure de Paris. Le serveur ne joue
-- pas et ne connaît ni les modes ni Premium : il tient le compte des
-- tentatives d'une fenêtre (semaine, langue, jour de Paris), le meilleur
-- résultat de chacun, et le classement.
--
-- Le compteur fait foi ici. Le quota que le client demande (2, 3 avec une
-- pub, 5 pour un Premium) n'est qu'un plafond de plus : le serveur ne le croit
-- jamais au-delà de `weekly_max_attempts`, et la fenêtre qu'on lui donne doit
-- être celle de son horloge — un téléphone déréglé ne gagne pas de tentatives.

create table public.weekly_attempts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles on delete cascade,
  -- Le dimanche d'ouverture de la semaine, et le jour de Paris de la tentative.
  week_id date not null check (extract(dow from week_id) = 0),
  lang text not null check (lang ~ '^[a-z]{2}$'),
  day date not null check (day between week_id and week_id + 7),
  -- Le numéro de la tentative dans sa fenêtre, de 1 à 5.
  n smallint not null check (n between 1 and 5),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  -- Des points, ou des secondes tenues en endurance : le client dit lequel.
  metric text not null default 'score' check (metric in ('score', 'survival')),
  value numeric(7, 1) check (value is null or value between 0 and 10000),
  -- La plus longue série de la partie, pour le trophée de la semaine.
  best_combo smallint check (best_combo is null or best_combo between 0 and 1000),
  -- Les mots de la partie, tels que le défi entre amis les range.
  words jsonb check (words is null or (jsonb_typeof(words) = 'array' and jsonb_array_length(words) <= 200)),
  unique (player_id, week_id, lang, day, n)
);

create index weekly_attempts_board on public.weekly_attempts (week_id, lang, value desc) where finished_at is not null;

-- Fermée comme les tables du duel : un joueur ne lit ni n'écrit rien hors des fonctions.
alter table public.weekly_attempts enable row level security;

create function public.weekly_max_attempts() returns integer
language sql immutable as $$ select 5 $$;

-- La fenêtre de l'horloge du serveur : la semaine bascule le dimanche à 21 h,
-- heure de Paris, et le jour avec minuit. Reculer de 21 h ramène la bascule à
-- minuit, d'où un dimanche qui se lit dans la date décalée.
create function public.weekly_window(p_at timestamptz default now())
returns table (week_id date, day date)
language sql stable as $$
  select ((s at time zone 'Europe/Paris') - interval '21 hours')::date
           - extract(dow from (s at time zone 'Europe/Paris') - interval '21 hours')::integer,
         (s at time zone 'Europe/Paris')::date
  from (select p_at as s) t
$$;

-- Lance une tentative : son identifiant et son numéro, ou aucune ligne quand
-- la fenêtre est périmée ou le quota atteint.
create function public.weekly_start(p_week_id date, p_lang text, p_day date, p_quota integer)
returns table (attempt_id uuid, n integer)
language plpgsql security definer set search_path = public as $$
declare
  v_window record;
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
  if p_week_id is distinct from v_window.week_id or p_day is distinct from v_window.day then
    return;
  end if;

  -- Deux appels simultanés du même joueur comptent à la suite, pas ensemble.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_week_id || p_lang || p_day, 0));

  select count(*) into v_used
  from public.weekly_attempts a
  where a.player_id = auth.uid() and a.week_id = p_week_id and a.lang = p_lang and a.day = p_day;
  if v_used >= greatest(0, least(coalesce(p_quota, 0), public.weekly_max_attempts())) then
    return;
  end if;

  insert into public.weekly_attempts (player_id, week_id, lang, day, n)
  values (auth.uid(), p_week_id, p_lang, p_day, v_used + 1)
  returning id into v_id;
  return query select v_id, v_used + 1;
end;
$$;

-- Rend le résultat d'une tentative, une fois : vrai si elle est encaissée. Une
-- tentative lancée il y a plus d'une demi-heure n'est plus une partie.
create function public.weekly_finish(p_attempt uuid, p_value numeric, p_words jsonb, p_metric text default 'score', p_combo integer default 0)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_metric not in ('score', 'survival') or p_value is null or p_value < 0 or p_value > 10000 then
    raise exception 'invalid result' using errcode = '22023';
  end if;
  if p_words is not null and (jsonb_typeof(p_words) <> 'array' or jsonb_array_length(p_words) > 200) then
    raise exception 'invalid result' using errcode = '22023';
  end if;

  update public.weekly_attempts
     set finished_at = now(), metric = p_metric, value = round(p_value, 1), words = p_words,
         best_combo = greatest(0, least(coalesce(p_combo, 0), 1000))
   where id = p_attempt
     and player_id = auth.uid()
     and finished_at is null
     and started_at > now() - interval '30 minutes';
  return found;
end;
$$;

-- Le classement : la meilleure tentative terminée de chaque joueur nommé, ex
-- aequo au même rang. Les joueurs maison jouent ailleurs, jamais ici, et sont
-- écartés par leur compte comme sur les autres tableaux (0024).
create function public.weekly_board(p_week_id date, p_lang text, p_lim integer)
returns table (rank integer, player_id uuid, display_name text, avatar jsonb, value numeric, attempts integer, me boolean)
language sql stable security definer set search_path = public as $$
  with best as (
    select a.player_id, max(a.value) as value, count(*)::integer as attempts
      from public.weekly_attempts a
      join auth.users u on u.id = a.player_id and not u.is_anonymous
     where a.week_id = p_week_id and a.lang = p_lang and a.finished_at is not null
       and not exists (select 1 from public.bots b where b.id = a.player_id)
     group by a.player_id
  )
  select (rank() over (order by b.value desc))::integer, b.player_id, p.display_name, p.avatar, b.value, b.attempts, b.player_id = auth.uid()
    from best b
    join public.profiles p on p.id = b.player_id
   order by 1, p.display_name
   limit greatest(1, least(coalesce(p_lim, 50), 100))
$$;

-- Le récap de fin de défi : mes tentatives dans l'ordre où je les ai jouées,
-- mon meilleur résultat, mon rang final et le nombre de joueurs classés.
create function public.weekly_recap(p_week_id date, p_lang text) returns jsonb
language sql stable security definer set search_path = public as $$
  with mine as (
    select a.n, a.day, a.value, a.metric, a.finished_at is not null as finished, a.started_at
      from public.weekly_attempts a
     where a.player_id = auth.uid() and a.week_id = p_week_id and a.lang = p_lang
  ),
  best as (
    select a.player_id, max(a.value) as value
      from public.weekly_attempts a
      join auth.users u on u.id = a.player_id and not u.is_anonymous
     where a.week_id = p_week_id and a.lang = p_lang and a.finished_at is not null
       and not exists (select 1 from public.bots b where b.id = a.player_id)
     group by a.player_id
  ),
  me as (select value from best where player_id = auth.uid())
  select jsonb_build_object(
    'attempts', coalesce((select jsonb_agg(jsonb_build_object(
      'n', m.n, 'day', m.day, 'value', m.value, 'metric', m.metric, 'finished', m.finished) order by m.started_at) from mine m), '[]'::jsonb),
    'best', (select value from me),
    'rank', (select 1 + count(*) from best b where b.value > (select value from me)),
    'players', (select count(*) from best)
  )
$$;

-- La dernière semaine close où j'ai rendu un résultat : c'est elle que le
-- client lit pour décider d'un récap à montrer. La semaine en cours n'a pas
-- fini de se jouer.
create function public.weekly_last_played(p_lang text) returns date
language sql stable security definer set search_path = public as $$
  select max(a.week_id)
    from public.weekly_attempts a
   where a.player_id = auth.uid() and a.lang = p_lang and a.finished_at is not null
     and a.week_id < (select week_id from public.weekly_window())
$$;

-- --------------------------------------------------------------- trophées --

-- Une ligne de mesures par joueur nommé qui a rendu une partie : de quoi
-- attribuer les huit trophées de la semaine (`awardWeeklyTrophies`) sans que
-- le client ait à lire les mots de personne. Les mots se comptent par joueur
-- une fois (catégorie + clé, la forme exacte avant la corrigée), sur toutes ses
-- tentatives. `reached_at` est l'heure où sa meilleure tentative s'est
-- terminée : c'est elle qui départage un ex aequo.
create function public.weekly_measures(p_week_id date, p_lang text)
returns table (
  player_id uuid, display_name text, reached_at timestamptz, attempts integer, climb numeric, best_combo integer,
  original integer, sheep integer,
  rarest_tier integer, rarest_points integer, rarest_word text,
  fastest numeric, fastest_word text,
  longest integer, longest_word text
)
language sql stable security definer set search_path = public as $$
  with fin as (
    select a.player_id, a.value, a.best_combo, a.words, a.started_at, a.finished_at
      from public.weekly_attempts a
      join auth.users u on u.id = a.player_id and not u.is_anonymous
     where a.week_id = p_week_id and a.lang = p_lang and a.finished_at is not null
       and not exists (select 1 from public.bots b where b.id = a.player_id)
  ),
  raw as (
    select f.player_id,
           x ->> 'categoryId' as cat, x ->> 'key' as key, x ->> 'display' as display,
           case x ->> 'tier' when 'très rare' then 3 when 'rare' then 2 when 'peu commun' then 1 else 0 end as tier,
           coalesce((x ->> 'points')::integer, 0) as points,
           coalesce((x ->> 'seconds')::numeric, 0) as seconds,
           coalesce((x ->> 'approximate')::boolean, false) as approx
      from fin f, jsonb_array_elements(coalesce(f.words, '[]'::jsonb)) x
     where x ? 'categoryId' and x ? 'key'
  ),
  dw as (
    select distinct on (player_id, cat, key) * from raw order by player_id, cat, key, approx
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
     where week_id = p_week_id and lang = p_lang group by player_id
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

-- ------------------------------------------------------------ réactions --

-- Comme celles d'un défi entre amis (0014), pour toute la semaine : une
-- réaction par joueur et par cible (`trophy:weekly-rarest`, `podium:1`,
-- `player:<id>`), que le client compose. Seul un joueur qui a rendu une
-- partie cette semaine-là réagit.
create table public.weekly_reactions (
  week_id date not null,
  lang text not null check (lang ~ '^[a-z]{2}$'),
  player_id uuid not null references public.profiles on delete cascade,
  target text not null check (char_length(target) between 1 and 200),
  emoji text not null check (emoji in ('👏', '😂', '😮', '🔥', '❤️', '🏆')),
  created_at timestamptz not null default now(),
  primary key (week_id, lang, player_id, target)
);

alter table public.weekly_reactions enable row level security;
-- Aucune politique : tout passe par les fonctions ci-dessous.

create function public.weekly_played(p_week_id date, p_lang text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.weekly_attempts
     where player_id = auth.uid() and week_id = p_week_id and lang = p_lang and finished_at is not null
  )
$$;

-- Un emoji nul retire la réaction.
create function public.react_in_weekly(p_week_id date, p_lang text, p_target text, p_emoji text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.weekly_played(p_week_id, p_lang) then
    return false;
  end if;
  if p_emoji is null then
    delete from public.weekly_reactions
     where week_id = p_week_id and lang = p_lang and player_id = auth.uid() and target = p_target;
    return true;
  end if;
  insert into public.weekly_reactions (week_id, lang, player_id, target, emoji)
    values (p_week_id, p_lang, auth.uid(), p_target, p_emoji)
    on conflict (week_id, lang, player_id, target) do update set emoji = excluded.emoji, created_at = now();
  return true;
exception when check_violation then
  return false;
end;
$$;

-- Des comptes, jamais des réactions une à une : des milliers de joueurs
-- n'en font qu'une ligne par cible et par emoji, `mine` disant si la mienne en est.
create function public.weekly_reaction_counts(p_week_id date, p_lang text)
returns table (target text, emoji text, n integer, mine boolean)
language sql stable security definer set search_path = public as $$
  select r.target, r.emoji, count(*)::integer, coalesce(bool_or(r.player_id = auth.uid()), false)
    from public.weekly_reactions r
   where r.week_id = p_week_id and r.lang = p_lang and public.weekly_played(p_week_id, p_lang)
   group by r.target, r.emoji
   order by r.target, 3 desc, r.emoji
$$;

revoke execute on function
  public.weekly_max_attempts(),
  public.weekly_played(date, text),
  public.weekly_window(timestamptz)
  from public, anon, authenticated;

revoke execute on function
  public.weekly_start(date, text, date, integer),
  public.weekly_finish(uuid, numeric, jsonb, text, integer),
  public.weekly_board(date, text, integer),
  public.weekly_recap(date, text),
  public.weekly_last_played(text),
  public.weekly_measures(date, text),
  public.react_in_weekly(date, text, text, text),
  public.weekly_reaction_counts(date, text)
  from public, anon;

grant execute on function
  public.weekly_start(date, text, date, integer),
  public.weekly_finish(uuid, numeric, jsonb, text, integer),
  public.weekly_board(date, text, integer),
  public.weekly_recap(date, text),
  public.weekly_last_played(text),
  public.weekly_measures(date, text),
  public.react_in_weekly(date, text, text, text),
  public.weekly_reaction_counts(date, text)
  to authenticated;
