-- Revenir au salon pendant tout le draft, pour toute la table (revue
-- multijoueur de CrazyGames) : « Retour au salon » n'était qu'une vue sur
-- l'appareil qui le touchait — les autres continuaient de choisir, et le draft
-- le reprenait au choix suivant. Le bouton ramène maintenant tout le monde, et
-- `duel_unstart` (0058) l'accepte tant que la partie n'a pas commencé : aucun
-- mot, aucun passe, aucun temps écoulé. Les choix et les conseils du draft
-- partent avec le reste du journal, puisque le rejeu repart de `started_at`.
--
-- Répond toujours 'back', 'started' (un mot est déjà joué), 'closed' ou
-- 'forbidden'.
create or replace function public.duel_unstart(p_table uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
v_table public.duel_tables;
begin
select * into v_table from public.duel_tables where id = p_table for update;
if not found or not public.duel_seated(p_table) then
return 'forbidden';
end if;
if v_table.status <> 'playing' then
return 'closed';
end if;
if exists (select 1 from public.duel_moves where table_id = p_table and kind in ('word', 'pass', 'timeout')) then
return 'started';
end if;

delete from public.duel_moves where table_id = p_table;
update public.duel_seats set seat = null where table_id = p_table;
update public.duel_seats set ready = false
where table_id = p_table and not is_bot and left_at is null and kicked_at is null;
update public.duel_tables set status = 'lobby', started_at = null where id = p_table;
return 'back';
end;
$$;
revoke execute on function public.duel_unstart(uuid) from public, anon;
grant execute on function public.duel_unstart(uuid) to authenticated;
