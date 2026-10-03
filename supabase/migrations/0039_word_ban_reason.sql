-- Le signalement d'un mot s'accompagne d'un motif, que les autres modérateurs
-- lisent sur la carte : « ce pays n'existe plus », « faute d'orthographe ». Il
-- se range dans le vote du signaleur — la colonne `note` de `moderation_votes`,
-- déjà bornée à 140 caractères — plutôt que dans une colonne à part : le
-- signalement est le premier vote du ban, et il n'y en a qu'un.
--
-- La fonction change de signature : l'ancienne est retirée pour que les deux ne
-- se masquent pas et qu'un appel à trois arguments suive la nouvelle (motif
-- nul), au cas où un client plus vieux traîne.

drop function public.propose_ban(text, text, text);

create function public.propose_ban(p_category text, p_word text, p_display text, p_note text default null)
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

  insert into public.moderation_votes (review_id, moderator_id, verdict, note)
  values (v_id, auth.uid(), 'correct', nullif(left(trim(coalesce(p_note, '')), 140), ''))
  on conflict do nothing;

  v_status := public.settle_review(v_id);
  return case when v_status = 'pending' then 'sent' else v_status end;
end;
$$;

revoke execute on function public.propose_ban(text, text, text, text) from public, anon;
grant execute on function public.propose_ban(text, text, text, text) to authenticated;

-- La file rend le motif d'un ban — celui de son signaleur — là où un ajout ne
-- rend que la note d'un cas spécial.
create or replace function public.moderation_queue(p_lang text, p_limit integer default 5)
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
         case when q.kind = 'ban'
              then (select v.note from public.moderation_votes v
                     where v.review_id = q.id and v.note is not null
                     order by v.created_at limit 1)
              else (select v.note from public.moderation_votes v
                     where v.review_id = q.id and v.verdict = 'special'
                     order by v.created_at desc limit 1) end,
         q.kind = 'add' and not exists (select 1 from public.moderation_votes v where v.review_id = q.id),
         coalesce(q.friend_names, '{}'),
         q.kind
    from queue q
   order by q.friend_names is not null desc, q.special desc, (q.kind = 'ban') desc, q.created_at
   limit greatest(1, least(p_limit, 20));
end;
$$;
