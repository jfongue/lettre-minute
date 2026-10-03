-- Bannir un mot : un modérateur qui tombe sur un mot qui n'a pas sa place
-- dans sa catégorie le signale depuis le récapitulatif d'une de ses parties.
-- Le signalement entre dans la file comme un ajout, et les autres le jugent
-- avec les mêmes seuils (`settle_review`) — « correct » veut dire retirer,
-- « incorrect » garder, et le vote du signaleur compte pour un.
--
-- Un ban accepté ne touche pas la base du jeu : les dictionnaires sont
-- embarqués dans l'app, et c'est l'import qui retire le mot
-- (`scripts/banned-words.ts`, `npm run import:words`). Un mot signalé reste
-- donc jouable jusqu'au dictionnaire livré d'après — sans quoi un ban
-- dépendrait d'une liste serveur, et le tirage d'un défi ne serait plus
-- fonction de la graine et des dictionnaires embarqués seuls.
--
-- Un mot peut porter deux revues : celle d'un ajout et celle d'un ban. Celle
-- des deux réglée en dernier gagne : un ajout accepté après un ban fait
-- revenir le mot.

alter table public.word_reviews
  add column if not exists kind text not null default 'add' check (kind in ('add', 'ban'));

-- L'unicité d'origine ignore le genre, et empêcherait un ban sur un mot qu'un
-- joueur vient de proposer, ou l'ajout d'un mot banni.
alter table public.word_reviews drop constraint if exists word_reviews_category_id_word_key;
create unique index if not exists word_reviews_add_key on public.word_reviews (category_id, word) where kind = 'add';
create unique index if not exists word_reviews_ban_key on public.word_reviews (category_id, word) where kind = 'ban';

-- Toute proposition rejoint la revue de son mot ; une revue déjà réglée
-- règle aussitôt la nouvelle venue. Un ban ne règle jamais un ajout.
create or replace function public.join_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  insert into public.word_reviews (category_id, word, display, kind)
  values (new.category_id, new.word, new.display, 'add')
  on conflict do nothing;

  select status into v_status from public.word_reviews
   where category_id = new.category_id and word = new.word and kind = 'add';

  if v_status = 'accepted' then
    perform public.accept_word(new.category_id, new.word);
  elsif v_status = 'rejected' then
    update public.word_submissions set status = 'rejected', seen_at = now() where id = new.id;
  end if;
  return new;
end;
$$;

-- Trois « correct » de trois modérateurs font entrer un mot ; deux
-- « incorrect » le bloquent. Deux « je ne sais pas » le rendent louche : il
-- lui faut alors trois « correct » de plus. Un super modérateur valide seul,
-- et seul il tranche un cas spécial.
--
-- Un ban se règle aux mêmes seuils, mais n'entre au dictionnaire ni ne réveille
-- les propositions qui attendent : il ne touche que sa propre revue.
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

  if v_super_correct or (not v_review.special and v_correct >= v_needed) then
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

-- Le signalement d'un modérateur est son premier vote. Répond ce que devient la
-- revue : 'sent' tant qu'elle attend les autres, 'accepted' ou 'rejected' quand
-- sa voix l'a réglée — un super modérateur la règle seul —, 'known' quand le
-- mot est déjà réglé ou qu'il l'a déjà signalé, 'forbidden' à qui n'est pas
-- modérateur.
create function public.propose_ban(p_category text, p_word text, p_display text)
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

  insert into public.word_reviews (category_id, word, display, kind)
  values (p_category, p_word, left(coalesce(nullif(trim(p_display), ''), p_word), 100), 'ban')
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

  insert into public.moderation_votes (review_id, moderator_id, verdict)
  values (v_id, auth.uid(), 'correct')
  on conflict do nothing;

  v_status := public.settle_review(v_id);
  return case when v_status = 'pending' then 'sent' else v_status end;
end;
$$;

