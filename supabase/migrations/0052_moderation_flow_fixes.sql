-- Deux trous du circuit de modération, l'un dans le signalement d'un mot,
-- l'autre dans le renflouage de la file.
--
-- 1. « Proposer à la modération » et attendre les autres (0048) : quand la
-- revue de ban existait déjà, le drapeau `waiting` n'était jamais posé. Un
-- super modérateur qui demandait l'avis des autres sur un mot déjà signalé
-- réglait donc la revue à lui seul, ce que 0048 était justement écrit pour
-- empêcher.
create or replace function public.propose_ban(p_category text, p_word text, p_display text, p_note text default null, p_wait boolean default false)
returns text
language plpgsql security definer set search_path = public as $$
declare
 v_id uuid;
 v_status text;
begin
 if not public.is_moderator() then
  return 'forbidden';
 end if;

 p_category := trim(coalesce(p_category, ''));
 p_word := trim(coalesce(p_word, ''));
 if p_category = '' or char_length(p_word) < 2 or char_length(p_word) > 100 then
  return 'forbidden';
 end if;

 insert into public.word_reviews (category_id, word, display, kind, waiting)
 values (p_category, p_word, left(coalesce(nullif(trim(p_display), ''), p_word), 100), 'ban', coalesce(p_wait, false))
 on conflict do nothing
 returning id into v_id;

 if v_id is null then
  select id, status into v_id, v_status
  from public.word_reviews
  where category_id = p_category and word = p_word and kind = 'ban'
  for update;
  if v_status <> 'pending'
  or exists (select 1 from public.moderation_votes v where v.review_id = v_id and v.moderator_id = auth.uid()) then
   return 'known';
  end if;
  -- La revue attendait déjà, mais peut-être sans que personne n'ait demandé
  -- l'avis des autres : le signaleur le demande maintenant, et sa voix ne
  -- doit plus la régler seule.
  if coalesce(p_wait, false) then
   update public.word_reviews set waiting = true where id = v_id;
  end if;
 end if;

 insert into public.moderation_votes (review_id, moderator_id, verdict, note)
 values (v_id, auth.uid(), 'correct', nullif(left(trim(coalesce(p_note, '')), 140), ''))
 on conflict do nothing;

 v_status := public.settle_review(v_id);
 return case when v_status = 'pending' then 'sent' else v_status end;
end;
$$;

-- 2. Le renflouage de la file (0019, 0023, 0037) brûlait un mot de la réserve
-- avant de savoir s'il versait quelque chose : `released_at` était posé avant
-- le test « déjà en revue ou au dictionnaire », donc un mot écarté là quittait
-- la réserve sans jamais entrer dans la file. Même chose quand le joueur
-- maison tiré au sort avait déjà proposé ce mot (`on conflict do nothing` :
-- rien n'était versé, mais le mot était compté et brûlé). La réserve ne
-- s'épuise plus sans verser.
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
  -- Un joueur l'a proposé entre-temps, ou il est déjà entré : il n'ajouterait
  -- rien à la file, et la réserve le garde pour plus tard.
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
