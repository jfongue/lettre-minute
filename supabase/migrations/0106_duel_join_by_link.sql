-- Rejoindre une table par le lien d'invitation du portail CrazyGames : l'hôte
-- partage l'adresse de son salon (`inviteLink`), et l'ami qui l'ouvre n'a reçu
-- aucune invitation du jeu, que `duel_join` (0046) exige. Même règles que ce
-- dernier — compte nommé, salon encore ouvert, place libre, jamais rassis
-- après une expulsion —, sans l'invitation, et un blocage, dans un sens ou
-- dans l'autre, avec l'hôte ou l'un des joueurs assis tient la table hors de
-- portée, comme pour la file (0097). L'identifiant de la table, un uuid, est
-- le secret que porte le lien ; le salon ne dure que quinze minutes.
-- Répond comme `duel_join`.
create function public.duel_join_link(p_table uuid, p_owned integer) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
  v_seat public.duel_seats;
begin
  if not public.is_named_account() then
    return 'forbidden';
  end if;
  select * into v_table from public.duel_tables where id = p_table for update;
  if not found then
    return 'closed';
  end if;
  select * into v_seat from public.duel_seats where table_id = p_table and player = auth.uid();
  if found and v_seat.kicked_at is not null then
    return 'kicked';
  end if;
  if found and v_seat.left_at is null then
    return 'joined';
  end if;
  if not public.duel_lobby_open(v_table) then
    return 'closed';
  end if;
  if exists (
    select 1 from public.blocks b
     where (b.blocker = auth.uid() and (b.blocked = v_table.host or b.blocked in (select s.player from public.duel_seats s where s.table_id = p_table and s.left_at is null and s.player is not null)))
        or (b.blocked = auth.uid() and (b.blocker = v_table.host or b.blocker in (select s.player from public.duel_seats s where s.table_id = p_table and s.left_at is null and s.player is not null)))
  ) then
    return 'forbidden';
  end if;
  if public.duel_active_seats(p_table) >= 4 then
    return 'full';
  end if;

  insert into public.duel_seats (table_id, player, owned)
  values (p_table, auth.uid(), greatest(0, least(coalesce(p_owned, 0), 999)))
  on conflict (table_id, player) do update
    set left_at = null, ready = false, joined_at = clock_timestamp(), owned = excluded.owned;
  return 'joined';
end;
$$;

revoke all on function public.duel_join_link(uuid, integer) from public, anon;
grant execute on function public.duel_join_link(uuid, integer) to authenticated;
