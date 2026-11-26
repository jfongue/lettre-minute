-- Le stock de 0119 comptait toute revue en attente, y compris les ajouts dont
-- la proposition n'existe plus (retirée avec son auteur banni, 0116) : la file
-- ne les montre jamais, et ils baissaient le seuil d'entrée sans qu'aucun juge
-- ne puisse les voir. Le stock compte désormais ce que `moderation_queue`
-- montrerait : un retrait, ou un ajout dont une proposition attend encore.
create or replace function public.moderation_stock(p_lang text) returns integer
language sql stable security definer set search_path = public as $$
  select (select count(*)::integer from public.word_reviews r
           where r.status = 'pending' and not r.special
             and public.category_lang(r.category_id) = p_lang
             and (r.kind = 'ban'
                  or exists (select 1 from public.word_submissions s
                              where s.category_id = r.category_id and s.word = r.word
                                and s.status = 'pending')))
       + (select count(*)::integer from public.moderation_reserve r
           where r.released_at is null and public.category_lang(r.category_id) = p_lang);
$$;

revoke execute on function public.moderation_stock(text) from public, anon, authenticated;
