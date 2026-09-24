-- Hardening found by supabase/tests: what a client could forge, what a
-- moderator could bypass, a race between two friend requests, a recap lost
-- to the clock, and bad arguments that raised instead of answering.
--
-- Rerunnable: policies and constraints are dropped before being created,
-- functions replaced.

-- -------------------------------------------------------------- proposals --

-- A proposal inserted already « accepted » counted towards the « words »
-- moderator offer.
drop policy if exists submissions_insert_own on public.word_submissions;
create policy submissions_insert_own on public.word_submissions for insert to authenticated
  with check (auth.uid() = player_id and status = 'pending' and seen_at is null);

-- Left from 0001: one ordinary moderator could settle a proposal or fill the
-- dictionary by hand, around the votes of `settle_review`.
drop policy if exists submissions_moderate on public.word_submissions;
drop policy if exists dictionary_write_moderator on public.dictionary_words;

-- A long enough word broke the btree index with an internal error. Not
-- valid: rows already there are left alone.
alter table public.word_submissions drop constraint if exists word_submissions_word_length;
alter table public.word_submissions drop constraint if exists word_submissions_display_length;
alter table public.word_submissions
  add constraint word_submissions_word_length check (char_length(word) between 1 and 100) not valid,
  add constraint word_submissions_display_length check (char_length(display) between 1 and 100) not valid;
alter table public.run_words drop constraint if exists run_words_word_length;
alter table public.run_words
  add constraint run_words_word_length check (char_length(word) between 1 and 100) not valid;

create or replace function public.amend_submission(p_id uuid, p_word text, p_display text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_category text;
begin
  if coalesce(length(trim(p_word)), 0) = 0 or char_length(p_word) > 100
     or coalesce(length(trim(p_display)), 0) = 0 or char_length(p_display) > 100 then
    return false;
  end if;
  if exists (
    select 1 from public.word_submissions s
      join public.word_reviews r on r.category_id = s.category_id and r.word = s.word
      join public.moderation_votes v on v.review_id = r.id
     where s.id = p_id
  ) then
    return false;
  end if;

  delete from public.word_submissions
   where id = p_id and player_id = auth.uid() and status = 'pending'
  returning category_id into v_category;

  if v_category is null then
    return false;
  end if;

  insert into public.word_submissions (player_id, category_id, word, display)
  values (auth.uid(), v_category, p_word, p_display)
  on conflict (player_id, category_id, word) do nothing;

  return true;
end;
$$;

-- ----------------------------------------------------------------- votes --

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
  if p_word is not null and p_word <> v_review.word then
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
     where category_id = v_review.category_id and word = p_word for update;

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

-- ------------------------------------------------------------------ runs --

-- The client never sends `created_at`: a run dated in the future sat on
-- every day board to come, and a backdated one stole discoveries. Words
-- added days later to an old run did the same.
drop policy if exists runs_insert_own on public.runs;
create policy runs_insert_own on public.runs for insert to authenticated
  with check (auth.uid() = player_id
              and created_at between now() - interval '1 minute' and now() + interval '1 minute');

drop policy if exists run_words_insert_own on public.run_words;
create policy run_words_insert_own on public.run_words for insert to authenticated
  with check (exists (select 1 from public.runs r
                       where r.id = run_id and r.player_id = auth.uid()
                         and r.created_at > now() - interval '10 minutes'));

-- --------------------------------------------------------------- friends --

-- Two players asking each other at the same moment each inserted their own
-- row. They both asked: the pair becomes one accepted friendship.
update public.friendships f set status = 'accepted'
 where exists (select 1 from public.friendships g where g.requester = f.addressee and g.addressee = f.requester);
delete from public.friendships f
 using public.friendships g
 where g.requester = f.addressee and g.addressee = f.requester
   and (f.created_at, f.requester) > (g.created_at, g.requester);

create unique index if not exists friendships_pair_key
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

create or replace function public.request_friend(p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_target uuid;
begin
  if not public.is_named_account() then
    return 'anonymous';
  end if;

  select p.id into v_target
    from public.profiles p
    join auth.users u on u.id = p.id and not u.is_anonymous
   where lower(p.display_name) = lower(trim(p_name));

  if v_target is null then
    return 'unknown';
  end if;
  if v_target = auth.uid() then
    return 'self';
  end if;
  if exists (
    select 1 from public.friendships
     where (requester = auth.uid() and addressee = v_target)
        or (requester = v_target and addressee = auth.uid() and status = 'accepted')
  ) then
    return 'already';
  end if;

  update public.friendships set status = 'accepted'
   where requester = v_target and addressee = auth.uid();
  if found then
    return 'accepted';
  end if;

  -- The other's request, committed while this one waited on the pair index.
  begin
    insert into public.friendships (requester, addressee) values (auth.uid(), v_target);
    return 'sent';
  exception when unique_violation then
    update public.friendships set status = 'accepted'
     where requester = v_target and addressee = auth.uid() and status = 'pending';
    return case when found then 'accepted' else 'already' end;
  end;
end;
$$;

-- ------------------------------------------------------------ challenges --

-- A challenge lives a day past its last run, so one played in turn could
-- close after four days from its creation, out of sight of the old filter.
create or replace function public.queue_recaps(p_challenge uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  for v_id in
    select c.id from public.challenges c
     where c.recap_queued_at is null
       and coalesce((select max(cp.played_at) from public.challenge_players cp where cp.challenge_id = c.id),
                    c.created_at) > now() - interval '2 days'
       and (p_challenge is null or c.id = p_challenge)
       for update skip locked
  loop
    if public.challenge_finished(v_id) then
      update public.challenges set recap_queued_at = now() where id = v_id;
      insert into public.push_outbox (player_id, kind, challenge_id)
      select player_id, 'recap', v_id
        from public.challenge_players
       where challenge_id = v_id and played_at is not null;
    end if;
  end loop;
end;
$$;

-- ------------------------------------------------------------------ push --

-- A platform or language the table refuses answered with an error, which the
-- client reads as the network being down.
create or replace function public.save_push_token(p_token text, p_platform text, p_lang text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_lang text := coalesce(nullif(p_lang, ''), 'fr');
begin
  if auth.uid() is null or coalesce(length(p_token), 0) not between 20 and 4096
     or coalesce(p_platform, '') not in ('android', 'ios') or v_lang !~ '^[a-z]{2}$' then
    return false;
  end if;
  insert into public.push_tokens (token, player_id, lang, platform)
  values (p_token, auth.uid(), v_lang, p_platform)
  on conflict (token) do update
    set player_id = excluded.player_id, lang = excluded.lang, platform = excluded.platform, updated_at = now();
  return true;
end;
$$;
