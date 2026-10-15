-- Le renflouage de la file n'avait plus rien versé depuis le verrou horaire
-- (0023) : il finissait par `update public.moderation_topup set released_at`
-- sans `where`, que l'extension `safeupdate` — préchargée par le rôle
-- `authenticator` de PostgREST — refuse. Chaque appel qui allait verser levait
-- donc à sa dernière ligne, et toute la transaction repartait en arrière :
-- mots versés, réserve brûlée, langue du modérateur (0078). Un appel en SQL
-- direct (`supabase db query`, rôle postgres) ne charge pas l'extension, d'où
-- un renflouage qui marchait à chaque essai à la main. La table n'a qu'une
-- ligne, que `where id` désigne.
--
-- L'offre « niveau » (0082) lit aussi l'XP du profil, celle dont le jeu tire
-- le niveau affiché : un joueur CrazyGames gagne l'essentiel de la sienne en
-- invité, sur des parties qui ne montent jamais au serveur, puis l'apporte à
-- son compte en se connectant au portail (`player_progress`, 0032). La somme
-- des parties envoyées reste le repli d'un profil que l'appareil n'a pas
-- encore poussé.

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

  -- La langue de la file qu'il ouvre est celle qu'il modère : c'est ici, et
  -- nulle part ailleurs, que le serveur l'apprend. Le versement, lui, peut
  -- rester fermé (file pleine, heure du dernier versement) sans que le
  -- modérateur cesse d'être un juge de cette langue.
  update public.moderators set lang = p_lang where id = auth.uid() and lang <> p_lang;

  -- Le verrou tient jusqu'à la fin de l'appel : deux modérateurs qui arrivent
  -- ensemble lisent la même heure, et le second trouve la porte fermée.
  select released_at into v_last from public.moderation_topup for no key update;

  v_waiting := (select count(*) from public.moderation_queue(p_lang, 20));
  if v_waiting >= 5 then
    return 0;
  end if;
  if v_last is not null and v_now - v_last < interval '1 hour' then
    return 0;
  end if;

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
    -- Un joueur l'a proposé entre-temps, ou il est déjà entré : il
    -- n'ajouterait rien à la file, et la réserve le garde pour plus tard.
    continue when exists (select 1 from public.word_reviews w
                           where w.category_id = v_seed.category_id and w.word = v_seed.word)
               or exists (select 1 from public.dictionary_words d
                           where d.category_id = v_seed.category_id and d.word = v_seed.word);

    -- Une forme qu'aucun dictionnaire livré ne prendrait — « H&M », « Bol.com »
    -- — ne peut pas être jugée utilement : la brûler vaut mieux que la retester
    -- à chaque heure.
    if not public.word_shape_ok(v_seed.display) then
      update public.moderation_reserve set released_at = now()
       where category_id = v_seed.category_id and word = v_seed.word;
      continue;
    end if;

    insert into public.word_submissions (player_id, category_id, word, display)
    values (v_bots[1 + floor(random() * array_length(v_bots, 1))::integer], v_seed.category_id, v_seed.word, v_seed.display)
    on conflict do nothing;
    -- Le joueur maison tiré au sort avait déjà proposé ce mot : rien n'est
    -- entré, donc rien n'est versé ni brûlé.
    continue when not found;

    update public.moderation_reserve set released_at = now()
     where category_id = v_seed.category_id and word = v_seed.word;
    v_waiting := v_waiting + 1;
    v_released := v_released + 1;
  end loop;

  if v_released > 0 then
    update public.moderation_topup set released_at = v_now where id;
  end if;
  return v_released;
end;
$$;

create or replace function public.moderator_offer_due() returns table (reason text, invited_by text)
language sql stable security definer set search_path = public as $$
with me as (
  select p.id,
         p.xp,
         (select count(*) from public.word_submissions s where s.player_id = p.id and s.status = 'accepted') as accepted,
         coalesce((select sum(r.score) from public.runs r where r.player_id = p.id), 0) as scored
    from public.profiles p
   where p.id = auth.uid()
     and not exists (select 1 from public.moderators m where m.id = p.id)
),
candidates as (
  select o.reason,
         (select f.display_name from public.profiles f where f.id = o.invited_by) as invited_by,
         1 as rank
    from public.moderator_offers o
    join me on o.player_id = me.id
   where not o.answered
  union all
  select 'words', null, 2 from me where me.accepted >= 3
  union all
  select 'level', null, 3 from me where greatest(me.xp, me.scored + 150 * me.accepted) >= 1650
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