-- Un ban n'a pas d'orthographe à corriger : c'est le mot du dictionnaire qu'il
-- vise, et un cas spécial n'attendrait qu'un super modérateur pour rien.
create or replace function public.cast_vote(
  p_review uuid,
  p_verdict text,
  p_note text default null,
  p_word text default null,
  p_display text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_review public.word_reviews;
  v_target public.word_reviews;
  v_super boolean := public.is_super_moderator(auth.uid());
begin
  if not public.is_moderator() or p_verdict is null or p_verdict not in ('correct', 'unsure', 'incorrect', 'special') then
    return 'gone';
  end if;

  select * into v_review from public.word_reviews where id = p_review for update;
  if not found or v_review.status <> 'pending' then
    return 'gone';
  end if;
  if v_review.kind = 'ban' and p_verdict = 'special' then
    return 'gone';
  end if;
  if v_review.special and not v_super then
    return 'gone';
  end if;
  if exists (select 1 from public.moderation_votes where review_id = p_review and moderator_id = auth.uid())
     or exists (select 1 from public.word_submissions
                 where category_id = v_review.category_id and word = v_review.word and player_id = auth.uid()) then
    return 'gone';
  end if;

  -- Corriger l'orthographe n'est permis qu'avant le premier vote, et vaut
  -- validation : un « correct » sur un mot que personne n'a vu tel quel.
  if p_word is not null and p_word <> v_review.word and v_review.kind = 'add' then
    -- A correction onto his own proposal would let him vote on it.
    if p_verdict <> 'correct'
       or coalesce(length(trim(p_word)), 0) = 0 or char_length(p_word) > 100
       or coalesce(length(trim(p_display)), 0) = 0 or char_length(trim(p_display)) > 100
       or exists (select 1 from public.moderation_votes where review_id = p_review)
       or exists (select 1 from public.word_submissions
                   where category_id = v_review.category_id and word = p_word and player_id = auth.uid()) then
      return 'gone';
    end if;

    select * into v_target from public.word_reviews
     where category_id = v_review.category_id and word = p_word and kind = 'add' for update;

    if found then
      -- Le mot corrigé était déjà proposé : les deux revues n'en font qu'une.
      delete from public.word_submissions s
       where s.category_id = v_review.category_id and s.word = v_review.word
         and exists (select 1 from public.word_submissions t
                      where t.player_id = s.player_id and t.category_id = s.category_id and t.word = p_word);
      update public.word_submissions
         -- Still pending, so that accept_word below pays them: it skips
         -- proposals already accepted.
         set word = p_word, display = v_target.display,
             status = case when v_target.status = 'accepted' then 'pending' else v_target.status end,
             seen_at = case when v_target.status = 'rejected' then now() end
       where category_id = v_review.category_id and word = v_review.word;
      delete from public.word_reviews where id = v_review.id;

      if v_target.status = 'accepted' then
        perform public.accept_word(v_target.category_id, v_target.word);
        return 'accepted';
      end if;
      if v_target.status = 'rejected' then
        return 'rejected';
      end if;
      if exists (select 1 from public.moderation_votes where review_id = v_target.id and moderator_id = auth.uid()) then
        return public.settle_review(v_target.id);
      end if;
      update public.word_reviews set respelled = true where id = v_target.id;
      v_review := v_target;
    else
      update public.word_submissions
         set word = p_word, display = trim(p_display)
       where category_id = v_review.category_id and word = v_review.word;
      update public.word_reviews
         set word = p_word, display = trim(p_display), respelled = true
       where id = v_review.id;
    end if;
  end if;

  insert into public.moderation_votes (review_id, moderator_id, verdict, note)
  values (v_review.id, auth.uid(), p_verdict, nullif(trim(coalesce(p_note, '')), ''));

  if p_verdict = 'special' then
    update public.word_reviews set special = true where id = v_review.id;
  end if;

  return public.settle_review(v_review.id);
end;
$$;

-- Les mots à juger dans une langue, les plus anciens d'abord : ni ceux qu'il
-- a déjà jugés, ni ceux qu'il a proposés lui-même, et les cas spéciaux aux
-- seuls super modérateurs. Un ban se juge comme un ajout — il n'attend
-- simplement aucune proposition de joueur — et passe avant eux.
drop function public.moderation_queue(text, integer);

create function public.moderation_queue(p_lang text, p_limit integer default 5)
returns table (id uuid, category_id text, word text, display text, proposals integer, special boolean, note text, can_respell boolean, friends text[], kind text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_super boolean := public.is_super_moderator(auth.uid());
begin
  if not public.is_moderator() then
    return;
  end if;

  return query
  with mine as (
    select case when f.requester = auth.uid() then f.addressee else f.requester end as friend
      from public.friendships f
     where f.status = 'accepted' and auth.uid() in (f.requester, f.addressee)
  ),
  queue as (
    select r.*,
           (select array_agg(p.display_name order by s.created_at)
              from public.word_submissions s
              join mine on mine.friend = s.player_id
              join public.profiles p on p.id = s.player_id
             where s.category_id = r.category_id and s.word = r.word) as friend_names
      from public.word_reviews r
     where r.status = 'pending'
       and (not r.special or v_super)
       and case when p_lang = 'fr' then position(':' in r.category_id) = 0
                else r.category_id like p_lang || ':%' end
       and (r.kind = 'ban'
            or (exists (select 1 from public.word_submissions s
                         where s.category_id = r.category_id and s.word = r.word and s.status = 'pending')
                and not exists (select 1 from public.word_submissions s
                                 where s.category_id = r.category_id and s.word = r.word and s.player_id = auth.uid())))
       and not exists (select 1 from public.moderation_votes v
                        where v.review_id = r.id and v.moderator_id = auth.uid())
  )
  select q.id,
         q.category_id,
         q.word,
         q.display,
         case when q.kind = 'ban'
              -- Combien de modérateurs ont déjà dit oui, celui qui a signalé
              -- le mot compris.
              then (select count(*)::integer from public.moderation_votes v
                     where v.review_id = q.id and v.verdict = 'correct')
              else (select count(*)::integer from public.word_submissions s
                     where s.category_id = q.category_id and s.word = q.word) end,
         q.special,
         (select v.note from public.moderation_votes v
           where v.review_id = q.id and v.verdict = 'special'
           order by v.created_at desc limit 1),
         q.kind = 'add' and not exists (select 1 from public.moderation_votes v where v.review_id = q.id),
         coalesce(q.friend_names, '{}'),
         q.kind
    from queue q
   order by q.friend_names is not null desc, q.special desc, (q.kind = 'ban') desc, q.created_at
   limit greatest(1, least(p_limit, 20));
end;
$$;

revoke execute on function public.moderation_queue(text, integer) from public, anon;
grant execute on function public.moderation_queue(text, integer) to authenticated;

revoke execute on function public.propose_ban(text, text, text) from public, anon;
grant execute on function public.propose_ban(text, text, text) to authenticated;
