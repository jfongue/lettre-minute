-- Retirer un mot d'office, depuis l'écran des mots : un super modérateur qui
-- voit un mot de trop ne demande pas l'avis des autres. Sa voix règle le
-- signalement sur-le-champ (0007 : un « correct » de super modérateur suffit),
-- et la copie communautaire du mot quitte le serveur tout de suite — sans quoi
-- `fetchCommunityWords` continuerait de la servir aux joueurs. Le dictionnaire
-- embarqué, lui, ne bouge qu'au prochain import (`scripts/banned-words.ts`),
-- exactement comme pour un ban ordinaire.
--
-- La revue et son vote sont écrits comme si le modérateur les avait posés :
-- la file de modération garde la trace du retrait, avec son motif, et les
-- autres modérateurs voient ce qui est sorti et pourquoi.

create function public.force_ban(p_category text, p_word text, p_display text, p_note text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_status text;
  v_scoped text;
  v_cut integer;
begin
  if not public.is_super_moderator(auth.uid()) then
    return 'forbidden';
  end if;

  p_category := trim(coalesce(p_category, ''));
  p_word := trim(coalesce(p_word, ''));
  if p_category = '' or char_length(p_word) < 2 or char_length(p_word) > 100 then
    return 'forbidden';
  end if;

  -- Le mot d'un ban se nomme nu, sa catégorie porte le préfixe de langue
  -- (`de:animaux`) ; la liste communautaire, elle, range les deux préfixés.
  v_cut := position(':' in p_category);
  v_scoped := case when v_cut > 0 then substring(p_category from 1 for v_cut) || p_word else p_word end;

  insert into public.word_reviews (category_id, word, display, kind)
  values (p_category, p_word, left(coalesce(nullif(trim(p_display), ''), p_word), 100), 'ban')
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select id, status into v_id, v_status
      from public.word_reviews
     where category_id = p_category and word = p_word and kind = 'ban'
     for update;
    if v_status <> 'pending' then
      return 'known';
    end if;
  end if;

  insert into public.moderation_votes (review_id, moderator_id, verdict, note)
  values (v_id, auth.uid(), 'correct', nullif(left(trim(coalesce(p_note, '')), 140), ''))
  on conflict (review_id, moderator_id) do update set note = excluded.note;

  v_status := public.settle_review(v_id);

  delete from public.dictionary_words d
   where d.category_id = p_category and d.word = v_scoped;

  return case when v_status = 'pending' then 'sent' else v_status end;
end;
$$;

-- Réservé au super modérateur : la porte est fermée côté serveur, pas
-- seulement dans l'interface.
revoke execute on function public.force_ban(text, text, text, text) from public, anon;
grant execute on function public.force_ban(text, text, text, text) to authenticated;
