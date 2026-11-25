-- Garde-fous de la modération : les joueurs qui proposent et les modérateurs
-- qui jugent se mesurent désormais à ce que la file a fini par décider.
--
-- Côté joueur, la fiabilité est la part de ses mots refusés parmi ceux qui ont
-- été jugés (`proposer_record`). Elle règle trois choses :
--   * un plafond de propositions par jour de Paris (`proposal_quota`, réglable
--     sans migration) : 10 au départ, 30 pour qui voit au moins 70 % de ses
--     mots acceptés, 3 pour qui en voit au moins 70 % refusés ;
--   * un ban de proposition d'office quand c'est flagrant — au moins quinze
--     mots jugés, plus de 80 % refusés — qui retire aussi ses propositions en
--     attente ;
--   * entre les deux (au moins dix jugés, la moitié refusés), le doute : son
--     profil remonte aux super modérateurs, avec ses derniers mots et les
--     raisons des refus (`profile_queue`), qui le bannissent ou le laissent
--     (`judge_profile`). Un ban d'office y remonte aussi : un humain le
--     confirme ou le lève. Un profil laissé ne revient qu'après dix refus de
--     plus.
--
-- Côté modérateur, le score (0-100, `moderators.score`) compare chacun de ses
-- votes tranchés au sort final du mot. Un refus que les autres ont partagé vaut
-- double, une validation que les autres ont refusée coûte double : plus on est
-- exigeant à raison, mieux c'est. Il se recalcule pour chaque votant quand une
-- revue se règle, jamais à la lecture.
--   * Sous 50 après vingt votes tranchés, son « correct » ne pèse plus qu'une
--     demi-voix dans `settle_review`. Rien ne le lui dit.
--   * À 90 et plus après soixante votes tranchés, le jeu lui propose d'être
--     super modérateur (`moderation_status.offer = 'super'`), qu'il accepte ou
--     non ; un refus est définitif.
--
-- Un refus peut toujours porter sa raison (la note de `cast_vote`, déjà là
-- depuis 0007), et la file montre aux modérateurs suivants les raisons de ceux
-- qui ont déjà voté (`moderation_queue.reasons`).
--
-- Les joueurs maison (`bots`) qui versent la réserve échappent au plafond et
-- au jugement : leurs mots sont ceux du jeu.

-- ------------------------------------------------------------- plafond --

create table public.proposal_quota (
  only_row boolean primary key default true check (only_row),
  base integer not null check (base >= 0),
  trusted integer not null check (trusted >= 0),
  low integer not null check (low >= 0)
);

insert into public.proposal_quota (base, trusted, low) values (10, 30, 3);

alter table public.proposal_quota enable row level security;

-- Ce qu'un joueur a proposé et que la file a tranché, ses mots en attente à
-- part.
create function public.proposer_record(p_player uuid)
returns table (accepted integer, rejected integer, pending integer)
language sql stable security definer set search_path = public as $$
  select count(*) filter (where status = 'accepted')::integer,
         count(*) filter (where status = 'rejected')::integer,
         count(*) filter (where status = 'pending')::integer
    from public.word_submissions
   where player_id = p_player;
$$;

revoke execute on function public.proposer_record(uuid) from public, anon, authenticated;

create function public.daily_quota(p_player uuid) returns integer
language plpgsql stable security definer set search_path = public as $$
declare
  v_quota public.proposal_quota;
  v_record record;
  v_decided integer;
begin
  select * into v_quota from public.proposal_quota;
  select * into v_record from public.proposer_record(p_player);
  v_decided := v_record.accepted + v_record.rejected;
  if v_decided < 10 then
    return v_quota.base;
  end if;
  if v_record.accepted >= 0.7 * v_decided then
    return v_quota.trusted;
  end if;
  if v_record.rejected >= 0.7 * v_decided then
    return v_quota.low;
  end if;
  return v_quota.base;
