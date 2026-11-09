-- Rejoindre une table par sa salle (CrazyGames, `updateRoom`) : le portail
-- montre la table d'un joueur à ses amis du portail, qui ne sont pas les siens
-- dans le jeu et n'ont reçu aucune invitation. Connaître la table — un uuid que
-- seul le portail transmet — vaut invitation, sauf blocage avec quelqu'un qui y
-- est assis : un bloqué n'apprend pas qu'il l'est, il lit 'closed' comme pour
-- une table partie. Le reste est celui de `duel_join` : salon ouvert, quatre
-- places, retour refusé à l'expulsé.

create function public.duel_join_room(p_table uuid, p_owned integer) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
  v_invited boolean;
  v_answer text;
begin
  if not public.is_named_account() then
    return 'forbidden';
  end if;
  select * into v_table from public.duel_tables where id = p_table;
  if not found or not public.duel_lobby_open(v_table) then
    return public.duel_join(p_table, p_owned);
  end if;
  if exists (
    select 1 from public.duel_seats s join public.blocks b
      on (b.blocker = s.player and b.blocked = auth.uid()) or (b.blocker = auth.uid() and b.blocked = s.player)
     where s.table_id = p_table and s.left_at is null and s.kicked_at is null
  ) then
    return 'closed';
  end if;

  -- L'invitation que la salle remplace, le temps de prendre la place : si la
  -- place ne se prend pas, elle disparaît, sans quoi l'accueil l'afficherait.
  insert into public.duel_invites (table_id, invitee)
  values (p_table, auth.uid())
  on conflict (table_id, invitee) do nothing;
  v_invited := found;
  v_answer := public.duel_join(p_table, p_owned);
  if v_answer <> 'joined' and v_invited then
    delete from public.duel_invites where table_id = p_table and invitee = auth.uid();
  end if;
  return v_answer;
end;
$$;

revoke execute on function public.duel_join_room(uuid, integer) from public, anon;
grant execute on function public.duel_join_room(uuid, integer) to authenticated;
