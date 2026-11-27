-- Un joueur connecté à Playgama joue sous un compte du jeu, comme un joueur
-- connecté à CrazyGames (0073, 0074) : la fonction Edge `playgama-auth` fait
-- vérifier par l'API de Playgama ce que son Bridge donne du joueur
-- (`bridge.player.extra`), puis `playgama_link` relie l'identifiant garanti à
-- un compte du jeu, nommé d'après le pseudo du portail. Playgama ne garantit
-- que l'identifiant : le pseudo vient du Bridge, sans preuve, et ne fait que
-- nommer le compte, comme un nom choisi dans l'app.
--
-- L'identifiant se range préfixé de la plateforme qui l'a vérifié
-- (`playgama:…`, `msn:…`, `microsoft_store:…`) : le Bridge tourne aussi chez
-- les partenaires où Playgama distribue le jeu, et deux plateformes peuvent
-- donner le même identifiant à deux joueurs.
--
-- Et la version Playgama se dit d'où vient une donnée, comme les autres
-- (0072, 0075) : `platform=playgama` dans `X-Client-Info`.

create table public.playgama_accounts (
  playgama_id text primary key check (char_length(playgama_id) between 3 and 200),
  player_id uuid not null unique references public.profiles (id) on delete cascade,
  portal_name text,
  created_at timestamptz not null default now()
);

-- Aucune politique : seule la fonction Edge, en service_role, la lit.
alter table public.playgama_accounts enable row level security;
revoke all on public.playgama_accounts from anon, authenticated;

-- Relie un joueur Playgama au compte du jeu que la fonction vient de créer, ou
-- rend celui qu'une requête concurrente a relié la première. Son pseudo
-- devient le nom du compte, suffixé du premier numéro libre s'il est pris, et
-- le suit quand il change sur le portail.
create function public.playgama_link(p_playgama_id text, p_player uuid, p_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_player uuid;
  v_applied text;
  v_base text := left(regexp_replace(coalesce(p_name, ''), '[^A-Za-z0-9_]', '', 'g'), 20);
  v_name text;
  v_n integer := 1;
begin
  insert into public.playgama_accounts (playgama_id, player_id)
  values (p_playgama_id, p_player)
  on conflict (playgama_id) do nothing;
  select player_id, portal_name into v_player, v_applied
  from public.playgama_accounts where playgama_id = p_playgama_id;

  if char_length(v_base) < 3 or v_applied is not distinct from p_name then
    return v_player;
  end if;
  v_name := v_base;
  while exists (select 1 from public.profiles where lower(display_name) = lower(v_name) and id <> v_player) loop
    v_n := v_n + 1;
    v_name := v_base || '_' || v_n;
  end loop;
  update public.profiles set display_name = v_name, updated_at = now() where id = v_player;
  update public.playgama_accounts set portal_name = p_name where playgama_id = p_playgama_id;
  return v_player;
end;
$$;

revoke execute on function public.playgama_link(text, uuid, text) from public, anon, authenticated;
grant execute on function public.playgama_link(text, uuid, text) to service_role;

-- ------------------------------------------------------------ plateforme --

create or replace function public.client_platform() returns text
language sql stable as $$
  select substring(
    coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-client-info', '')
    from 'platform=(android|web|crazygames|playgama|reddit)'
  );
$$;

alter table public.runs drop constraint if exists runs_platform_check;
alter table public.runs add constraint runs_platform_check
  check (platform in ('android', 'web', 'crazygames', 'playgama', 'reddit'));
alter table public.duel_tables drop constraint if exists duel_tables_platform_check;
alter table public.duel_tables add constraint duel_tables_platform_check
  check (platform in ('android', 'web', 'crazygames', 'playgama', 'reddit'));
alter table public.weekly_attempts drop constraint if exists weekly_attempts_platform_check;
alter table public.weekly_attempts add constraint weekly_attempts_platform_check
  check (platform in ('android', 'web', 'crazygames', 'playgama', 'reddit'));
