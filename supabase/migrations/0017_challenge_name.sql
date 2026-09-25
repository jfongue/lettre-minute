-- Un défi peut porter un nom, choisi par son chef à la création : facultatif,
-- quarante caractères au plus, et gardé par la revanche. Sans nom, le client
-- affiche « Défi de <chef> » comme avant.

alter table public.challenges add column name text
  check (name is null or char_length(name) between 1 and 40);

-- Remplace celle de 0016, un argument en plus. Un nom vide ou fait d'espaces
-- vaut pas de nom ; un client d'avant 0017 appelle toujours avec cinq.
drop function public.create_challenge(text, bigint, text[], uuid[], boolean);
create function public.create_challenge(
  p_lang text, p_seed bigint, p_categories text[], p_friends uuid[], p_powers boolean default true, p_name text default null
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
  update public.challenges
     set powers_allowed = coalesce(p_powers, true),
         name = nullif(left(btrim(coalesce(p_name, '')), 40), '')
   where id = v_id;
  return v_id;
end;
$$;

revoke execute on function public.create_challenge(text, bigint, text[], uuid[], boolean, text) from public, anon;
grant execute on function public.create_challenge(text, bigint, text[], uuid[], boolean, text) to authenticated;

-- La revanche garde le nom du défi qu'elle suit.
create function public.carry_challenge_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.previous_id is not null then
    select name into new.name from public.challenges where id = new.previous_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.carry_challenge_name() from public, anon, authenticated;

create trigger challenges_carry_name
  before insert on public.challenges
  for each row execute function public.carry_challenge_name();

-- Identique à 0016, `name` en plus.
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
      'name', c.name,
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

-- Identique à 0008, `name` en plus : une colonne de sortie ne s'ajoute qu'en
-- recréant la fonction.
drop function public.my_challenges();
create function public.my_challenges()
returns table (
  id uuid, owner_name text, owned boolean, lang text, category_ids text[], created_at timestamptz,
  players integer, played integer, me_played boolean, my_score integer, finished boolean,
  expires_at timestamptz, seen_invite boolean, seen_recap boolean, next_id uuid, name text
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
         c.next_id,
         c.name
    from public.challenge_players me
    join public.challenges c on c.id = me.challenge_id
    left join public.profiles o on o.id = c.owner
   where me.player_id = auth.uid()
     and (not public.challenge_finished(c.id) or public.challenge_expires_at(c.id) > now() - interval '3 days')
   order by c.created_at desc
   limit 30;
$$;
