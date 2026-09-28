-- L'historique des défis joués avec chaque ami, pour sa fiche dans « Mes
-- amis ». Le serveur ne dit que qui a partagé quel défi : le bilan, lui, se
-- règle sur l'appareil. Le score d'un défi dépend des mots de tous (bonus du
-- mot unique), et ceux des joueurs maison n'existent que rejoués depuis la
-- graine (`withBotRuns`) — aucun classement calculé ici ne serait juste.
--
-- Contrairement à `my_challenges`, pas de fenêtre de trois jours : c'est
-- tout l'historique qu'on veut, borné aux cinq cents lignes les plus
-- récentes. Seuls comptent les amis acceptés à l'heure de la lecture.

create function public.friend_challenges()
returns table (friend_id uuid, challenge_id uuid, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select them.player_id, c.id, c.created_at
    from public.challenge_players me
    join public.challenges c on c.id = me.challenge_id
    join public.challenge_players them on them.challenge_id = c.id and them.player_id <> me.player_id
   where me.player_id = auth.uid()
     and exists (
       select 1 from public.friendships f
        where f.status = 'accepted'
          and ((f.requester = me.player_id and f.addressee = them.player_id)
            or (f.addressee = me.player_id and f.requester = them.player_id))
     )
   order by c.created_at desc
   limit 500;
$$;

revoke execute on function public.friend_challenges() from public, anon;
grant execute on function public.friend_challenges() to authenticated;
