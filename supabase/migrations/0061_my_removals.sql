-- « Mes demandes » montre aussi les retraits qu'un modérateur a demandés,
-- tant qu'ils attendent les autres : la file de modération ne rend jamais une
-- revue qu'on a déjà votée (`moderation_queue`), donc sans cette porte un
-- signalement posé ne se retire plus.
--
-- Un retrait n'a pas de table à lui : c'est une revue `kind = 'ban'`, et son
-- auteur se lit à son vote — `propose_ban` pose toujours le sien. Un
-- modérateur qui a seulement dit « correct » sur le signalement d'un autre y
-- voit donc aussi son vote, ce qui est exactement le geste qu'il cherche.
create function public.my_removals()
returns table (id uuid, category_id text, display text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
select r.id, r.category_id, r.display, r.created_at
from public.word_reviews r
join public.moderation_votes v on v.review_id = r.id and v.moderator_id = auth.uid()
where r.kind = 'ban' and r.status = 'pending'
order by r.created_at desc;
$$;

-- Retirer son signalement : son vote s'efface, et la revue avec lui si
-- personne d'autre ne l'a rejoint — sinon elle resterait dans la file de tout
-- le monde sans la moindre proposition. Une revue déjà réglée ne se retire
-- plus : les mots entrés ou gardés ne se défont pas ici.
create function public.cancel_removal(p_review uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
v_review public.word_reviews;
v_left integer;
begin
if not public.is_moderator() then
return false;
end if;

select * into v_review from public.word_reviews where id = p_review for update;
if not found or v_review.kind <> 'ban' or v_review.status <> 'pending' then
return false;
end if;

delete from public.moderation_votes
where review_id = p_review and moderator_id = auth.uid();
if not found then
return false;
end if;

select count(*) into v_left from public.moderation_votes where review_id = p_review;
if v_left = 0 then
delete from public.word_reviews where id = p_review;
end if;

return true;
end;
$$;

revoke execute on function public.my_removals() from public, anon;
grant execute on function public.my_removals() to authenticated;

revoke execute on function public.cancel_removal(uuid) from public, anon;
grant execute on function public.cancel_removal(uuid) to authenticated;
