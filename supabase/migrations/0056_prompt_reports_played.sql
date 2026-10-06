-- Le rapport de fin de partie dit avec quels couples la partie s'est jouée : le
-- tirage de tout le monde s'en sert (`Judge.pull`, `src/domain/prompts.ts`), et
-- il suffisait d'une graine inédite pour ce compte, sans qu'aucune partie ne la
-- porte. Un client pouvait donc rapporter des parties inventées, autant qu'il
-- voulait, et effacer un couple pour les autres joueurs.
--
-- Le rapport parle d'une partie reçue : sa graine doit exister dans `runs` pour
-- ce compte. Le client pousse la partie, puis ses compteurs — quand l'envoi de
-- la partie a échoué (hors ligne, plafond de 0054), le rapport n'a plus rien à
-- nourrir et n'écrit rien.

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
  if not exists (select 1 from public.runs r where r.player_id = auth.uid() and r.seed = p_seed) then
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
