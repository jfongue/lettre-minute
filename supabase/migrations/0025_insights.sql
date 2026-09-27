-- Les classements avancés : un mode débug caché, ouvert par cinq tapes sur le
-- mot « Classement ». Rien ici ne nomme un joueur — que des parties, des
-- comptes, des rythmes et des moyennes —, et le client ne les lit que sous ce
-- geste.
--
-- Deux mesures manquaient au serveur pour les nourrir : avec quels pouvoirs une
-- partie a été jouée, et ce qu'un couple lettre + catégorie rapporte. Les
-- pouvoirs restent hors du profil (le serveur ne sait toujours pas ce qu'un
-- joueur possède) : c'est la partie qui dit avec quoi elle a été jouée.

-- ------------------------------------------------------- ce que la partie dit --

alter table public.runs add column powers text[] not null default '{}';
-- Le jeu n'en porte que deux, un défi un peu plus : la borne n'est là que pour
-- arrêter un client qui enverrait n'importe quoi.
alter table public.runs add constraint runs_powers_count check (cardinality(powers) <= 20);

alter table public.prompt_stats add column points integer not null default 0 check (points >= 0);
alter table public.prompt_stats add column words integer not null default 0 check (words >= 0);

-- Le rapport d'une partie gagne les points et les mots que chaque couple a
-- rendus : les deux compteurs d'origine suffisent au tirage, pas à dire ce
-- qu'un couple rapporte. Un envoi d'avant (0022) n'a ni l'un ni l'autre : les
-- colonnes retombent alors à zéro, sans faire échouer le rapport.
create or replace function public.report_prompts(p_seed bigint, p_lang text, p_prompts jsonb)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_category text;
  v_letter text;
  v_passed boolean;
  v_points integer;
  v_words integer;
begin
  if auth.uid() is null or p_seed is null or p_lang is null or p_lang !~ '^[a-z]{2}$'
     or p_prompts is null or jsonb_typeof(p_prompts) <> 'array' then
    return false;
  end if;
  -- Soixante secondes ne quittent pas trente couples.
  if jsonb_array_length(p_prompts) > 30 then
    return false;
  end if;

  insert into public.prompt_reports (player_id, seed) values (auth.uid(), p_seed)
  on conflict do nothing;
  if not found then
    return false;
  end if;

  for v_item in select value from jsonb_array_elements(p_prompts) loop
    -- `coalesce` : un objet sans verdict rend un type nul, et un test faux
    -- laisserait passer le couple.
    if jsonb_typeof(v_item) <> 'object' or coalesce(jsonb_typeof(v_item -> 'passed'), '') <> 'boolean' then
      continue;
    end if;
    v_category := v_item ->> 'category';
    v_letter := v_item ->> 'letter';
    v_passed := (v_item ->> 'passed')::boolean;
    if v_category is null or v_category !~ '^[a-z0-9-]{1,60}$' or v_letter is null or v_letter !~ '^[A-Z]$' then
      continue;
    end if;
    -- Soixante secondes ne rapportent pas plus : une valeur douteuse est
    -- ramenée dans les bornes plutôt que d'écarter le couple.
    v_points := case when jsonb_typeof(v_item -> 'points') = 'number'
                     then least(greatest(coalesce((v_item ->> 'points')::numeric, 0), 0), 100000)::integer
                     else 0 end;
    v_words := case when jsonb_typeof(v_item -> 'words') = 'number'
                    then least(greatest(coalesce((v_item ->> 'words')::numeric, 0), 0), 60)::integer
                    else 0 end;
    insert into public.prompt_stats (lang, category_id, letter, dealt, passed, points, words)
    values (p_lang, v_category, v_letter, 1, case when v_passed then 1 else 0 end, v_points, v_words)
    on conflict (lang, category_id, letter) do update
      set dealt = public.prompt_stats.dealt + 1,
          passed = public.prompt_stats.passed + excluded.passed,
          points = public.prompt_stats.points + excluded.points,
          words = public.prompt_stats.words + excluded.words;
  end loop;
  return true;
end;
$$;

-- ----------------------------------------------------------- les classements --

-- Le rythme du jeu : les parties jouées et les comptes créés, par heure sur les
-- dernières vingt-quatre (vue du jour), par jour sur la semaine, ou par semaine
-- sur les douze dernières (vue totale). L'heure de Paris, comme les périodes
-- des classements ; les cases vides sortent à zéro, pour que le graphique
-- montre les creux au lieu de les sauter.
create function public.debug_activity(p_bucket text)
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
       group by 1
    ),
    created as (
      select date_trunc(v_unit, u.created_at at time zone 'Europe/Paris') as local_bucket,
             count(*)::integer as n
        from auth.users u
       where not u.is_anonymous
         and u.created_at >= (select min(s.local_bucket) at time zone 'Europe/Paris' from series s)
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
create function public.debug_powers()
returns table (power text, runs integer, points integer, best integer)
language sql stable security definer set search_path = public as $$
  select p.power,
         count(*)::integer,
         sum(r.score)::integer,
         max(r.score)::integer
    from public.runs r
    cross join lateral unnest(r.powers) as p(power)
   group by p.power;
$$;

-- Ce que chaque couple lettre + catégorie rapporte et ce qu'on le quitte : les
-- compteurs du tirage (0022) et ce que les parties y ont marqué. Par langue :
-- un couple allemand ne dit rien d'un couple français.
create function public.debug_pairs(p_lang text)
returns table (category_id text, letter text, dealt integer, passed integer, words integer, points integer)
language sql stable security definer set search_path = public as $$
  select s.category_id, s.letter, s.dealt, s.passed, s.words, s.points
    from public.prompt_stats s
   where s.lang = p_lang
     and s.dealt > 0;
$$;

-- Réservés aux joueurs connectés, comme les classements : ils ne nomment
-- personne, mais rien ne justifie de les ouvrir à un visiteur sans session.
revoke execute on function public.debug_activity(text) from public, anon;
revoke execute on function public.debug_powers() from public, anon;
revoke execute on function public.debug_pairs(text) from public, anon;
grant execute on function public.debug_activity(text) to authenticated;
grant execute on function public.debug_powers() to authenticated;
grant execute on function public.debug_pairs(text) to authenticated;
