-- Bloquer un joueur, et réagir au bilan d'un défi.
--
-- Bloquer se fait par le nom, comme demander en ami : c'est tout ce qu'un
-- classement montre d'un joueur. Le blocage efface l'amitié ou la demande en
-- cours, et les demandes suivantes du bloqué s'évanouissent sans qu'il le
-- sache : lui répondre « bloqué » le pousserait à revenir sous un autre nom.
-- Sans amitié, il ne peut plus inviter à un défi non plus (`challengeable`).

create table public.blocks (
  blocker uuid not null references public.profiles on delete cascade,
  blocked uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

create index blocks_blocked_idx on public.blocks (blocked);

alter table public.blocks enable row level security;
-- Aucune politique : tout passe par les fonctions ci-dessous.

create function public.named_player(p_name text) returns uuid
language sql stable security definer set search_path = public as $$
  select p.id
    from public.profiles p
    join auth.users u on u.id = p.id and not u.is_anonymous
   where lower(p.display_name) = lower(trim(p_name));
$$;

-- 'blocked', 'self', 'unknown' ou 'anonymous'.
create function public.block_player(p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_target uuid;
begin
  if not public.is_named_account() then
    return 'anonymous';
  end if;
  v_target := public.named_player(p_name);
  if v_target is null then
    return 'unknown';
  end if;
  if v_target = auth.uid() then
    return 'self';
  end if;

  insert into public.blocks (blocker, blocked) values (auth.uid(), v_target)
    on conflict do nothing;
  delete from public.friendships
   where (requester = auth.uid() and addressee = v_target)
      or (requester = v_target and addressee = auth.uid());
  return 'blocked';
end;
$$;

create function public.unblock_player(p_other uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.blocks where blocker = auth.uid() and blocked = p_other;
$$;

create function public.my_blocks()
returns table (id uuid, display_name text, avatar jsonb)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar
    from public.blocks b
    join public.profiles p on p.id = b.blocked
   where b.blocker = auth.uid()
   order by p.display_name;
$$;

-- Identique à 0011, avec le blocage : demander un joueur qu'on a bloqué le
-- débloque (le geste est explicite), et une demande vers qui nous a bloqués
-- répond 'sent' sans rien écrire.
create or replace function public.request_friend(p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_target uuid;
begin
  if not public.is_named_account() then
    return 'anonymous';
  end if;

  v_target := public.named_player(p_name);

  if v_target is null then
    return 'unknown';
  end if;
  if v_target = auth.uid() then
    return 'self';
  end if;

  delete from public.blocks where blocker = auth.uid() and blocked = v_target;
  if exists (select 1 from public.blocks where blocker = v_target and blocked = auth.uid()) then
    return 'sent';
  end if;

  if exists (
    select 1 from public.friendships
     where (requester = auth.uid() and addressee = v_target)
        or (requester = v_target and addressee = auth.uid() and status = 'accepted')
  ) then
    return 'already';
  end if;

  update public.friendships set status = 'accepted'
   where requester = v_target and addressee = auth.uid();
  if found then
    return 'accepted';
  end if;

  begin
    insert into public.friendships (requester, addressee) values (auth.uid(), v_target);
    return 'sent';
  exception when unique_violation then
    update public.friendships set status = 'accepted'
     where requester = v_target and addressee = auth.uid() and status = 'pending';
    return case when found then 'accepted' else 'already' end;
  end;
end;
$$;

revoke execute on function public.named_player(text) from public, anon, authenticated;
revoke execute on function
  public.block_player(text),
  public.unblock_player(uuid),
  public.my_blocks()
  from public, anon;
grant execute on function
  public.block_player(text),
  public.unblock_player(uuid),
  public.my_blocks()
  to authenticated;

-- ------------------------------------------------------------ réactions --

-- Une réaction par joueur et par cible du bilan : un trophée (`trophy:slowest`)
-- ou un mot (`word:animaux:chat`). La cible est un texte libre que le client
-- compose : le serveur ne connaît ni les trophées, qu'il ne calcule pas, ni
-- les mots, qu'il ne juge pas.
create table public.challenge_reactions (
  challenge_id uuid not null references public.challenges on delete cascade,
  player_id uuid not null references public.profiles on delete cascade,
  target text not null check (char_length(target) between 1 and 200),
  emoji text not null check (emoji in ('👏', '😂', '😮', '🔥', '❤️', '🏆')),
  created_at timestamptz not null default now(),
  primary key (challenge_id, player_id, target)
);

alter table public.challenge_reactions enable row level security;
-- Aucune politique : tout passe par les fonctions ci-dessous.

-- Seul un joueur qui a joué réagit : les mots des autres lui sont connus.
-- Un emoji nul retire la réaction.
create function public.react_in_challenge(p_challenge uuid, p_target text, p_emoji text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.challenge_players
     where challenge_id = p_challenge and player_id = auth.uid() and played_at is not null
  ) then
    return false;
  end if;
  if p_emoji is null then
    delete from public.challenge_reactions
     where challenge_id = p_challenge and player_id = auth.uid() and target = p_target;
    return true;
  end if;
  insert into public.challenge_reactions (challenge_id, player_id, target, emoji)
    values (p_challenge, auth.uid(), p_target, p_emoji)
    on conflict (challenge_id, player_id, target) do update set emoji = excluded.emoji, created_at = now();
  return true;
exception when check_violation then
  return false;
end;
$$;

create function public.reactions_of_challenge(p_challenge uuid)
returns table (target text, emoji text, player_id uuid)
language sql stable security definer set search_path = public as $$
  select r.target, r.emoji, r.player_id
    from public.challenge_reactions r
   where r.challenge_id = p_challenge
     and exists (
       select 1 from public.challenge_players
        where challenge_id = p_challenge and player_id = auth.uid()
     )
   order by r.created_at;
$$;

revoke execute on function
  public.react_in_challenge(uuid, text, text),
  public.reactions_of_challenge(uuid)
  from public, anon;
grant execute on function
  public.react_in_challenge(uuid, text, text),
  public.reactions_of_challenge(uuid)
  to authenticated;
