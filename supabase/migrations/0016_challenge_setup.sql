-- Le chef choisit les catégories d'un défi parmi les siennes (le client
-- s'en charge : le serveur ne connaît pas les possessions) et s'il autorise
-- les pouvoirs. Sans pouvoirs, chacun joue à mains nues ; la revanche garde
-- la même règle.

alter table public.challenges add column powers_allowed boolean not null default true;

-- Remplace celle de 0008, un argument en plus. Par défaut les pouvoirs
-- restent permis : un client d'avant 0016 appelle toujours avec quatre.
drop function public.create_challenge(text, bigint, text[], uuid[]);
create function public.create_challenge(
  p_lang text, p_seed bigint, p_categories text[], p_friends uuid[], p_powers boolean default true
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_friends uuid[];
  v_id uuid;
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
  v_id := public.open_challenge(p_lang, p_seed, p_categories, v_friends, null);
  update public.challenges set powers_allowed = coalesce(p_powers, true) where id = v_id;
  return v_id;
end;
$$;

revoke execute on function public.create_challenge(text, bigint, text[], uuid[], boolean) from public, anon;
grant execute on function public.create_challenge(text, bigint, text[], uuid[], boolean) to authenticated;

-- La revanche reprend la règle des pouvoirs du défi qu'elle suit.
create function public.carry_powers_allowed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.previous_id is not null then
    select powers_allowed into new.powers_allowed from public.challenges where id = new.previous_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.carry_powers_allowed() from public, anon, authenticated;

create trigger challenges_carry_powers
  before insert on public.challenges
  for each row execute function public.carry_powers_allowed();

-- Identique à 0012, `powers_allowed` en plus.
create or replace function public.challenge_detail(p_challenge uuid) returns jsonb
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
      'powers_allowed', c.powers_allowed,
      'players', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'id', p.id,
                 'name', p.display_name,
                 'avatar', p.avatar,
                 'me', p.id = auth.uid(),
                 'bot', exists (select 1 from public.bots b where b.id = p.id),
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
