-- Une langue qui compte moins de dix modérateurs n'attend plus cinq
-- « correct » pour qu'un mot entre : deux suffisent tant que la file y est
-- tenue par une poignée de juges, sans quoi un mot proposé dans une langue
-- neuve n'entrerait jamais et les joueurs de cette langue se lasseraient de
-- proposer. Le refus ne change pas : deux « incorrect » bloquent, et les
-- ajouts du doute et du plafond (0059) se posent sur le seuil de la langue.
--
-- Le serveur ne savait pas quelle langue modère chaque modérateur : il reçoit
-- une langue à chaque appel (`p_lang`, celle de l'interface), sans la garder.
-- `moderators.lang` la garde désormais, 'fr' par défaut — la langue nue du
-- français —, posée quand le modérateur ouvre « Mes demandes »
-- (`top_up_moderation`) : c'est la file qu'il lit, donc celle qu'il modère.
-- Le seuil se lit sur la langue de la *revue* (`category_lang`, 0019), pas sur
-- celle du votant.
--
-- Un mot n'entre jamais sur un seul vote : dans une langue courte, deux voix
-- peuvent venir d'un super modérateur seul, dont le vote pèse deux (0047). Il
-- en faut donc deux personnes, quel que soit le seuil — l'invariant que 0047 a
-- posé —, sans quoi un super modérateur réglerait seul les langues neuves.
-- `force_ban` (0044) tranche toujours seul, et `is_super_moderator` ne bouge
-- pas.

alter table public.moderators add column lang text not null default 'fr'
  check (lang ~ '^[a-z]{2}$');

-- Reprise de 0052, à l'identique : seule la langue du modérateur s'y ajoute.
create or replace function public.top_up_moderation(p_lang text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_waiting integer;
  v_released integer := 0;
  v_bots uuid[];
  v_seed record;
  v_last timestamptz;
  v_now timestamptz := now();
begin
  if not public.is_moderator() or p_lang is null or p_lang !~ '^[a-z]{2}$' then
    return 0;
  end if;

  -- La langue de la file qu'il ouvre est celle qu'il modère : c'est ici, et
  -- nulle part ailleurs, que le serveur l'apprend. Le versement, lui, peut
  -- rester fermé (file pleine, heure du dernier versement) sans que le
  -- modérateur cesse d'être un juge de cette langue.
  update public.moderators set lang = p_lang where id = auth.uid() and lang <> p_lang;

  -- Le verrou tient jusqu'à la fin de l'appel : deux modérateurs qui arrivent
  -- ensemble lisent la même heure, et le second trouve la porte fermée.
  select released_at into v_last from public.moderation_topup for no key update;

  v_waiting := (select count(*) from public.moderation_queue(p_lang, 20));
  if v_waiting >= 5 then
    return 0;
  end if;
  if v_last is not null and v_now - v_last < interval '1 hour' then
    return 0;
  end if;

  select array_agg(id) into v_bots from public.bots;
  if v_bots is null then
    return 0;
  end if;

  for v_seed in
    select r.category_id, r.word, r.display
      from public.moderation_reserve r
     where r.released_at is null
       and public.category_lang(r.category_id) = p_lang
     order by random()
       for update skip locked
  loop
    exit when v_waiting >= 5;
    -- Un joueur l'a proposé entre-temps, ou il est déjà entré : il
    -- n'ajouterait rien à la file, et la réserve le garde pour plus tard.
    continue when exists (select 1 from public.word_reviews w
                           where w.category_id = v_seed.category_id and w.word = v_seed.word)
               or exists (select 1 from public.dictionary_words d
                           where d.category_id = v_seed.category_id and d.word = v_seed.word);

    -- Une forme qu'aucun dictionnaire livré ne prendrait — « H&M », « Bol.com »
    -- — ne peut pas être jugée utilement : la brûler vaut mieux que la retester
    -- à chaque heure.
    if not public.word_shape_ok(v_seed.display) then
      update public.moderation_reserve set released_at = now()
       where category_id = v_seed.category_id and word = v_seed.word;
      continue;
    end if;

    insert into public.word_submissions (player_id, category_id, word, display)
    values (v_bots[1 + floor(random() * array_length(v_bots, 1))::integer], v_seed.category_id, v_seed.word, v_seed.display)
    on conflict do nothing;
    -- Le joueur maison tiré au sort avait déjà proposé ce mot : rien n'est
    -- entré, donc rien n'est versé ni brûlé.
    continue when not found;

    update public.moderation_reserve set released_at = now()
     where category_id = v_seed.category_id and word = v_seed.word;
    v_waiting := v_waiting + 1;
    v_released := v_released + 1;
  end loop;

  if v_released > 0 then
    update public.moderation_topup set released_at = v_now;
  end if;
  return v_released;
end;
$$;

revoke execute on function public.top_up_moderation(text) from public, anon;
grant execute on function public.top_up_moderation(text) to authenticated;

-- Le seuil de la langue de la revue : deux « correct » tant qu'elle compte
-- moins de dix juges, cinq ensuite. L'interface n'a pas à connaître le seuil,
-- `moderation_status` ne le dit pas ; ses textes disent les deux cas.
create function public.thin_language(p_category text) returns boolean
language sql stable security definer set search_path = public as $$
  select (select count(*) from public.moderators m where m.lang = public.category_lang(p_category)) < 10;
$$;

revoke execute on function public.thin_language(text) from public, anon, authenticated;

create or replace function public.settle_review(p_review uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_review public.word_reviews;
  v_yes integer;
  v_no integer;
  v_unsure integer;
  v_voters integer;
  v_super_correct boolean;
  v_super_incorrect boolean;
  v_yes_needed integer;
  v_no_needed numeric;
begin
  select * into v_review from public.word_reviews where id = p_review for update;
  if v_review.status <> 'pending' then
    return v_review.status;
  end if;

  -- Le poids d'un vote se lit au rôle de son auteur, maintenant, pas à ce qu'il
  -- était quand il a voté : un modérateur retiré de `moderators` garde son vote,
  -- qui repèse une voix.
  select
    coalesce(sum(case when verdict = 'correct' then weight else 0 end), 0),
    coalesce(sum(case when verdict = 'incorrect' then weight else 0 end), 0),
    count(*) filter (where verdict = 'unsure'),
    count(distinct moderator_id),
    coalesce(bool_or(verdict = 'correct' and weight = 2), false),
    coalesce(bool_or(verdict = 'incorrect' and weight = 2), false)
  into v_yes, v_no, v_unsure, v_voters, v_super_correct, v_super_incorrect
  from (
    select verdict, moderator_id, case when public.is_super_moderator(moderator_id) then 2 else 1 end as weight
    from public.moderation_votes
    where review_id = p_review
  ) votes;

  -- Une langue courte se contente de deux « correct » ; une correction
  -- d'orthographe coûte une voix de plus, le doute deux voix de plus à
  -- l'action et une demi-voix de plus au refus, les seuils plafonnés.
  v_yes_needed := least((case when public.thin_language(v_review.category_id) then 2 else 5 end)
                        + case when v_review.respelled then 1 else 0 end + 2 * v_unsure, 15);
  v_no_needed := least(2 + 0.5 * v_unsure, 7);

  -- Deux voix d'un seul juge ne font pas un mot, même à deux : sans quoi un
  -- super modérateur (poids double) réglerait seul une langue neuve.
  if (v_review.special and v_super_correct)
     or (not v_review.special and v_yes >= v_yes_needed and v_voters >= 2) then
    update public.word_reviews set status = 'accepted', decided_at = now() where id = p_review;
    if v_review.kind = 'add' then
      perform public.accept_word(v_review.category_id, v_review.word);
    end if;
    return 'accepted';
  end if;

  if (v_review.special and v_super_incorrect) or (not v_review.special and v_no >= v_no_needed) then
    update public.word_reviews set status = 'rejected', decided_at = now() where id = p_review;
    if v_review.kind = 'add' then
      perform public.reject_word(v_review.category_id, v_review.word);
    end if;
    return 'rejected';
  end if;

  return case when v_review.special then 'special' else 'pending' end;
end;
$$;