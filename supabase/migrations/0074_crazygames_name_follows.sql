-- Le nom d'un compte CrazyGames suit celui du portail. Un pseudo du portail
-- porte une extension après son point (« FieryGoat.qrfj ») qui ne dit rien
-- aux autres joueurs : le compte ne garde que ce qui la précède. Et un joueur
-- qui change de pseudo sur le portail change de nom dans le jeu à sa
-- connexion suivante : `portal_name` retient le pseudo déjà appliqué, pour ne
-- renommer qu'à un changement.

alter table public.crazygames_accounts add column portal_name text;

create or replace function public.crazygames_link(p_crazygames_id text, p_player uuid, p_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_player uuid;
  v_applied text;
  v_base text := left(regexp_replace(split_part(coalesce(p_name, ''), '.', 1), '[^A-Za-z0-9_]', '', 'g'), 20);
  v_name text;
  v_n integer := 1;
begin
  insert into public.crazygames_accounts (crazygames_id, player_id)
  values (p_crazygames_id, p_player)
  on conflict (crazygames_id) do nothing;
  select player_id, portal_name into v_player, v_applied
  from public.crazygames_accounts where crazygames_id = p_crazygames_id;

  if v_base = '' or v_applied is not distinct from p_name then
    return v_player;
  end if;
  v_name := v_base;
  while exists (select 1 from public.profiles where lower(display_name) = lower(v_name) and id <> v_player) loop
    v_n := v_n + 1;
    v_name := v_base || '_' || v_n;
  end loop;
  update public.profiles set display_name = v_name, updated_at = now() where id = v_player;
  update public.crazygames_accounts set portal_name = p_name where crazygames_id = p_crazygames_id;
  return v_player;
end;
$$;

revoke execute on function public.crazygames_link(text, uuid, text) from public, anon, authenticated;
grant execute on function public.crazygames_link(text, uuid, text) to service_role;
