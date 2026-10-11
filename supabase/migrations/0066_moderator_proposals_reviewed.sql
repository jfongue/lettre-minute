-- Une proposition de modérateur ne s'accepte plus d'elle-même. Trois joueurs
-- réclamant le même mot le faisaient entrer sans revue (0001) : un modérateur
-- qui en proposait un le voyait donc passer d'un coup, alors que c'est à lui
-- de juger. Sa proposition reste dans la file et suit la revue ordinaire, comme
-- celle de n'importe qui ; le seuil des trois vaut toujours pour les joueurs.
--
-- Un super modérateur est dans `moderators` : `is_moderator()` le couvre, et
-- son vote reste celui de 0059 (double, sans faire entrer un mot à lui seul).
--
-- Écrite, pas encore appliquée.

create or replace function public.auto_accept_word() returns trigger
language plpgsql security definer set search_path = public as $$
declare
v_count integer;
begin
if public.is_moderator() then
return new;
end if;

select count(*) into v_count
from public.word_submissions
where category_id = new.category_id and word = new.word;

if v_count >= 3 then
perform public.accept_word(new.category_id, new.word);
end if;

return new;
end;
$$;
