-- Modération : des joueurs volontaires jugent les mots proposés, un par un.
--
-- Un mot proposé devient une « revue » (catégorie + mot), que rejoignent tous
-- les joueurs qui l'ont réclamé. Les modérateurs y votent ; la revue se règle
-- d'elle-même au fil des votes (`settle_review`). Les seuils vivent ici, pas
-- dans le client : les changer ne demande pas de redéploiement.

-- ---------------------------------------------------------------- revues --

create table public.word_reviews (
  id uuid primary key default gen_random_uuid(),
  category_id text not null,
  word text not null,
  display text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  -- Un modérateur a corrigé l'orthographe : sa validation vaut, mais il en
  -- faut une de plus.
  respelled boolean not null default false,
  -- Synonyme, double orthographe, doute : seul un super modérateur tranche.
  special boolean not null default false,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (category_id, word)
);

create index word_reviews_pending_idx on public.word_reviews (created_at) where status = 'pending';

create table public.moderation_votes (
  review_id uuid not null references public.word_reviews on delete cascade,
  moderator_id uuid not null references public.profiles on delete cascade,
  verdict text not null check (verdict in ('correct', 'unsure', 'incorrect', 'special')),
  note text check (char_length(note) <= 140),
  created_at timestamptz not null default now(),
  primary key (review_id, moderator_id)
);

create index moderation_votes_moderator_idx on public.moderation_votes (moderator_id);

alter table public.moderators add column invited_by uuid references public.profiles on delete set null;
alter table public.moderators add column created_at timestamptz not null default now();

-- Une proposition de devenir modérateur, par motif : le niveau, les mots
-- acceptés, ou un ami modérateur. Refuser l'une n'empêche pas les autres.
create table public.moderator_offers (
  player_id uuid not null references public.profiles on delete cascade,
  reason text not null check (reason in ('level', 'words', 'friend')),
  invited_by uuid references public.profiles on delete set null,
  answered boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (player_id, reason)
);

-- La pastille de « Mes demandes » : un mot accepté que son auteur n'a pas vu.
alter table public.word_submissions add column seen_at timestamptz;
update public.word_submissions set seen_at = now() where status <> 'pending';

alter table public.word_reviews enable row level security;
alter table public.moderation_votes enable row level security;
alter table public.moderator_offers enable row level security;
-- Aucune politique : tout passe par les fonctions ci-dessous.

-- Trois joueurs ne suffisent plus à faire entrer un mot : ce sont les
-- modérateurs qui en décident.
drop trigger word_submissions_auto_accept on public.word_submissions;
drop function public.auto_accept_word();

insert into public.word_reviews (category_id, word, display)
select category_id, word, min(display)
  from public.word_submissions
 where status = 'pending'
 group by category_id, word
on conflict do nothing;

-- Toute proposition rejoint la revue de son mot ; une revue déjà réglée
-- règle aussitôt la nouvelle venue.
create function public.join_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  insert into public.word_reviews (category_id, word, display)
  values (new.category_id, new.word, new.display)
  on conflict (category_id, word) do nothing;

  select status into v_status from public.word_reviews
   where category_id = new.category_id and word = new.word;

  if v_status = 'accepted' then
    perform public.accept_word(new.category_id, new.word);
  elsif v_status = 'rejected' then
    update public.word_submissions set status = 'rejected', seen_at = now() where id = new.id;
  end if;
  return new;
end;
$$;

create trigger word_submissions_join_review
  after insert on public.word_submissions
  for each row execute function public.join_review();

-- ------------------------------------------------------ super modérateurs --

