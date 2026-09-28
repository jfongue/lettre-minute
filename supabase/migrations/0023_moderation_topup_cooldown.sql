-- Le renflouage de la file (0019) ne puise plus la réserve qu'à la fréquence
-- d'un versement par heure, toutes langues et tous modérateurs confondus : la
-- réserve se vidait en quelques visites quand plusieurs modérateurs la
-- tiraient en même temps, chacun croyant arriver le premier. Un modérateur
-- bloqué par l'heure garde son marqueur « file finie » (`moderation_drained`) :
-- sa première visite une fois l'heure écoulée renfloue, sans lui faire
-- re-vider une file.
--
-- Les mots déjà versés restent dans la file pour tout le monde : l'heure ne
-- ferme que le versement, jamais la modération.

create table public.moderation_topup (
  id boolean primary key default true check (id),
  released_at timestamptz not null default now()
);
alter table public.moderation_topup enable row level security;
-- Aucune politique : tout passe par les fonctions ci-dessous.
insert into public.moderation_topup (id, released_at) values (true, now() - interval '1 hour');

create or replace function public.top_up_moderation(p_lang text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_waiting integer;
  v_released integer := 0;
  v_bots uuid[];
  v_seed record;
  v_last timestamptz;
  v_now timestamptz := now();
begin
  if not public.is_moderator() or p_lang is null or p_lang !~ '^[a-z]{2}$' then
    return 0;
  end if;

  -- Le verrou tient jusqu'à la fin de l'appel : deux modérateurs qui arrivent
  -- ensemble lisent la même heure, et le second trouve la porte fermée.
  select released_at into v_last from public.moderation_topup for no key update;

  v_waiting := (select count(*) from public.moderation_queue(p_lang, 20));
  if v_waiting >= 5 then
    delete from public.moderation_drained where moderator_id = auth.uid() and lang = p_lang;
    return 0;
  end if;
  if not exists (select 1 from public.moderation_drained where moderator_id = auth.uid() and lang = p_lang) then
    insert into public.moderation_drained (moderator_id, lang) values (auth.uid(), p_lang);
    return 0;
  end if;

  if v_last is not null and v_now - v_last < interval '1 hour' then
    return 0;
  end if;

  delete from public.moderation_drained where moderator_id = auth.uid() and lang = p_lang;
  update public.moderation_topup set released_at = v_now;

  select array_agg(id) into v_bots from public.bots;
  if v_bots is null then
    return 0;
  end if;

  for v_seed in
    select r.category_id, r.word, r.display
      from public.moderation_reserve r
     where r.released_at is null
       and public.category_lang(r.category_id) = p_lang
     order by random()
       for update skip locked
  loop
    exit when v_waiting >= 5;
    update public.moderation_reserve set released_at = now()
     where category_id = v_seed.category_id and word = v_seed.word;
    -- Un joueur l'a proposé entre-temps, ou il est déjà entré : il
    -- n'ajouterait rien à la file.
    continue when exists (select 1 from public.word_reviews w
                           where w.category_id = v_seed.category_id and w.word = v_seed.word)
               or exists (select 1 from public.dictionary_words d
                           where d.category_id = v_seed.category_id and d.word = v_seed.word);
    insert into public.word_submissions (player_id, category_id, word, display)
    values (v_bots[1 + floor(random() * array_length(v_bots, 1))::integer], v_seed.category_id, v_seed.word, v_seed.display)
    on conflict do nothing;
    v_waiting := v_waiting + 1;
    v_released := v_released + 1;
  end loop;
  return v_released;
end;
$$;

revoke execute on function public.top_up_moderation(text) from public, anon;
grant execute on function public.top_up_moderation(text) to authenticated;
