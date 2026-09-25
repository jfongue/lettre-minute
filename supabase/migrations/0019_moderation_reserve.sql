-- Une réserve de mots évidents que les dictionnaires ignorent, versée au
-- compte-goutte dans la file de modération : un modérateur qui a fini la
-- sienne en retrouve une session entière à sa visite suivante de « Mes
-- demandes ». Un joueur maison les propose, pour que tout le reste — la
-- revue, les votes, l'entrée au dictionnaire, l'import suivant — se passe
-- comme pour le mot d'un joueur. La réserve se remplit hors migration
-- (`npm run seed:moderation`, scripts/moderation-reserve.ts).

create table public.moderation_reserve (
  category_id text not null,
  word text not null check (char_length(word) between 1 and 100),
  display text not null check (char_length(display) between 1 and 100),
  released_at timestamptz,
  primary key (category_id, word)
);

-- Un modérateur qui a fini ce qu'il y avait à juger dans une langue : à un
-- vote qui laisse sa file sous une session, ou à une visite qui l'y trouve.
create table public.moderation_drained (
  moderator_id uuid not null references public.profiles on delete cascade,
  lang text not null,
  created_at timestamptz not null default now(),
  primary key (moderator_id, lang)
);

alter table public.moderation_reserve enable row level security;
alter table public.moderation_drained enable row level security;
-- Aucune politique : tout passe par les fonctions ci-dessous.

-- cloud.ts préfixe chaque langue sauf le français, qui garde ses noms nus.
create function public.category_lang(p_category text) returns text
language sql immutable set search_path = public as $$
  select coalesce(substring(p_category from '^([a-z]{2}):'), 'fr');
$$;

-- `moderation_queue` lit `auth.uid()`, qui est encore le votant ici.
create function public.note_drained() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_lang text;
begin
  select public.category_lang(r.category_id) into v_lang from public.word_reviews r where r.id = new.review_id;
  if v_lang is not null and (select count(*) from public.moderation_queue(v_lang, 20)) < 5 then
    insert into public.moderation_drained (moderator_id, lang) values (new.moderator_id, v_lang)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger moderation_votes_note_drained
  after insert on public.moderation_votes
  for each row execute function public.note_drained();

-- À l'ouverture de « Mes demandes » : si le modérateur avait fini sa file la
-- fois d'avant et qu'elle est encore sous une session (5,
-- `MODERATION_MIN_QUEUE`), la réserve la complète juste assez pour en
-- rouvrir une. Sinon, rien : c'est ce qui la fait durer. Répond combien de
-- mots sont entrés dans la file.
create function public.top_up_moderation(p_lang text) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_waiting integer;
  v_released integer := 0;
  v_bots uuid[];
  v_seed record;
begin
  if not public.is_moderator() or p_lang is null or p_lang !~ '^[a-z]{2}$' then
    return 0;
  end if;

  v_waiting := (select count(*) from public.moderation_queue(p_lang, 20));
  if v_waiting >= 5 then
    delete from public.moderation_drained where moderator_id = auth.uid() and lang = p_lang;
    return 0;
  end if;
  if not exists (select 1 from public.moderation_drained where moderator_id = auth.uid() and lang = p_lang) then
    insert into public.moderation_drained (moderator_id, lang) values (auth.uid(), p_lang);
    return 0;
  end if;
  delete from public.moderation_drained where moderator_id = auth.uid() and lang = p_lang;

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

-- Un robot ne gagne pas d'XP par les mots de la réserve : il monterait de
-- niveau à chaque session de modération, sous les yeux de ses amis.
create or replace function public.accept_word(p_category text, p_word text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_display text;
begin
  select min(display) into v_display
  from public.word_submissions
  where category_id = p_category and word = p_word;

  if v_display is null then
    return;
  end if;

  insert into public.dictionary_words (category_id, word, display, source)
  values (p_category, p_word, v_display, 'community')
  on conflict (category_id, word) do nothing;

  -- La récompense va à chaque joueur qui l'a réclamé, une seule fois : le
  -- passage à 'accepted' est ce qui la rend non rejouable.
  update public.profiles p
     set xp = p.xp + 150, updated_at = now()
    from public.word_submissions s
   where s.player_id = p.id
     and s.category_id = p_category
     and s.word = p_word
     and s.status <> 'accepted'
     and not exists (select 1 from public.bots b where b.id = p.id);

  update public.word_submissions
     set status = 'accepted'
   where category_id = p_category and word = p_word;
end;
$$;

revoke execute on function public.note_drained() from public, anon, authenticated;
revoke execute on function public.top_up_moderation(text) from public, anon;
grant execute on function public.top_up_moderation(text) to authenticated;
