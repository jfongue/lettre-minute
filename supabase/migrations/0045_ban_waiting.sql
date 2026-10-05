-- « Proposer à la modération » doit vraiment attendre les autres : un super
-- modérateur qui signale un mot depuis l'écran des mots demande leur avis, il
-- ne tranche pas. Or sa voix règle une revue à elle seule (0007) — sa
-- proposition partait donc acceptée aussitôt, sans jamais passer par la file,
-- et la liste de modération restait vide.
--
-- D'où `waiting` sur une revue : le signaleur a demandé l'avis des autres, sa
-- voix compte pour une parmi les trois. Le retrait d'office (`force_ban`,
-- 0044) ne la pose pas — il tranche —, pas plus que le signalement d'un
-- récapitulatif de partie, qui garde la règle d'origine.

alter table public.word_reviews add column waiting boolean not null default false;

create or replace function public.settle_review(p_review uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_review public.word_reviews;
  v_correct integer;
  v_unsure integer;
  v_incorrect integer;
  v_super_correct boolean;
  v_super_incorrect boolean;
  v_needed integer;
begin
  select * into v_review from public.word_reviews where id = p_review for update;
  if v_review.status <> 'pending' then
    return v_review.status;
  end if;

  select count(*) filter (where verdict = 'correct'),
         count(*) filter (where verdict = 'unsure'),
         count(*) filter (where verdict = 'incorrect'),
         coalesce(bool_or(verdict = 'correct' and public.is_super_moderator(moderator_id)), false),
         coalesce(bool_or(verdict = 'incorrect' and public.is_super_moderator(moderator_id)), false)
    into v_correct, v_unsure, v_incorrect, v_super_correct, v_super_incorrect
    from public.moderation_votes
   where review_id = p_review;

  v_needed := 3 + case when v_review.respelled then 1 else 0 end + case when v_unsure >= 2 then 3 else 0 end;

  -- Une revue que son signaleur a laissée aux autres ne se règle pas sur sa
  -- seule voix, super modérateur ou pas.
  if (v_super_correct and not v_review.waiting) or (not v_review.special and v_correct >= v_needed) then
    update public.word_reviews set status = 'accepted', decided_at = now() where id = p_review;
    if v_review.kind = 'add' then
      perform public.accept_word(v_review.category_id, v_review.word);
    end if;
    return 'accepted';
  end if;

  if (v_review.special and v_super_incorrect) or (not v_review.special and v_incorrect >= 2) then
    update public.word_reviews set status = 'rejected', decided_at = now() where id = p_review;
    if v_review.kind = 'add' then
      perform public.reject_word(v_review.category_id, v_review.word);
    end if;
    return 'rejected';
  end if;

  return case when v_review.special then 'special' else 'pending' end;
end;
$$;

-- La fonction change de signature : l'ancienne est retirée pour que les deux ne
-- se masquent pas, et pour qu'un appel à quatre arguments (un client plus
-- vieux) suive la nouvelle avec `p_wait` à faux — il tranche comme avant.
drop function public.propose_ban(text, text, text, text);

create function public.propose_ban(p_category text, p_word text, p_display text, p_note text default null, p_wait boolean default false)
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
  end if;

  insert into public.moderation_votes (review_id, moderator_id, verdict, note)
  values (v_id, auth.uid(), 'correct', nullif(left(trim(coalesce(p_note, '')), 140), ''))
  on conflict do nothing;

  v_status := public.settle_review(v_id);
  return case when v_status = 'pending' then 'sent' else v_status end;
end;
$$;

revoke execute on function public.propose_ban(text, text, text, text, boolean) from public, anon;
grant execute on function public.propose_ban(text, text, text, text, boolean) to authenticated;
