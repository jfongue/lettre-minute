-- La proposition de modération se payait d'un `PATCH` : le niveau se lisait dans
-- `profiles.xp`, une colonne que le client écrit lui-même, et
-- `answer_moderator_offer('level', true)` faisait modérateur. Un joueur qui
-- s'écrivait 9999 XP entrait donc dans la modération sans avoir rien écrit de la
-- journée.
--
-- Le serveur ne connaît pas le vrai niveau d'un joueur — il ne voit que ce qu'il
-- a reçu —, mais il peut additionner ce qu'il garde : les scores des parties
-- (`runs`, bornés depuis 0054) et les 150 XP d'un mot accepté (`accept_word`,
-- 0001). Le seuil reste `xpForLevel(MODERATOR_LEVEL)` = 2550
-- (`src/domain/moderation.ts`, dont un test tient les deux ensemble).
--
-- Un joueur dont la partie est restée sur son appareil, jamais poussée, attend
-- son envoi : c'est déjà le serveur qui décidait, sur un compteur qu'il n'avait
-- reçu que par le client.

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
    select 'friend' as reason, (select f.display_name from public.profiles f where f.id = o.invited_by) as invited_by, 1 as rank
      from public.moderator_offers o join me on o.player_id = me.id
     where o.reason = 'friend' and not o.answered
    union all
    select 'words', null, 2 from me where me.accepted >= 3
    union all
    select 'level', null, 3 from me where me.scored + 150 * me.accepted >= 2550
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
