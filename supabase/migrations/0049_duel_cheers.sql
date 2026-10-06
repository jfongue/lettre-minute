-- Un conseil pendant le draft : celui qui attend son tour touche la catégorie
-- qu'il verrait bien, et son icône frémit sur les appareils de toute la table,
-- celui qui choisit compris. C'est le seul coup du journal qui ne change rien à
-- la partie — `applyMove` le rend sans toucher au duel (src/domain/duelLog.ts) —
--, mais il doit traverser le serveur comme les autres : le client n'a pas de
-- Realtime, les appareils relisent `duel_sync` et rejouent le même journal.
--
-- Il se glisse donc dans `duel_moves` comme une sorte de coup de plus, et
-- `duel_move` n'en accepte qu'un : le sien. Un joueur maison n'en donne pas,
-- et personne ne conseille à la place d'un autre.

alter table public.duel_moves drop constraint duel_moves_kind_check;

alter table public.duel_moves add constraint duel_moves_kind_check
  check (kind in ('pick', 'word', 'pass', 'timeout', 'cheer'));

create or replace function public.duel_move(p_table uuid, p_seq integer, p_seat integer, p_kind text, p_payload text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
  v_seat public.duel_seats;
  v_last integer;
begin
  select * into v_table from public.duel_tables where id = p_table;
  if not found or not public.duel_seated(p_table) then
    return 'forbidden';
  end if;
  if v_table.status <> 'playing' then
    return 'closed';
  end if;
  if p_kind not in ('pick', 'word', 'pass', 'timeout', 'cheer') or char_length(coalesce(p_payload, '')) > 80 then
    return 'forbidden';
  end if;
  select * into v_seat from public.duel_seats where table_id = p_table and seat = p_seat;
  if not found then
    return 'forbidden';
  end if;
  -- Un mot, un passe ou un conseil d'un joueur ne vient que de lui.
  if p_kind in ('word', 'pass', 'cheer') and (v_seat.is_bot or v_seat.player <> auth.uid()) then
    return 'forbidden';
  end if;

  select coalesce(max(seq), 0) into v_last from public.duel_moves where table_id = p_table;
  if p_seq <> v_last + 1 then
    return 'stale';
  end if;
  begin
    insert into public.duel_moves (table_id, seq, seat, kind, payload, by)
    values (p_table, p_seq, p_seat, p_kind, coalesce(p_payload, ''), auth.uid());
  exception when unique_violation then
    return 'stale';
  end;
  update public.duel_seats set last_seen = now() where table_id = p_table and player = auth.uid();
  return 'ok';
end;
$$;
