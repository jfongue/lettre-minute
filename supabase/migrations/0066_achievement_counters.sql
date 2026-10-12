-- 0066_achievement_counters.sql — les deux pistes de la 1.7.16 que le serveur
-- comptait déjà : les tentatives du défi du moment (`weekly_attempts`, 0062) et
-- les défis entre amis joués (`challenge_players.played_at`, 0008). Le client
-- n'a pas de quoi les retrouver lui-même — `my_challenges` (0041) ne rend que
-- les défis vivants ou clos depuis trois jours, et `friend_challenges` (0027)
-- dit qui a partagé un défi, jamais qui l'a joué.
--
-- Une seule lecture, à la connexion : le profil garde le plus grand des deux
-- (`backfillCounters`, `src/domain/progression.ts`), donc rien ne redescend et
-- un joueur qui a joué ses défis avant la piste ne repart pas de zéro. Les
-- duels (0060) partagent `challenge_players` : ils comptent aussi, comme le
-- fait la piste côté client pour toute partie de défi envoyée.

create function public.my_achievement_counters()
returns table (weekly_attempts integer, challenges_finished integer)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.weekly_attempts a where a.player_id = auth.uid())::integer,
    (select count(*) from public.challenge_players cp
      where cp.player_id = auth.uid() and cp.played_at is not null)::integer
$$;

revoke execute on function public.my_achievement_counters() from public, anon;
grant execute on function public.my_achievement_counters() to authenticated;
