-- L'offre de modération atteint ceux à qui elle est due.
--
-- 1. Le seuil du niveau 6 était resté à 2550 XP en 0055, alors que 0018 l'avait
--    baissé à 1650 (`xpForLevel(MODERATOR_LEVEL)`, src/domain/moderation.ts,
--    dont un test tient les deux ensemble) : un joueur qui atteignait le
--    niveau 6 entre les deux ne recevait rien. Le seuil redevient celui du jeu.
--
-- 2. Une file en attente plus courte qu'une session (`MODERATION_MIN_QUEUE`,
--    5) fermait l'offre ; mais la réserve (0019) en garde des dizaines prêtes
--    à verser, et `top_up_moderation` les verse à la première visite du
--    modérateur. La contrainte compte donc aussi ce que cette langue a en
--    réserve à injecter.
--
-- 3. Une invitation posée à la main dans `moderator_offers` n'était lue que
--    pour le motif « friend ». Toute ligne non répondue est désormais une
--    proposition due, quel qu'en soit le motif : c'est par là qu'on invite un
--    joueur que le serveur ne peut pas vérifier, tel un compte CrazyGames dont
--    les parties jouées en invité ne sont jamais montées. Refuser une offre
--    déjà répondue la ferme toujours (le filtre en fin de requête).

create or replace function public.moderator_offer_due() returns table (reason text, invited_by text)
language sql stable security definer set search_path = public as $$
with me as (
  select p.id,
         (select count(*) from public.word_submissions s where s.player_id = p.id and s.status = 'accepted') as accepted,
         coalesce((select sum(r.score) from public.runs r where r.player_id = p.id), 0) as scored
    from public.profiles p
   where p.id = auth.uid()
     and not exists (select 1 from public.moderators m where m.id = p.id)
),
candidates as (
  select o.reason,
         (select f.display_name from public.profiles f where f.id = o.invited_by) as invited_by,
         1 as rank
    from public.moderator_offers o
    join me on o.player_id = me.id
   where not o.answered
  union all
  select 'words', null, 2 from me where me.accepted >= 3
  union all
  select 'level', null, 3 from me where me.scored + 150 * me.accepted >= 1650
)
select c.reason, c.invited_by
  from candidates c
 where not exists (
   select 1 from public.moderator_offers o
    where o.player_id = auth.uid() and o.reason = c.reason and o.answered
 )
 order by c.rank
 limit 1;
$$;

create or replace function public.moderation_status(p_lang text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_moderator boolean := public.is_moderator();
  v_reason text;
  v_invited_by text;
  -- Ce qu'une recrue trouverait : la file de la langue, plus ce que sa
  -- réserve lui versera (0019).
  v_waiting integer;
begin
  v_waiting := public.pending_reviews(p_lang)
    + (select count(*)::integer from public.moderation_reserve r
        where r.released_at is null and public.category_lang(r.category_id) = p_lang);
  if v_waiting >= 5 then
    select d.reason, d.invited_by into v_reason, v_invited_by from public.moderator_offer_due() d;
  end if;
  return jsonb_build_object(
    'moderator', v_moderator,
    'super', v_moderator and public.is_super_moderator(auth.uid()),
    'validated', case when v_moderator then public.validated_count(auth.uid()) else 0 end,
    'queue', case when v_moderator then (select count(*) from public.moderation_queue(p_lang, 20)) else 0 end,
    'sessions', case when v_moderator then (select count(*) from public.moderation_sessions
                                            where player_id = auth.uid()) else 0 end,
    'offer', v_reason,
    'invited_by', v_invited_by,
    'news', (select count(*) from public.word_submissions
              where player_id = auth.uid() and status = 'accepted' and seen_at is null)
  );
end;
$$;
