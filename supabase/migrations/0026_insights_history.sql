-- Les classements avancés, corrigés sur deux points.
--
-- D'abord les joueurs maison : leurs parties tournent toutes les heures par
-- pg_cron, et elles gonflaient le rythme du jeu comme si la foule jouait la
-- nuit. Les trois fonctions les écartent maintenant par leur compte (`bots`),
-- jamais par leur nom, qu'un vrai joueur peut porter — la même règle que les
-- classements (0024).
--
-- Ensuite l'histoire : les compteurs de `prompt_stats` ne datent que des
-- rapports, c'est-à-dire des clients qui envoient leurs couples (0022) et,
-- pour les points, de 0025. Tout ce que les joueurs ont écrit avant dort
-- pourtant dans `run_words`, avec sa catégorie et ses points. `debug_pairs`
-- réunit donc les deux sources : les rapports, et les parties dont aucun
-- rapport n'est arrivé — le mot trouvé y donne la lettre du couple, comme le
-- jeu la juge (`initialOf`, `src/domain/text.ts`).
--
-- Rien n'est écrit dans `prompt_stats` : le tirage lit cette table
-- (`Judge.pull`), et un « dealt » qui ne compterait que les tirages répondus
-- fausserait la cote des couples concernés. L'histoire ne vit que dans ce que
-- lisent les classements avancés, et `reported` dit d'où vient chaque ligne.

-- La lettre sur laquelle un mot se joue : la même règle que le client —
-- ligatures développées, accents retirés, et le premier caractère latin.
-- « Œil » sort donc en O, comme le jeu le propose.
create function public.prompt_letter(p_word text) returns text
language sql immutable set search_path = public as $$
  select upper(substring(
           translate(
             replace(replace(replace(replace(replace(replace(replace(replace(replace(lower(p_word),
               'œ', 'oe'), 'æ', 'ae'), 'ß', 'ss'), 'ĳ', 'ij'), 'ø', 'o'), 'ł', 'l'),
               'đ', 'd'), 'ð', 'd'), 'þ', 'th'),
             'àáâãäåçèéêëìíîïñòóôõöùúûüýÿı', 'aaaaaaceeeeiiiinooooouuuuyyi')
           from '[a-z]'));
$$;

-- Rien hors des fonctions qui l'appellent : c'est un détail de calcul.
revoke execute on function public.prompt_letter(text) from public, anon, authenticated;

-- Le rythme du jeu : les parties jouées et les comptes créés, par heure sur les
-- dernières vingt-quatre (vue du jour), par jour sur la semaine, ou par semaine
-- sur les douze dernières (vue totale). L'heure de Paris, comme les périodes
-- des classements ; les cases vides sortent à zéro. Les joueurs maison n'y
-- comptent pas : ni leurs parties, ni leurs comptes.
create or replace function public.debug_activity(p_bucket text)
returns table (bucket timestamptz, runs integer, accounts integer)
language plpgsql stable security definer set search_path = public as $$
declare
  v_unit text;
  v_step interval;
  v_span integer;
begin
  if p_bucket = 'hour' then
    v_unit := 'hour'; v_step := interval '1 hour'; v_span := 24;
  elsif p_bucket = 'day' then
    v_unit := 'day'; v_step := interval '1 day'; v_span := 7;
  elsif p_bucket = 'week' then
    v_unit := 'week'; v_step := interval '1 week'; v_span := 12;
  else
    return;
  end if;

  return query
    with series as (
      select generate_series(
               date_trunc(v_unit, now() at time zone 'Europe/Paris') - (v_span - 1) * v_step,
               date_trunc(v_unit, now() at time zone 'Europe/Paris'),
               v_step
             ) as local_bucket
    ),
    played as (
      select date_trunc(v_unit, r.created_at at time zone 'Europe/Paris') as local_bucket,
             count(*)::integer as n
        from public.runs r
       where r.created_at >= (select min(s.local_bucket) at time zone 'Europe/Paris' from series s)
         and not exists (select 1 from public.bots b where b.id = r.player_id)
       group by 1
    ),
    created as (
      select date_trunc(v_unit, u.created_at at time zone 'Europe/Paris') as local_bucket,
             count(*)::integer as n
        from auth.users u
       where not u.is_anonymous
         and u.created_at >= (select min(s.local_bucket) at time zone 'Europe/Paris' from series s)
         and not exists (select 1 from public.bots b where b.id = u.id)
       group by 1
    )
    select s.local_bucket at time zone 'Europe/Paris',
           coalesce(p.n, 0),
           coalesce(c.n, 0)
      from series s
      left join played p on p.local_bucket = s.local_bucket
      left join created c on c.local_bucket = s.local_bucket
     order by s.local_bucket;
