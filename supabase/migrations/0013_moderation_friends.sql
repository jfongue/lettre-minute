-- Les mots proposés par des amis passent en tête de la file, avec leurs
-- noms ; et la modération ne se propose qu'à partir de cinq mots en attente
-- (`MODERATION_MIN_QUEUE`, src/domain/moderation.ts) : recruter quelqu'un
-- pour deux mots, c'est le décevoir à sa première session.

drop function public.moderation_queue(text, integer);

create function public.moderation_queue(p_lang text, p_limit integer default 5)
returns table (id uuid, category_id text, word text, display text, proposals integer, special boolean, note text, can_respell boolean, friends text[])
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
       and exists (select 1 from public.word_submissions s
                    where s.category_id = r.category_id and s.word = r.word and s.status = 'pending')
       and not exists (select 1 from public.word_submissions s
                        where s.category_id = r.category_id and s.word = r.word and s.player_id = auth.uid())
       and not exists (select 1 from public.moderation_votes v
                        where v.review_id = r.id and v.moderator_id = auth.uid())
  )
  select q.id,
         q.category_id,
         q.word,
         q.display,
         (select count(*)::integer from public.word_submissions s
           where s.category_id = q.category_id and s.word = q.word),
         q.special,
         (select v.note from public.moderation_votes v
           where v.review_id = q.id and v.verdict = 'special'
           order by v.created_at desc limit 1),
         not exists (select 1 from public.moderation_votes v where v.review_id = q.id),
         coalesce(q.friend_names, '{}')
    from queue q
   order by q.friend_names is not null desc, q.special desc, q.created_at
   limit greatest(1, least(p_limit, 20));
end;
$$;

-- Les mots d'une langue qui attendent un modérateur, hors ceux du joueur :
-- ce qu'une recrue trouverait à sa première session.
create function public.pending_reviews(p_lang text) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer
    from public.word_reviews r
   where r.status = 'pending'
     and not r.special
     and case when p_lang = 'fr' then position(':' in r.category_id) = 0
              else r.category_id like p_lang || ':%' end
     and exists (select 1 from public.word_submissions s
                  where s.category_id = r.category_id and s.word = r.word and s.status = 'pending')
     and not exists (select 1 from public.word_submissions s
                      where s.category_id = r.category_id and s.word = r.word and s.player_id = auth.uid());
$$;

create or replace function public.moderation_status(p_lang text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_moderator boolean := public.is_moderator();
  v_reason text;
  v_invited_by text;
begin
  if public.pending_reviews(p_lang) >= 5 then
    select d.reason, d.invited_by into v_reason, v_invited_by from public.moderator_offer_due() d;
  end if;
  return jsonb_build_object(
    'moderator', v_moderator,
    'super', v_moderator and public.is_super_moderator(auth.uid()),
    'validated', case when v_moderator then public.validated_count(auth.uid()) else 0 end,
    'queue', case when v_moderator then (select count(*) from public.moderation_queue(p_lang, 20)) else 0 end,
    'offer', v_reason,
    'invited_by', v_invited_by,
    'news', (select count(*) from public.word_submissions
              where player_id = auth.uid() and status = 'accepted' and seen_at is null)
  );
end;
$$;

revoke execute on function public.pending_reviews(text) from public, anon, authenticated;
revoke execute on function public.moderation_queue(text, integer) from public, anon;
grant execute on function public.moderation_queue(text, integer) to authenticated;
