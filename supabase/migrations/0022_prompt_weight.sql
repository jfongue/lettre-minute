-- Ce que les parties disent des couples lettre + catégorie : un couple que les
-- joueurs quittent sans rien écrire s'efface peu à peu du tirage, un couple
-- qu'ils réussissent y revient (`src/domain/prompts.ts`). Le client rapporte
-- les couples qu'il a quittés à l'envoi de sa partie ; le serveur ne fait
-- qu'additionner, et ne garde rien d'autre que deux compteurs.
--
-- Un défi ne rapporte rien : sa graine est publique, ses couples connus
-- d'avance, et son tirage doit rester fonction de la graine et des
-- dictionnaires embarqués seuls (aucun client ne lit ces cotes pour un défi).

-- Une partie ne parle qu'une fois : la graine la nomme, comme `runs`.
create table public.prompt_reports (
  player_id uuid not null references public.profiles on delete cascade,
  seed bigint not null,
  created_at timestamptz not null default now(),
  primary key (player_id, seed)
);

-- La langue est une colonne, pas un préfixe : la table naît ici, sans les
-- noms nus du français à ménager.
create table public.prompt_stats (
  lang text not null check (lang ~ '^[a-z]{2}$'),
  category_id text not null check (category_id ~ '^[a-z0-9-]{1,60}$'),
  letter text not null check (letter ~ '^[A-Z]$'),
  dealt integer not null default 0 check (dealt >= 0),
  passed integer not null default 0 check (passed >= 0 and passed <= dealt),
  primary key (lang, category_id, letter)
);

alter table public.prompt_reports enable row level security;
-- Aucune politique : le rapport d'une partie n'est jamais relu.
alter table public.prompt_stats enable row level security;
-- Les cotes sont lisibles par tous les joueurs : elles ne disent rien de personne.
create policy prompt_stats_read on public.prompt_stats for select to authenticated using (true);

-- Le rapport d'une partie : une seule fois par graine, et des couples bornés.
-- Les valeurs douteuses sont écartées une à une plutôt que de faire échouer
-- tout le rapport : une partie perdue pour une lettre mal écrite ne dit rien
-- de faux, elle dit seulement moins.
create function public.report_prompts(p_seed bigint, p_lang text, p_prompts jsonb)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_category text;
  v_letter text;
  v_passed boolean;
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
    insert into public.prompt_stats (lang, category_id, letter, dealt, passed)
    values (p_lang, v_category, v_letter, 1, case when v_passed then 1 else 0 end)
    on conflict (lang, category_id, letter) do update
      set dealt = public.prompt_stats.dealt + 1,
          passed = public.prompt_stats.passed + excluded.passed;
  end loop;
  return true;
end;
$$;

revoke execute on function public.report_prompts(bigint, text, jsonb) from public, anon;
grant execute on function public.report_prompts(bigint, text, jsonb) to authenticated;
