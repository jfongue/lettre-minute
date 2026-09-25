-- Les niveaux coûtent moins cher (`xpForLevel`, src/domain/progression.ts) :
-- le niveau 6 tombe de 2550 à 1650 XP. Identique à 0007, ce seuil mis à part.
create or replace function public.moderator_offer_due() returns table (reason text, invited_by text)
language sql stable security definer set search_path = public as $$
  with me as (
    select p.id, p.xp,
           (select count(*) from public.word_submissions s where s.player_id = p.id and s.status = 'accepted') as accepted
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
    select 'level', null, 3 from me where me.xp >= 1650
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
