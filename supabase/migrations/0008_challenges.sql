-- Défis entre amis : une graine, une liste de catégories, jouées par chacun
-- à son tour. Le tirage ne dépend que de la graine et des catégories : tous
-- les joueurs d'un défi voient les mêmes lettres dans le même ordre.
--
-- Les parties de défi n'entrent ni dans `runs` ni dans `run_words` : leur
-- graine est connue d'avance, un joueur peut la rejouer avant d'envoyer son
-- score. Elles restent donc hors des classements, de la rareté et des
-- découvertes.
--
-- Un défi se termine quand chaque invité a joué, ou vingt-quatre heures après
-- la dernière partie jouée (à défaut, après sa création). Rien ne tourne pour
-- le clore : chaque lecture le recalcule.

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  -- Le chef : seul lui invite. Son compte effacé, le défi continue sans chef.
  owner uuid references public.profiles on delete set null,
  lang text not null check (lang ~ '^[a-z]{2}$'),
  seed bigint not null,
  category_ids text[] not null check (cardinality(category_ids) between 1 and 5),
  previous_id uuid references public.challenges on delete set null,
  -- La revanche : une seule par défi, que rejoint quiconque arrive après.
  next_id uuid references public.challenges on delete set null,
  created_at timestamptz not null default now()
);

create table public.challenge_players (
  challenge_id uuid not null references public.challenges on delete cascade,
  player_id uuid not null references public.profiles on delete cascade,
  invited_at timestamptz not null default now(),
  played_at timestamptz,
  score integer check (score >= 0),
  skips integer check (skips >= 0),
  best_combo integer check (best_combo >= 0),
  -- Les mots de la partie, tels que le client les juge : clé, catégorie,
  -- points, rareté, secondes. Il en faut assez pour régler le Petit Bac,
  -- rejouer la course et décerner les trophées.
  words jsonb check (words is null or (jsonb_typeof(words) = 'array' and jsonb_array_length(words) <= 200)),
  seen_invite_at timestamptz,
  seen_recap_at timestamptz,
  primary key (challenge_id, player_id)
);

create index challenge_players_player_idx on public.challenge_players (player_id, invited_at desc);

alter table public.challenges enable row level security;
alter table public.challenge_players enable row level security;
-- Aucune politique : tout passe par les fonctions ci-dessous.

-- ---------------------------------------------------------------- état --

