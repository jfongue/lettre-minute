-- Renoncer au départ d'un duel : la barre d'annonce dure 3,2 secondes, et le
-- serveur a déjà lancé la table au dernier « prêt » (`duel_ready`) : sans cette
-- porte, un « prêt » donné trop vite enfermait tout le monde dans un draft que
-- personne n'avait voulu, sans autre issue que de quitter la table.
--
-- N'importe quel joueur assis peut la pousser tant que personne n'a choisi : le
-- draft n'a alors rien produit, et le journal est vidé — les conseils du draft
-- compris — parce que le rejeu repart de `started_at` (src/domain/duelLog.ts) :
-- les coups d'un départ avorté se rejoueraient dans la partie suivante.
--
-- La table revient donc au salon, ses places désarmées : il faut se redéclarer
-- prêt. Les joueurs maison gardent leur « prêt » — personne ne peut le poser
-- pour eux. Répond 'back', 'started' (un choix est déjà pris), 'closed' ou
-- 'forbidden'.
create function public.duel_unstart(p_table uuid) returns text
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
if exists (select 1 from public.duel_moves where table_id = p_table and kind = 'pick') then
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