end;
$$;

-- Quels pouvoirs sortent, et ce qu'ils rapportent : une ligne par pouvoir joué,
-- les parties qui le portaient et leurs points. La moyenne se calcule côté
-- client — deux divisions, mieux testées là-bas qu'en SQL.
create or replace function public.debug_powers()
returns table (power text, runs integer, points integer, best integer)
language sql stable security definer set search_path = public as $$
  select p.power,
         count(*)::integer,
         sum(r.score)::integer,
         max(r.score)::integer
    from public.runs r
    cross join lateral unnest(r.powers) as p(power)
   where not exists (select 1 from public.bots b where b.id = r.player_id)
   group by p.power;
$$;

-- Ce que chaque couple lettre + catégorie rapporte et ce qu'on le quitte : les
-- rapports des parties (`prompt_stats`) réunis à l'histoire des mots joués que
-- personne n'a rapportée. `reported` dit d'où vient la ligne : un rapport
-- compte les tirages quittés (`dealt`, `passed`), l'histoire ne voit que les
-- tirages qui ont donné un mot, et son `dealt` en est donc un plancher.
drop function public.debug_pairs(text);

create function public.debug_pairs(p_lang text)
returns table (category_id text, letter text, dealt integer, passed integer, words integer, points integer, reported boolean)
language sql stable security definer set search_path = public as $$
  with reported_run as (
    select r.id
      from public.runs r
      join public.prompt_reports p on p.player_id = r.player_id and p.seed = r.seed
  ),
  played as (
    select case when w.category_id ~ '^[a-z]{2}:' then split_part(w.category_id, ':', 1) else 'fr' end as lang,
           case when w.category_id ~ '^[a-z]{2}:' then split_part(w.category_id, ':', 2) else w.category_id end as category_id,
           -- Le mot d'une autre langue porte le même préfixe (`de:katze`) :
           -- la lettre se lit sur le mot seul, comme le jeu la propose.
           public.prompt_letter(regexp_replace(w.word, '^[a-z]{2}:', '')) as letter,
           w.run_id,
           w.points
      from public.run_words w
      join public.runs r on r.id = w.run_id
     where not exists (select 1 from reported_run rr where rr.id = r.id)
       and not exists (select 1 from public.bots b where b.id = r.player_id)
  ),
  history as (
    select category_id,
           letter,
           count(distinct run_id)::integer as dealt,
           count(*)::integer as words,
           sum(points)::integer as points
      from played
     where lang = p_lang
       and letter ~ '^[A-Z]$'
     group by 1, 2
  )
  select s.category_id, s.letter, s.dealt, s.passed, s.words, s.points, true
    from public.prompt_stats s
   where s.lang = p_lang
  union all
  select h.category_id, h.letter, h.dealt, 0, h.words, h.points, false
    from history h;
$$;

revoke execute on function public.debug_activity(text) from public, anon;
revoke execute on function public.debug_powers() from public, anon;
revoke execute on function public.debug_pairs(text) from public, anon;
grant execute on function public.debug_activity(text) to authenticated;
grant execute on function public.debug_powers() to authenticated;
grant execute on function public.debug_pairs(text) to authenticated;