-- Cinq mots validés par lui, finalement entrés sans qu'un seul modérateur les
-- ait dits incorrects : sa parole suffit désormais.
create function public.validated_count(p_moderator uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer
    from public.moderation_votes v
    join public.word_reviews r on r.id = v.review_id and r.status = 'accepted'
   where v.moderator_id = p_moderator
     and v.verdict = 'correct'
     and not exists (
       select 1 from public.moderation_votes x where x.review_id = r.id and x.verdict = 'incorrect'
     );
$$;

create function public.is_super_moderator(p_moderator uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.moderators where id = p_moderator)
     and public.validated_count(p_moderator) >= 5;
$$;

-- ------------------------------------------------------------- règlement --

create function public.reject_word(p_category text, p_word text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.word_submissions
     set status = 'rejected', seen_at = now()
   where category_id = p_category and word = p_word and status = 'pending';
end;
$$;

-- Trois « correct » de trois modérateurs font entrer un mot ; deux
-- « incorrect » le bloquent. Deux « je ne sais pas » le rendent louche : il
-- lui faut alors trois « correct » de plus. Un super modérateur valide seul,
-- et seul il tranche un cas spécial.
create function public.settle_review(p_review uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_review public.word_reviews;
  v_correct integer;
  v_unsure integer;
  v_incorrect integer;
  v_super_correct boolean;
  v_super_incorrect boolean;
  v_needed integer;
begin
  select * into v_review from public.word_reviews where id = p_review for update;
  if v_review.status <> 'pending' then
    return v_review.status;
  end if;

  select count(*) filter (where verdict = 'correct'),
         count(*) filter (where verdict = 'unsure'),
         count(*) filter (where verdict = 'incorrect'),
         coalesce(bool_or(verdict = 'correct' and public.is_super_moderator(moderator_id)), false),
         coalesce(bool_or(verdict = 'incorrect' and public.is_super_moderator(moderator_id)), false)
    into v_correct, v_unsure, v_incorrect, v_super_correct, v_super_incorrect
    from public.moderation_votes
   where review_id = p_review;

  v_needed := 3 + case when v_review.respelled then 1 else 0 end + case when v_unsure >= 2 then 3 else 0 end;

  if v_super_correct or (not v_review.special and v_correct >= v_needed) then
    update public.word_reviews set status = 'accepted', decided_at = now() where id = p_review;
    perform public.accept_word(v_review.category_id, v_review.word);
    return 'accepted';
  end if;

  if (v_review.special and v_super_incorrect) or (not v_review.special and v_incorrect >= 2) then
    update public.word_reviews set status = 'rejected', decided_at = now() where id = p_review;
    perform public.reject_word(v_review.category_id, v_review.word);
    return 'rejected';
  end if;

  return case when v_review.special then 'special' else 'pending' end;
end;
$$;

-- ----------------------------------------------------------------- votes --

-- Les mots à juger dans une langue, les plus anciens d'abord : ni ceux qu'il
-- a déjà jugés, ni ceux qu'il a proposés lui-même, et les cas spéciaux aux
-- seuls super modérateurs.
create function public.moderation_queue(p_lang text, p_limit integer default 5)
returns table (id uuid, category_id text, word text, display text, proposals integer, special boolean, note text, can_respell boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_super boolean := public.is_super_moderator(auth.uid());
begin
  if not public.is_moderator() then
    return;
  end if;

  return query
  select r.id,
         r.category_id,
         r.word,
         r.display,
         (select count(*)::integer from public.word_submissions s
           where s.category_id = r.category_id and s.word = r.word),
         r.special,
         (select v.note from public.moderation_votes v
           where v.review_id = r.id and v.verdict = 'special'
           order by v.created_at desc limit 1),
         not exists (select 1 from public.moderation_votes v where v.review_id = r.id)
    from public.word_reviews r
   where r.status = 'pending'
     and (not r.special or v_super)
     and case when p_lang = 'fr' then position(':' in r.category_id) = 0
              else r.category_id like p_lang || ':%' end
     and exists (select 1 from public.word_submissions s
                  where s.category_id = r.category_id and s.word = r.word and s.status = 'pending')
     and not exists (select 1 from public.word_submissions s
                      where s.category_id = r.category_id and s.word = r.word and s.player_id = auth.uid())
     and not exists (select 1 from public.moderation_votes v
                      where v.review_id = r.id and v.moderator_id = auth.uid())
   order by r.special desc, r.created_at
   limit greatest(1, least(p_limit, 20));
end;
$$;

-- Répond par ce que devient le mot : 'pending', 'special', 'accepted',
-- 'rejected', ou 'gone' quand le vote n'a pas pu être pris (mot déjà réglé,
-- déjà jugé, orthographe verrouillée).
create function public.cast_vote(
  p_review uuid,
  p_verdict text,
  p_note text default null,
  p_word text default null,
  p_display text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_review public.word_reviews;
  v_target public.word_reviews;
  v_super boolean := public.is_super_moderator(auth.uid());
begin
  if not public.is_moderator() or p_verdict not in ('correct', 'unsure', 'incorrect', 'special') then
    return 'gone';
  end if;

  select * into v_review from public.word_reviews where id = p_review for update;
  if not found or v_review.status <> 'pending' then
    return 'gone';
  end if;
  if v_review.special and not v_super then
    return 'gone';
  end if;
  if exists (select 1 from public.moderation_votes where review_id = p_review and moderator_id = auth.uid())
     or exists (select 1 from public.word_submissions
                 where category_id = v_review.category_id and word = v_review.word and player_id = auth.uid()) then
    return 'gone';
  end if;

  -- Corriger l'orthographe n'est permis qu'avant le premier vote, et vaut
  -- validation : un « correct » sur un mot que personne n'a vu tel quel.
  if p_word is not null and p_word <> v_review.word then
    if p_verdict <> 'correct' or length(trim(p_display)) = 0
       or exists (select 1 from public.moderation_votes where review_id = p_review) then
      return 'gone';
    end if;

    select * into v_target from public.word_reviews
     where category_id = v_review.category_id and word = p_word for update;

    if found then
      -- Le mot corrigé était déjà proposé : les deux revues n'en font qu'une.
      delete from public.word_submissions s
       where s.category_id = v_review.category_id and s.word = v_review.word
         and exists (select 1 from public.word_submissions t
                      where t.player_id = s.player_id and t.category_id = s.category_id and t.word = p_word);
      update public.word_submissions
         set word = p_word, display = v_target.display, status = v_target.status,
             seen_at = case when v_target.status = 'rejected' then now() end
       where category_id = v_review.category_id and word = v_review.word;
      delete from public.word_reviews where id = v_review.id;

      if v_target.status = 'accepted' then
        perform public.accept_word(v_target.category_id, v_target.word);
        return 'accepted';
      end if;
      if v_target.status = 'rejected' then
        return 'rejected';
      end if;
      if exists (select 1 from public.moderation_votes where review_id = v_target.id and moderator_id = auth.uid()) then
        return public.settle_review(v_target.id);
      end if;
      update public.word_reviews set respelled = true where id = v_target.id;
      v_review := v_target;
    else
      update public.word_submissions
         set word = p_word, display = trim(p_display)
       where category_id = v_review.category_id and word = v_review.word;
      update public.word_reviews
         set word = p_word, display = trim(p_display), respelled = true
       where id = v_review.id;
    end if;
  end if;

  insert into public.moderation_votes (review_id, moderator_id, verdict, note)
  values (v_review.id, auth.uid(), p_verdict, nullif(trim(coalesce(p_note, '')), ''));

  if p_verdict = 'special' then
    update public.word_reviews set special = true where id = v_review.id;
  end if;

  return public.settle_review(v_review.id);
end;
$$;

-- ------------------------------------------------------- recrutement --

-- Le niveau 6 en XP, tel que `xpForLevel(MODERATOR_LEVEL)` le calcule
-- (`src/domain/moderation.ts`, dont un test tient les deux ensemble).
create function public.moderator_offer_due() returns table (reason text, invited_by text)
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
    select 'level', null, 3 from me where me.xp >= 2550
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

-- Un compte anonyme ne devient pas modérateur : la fusion à la connexion
-- effacerait son titre avec lui.
create function public.answer_moderator_offer(p_reason text, p_accept boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_invited_by uuid;
begin
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

-- Un modérateur élit un ami : l'ami reçoit la proposition, libre de refuser.
-- Répond 'sent', 'already' (déjà modérateur ou déjà invité), 'not-friend' ou
-- 'forbidden'.
create function public.invite_moderator(p_friend uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then
    return 'forbidden';
  end if;
  if not exists (
    select 1 from public.friendships
     where status = 'accepted'
       and ((requester = auth.uid() and addressee = p_friend) or (requester = p_friend and addressee = auth.uid()))
  ) or not exists (select 1 from auth.users where id = p_friend and not is_anonymous) then
    return 'not-friend';
  end if;
  if exists (select 1 from public.moderators where id = p_friend)
     or exists (select 1 from public.moderator_offers
                 where player_id = p_friend and reason = 'friend' and not answered) then
    return 'already';
  end if;

  insert into public.moderator_offers (player_id, reason, invited_by)
  values (p_friend, 'friend', auth.uid())
  on conflict (player_id, reason) do update set invited_by = excluded.invited_by, answered = false, created_at = now();
  return 'sent';
end;
$$;

-- ----------------------------------------------------------- tableau de bord --

-- Tout ce que l'accueil doit savoir en un appel : le rôle du joueur, les mots
-- qui l'attendent dans sa langue, la proposition à lui faire, et ses mots
-- acceptés qu'il n'a pas encore vus.
create function public.moderation_status(p_lang text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_moderator boolean := public.is_moderator();
  v_offer record;
begin
  select * into v_offer from public.moderator_offer_due();
  return jsonb_build_object(
    'moderator', v_moderator,
    'super', v_moderator and public.is_super_moderator(auth.uid()),
    'validated', case when v_moderator then public.validated_count(auth.uid()) else 0 end,
    'queue', case when v_moderator then (select count(*) from public.moderation_queue(p_lang, 20)) else 0 end,
    'offer', v_offer.reason,
    'invited_by', v_offer.invited_by,
    'news', (select count(*) from public.word_submissions
              where player_id = auth.uid() and status = 'accepted' and seen_at is null)
  );
end;
$$;

create function public.mark_requests_seen() returns void
language sql security definer set search_path = public as $$
  update public.word_submissions set seen_at = now()
   where player_id = auth.uid() and status = 'accepted' and seen_at is null;
$$;

-- « Mes demandes » : ce qu'en voit leur auteur, et si l'orthographe peut
-- encore changer — plus après le premier vote.
create function public.my_submissions()
returns table (id uuid, category_id text, display text, status text, created_at timestamptz, locked boolean, fresh boolean)
language sql stable security definer set search_path = public as $$
  select s.id, s.category_id, s.display, s.status, s.created_at,
         exists (select 1 from public.word_reviews r join public.moderation_votes v on v.review_id = r.id
                  where r.category_id = s.category_id and r.word = s.word),
         s.status = 'accepted' and s.seen_at is null
    from public.word_submissions s
   where s.player_id = auth.uid()
   order by s.created_at desc;
$$;

-- Corriger sa proposition n'est plus permis une fois qu'un modérateur l'a vue.
create or replace function public.amend_submission(p_id uuid, p_word text, p_display text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_category text;
begin
  if length(trim(p_word)) = 0 then
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
  returning category_id into v_category;

  if v_category is null then
    return false;
  end if;

  insert into public.word_submissions (player_id, category_id, word, display)
  values (auth.uid(), v_category, p_word, p_display)
  on conflict (player_id, category_id, word) do nothing;

  return true;
end;
$$;

-- Les amis, avec de quoi savoir qui est déjà modérateur.
drop function public.my_friends();
create function public.my_friends()
returns table (id uuid, display_name text, avatar jsonb, xp integer, best_score integer, week_best integer, relation text, moderator boolean)
language sql stable security definer set search_path = public as $$
  select p.id,
         p.display_name,
         p.avatar,
         p.xp,
         p.best_score,
         coalesce((
           select max(r.score) from public.runs r
            where r.player_id = p.id and r.created_at >= public.period_start('week')
         ), 0)::integer,
         case
           when f.status = 'accepted' then 'friend'
           when f.requester = auth.uid() then 'outgoing'
           else 'incoming'
         end,
         exists (select 1 from public.moderators m where m.id = p.id)
    from public.friendships f
    join public.profiles p
      on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
   where auth.uid() in (f.requester, f.addressee)
   order by p.display_name;
$$;

-- `accept_word` n'avait jamais été retiré aux clients : n'importe quel joueur
-- pouvait faire entrer un mot et encaisser ses 150 XP.
revoke execute on function
  public.accept_word(text, text),
  public.validated_count(uuid),
  public.is_super_moderator(uuid),
  public.reject_word(text, text),
  public.settle_review(uuid),
  public.join_review(),
  public.moderator_offer_due()
  from public, anon, authenticated;

revoke execute on function
  public.moderation_queue(text, integer),
  public.cast_vote(uuid, text, text, text, text),
  public.answer_moderator_offer(text, boolean),
  public.invite_moderator(uuid),
  public.moderation_status(text),
  public.mark_requests_seen(),
  public.my_submissions(),
  public.my_friends()
  from public, anon;
grant execute on function
  public.moderation_queue(text, integer),
  public.cast_vote(uuid, text, text, text, text),
  public.answer_moderator_offer(text, boolean),
  public.invite_moderator(uuid),
  public.moderation_status(text),
  public.mark_requests_seen(),
  public.my_submissions(),
  public.my_friends()
  to authenticated;