end;
$$;

revoke execute on function public.daily_quota(uuid) from public, anon, authenticated;

create function public.proposed_today(p_player uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.word_submissions
   where player_id = p_player
     and created_at >= (date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris');
$$;

revoke execute on function public.proposed_today(uuid) from public, anon, authenticated;

-- Ce que le client peut encore envoyer aujourd'hui : il garde le reste sur
-- l'appareil pour le lendemain, et jette tout si le joueur est banni.
create function public.proposal_room() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_quota integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('banned', false, 'room', 0, 'quota', 0);
  end if;
  v_quota := public.daily_quota(auth.uid());
  return jsonb_build_object(
    'banned', public.proposals_banned(auth.uid()),
    'room', greatest(0, v_quota - public.proposed_today(auth.uid())),
    'quota', v_quota
  );
end;
$$;

revoke execute on function public.proposal_room() from public, anon;
grant execute on function public.proposal_room() to authenticated;

-- ------------------------------------------------- profils à juger --

-- Un joueur dont les propositions inquiètent. `banned` est le ban lui-même,
-- qu'il vienne d'office ou d'un super modérateur ; `state` dit si un humain
-- doit encore regarder le profil.
create table public.proposer_reviews (
  player_id uuid primary key references public.profiles on delete cascade,
  state text not null check (state in ('open', 'cleared', 'banned')),
  banned boolean not null default false,
  -- Banni d'office : le super modérateur confirme ou lève.
  auto boolean not null default false,
  -- Refus comptés quand le profil a été laissé : il ne revient qu'à dix de plus.
  rejected_mark integer not null default 0,
  opened_at timestamptz not null default now(),
  decided_by uuid references public.profiles on delete set null,
  decided_at timestamptz
);

create index proposer_reviews_open_idx on public.proposer_reviews (opened_at) where state = 'open';

alter table public.proposer_reviews enable row level security;

create function public.proposals_banned(p_player uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.proposer_reviews where player_id = p_player and banned);
$$;

revoke execute on function public.proposals_banned(uuid) from public, anon, authenticated;

-- Retire les propositions en attente d'un joueur banni, et les revues que plus
-- personne ne réclame ni n'a jugées.
create function public.withdraw_proposals(p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_gone record;
begin
  for v_gone in
    delete from public.word_submissions
     where player_id = p_player and status = 'pending'
    returning category_id, word
  loop
    delete from public.word_reviews r
     where r.category_id = v_gone.category_id and r.word = v_gone.word
       and r.kind = 'add' and r.status = 'pending'
       and not exists (select 1 from public.word_submissions s
                        where s.category_id = r.category_id and s.word = r.word)
       and not exists (select 1 from public.moderation_votes v where v.review_id = r.id);
  end loop;
end;
$$;

revoke execute on function public.withdraw_proposals(uuid) from public, anon, authenticated;

create function public.weigh_proposer(p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_record record;
  v_decided integer;
  v_review public.proposer_reviews;
begin
  if exists (select 1 from public.bots where id = p_player) then
    return;
  end if;
  select * into v_review from public.proposer_reviews where player_id = p_player for update;
  -- Banni, ou déjà sous les yeux d'un super modérateur : rien de neuf à dire.
  if found and (v_review.banned or v_review.state = 'open') then
    return;
  end if;

  select * into v_record from public.proposer_record(p_player);
  v_decided := v_record.accepted + v_record.rejected;

  if v_decided >= 15 and v_record.rejected > 0.8 * v_decided then
    insert into public.proposer_reviews (player_id, state, banned, auto, rejected_mark)
    values (p_player, 'open', true, true, v_record.rejected)
    on conflict (player_id) do update
      set state = 'open', banned = true, auto = true, rejected_mark = excluded.rejected_mark,
          opened_at = now(), decided_by = null, decided_at = null;
    perform public.withdraw_proposals(p_player);
    return;
  end if;

  if v_decided >= 10 and v_record.rejected >= 0.5 * v_decided
     and (v_review.player_id is null or v_record.rejected >= v_review.rejected_mark + 10) then
    insert into public.proposer_reviews (player_id, state, rejected_mark)
    values (p_player, 'open', v_record.rejected)
    on conflict (player_id) do update
      set state = 'open', auto = false, rejected_mark = excluded.rejected_mark,
          opened_at = now(), decided_by = null, decided_at = null;
  end if;
end;
$$;

revoke execute on function public.weigh_proposer(uuid) from public, anon, authenticated;

create function public.on_submission_rejected() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.weigh_proposer(new.player_id);
  return null;
end;
$$;

create trigger word_submissions_weigh_proposer
  after update of status on public.word_submissions
  for each row when (new.status = 'rejected' and old.status is distinct from 'rejected')
  execute function public.on_submission_rejected();

-- Le plafond et le ban tiennent au serveur aussi : un client modifié ne les
-- contourne pas. Le client lit `proposal_room` avant d'envoyer, et n'arrive ici
-- qu'en cas de course.
create function public.guard_submission() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.bots where id = new.player_id) then
    return new;
  end if;
  if public.proposals_banned(new.player_id) then
    raise exception 'proposals banned' using errcode = '42501';
  end if;
  -- Une correction d'orthographe remplace un mot déjà compté : elle ne
  -- consomme pas le plafond (`amend_submission` pose le drapeau).
  if coalesce(current_setting('lettre_minute.amending', true), '') <> 'on'
     and public.proposed_today(new.player_id) >= public.daily_quota(new.player_id) then
    raise exception 'daily proposal quota reached' using errcode = '54000';
  end if;
  return new;
end;
$$;

create trigger word_submissions_guard
  before insert on public.word_submissions
  for each row execute function public.guard_submission();

-- Les profils que les super modérateurs ont à juger, les plus anciens d'abord,
-- chacun avec ses vingt derniers mots et les raisons de leurs refus.
create function public.profile_queue() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_moderator(auth.uid()) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(entry order by opened_at)
      from (
        select q.opened_at,
               jsonb_build_object(
                 'id', q.player_id,
                 'name', p.display_name,
                 'banned', q.banned,
                 'auto', q.auto,
                 'accepted', rec.accepted,
                 'rejected', rec.rejected,
                 'pending', rec.pending,
                 'words', coalesce((
                   select jsonb_agg(jsonb_build_object(
                            'display', s.display,
                            'category_id', s.category_id,
                            'status', s.status,
                            'at', s.created_at,
                            'reasons', coalesce((
                              select jsonb_agg(v.note order by v.created_at)
                                from public.word_reviews r
                                join public.moderation_votes v on v.review_id = r.id
                               where r.category_id = s.category_id and r.word = s.word and r.kind = 'add'
                                 and v.verdict = 'incorrect' and v.note is not null), '[]'::jsonb))
                          order by s.created_at desc)
                     from (select * from public.word_submissions
                            where player_id = q.player_id
                            order by created_at desc limit 20) s), '[]'::jsonb)
               ) as entry
          from public.proposer_reviews q
          join public.profiles p on p.id = q.player_id
          cross join lateral public.proposer_record(q.player_id) rec
         where q.state = 'open' and q.player_id <> auth.uid()
         order by q.opened_at
         limit 10
      ) rows
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.profile_queue() from public, anon;
grant execute on function public.profile_queue() to authenticated;

-- Un super modérateur bannit le joueur (ses propositions en attente partent
-- avec), ou le laisse proposer — ce qui lève un ban d'office.
create function public.judge_profile(p_player uuid, p_ban boolean) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_review public.proposer_reviews;
begin
  if not public.is_super_moderator(auth.uid()) or p_player = auth.uid() or p_ban is null then
    return 'gone';
  end if;
  select * into v_review from public.proposer_reviews where player_id = p_player for update;
  if not found or v_review.state <> 'open' then
    return 'gone';
  end if;

  if p_ban then
    update public.proposer_reviews
       set state = 'banned', banned = true, decided_by = auth.uid(), decided_at = now()
     where player_id = p_player;
    perform public.withdraw_proposals(p_player);
    return 'banned';
  end if;

  update public.proposer_reviews
     set state = 'cleared', banned = false, auto = false, decided_by = auth.uid(), decided_at = now(),
         rejected_mark = (select rejected from public.proposer_record(p_player))
   where player_id = p_player;
  return 'cleared';
end;
$$;

revoke execute on function public.judge_profile(uuid, boolean) from public, anon;
grant execute on function public.judge_profile(uuid, boolean) to authenticated;

-- ------------------------------------------------- score de modérateur --

alter table public.moderators add column score smallint check (score between 0 and 100);
alter table public.moderators add column judged integer not null default 0;

-- Chaque vote tranché sur une revue réglée : d'accord ou non avec le sort du
-- mot. Sur un ajout, un refus partagé compte double et une validation
-- refusée par les autres coûte double ; sur un retrait, accord et désaccord
-- pèsent un. « Je ne sais pas » et les cas spéciaux ne comptent pas.
create function public.refresh_moderator_score(p_moderator uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_for numeric;
  v_against numeric;
  v_judged integer;
begin
  select
    coalesce(sum(case
      when r.kind = 'add' and v.verdict = 'incorrect' and r.status = 'rejected' then 2
      when v.verdict = 'correct' and r.status = 'accepted' then 1
      when r.kind = 'ban' and v.verdict = 'incorrect' and r.status = 'rejected' then 1
      else 0 end), 0),
    coalesce(sum(case
      when r.kind = 'add' and v.verdict = 'correct' and r.status = 'rejected' then 2
      when v.verdict = 'incorrect' and r.status = 'accepted' then 1
      when r.kind = 'ban' and v.verdict = 'correct' and r.status = 'rejected' then 1
      else 0 end), 0),
    count(*)::integer
  into v_for, v_against, v_judged
  from public.moderation_votes v
  join public.word_reviews r on r.id = v.review_id
  where v.moderator_id = p_moderator
    and v.verdict in ('correct', 'incorrect')
    and r.status in ('accepted', 'rejected');

  update public.moderators
     set judged = v_judged,
         score = case when v_for + v_against > 0 then round(100 * v_for / (v_for + v_against)) end
   where id = p_moderator;
end;
$$;

revoke execute on function public.refresh_moderator_score(uuid) from public, anon, authenticated;

-- Un modérateur dont les validations sont trop souvent refusées par les autres.
create function public.lax_moderator(p_moderator uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.moderators
                  where id = p_moderator and judged >= 20 and score < 50);
$$;

revoke execute on function public.lax_moderator(uuid) from public, anon, authenticated;

create function public.super_offer_due() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.moderators m
                  where m.id = auth.uid() and not m.super and m.judged >= 60 and m.score >= 90)
     and not exists (select 1 from public.moderator_offers o
                      where o.player_id = auth.uid() and o.reason = 'super' and o.answered);
$$;

revoke execute on function public.super_offer_due() from public, anon, authenticated;

alter table public.moderator_offers drop constraint moderator_offers_reason_check;
alter table public.moderator_offers
  add constraint moderator_offers_reason_check check (reason in ('level', 'words', 'friend', 'super'));

-- Reprise de 0078 : le poids d'un vote lit aussi le score de son auteur, les
-- seuils deviennent décimaux, et chaque votant d'une revue réglée voit son
-- score recalculé.
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
  v_yes_needed integer;
  v_no_needed numeric;
  v_status text;
  v_voter uuid;
begin
  select * into v_review from public.word_reviews where id = p_review for update;
  if v_review.status <> 'pending' then
    return v_review.status;
  end if;

  -- Le poids se lit au rôle et au score de l'auteur maintenant, pas à ce qu'ils
  -- étaient quand il a voté. Seul le « correct » d'un modérateur laxiste perd
  -- du poids : ses refus restent entiers.
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

  v_yes_needed := least((case when public.thin_language(v_review.category_id) then 2 else 5 end)
                        + case when v_review.respelled then 1 else 0 end + 2 * v_unsure, 15);
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

-- -------------------------------------------- raisons dans la file --

-- Reprise de 0039, plus `reasons` : les raisons laissées par ceux qui ont déjà
-- voté, avec leur verdict, sans leur nom.
drop function public.moderation_queue(text, integer);

create function public.moderation_queue(p_lang text, p_limit integer default 5)
returns table (id uuid, category_id text, word text, display text, proposals integer, special boolean, note text,
               can_respell boolean, friends text[], kind text, reasons jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  v_super boolean := public.is_super_moderator(auth.uid());
begin
  if not public.is_moderator() then
    return;
  end if;

  return query
  with mine as (
    select case when f.requester = auth.uid() then f.addressee else f.requester end as friend
      from public.friendships f
     where f.status = 'accepted' and auth.uid() in (f.requester, f.addressee)
  ),
  queue as (
    select r.*,
           (select array_agg(p.display_name order by s.created_at)
              from public.word_submissions s
              join mine on mine.friend = s.player_id
              join public.profiles p on p.id = s.player_id
             where s.category_id = r.category_id and s.word = r.word) as friend_names
      from public.word_reviews r
     where r.status = 'pending'
       and (not r.special or v_super)
       and case when p_lang = 'fr' then position(':' in r.category_id) = 0
                else r.category_id like p_lang || ':%' end
       and (r.kind = 'ban'
            or (exists (select 1 from public.word_submissions s
                         where s.category_id = r.category_id and s.word = r.word and s.status = 'pending')
                and not exists (select 1 from public.word_submissions s
                                 where s.category_id = r.category_id and s.word = r.word and s.player_id = auth.uid())))
       and not exists (select 1 from public.moderation_votes v
                        where v.review_id = r.id and v.moderator_id = auth.uid())
  )
  select q.id,
         q.category_id,
         q.word,
         q.display,
         case when q.kind = 'ban'
              then (select count(*)::integer from public.moderation_votes v
                     where v.review_id = q.id and v.verdict = 'correct')
              else (select count(*)::integer from public.word_submissions s
                     where s.category_id = q.category_id and s.word = q.word) end,
         q.special,
         case when q.kind = 'ban'
              then (select v.note from public.moderation_votes v
                     where v.review_id = q.id and v.note is not null
                     order by v.created_at limit 1)
              else (select v.note from public.moderation_votes v
                     where v.review_id = q.id and v.verdict = 'special'
                     order by v.created_at desc limit 1) end,
         q.kind = 'add' and not exists (select 1 from public.moderation_votes v where v.review_id = q.id),
         coalesce(q.friend_names, '{}'),
         q.kind,
         coalesce((select jsonb_agg(jsonb_build_object('verdict', v.verdict, 'note', v.note) order by v.created_at)
                     from public.moderation_votes v
                    where v.review_id = q.id and v.note is not null), '[]'::jsonb)
    from queue q
   order by q.friend_names is not null desc, q.special desc, (q.kind = 'ban') desc, q.created_at
   limit greatest(1, least(p_limit, 20));
end;
$$;

revoke execute on function public.moderation_queue(text, integer) from public, anon;
grant execute on function public.moderation_queue(text, integer) to authenticated;

-- ------------------------------------------------------------ statut --

-- Reprise de 0100, plus le score du modérateur, l'offre de super modérateur,
-- les profils qui attendent un super modérateur et le ban de proposition.
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
  v_waiting := public.pending_reviews(p_lang)
    + (select count(*)::integer from public.moderation_reserve r
        where r.released_at is null and public.category_lang(r.category_id) = p_lang);
  if v_waiting >= 5 then
    select d.reason, d.invited_by into v_reason, v_invited_by from public.moderator_offer_due() d;
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

-- ------------------------------------------------------------- offre --

-- Reprise de 0064, plus `super` : un modérateur au score excellent devient
-- super modérateur s'il le veut ; un refus ne se repose pas.
create or replace function public.answer_moderator_offer(p_reason text, p_accept boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_invited_by uuid;
begin
  if p_reason = 'super' then
    if not public.super_offer_due() then
      return false;
    end if;
    insert into public.moderator_offers (player_id, reason, answered)
    values (auth.uid(), 'super', true)
    on conflict (player_id, reason) do update set answered = true;
    if p_accept then
      update public.moderators set super = true where id = auth.uid();
    end if;
    return true;
  end if;

  if p_reason = 'bonus' then
    if exists (select 1 from public.moderators m where m.id = auth.uid()) then
      return false;
    end if;
    if p_accept then
      if not public.is_named_account() then
        return false;
      end if;
      if (select coalesce((select sum(r.score) from public.runs r where r.player_id = auth.uid()), 0)
                + 150 * (select count(*) from public.word_submissions s
                          where s.player_id = auth.uid() and s.status = 'accepted')) < 3950 then
        return false;
      end if;
      insert into public.moderators (id, invited_by) values (auth.uid(), null)
      on conflict do nothing;
    end if;
    return true;
  end if;

  if not exists (select 1 from public.moderator_offer_due() d where d.reason = p_reason) then
    return false;
  end if;
  if p_accept and not public.is_named_account() then
    return false;
  end if;

  select o.invited_by into v_invited_by from public.moderator_offers o
   where o.player_id = auth.uid() and o.reason = p_reason;

  insert into public.moderator_offers (player_id, reason, invited_by, answered)
  values (auth.uid(), p_reason, v_invited_by, true)
  on conflict (player_id, reason) do update set answered = true;

  if p_accept then
    insert into public.moderators (id, invited_by) values (auth.uid(), v_invited_by)
    on conflict do nothing;
  end if;
  return true;
end;
$$;

-- Reprise de 0011 : la proposition corrigée garde sa date et ne passe pas par
-- le plafond du jour, qu'elle a déjà payé.
create or replace function public.amend_submission(p_id uuid, p_word text, p_display text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_category text;
  v_at timestamptz;
begin
  if coalesce(length(trim(p_word)), 0) = 0 or char_length(p_word) > 100
     or coalesce(length(trim(p_display)), 0) = 0 or char_length(p_display) > 100 then
    return false;
  end if;
  if exists (
    select 1 from public.word_submissions s
      join public.word_reviews r on r.category_id = s.category_id and r.word = s.word
      join public.moderation_votes v on v.review_id = r.id
     where s.id = p_id
  ) then
    return false;
  end if;

  delete from public.word_submissions
   where id = p_id and player_id = auth.uid() and status = 'pending'
  returning category_id, created_at into v_category, v_at;

  if v_category is null then
    return false;
  end if;

  perform set_config('lettre_minute.amending', 'on', true);
  insert into public.word_submissions (player_id, category_id, word, display, created_at)
  values (auth.uid(), v_category, p_word, p_display, v_at)
  on conflict (player_id, category_id, word) do nothing;
  perform set_config('lettre_minute.amending', 'off', true);

  return true;
end;
$$;

-- -------------------------------------------------------- rattrapage --

-- Les scores de chacun sur tout ce que la file a déjà tranché. Les profils
-- ne se pèsent qu'au prochain refus : un ban d'office ne tombe pas sur un
-- passé que personne ne lui reprochait.
select public.refresh_moderator_score(id) from public.moderators;
