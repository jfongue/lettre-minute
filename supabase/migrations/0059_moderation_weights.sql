-- Les seuils de modération changent, et la voix d'un super modérateur cesse de
-- régler une revue à elle seule : cinq « correct » font entrer un mot, deux
-- « incorrect » le bloquent (0007 en demandait trois et deux). Chaque
-- « je ne sais pas » demande deux « correct » de plus — jusqu'à quinze — et une
-- demi-voix de plus pour bloquer — jusqu'à sept.
--
-- Un vote de super modérateur compte double : trois modérateurs et lui font
-- entrer un mot, et son seul « incorrect » le bloque, pesant à lui seul les
-- deux voix qu'il faut. Les cas spéciaux ne changent pas : eux seuls les voient
-- et les tranchent (`cast_vote`, 0038), et leur voix y règle la revue.
--
-- `force_ban` (0044) reste la porte qui tranche : le retrait d'office ne
-- demande pas les cinq voix, il écrit la revue acceptée lui-même.
--
-- `word_reviews.waiting` (0048) perd son effet : il servait à empêcher un super
-- modérateur de régler seul une revue qu'il laissait aux autres, ce que les
-- seuils font maintenant pour tout le monde. La colonne reste, et `propose_ban`
-- continue de la poser : la file garde la trace de qui a demandé l'avis des
-- autres.

create or replace function public.settle_review(p_review uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
v_review public.word_reviews;
v_yes integer;
v_no integer;
v_unsure integer;
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
coalesce(bool_or(verdict = 'correct' and weight = 2), false),
coalesce(bool_or(verdict = 'incorrect' and weight = 2), false)
into v_yes, v_no, v_unsure, v_super_correct, v_super_incorrect
from (
select verdict, case when public.is_super_moderator(moderator_id) then 2 else 1 end as weight
from public.moderation_votes
where review_id = p_review
) votes;

-- Une correction d'orthographe coûte une voix de plus ; le doute coûte deux
-- voix de plus à l'action et une demi-voix de plus au refus, les deux seuils
-- plafonnés.
v_yes_needed := least(5 + case when v_review.respelled then 1 else 0 end + 2 * v_unsure, 15);
v_no_needed := least(2 + 0.5 * v_unsure, 7);

if (v_review.special and v_super_correct) or (not v_review.special and v_yes >= v_yes_needed) then
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

create or replace function public.force_ban(p_category text, p_word text, p_display text, p_note text default null)
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

-- Le retrait d'office tranche : sa voix vaut deux, pas les cinq qu'une revue
-- attend des autres. La revue s'écrit acceptée comme si la file l'avait réglée.
update public.word_reviews set status = 'accepted', decided_at = now() where id = v_id;

delete from public.dictionary_words d
where d.category_id = p_category and d.word = v_scoped;

return 'accepted';
end;
$$;
