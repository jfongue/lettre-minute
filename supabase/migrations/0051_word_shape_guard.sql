-- Une proposition dont la forme n'entrera jamais au dictionnaire ne doit pas
-- ouvrir de revue : trois modérateurs la valideraient, `accept_word` verserait
-- 150 XP à chacun de ses auteurs, et l'import la jetterait pour toujours
-- (`acceptable`, `src/domain/wordShape.ts`). Le client la refuse déjà avant de
-- l'envoyer — l'écran des mots comme `proposeWord` —, mais le serveur ne peut
-- pas s'en remettre à lui : une RPC s'appelle sans client.
--
-- La règle ci-dessous est celle du domaine, réécrite pour du SQL. Elle en
-- attrape les cas qui coûtent — « M » pour une couleur, « C&A » pour une marque
-- — mais ne sait pas nommer les plages entières de l'alphabet latin : une
-- lettre exotique comme « ə » passe ici et serait refusée par l'import, qui
-- filtre avec la règle exacte. Les deux tests portent les mêmes cas :
-- `src/domain/wordShape.test.ts` et `supabase/tests/22_word_shape.sql`.
create function public.word_shape_ok(p_display text) returns boolean
language sql immutable as $$
  select p_display is not null
     and char_length(p_display) between 2 and 28
     and p_display !~ '[0-9(),:;"«»/\\\[\]]'
     and p_display !~ '\m(?:sp|ssp|var|cf)\.'
     and p_display ~ '^[A-Za-zÀ-ÖØ-öø-ÿĀ-ſḀ-ỿ''’ -]+$'
$$;

-- Toute proposition d'une forme que le dictionnaire livré ne peut pas porter
-- est close d'office, comme si un modérateur l'avait refusée : le joueur lit
-- « refusé » dans « Mes demandes », et rien n'attend dans la file.
create or replace function public.join_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare
 v_status text;
begin
 if not public.word_shape_ok(new.display) then
  update public.word_submissions set status = 'rejected', seen_at = now() where id = new.id;
  return new;
 end if;

 insert into public.word_reviews (category_id, word, display, kind)
 values (new.category_id, new.word, new.display, 'add')
 on conflict do nothing;

 select status into v_status from public.word_reviews
 where category_id = new.category_id and word = new.word and kind = 'add';

 if v_status = 'accepted' then
  perform public.accept_word(new.category_id, new.word);
 elsif v_status = 'rejected' then
  update public.word_submissions set status = 'rejected', seen_at = now() where id = new.id;
 end if;
 return new;
end;
$$;
