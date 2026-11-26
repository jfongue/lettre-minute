-- La modération se règle sur son stock : les mots d'une langue qui attendent un
-- juge, revues en attente et réserve pas encore versée (`moderation_stock`).
--
-- * Le seuil d'entrée suit le stock à rebours. Une file courte peut se payer
--   cinq « correct » ; une file qui déborde se vide à quatre, trois, puis deux,
--   sans quoi les mots des joueurs y vieillissent des semaines. Les paliers
--   vivent dans `moderation_stock_steps`, réglables sans migration. Une langue
--   de moins de dix juges (0078) reste à deux au plus : elle n'aurait pas assez
--   de monde pour cinq. Le doute, la correction d'orthographe, le plafond, les
--   deux personnes au moins et le refus à deux « incorrect » ne changent pas.
--
-- * Le recrutement suit le stock dans l'autre sens : une langue veut un juge
--   pour `words_per_moderator` mots qui attendent (`moderators_wanted`).
--   Tant qu'elle en a assez, l'offre de niveau ou de mots acceptés ne sort plus
--   à l'accueil ; une invitation posée — par un ami modérateur ou à la main —
--   sort toujours, quelqu'un l'a voulue. Les modérateurs en place le restent.
--   Seul `moderation_status` lit ce besoin : `answer_moderator_offer` accepte
--   toujours une offre due, pour qu'un joueur qui l'a vue ne la perde pas entre
--   deux lectures.

create table public.moderation_stock_steps (
  stock_from integer primary key check (stock_from >= 0),
  yes_needed integer not null check (yes_needed between 2 and 15)
);

insert into public.moderation_stock_steps (stock_from, yes_needed)
values (0, 5), (50, 4), (150, 3), (300, 2);

alter table public.moderation_stock_steps enable row level security;

create table public.moderation_staffing (
  only_row boolean primary key default true check (only_row),
  words_per_moderator integer not null check (words_per_moderator > 0)
);

insert into public.moderation_staffing (words_per_moderator) values (3);

alter table public.moderation_staffing enable row level security;

-- Tout ce qui attend un juge dans la langue, quel que soit le lecteur : à la
-- différence de `pending_reviews`, ni ses propres mots ni les retraits n'en
-- sortent, puisque c'est la charge de toute la langue qui se mesure.
create function public.moderation_stock(p_lang text) returns integer
language sql stable security definer set search_path = public as $$
  select (select count(*)::integer from public.word_reviews r
           where r.status = 'pending' and not r.special
             and public.category_lang(r.category_id) = p_lang)
       + (select count(*)::integer from public.moderation_reserve r
           where r.released_at is null and public.category_lang(r.category_id) = p_lang);
$$;

create function public.stock_yes_needed(p_lang text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select s.yes_needed from public.moderation_stock_steps s
                    where s.stock_from <= public.moderation_stock(p_lang)
                    order by s.stock_from desc limit 1), 5);
$$;

create function public.moderators_wanted(p_lang text) returns integer
language sql stable security definer set search_path = public as $$
  select ceil(public.moderation_stock(p_lang)::numeric
              / (select words_per_moderator from public.moderation_staffing))::integer;
$$;

revoke execute on function public.moderation_stock(text) from public, anon, authenticated;
revoke execute on function public.stock_yes_needed(text) from public, anon, authenticated;
revoke execute on function public.moderators_wanted(text) from public, anon, authenticated;

