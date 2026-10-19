-- Deux portes de plus pour l'écran des mots, réservées au super modérateur :
-- ajouter un mot sans passer par les votes (`add_word_direct`), et corriger
-- l'orthographe d'un mot du dictionnaire (`amend_word`).
--
-- Le dictionnaire embarqué ne bouge qu'à l'import : une correction s'écrit donc
-- ici, dans `word_amendments`, et `scripts/amended-words.ts` l'applique au
-- prochain import (remplace la ligne et ses formes) à côté des mots bannis. En
-- attendant, la nouvelle graphie entre dans le dictionnaire vivant
-- (`dictionary_words`, source communautaire), que `fetchCommunityWords` sert déjà
-- aux parties seules : aucun contournement nouveau, et ni défi ni robot n'en
-- voient rien — leur tirage ne lit que la graine et les dictionnaires livrés.

create table public.word_amendments (
  category_id text not null,
  -- La clé du mot corrigé, nue (sans préfixe de langue), comme celle d'un ban.
  word text not null,
  display text not null,
  old_display text not null,
  by_player uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  primary key (category_id, word)
);

-- Aucune politique : seuls les fonctions du serveur et l'import (propriétaire
-- du projet) la lisent.
alter table public.word_amendments enable row level security;

-- Ajouter un mot d'office : la revue s'écrit acceptée avec la voix du super
-- modérateur, comme `force_ban` (0059) écrit la sienne — la file garde la
-- trace, et un ajout postérieur à un retrait fait revenir le mot à l'import
-- (0038). Les joueurs qui l'avaient déjà proposé touchent leur récompense par
-- `accept_word`, comme si la file l'avait accepté.
create function public.add_word_direct(p_category text, p_display text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_cut integer;
  v_word text;
begin
  if not public.is_super_moderator(auth.uid()) then
    return 'forbidden';
  end if;

  p_category := trim(coalesce(p_category, ''));
  p_display := regexp_replace(trim(coalesce(p_display, '')), '\s+', ' ', 'g');
  if p_category = '' then
    return 'forbidden';
  end if;
  if not public.word_shape_ok(p_display) then
    return 'invalid';
  end if;

  -- La catégorie porte le préfixe de langue (`de:animaux`), le mot proposé
  -- aussi (`de:eule`) ; le français garde ses noms nus.
  v_cut := position(':' in p_category);
  v_word := case when v_cut > 0 then substring(p_category from 1 for v_cut) else '' end || lower(p_display);

  if exists (select 1 from public.dictionary_words d where d.category_id = p_category and d.word = v_word) then
    return 'known';
  end if;

  insert into public.word_reviews (category_id, word, display, kind)
  values (p_category, v_word, left(p_display, 100), 'add')
  on conflict do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.word_reviews
     where category_id = p_category and word = v_word and kind = 'add' for update;
  end if;

  insert into public.moderation_votes (review_id, moderator_id, verdict, note)
  values (v_id, auth.uid(), 'correct', 'Ajouté d’office depuis l’écran des mots.')
  on conflict (review_id, moderator_id) do nothing;

  update public.word_reviews set status = 'accepted', decided_at = now() where id = v_id;

  perform public.accept_word(p_category, v_word);
  insert into public.dictionary_words (category_id, word, display, source)
  values (p_category, v_word, left(p_display, 100), 'community')
  on conflict (category_id, word) do nothing;

  return 'added';
end;
$$;

-- Corriger l'orthographe d'un mot : `p_word` est sa clé nue, `p_old` la graphie
-- qu'il avait. La correction est notée pour l'import ; la copie vivante du mot
-- (s'il en a une) change de graphie, et un mot que seuls les dictionnaires
-- livrés portent reçoit la nouvelle graphie comme mot de la communauté, pour
-- qu'elle se joue sans attendre l'import.
create function public.amend_word(p_category text, p_word text, p_old text, p_display text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_cut integer;
  v_prefix text;
  v_bare text;
  v_old text;
  v_new text;
begin
  if not public.is_super_moderator(auth.uid()) then
    return 'forbidden';
  end if;

  p_category := trim(coalesce(p_category, ''));
  p_old := regexp_replace(trim(coalesce(p_old, '')), '\s+', ' ', 'g');
  p_display := regexp_replace(trim(coalesce(p_display, '')), '\s+', ' ', 'g');
  if p_category = '' or p_old = '' then
    return 'forbidden';
  end if;
  if not public.word_shape_ok(p_display) then
    return 'invalid';
  end if;
  if p_display = p_old then
    return 'known';
  end if;

  v_cut := position(':' in p_category);
  v_prefix := case when v_cut > 0 then substring(p_category from 1 for v_cut) else '' end;
  v_bare := trim(coalesce(p_word, ''));
  if v_prefix <> '' and left(v_bare, length(v_prefix)) = v_prefix then
    v_bare := substring(v_bare from length(v_prefix) + 1);
  end if;
  if v_bare = '' then
    return 'forbidden';
  end if;
  v_old := v_prefix || lower(p_old);
  v_new := v_prefix || lower(p_display);

  insert into public.word_amendments (category_id, word, display, old_display, by_player)
  values (p_category, v_bare, left(p_display, 100), left(p_old, 100), auth.uid())
  on conflict (category_id, word) do update
    set display = excluded.display, by_player = excluded.by_player, created_at = now();

  -- Sa copie vivante, s'il en a une, change de graphie : l'ancienne clé part,
  -- la nouvelle reste la même si une autre ligne la portait déjà.
  if exists (select 1 from public.dictionary_words d where d.category_id = p_category and d.word = v_old) then
    delete from public.dictionary_words d where d.category_id = p_category and d.word = v_old;
  end if;
  insert into public.dictionary_words (category_id, word, display, source)
  values (p_category, v_new, left(p_display, 100), 'community')
  on conflict (category_id, word) do update set display = excluded.display;

  return 'amended';
end;
$$;

revoke execute on function public.add_word_direct(text, text) from public, anon;
grant execute on function public.add_word_direct(text, text) to authenticated;
revoke execute on function public.amend_word(text, text, text, text) from public, anon;
grant execute on function public.amend_word(text, text, text, text) to authenticated;
