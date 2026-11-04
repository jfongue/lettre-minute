-- Rejoindre une table par le lien d'invitation du portail CrazyGames : le lien
-- porte l'identifiant de la table (un uuid qu'on ne devine pas), et celui qui
-- l'ouvre n'a pas d'invitation écrite, que `duel_join` (0046) exige. Celui-ci
-- en écrit une pour l'appelant puis la fait valoir — l'hôte garde l'expulsion,
-- et une table pleine, lancée ou fermée n'accueille toujours personne.
--
-- Un blocage, dans un sens ou dans l'autre, avec l'hôte ou un joueur assis tient
-- la table hors de portée, et se dit comme une table fermée : un blocage ne se
-- dit jamais au bloqué (0014).

create function public.duel_join_link(p_table uuid, p_owned integer) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
begin
  if not public.is_named_account() then
    return 'forbidden';
  end if;
  select * into v_table from public.duel_tables where id = p_table;
  if not found or not public.duel_lobby_open(v_table) then
    return 'closed';
  end if;
  if exists (
    select 1 from public.duel_seats s join public.blocks b
      on (b.blocker = s.player and b.blocked = auth.uid()) or (b.blocker = auth.uid() and b.blocked = s.player)
     where s.table_id = p_table and s.left_at is null and s.kicked_at is null
  ) then
    return 'closed';
  end if;
  insert into public.duel_invites (table_id, invitee) values (p_table, auth.uid())
  on conflict (table_id, invitee) do nothing;
  return public.duel_join(p_table, p_owned);
end;
$$;

revoke execute on function public.duel_join_link(uuid, integer) from public, anon;
grant execute on function public.duel_join_link(uuid, integer) to authenticated;