-- Reprise de 0116 : seul le seuil d'entrée lit le stock de la langue.
create or replace function public.settle_review(p_review uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_review public.word_reviews;
  v_yes numeric;
  v_no numeric;
  v_unsure integer;
  v_voters integer;
  v_super_correct boolean;
  v_super_incorrect boolean;
  v_base integer;
  v_yes_needed integer;
  v_no_needed numeric;
  v_status text;
  v_voter uuid;
begin
  select * into v_review from public.word_reviews where id = p_review for update;
  if v_review.status <> 'pending' then
    return v_review.status;
  end if;

  select
    coalesce(sum(case when verdict = 'correct' then weight else 0 end), 0),
    coalesce(sum(case when verdict = 'incorrect' then weight else 0 end), 0),
    count(*) filter (where verdict = 'unsure'),
    count(distinct moderator_id),
    coalesce(bool_or(verdict = 'correct' and weight = 2), false),
    coalesce(bool_or(verdict = 'incorrect' and weight = 2), false)
  into v_yes, v_no, v_unsure, v_voters, v_super_correct, v_super_incorrect
  from (
    select verdict, moderator_id,
           case when public.is_super_moderator(moderator_id) then 2
                when verdict = 'correct' and public.lax_moderator(moderator_id) then 0.5
                else 1 end as weight
    from public.moderation_votes
    where review_id = p_review
  ) votes;

  -- Le stock se lit revue comprise : le mot qu'on juge attend encore.
  v_base := public.stock_yes_needed(public.category_lang(v_review.category_id));
  if public.thin_language(v_review.category_id) then
    v_base := least(v_base, 2);
  end if;
  v_yes_needed := least(v_base + case when v_review.respelled then 1 else 0 end + 2 * v_unsure, 15);
  v_no_needed := least(2 + 0.5 * v_unsure, 7);

  if (v_review.special and v_super_correct)
     or (not v_review.special and v_yes >= v_yes_needed and v_voters >= 2) then
    v_status := 'accepted';
    update public.word_reviews set status = 'accepted', decided_at = now() where id = p_review;
    if v_review.kind = 'add' then
      perform public.accept_word(v_review.category_id, v_review.word);
    end if;
  elsif (v_review.special and v_super_incorrect) or (not v_review.special and v_no >= v_no_needed) then
    v_status := 'rejected';
    update public.word_reviews set status = 'rejected', decided_at = now() where id = p_review;
    if v_review.kind = 'add' then
      perform public.reject_word(v_review.category_id, v_review.word);
    end if;
  else
    return case when v_review.special then 'special' else 'pending' end;
  end if;

  for v_voter in select moderator_id from public.moderation_votes where review_id = p_review loop
    perform public.refresh_moderator_score(v_voter);
  end loop;
  return v_status;
end;
$$;

-- Reprise de 0116 : l'offre de niveau ou de mots ne sort que si la langue
-- manque de juges pour son stock.
create or replace function public.moderation_status(p_lang text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_moderator boolean := public.is_moderator();
  v_super boolean := v_moderator and public.is_super_moderator(auth.uid());
  v_reason text;
  v_invited_by text;
  v_waiting integer;
  v_queue integer := 0;
  v_topup boolean := false;
  v_last timestamptz;
  v_self public.moderators;
begin
  v_waiting := public.moderation_stock(p_lang);
  if v_waiting >= 5 then
    select d.reason, d.invited_by into v_reason, v_invited_by from public.moderator_offer_due() d;
    if v_reason is not null
       and not exists (select 1 from public.moderator_offers o
                        where o.player_id = auth.uid() and o.reason = v_reason and not o.answered)
       and (select count(*) from public.moderators m where m.lang = p_lang) >= public.moderators_wanted(p_lang) then
      v_reason := null;
      v_invited_by := null;
    end if;
  end if;
  if v_moderator then
    select * into v_self from public.moderators where id = auth.uid();
    if public.super_offer_due() then
      v_reason := 'super';
      v_invited_by := null;
    end if;
    v_queue := (select count(*) from public.moderation_queue(p_lang, 20));
    select released_at into v_last from public.moderation_topup;
    v_topup := v_queue < 5
      and (v_last is null or now() - v_last >= interval '1 hour')
      and exists (select 1 from public.bots)
      and exists (select 1 from public.moderation_reserve r
                   where r.released_at is null and public.category_lang(r.category_id) = p_lang);
  end if;
  return jsonb_build_object(
    'moderator', v_moderator,
    'super', v_super,
    'validated', case when v_moderator then public.validated_count(auth.uid()) else 0 end,
    'queue', v_queue,
    'sessions', case when v_moderator then (select count(*) from public.moderation_sessions
                                            where player_id = auth.uid()) else 0 end,
    'offer', v_reason,
    'invited_by', v_invited_by,
    'topup', v_topup,
    'news', (select count(*) from public.word_submissions
              where player_id = auth.uid() and status = 'accepted' and seen_at is null),
    'score', v_self.score,
    'judged', coalesce(v_self.judged, 0),
    'profiles', case when v_super then (select count(*) from public.proposer_reviews q
                                         where q.state = 'open' and q.player_id <> auth.uid()) else 0 end,
    'banned', public.proposals_banned(auth.uid())
  );
end;
$$;