create function public.challenge_expires_at(p_challenge uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce(max(cp.played_at), c.created_at) + interval '24 hours'
    from public.challenges c
    left join public.challenge_players cp on cp.challenge_id = c.id
   where c.id = p_challenge
   group by c.id;
$$;

create function public.challenge_finished(p_challenge uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
           select 1 from public.challenge_players
            where challenge_id = p_challenge and played_at is null
         )
      or now() >= public.challenge_expires_at(p_challenge);
$$;

-- Un ami, avec un compte nommé, qui n'est pas un joueur maison : un robot
-- invité ne jouerait jamais, et ferait attendre tout le monde un jour entier.
create function public.challengeable(p_friend uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_friend <> auth.uid()
     and exists (
       select 1 from public.friendships
        where status = 'accepted'
          and ((requester = auth.uid() and addressee = p_friend)
            or (requester = p_friend and addressee = auth.uid()))
     )
     and exists (select 1 from auth.users where id = p_friend and not is_anonymous)
     and not exists (select 1 from public.bots where id = p_friend);
$$;

-- Ouvre un défi : le chef en est, et n'a pas besoin d'être prévenu du sien.
create function public.open_challenge(
  p_lang text, p_seed bigint, p_categories text[], p_players uuid[], p_previous uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  insert into public.challenges (owner, lang, seed, category_ids, previous_id)
  values (auth.uid(), p_lang, p_seed, p_categories, p_previous)
  returning id into v_id;

  insert into public.challenge_players (challenge_id, player_id, seen_invite_at)
  values (v_id, auth.uid(), now());

  insert into public.challenge_players (challenge_id, player_id)
  select v_id, player
    from (select distinct unnest(p_players) as player) invited
   where player <> auth.uid();

  return v_id;
end;
$$;

-- --------------------------------------------------------------- écrire --

-- Null quand le défi ne peut pas s'ouvrir : compte anonyme, personne à
-- inviter, ou plus de huit joueurs.
create function public.create_challenge(p_lang text, p_seed bigint, p_categories text[], p_friends uuid[])
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_friends uuid[];
begin
  if not public.is_named_account() then
    return null;
  end if;
  select coalesce(array_agg(distinct friend), '{}') into v_friends
    from unnest(p_friends) as friend
   where public.challengeable(friend);
  if cardinality(v_friends) = 0 or cardinality(v_friends) > 7 then
    return null;
  end if;
  return public.open_challenge(p_lang, p_seed, p_categories, v_friends, null);
end;
$$;

-- Répond par un code : 'sent', 'full', 'finished', 'forbidden'.
create function public.invite_to_challenge(p_challenge uuid, p_friends uuid[]) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_count integer;
  v_friends uuid[];
begin
  select owner into v_owner from public.challenges where id = p_challenge for update;
  if v_owner is null or v_owner <> auth.uid() then
    return 'forbidden';
  end if;
  if public.challenge_finished(p_challenge) then
    return 'finished';
  end if;

  select coalesce(array_agg(distinct friend), '{}') into v_friends
    from unnest(p_friends) as friend
   where public.challengeable(friend)
     and not exists (
       select 1 from public.challenge_players
        where challenge_id = p_challenge and player_id = friend
     );
  select count(*) into v_count from public.challenge_players where challenge_id = p_challenge;
  if v_count + cardinality(v_friends) > 8 then
    return 'full';
  end if;

  insert into public.challenge_players (challenge_id, player_id)
  select p_challenge, friend from unnest(v_friends) as friend;
  return 'sent';
end;
$$;

-- Une partie par invité, tant que le défi court. Faux sinon : déjà jouée,
-- pas invité, ou défi clos.
create function public.submit_challenge_run(
  p_challenge uuid, p_score integer, p_skips integer, p_best_combo integer, p_words jsonb
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.challenge_finished(p_challenge) then
    return false;
  end if;
  update public.challenge_players
     set played_at = now(),
         score = greatest(0, p_score),
         skips = greatest(0, p_skips),
         best_combo = greatest(0, p_best_combo),
         words = p_words,
         seen_invite_at = coalesce(seen_invite_at, now())
   where challenge_id = p_challenge and player_id = auth.uid() and played_at is null;
  return found;
end;
$$;

-- `invite` éteint la notification d'invitation, `recap` celle du bilan.
create function public.mark_challenge_seen(p_challenge uuid, p_what text) returns void
language sql security definer set search_path = public as $$
  update public.challenge_players
     set seen_invite_at = case when p_what = 'invite' then coalesce(seen_invite_at, now()) else seen_invite_at end,
         seen_recap_at = case when p_what = 'recap' then coalesce(seen_recap_at, now()) else seen_recap_at end
   where challenge_id = p_challenge and player_id = auth.uid();
$$;

-- La revanche : n'importe quel joueur d'un défi clos la lance, et tous ceux
-- qui ont joué y sont invités. Si quelqu'un l'a lancée avant, on reçoit la
-- sienne : il n'y en a qu'une. Le verrou sur la ligne départage deux joueurs
-- qui appuient à la même seconde.
create function public.rematch_challenge(p_challenge uuid, p_seed bigint, p_categories text[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_challenge public.challenges;
  v_players uuid[];
  v_id uuid;
begin
  select * into v_challenge from public.challenges where id = p_challenge for update;
  if v_challenge.id is null then
    return null;
  end if;
  if v_challenge.next_id is not null then
    return v_challenge.next_id;
  end if;
  if not public.challenge_finished(p_challenge) or not exists (
    select 1 from public.challenge_players
     where challenge_id = p_challenge and player_id = auth.uid() and played_at is not null
  ) then
    return null;
  end if;

  select array_agg(player_id) into v_players
    from public.challenge_players
   where challenge_id = p_challenge and played_at is not null;

  v_id := public.open_challenge(v_challenge.lang, p_seed, p_categories, v_players, p_challenge);
  update public.challenges set next_id = v_id where id = p_challenge;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------- lire --

-- Les défis du joueur : ceux qui courent, et ceux clos depuis moins de trois
-- jours, dont le bilan reste à portée.
create function public.my_challenges()
returns table (
  id uuid, owner_name text, owned boolean, lang text, category_ids text[], created_at timestamptz,
  players integer, played integer, me_played boolean, my_score integer, finished boolean,
  expires_at timestamptz, seen_invite boolean, seen_recap boolean, next_id uuid
)
language sql stable security definer set search_path = public as $$
  select c.id,
         coalesce(o.display_name, ''),
         c.owner = auth.uid(),
         c.lang,
         c.category_ids,
         c.created_at,
         (select count(*) from public.challenge_players a where a.challenge_id = c.id)::integer,
         (select count(*) from public.challenge_players a where a.challenge_id = c.id and a.played_at is not null)::integer,
         me.played_at is not null,
         me.score,
         public.challenge_finished(c.id),
         public.challenge_expires_at(c.id),
         me.seen_invite_at is not null,
         me.seen_recap_at is not null,
         c.next_id
    from public.challenge_players me
    join public.challenges c on c.id = me.challenge_id
    left join public.profiles o on o.id = c.owner
   where me.player_id = auth.uid()
     and (not public.challenge_finished(c.id) or public.challenge_expires_at(c.id) > now() - interval '3 days')
   order by c.created_at desc
   limit 30;
$$;

-- Un défi en entier. Les mots des autres ne se lisent qu'une fois sa propre
-- partie jouée, ou le défi clos : avant, seuls leur instant et leurs points
-- voyagent — de quoi rejouer la course, rien à recopier.
create function public.challenge_detail(p_challenge uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_open boolean;
begin
  if not exists (
    select 1 from public.challenge_players where challenge_id = p_challenge and player_id = auth.uid()
  ) then
    return null;
  end if;
  v_open := public.challenge_finished(p_challenge) or exists (
    select 1 from public.challenge_players
     where challenge_id = p_challenge and player_id = auth.uid() and played_at is not null
  );

  return (
    select jsonb_build_object(
      'id', c.id,
      'owner_name', coalesce(o.display_name, ''),
      'owned', c.owner = auth.uid(),
      'lang', c.lang,
      'seed', c.seed,
      'category_ids', to_jsonb(c.category_ids),
      'created_at', c.created_at,
      'expires_at', public.challenge_expires_at(c.id),
      'finished', public.challenge_finished(c.id),
      'next_id', c.next_id,
      'players', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'id', p.id,
                 'name', p.display_name,
                 'avatar', p.avatar,
                 'me', p.id = auth.uid(),
                 'played_at', cp.played_at,
                 'score', cp.score,
                 'skips', cp.skips,
                 'best_combo', cp.best_combo,
                 'words', case
                   when cp.words is null then '[]'::jsonb
                   when v_open or p.id = auth.uid() then cp.words
                   else (select coalesce(jsonb_agg(jsonb_build_object('at', w -> 'at', 'points', w -> 'points')), '[]'::jsonb)
                           from jsonb_array_elements(cp.words) w)
                 end
               ) order by cp.played_at nulls last, cp.invited_at), '[]'::jsonb)
          from public.challenge_players cp
          join public.profiles p on p.id = cp.player_id
         where cp.challenge_id = c.id
      )
    )
    from public.challenges c
    left join public.profiles o on o.id = c.owner
   where c.id = p_challenge
  );
end;
$$;

revoke execute on function
  public.challenge_expires_at(uuid),
  public.challenge_finished(uuid),
  public.challengeable(uuid),
  public.open_challenge(text, bigint, text[], uuid[], uuid)
  from public, anon, authenticated;

revoke execute on function
  public.create_challenge(text, bigint, text[], uuid[]),
  public.invite_to_challenge(uuid, uuid[]),
  public.submit_challenge_run(uuid, integer, integer, integer, jsonb),
  public.mark_challenge_seen(uuid, text),
  public.rematch_challenge(uuid, bigint, text[]),
  public.my_challenges(),
  public.challenge_detail(uuid)
  from public, anon;
grant execute on function
  public.create_challenge(text, bigint, text[], uuid[]),
  public.invite_to_challenge(uuid, uuid[]),
  public.submit_challenge_run(uuid, integer, integer, integer, jsonb),
  public.mark_challenge_seen(uuid, text),
  public.rematch_challenge(uuid, bigint, text[]),
  public.my_challenges(),
  public.challenge_detail(uuid)
  to authenticated;
