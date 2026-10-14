-- Les classements s'ouvrent au portail CrazyGames, où un invité n'a pas de
-- session et ne doit pas en recevoir : jouer en invité y est le chemin
-- principal, et rien ne s'écrit pour lui. Il lit donc les tableaux sous le
-- rôle `anon`, et sa propre place se calcule sur l'appareil : sa meilleure
-- valeur, que `leaderboard_rank` situe parmi les comptes nommés quand elle
-- tombe au-delà des cinquante lignes rendues.
--
-- Un joueur connecté à CrazyGames joue, lui, sous un compte du jeu que la
-- fonction Edge `crazygames-auth` ouvre après avoir vérifié le jeton du SDK :
-- `crazygames_accounts` relie l'identifiant CrazyGames à ce compte, et
-- `crazygames_link` lui donne le nom du portail, ou le premier libre qui en
-- dérive.

revoke execute on function public.leaderboard_board(text) from public;
grant execute on function public.leaderboard_board(text) to anon, authenticated;

revoke execute on function public.leaderboard_stat(text, text) from public;
grant execute on function public.leaderboard_stat(text, text) to anon, authenticated;

-- La place qu'une valeur prendrait, au sens de `rank()` : un de plus que les
-- comptes nommés qui font mieux. Les sessions de modération restent fermées,
-- comme dans `leaderboard_stat`.
create function public.leaderboard_rank(p_stat text, p_period text, p_value integer)
returns integer
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(p_stat not in ('best', 'points', 'runs', 'words', 'discoveries', 'combo', 'added')
    or p_period not in ('day', 'week', 'all') or p_value < 1, true) then
    return null;
  end if;
  return 1 + (
    select count(*)::integer
    from public.leaderboard_values(
      p_stat,
      case when p_period = 'all' then '-infinity'::timestamptz else public.period_start(p_period) end
    ) x
    join auth.users u on u.id = x.player_id and not u.is_anonymous
    where x.value > p_value
  );
end;
$$;

revoke execute on function public.leaderboard_rank(text, text, integer) from public;
grant execute on function public.leaderboard_rank(text, text, integer) to anon, authenticated;

create table public.crazygames_accounts (
  crazygames_id text primary key check (char_length(crazygames_id) between 1 and 128),
  player_id uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Aucune politique : seule la fonction Edge, en service_role, la lit.
alter table public.crazygames_accounts enable row level security;
revoke all on public.crazygames_accounts from anon, authenticated;

-- Relie un compte CrazyGames au compte du jeu que la fonction vient de créer,
-- ou rend celui qu'une requête concurrente a relié la première. Le nom du
-- portail (6 à 20 caractères) devient celui du compte tant qu'il porte encore
-- le nom par défaut ; pris, il se suffixe du premier numéro libre.
create function public.crazygames_link(p_crazygames_id text, p_player uuid, p_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_player uuid;
  v_base text := left(regexp_replace(coalesce(p_name, ''), '[^A-Za-z0-9._]', '', 'g'), 20);
  v_name text;
  v_n integer := 1;
begin
  insert into public.crazygames_accounts (crazygames_id, player_id)
  values (p_crazygames_id, p_player)
  on conflict (crazygames_id) do nothing;
  select player_id into v_player from public.crazygames_accounts where crazygames_id = p_crazygames_id;

  if v_base = '' then
    return v_player;
  end if;
  if not exists (select 1 from public.profiles where id = v_player and display_name = 'Anonyme') then
    return v_player;
  end if;
  v_name := v_base;
  while exists (select 1 from public.profiles where lower(display_name) = lower(v_name) and id <> v_player) loop
    v_n := v_n + 1;
    v_name := v_base || '_' || v_n;
  end loop;
  update public.profiles set display_name = v_name, updated_at = now() where id = v_player;
  return v_player;
end;
$$;

revoke execute on function public.crazygames_link(text, uuid, text) from public, anon, authenticated;
grant execute on function public.crazygames_link(text, uuid, text) to service_role;
