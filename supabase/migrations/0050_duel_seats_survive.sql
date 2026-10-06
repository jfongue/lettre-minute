-- Une place survit à la suppression du compte : le siège garde son rang, la
-- table continue, et le meneur suivant déclare la mort du parti comme pour tout
-- abandon. Sans ça, la cascade de `0002_delete_account` effaçait la ligne : les
-- appareils recompactaient les places restantes (`src/state/duel.ts`), alors que
-- le rejeu adresse la place et non le joueur (`duel_moves.seat`) — l'histoire se
-- réécrivait en silence, et à deux il ne restait plus de quoi jouer.

-- Le joueur devient facultatif, la place devient la clé.
alter table public.duel_seats add column id uuid not null default gen_random_uuid();
alter table public.duel_seats drop constraint duel_seats_pkey;
alter table public.duel_seats add primary key (id);
-- `duel_join` s'appuie encore dessus (`on conflict (table_id, player)`), et deux
-- places sans joueur ne se confondent pas : un index unique laisse passer
-- plusieurs NULL.
alter table public.duel_seats add constraint duel_seats_player_key unique (table_id, player);
alter table public.duel_seats alter column player drop not null;
alter table public.duel_seats drop constraint duel_seats_player_fkey;
alter table public.duel_seats add constraint duel_seats_player_fkey
  foreign key (player) references public.profiles on delete set null;

-- Le compte s'efface : ses places se libèrent avant la cascade, pour que la
-- table ne le compte plus comme présent et que sa réserve cesse d'être défendue.
create function public.duel_seats_left_on_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.duel_seats set left_at = coalesce(left_at, now()), ready = false
   where player = old.id;
  return old;
end;
$$;

create trigger duel_seats_left_on_delete
before delete on auth.users
for each row execute function public.duel_seats_left_on_delete();

-- La table relue porte donc des places sans joueur : leur nom et leur avatar
-- manquent, mais leur rang reste, et le rejeu les retrouve à leur index. Le
-- marquage de présence, lui, ne s'écrit plus à chaque battement : le silence qui
-- compte est de huit secondes (`DRIVER_SILENCE`), deux suffisent à le tenir.
create or replace function public.duel_sync(p_table uuid, p_after integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
begin
  select * into v_table from public.duel_tables where id = p_table;
  if not found or not exists (select 1 from public.duel_seats where table_id = p_table and player = auth.uid()) then
    return null;
  end if;
  update public.duel_seats set last_seen = now()
   where table_id = p_table and player = auth.uid() and left_at is null and kicked_at is null
     and last_seen < clock_timestamp() - interval '2 seconds';

  return jsonb_build_object(
    'now', extract(epoch from clock_timestamp()),
    'table', jsonb_build_object(
      'id', v_table.id,
      'host', v_table.host,
      'lang', v_table.lang,
      'seed', v_table.seed,
      'categories', to_jsonb(v_table.categories),
      'status', case when v_table.status = 'lobby' and not public.duel_lobby_open(v_table) then 'closed' else v_table.status end,
      'started_at', extract(epoch from v_table.started_at),
      'rematch', v_table.rematch
    ),
    'seats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player', s.player,
        'name', p.display_name,
        'avatar', p.avatar,
        'bot', s.is_bot,
        'owned', s.owned,
        'ready', s.ready,
        'seat', s.seat,
        'left', s.left_at is not null,
        'kicked', s.kicked_at is not null,
        'seen', extract(epoch from s.last_seen)
      ) order by s.joined_at, s.player)
      from public.duel_seats s left join public.profiles p on p.id = s.player
      where s.table_id = p_table
    ), '[]'::jsonb),
    'invites', case when v_table.host = auth.uid() then coalesce((
      select jsonb_agg(jsonb_build_object('player', i.invitee, 'name', p.display_name, 'avatar', p.avatar) order by i.created_at)
      from public.duel_invites i join public.profiles p on p.id = i.invitee
      where i.table_id = p_table and i.answered_at is null
    ), '[]'::jsonb) else '[]'::jsonb end,
    'moves', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seq', m.seq, 'seat', m.seat, 'kind', m.kind, 'payload', m.payload, 'at', extract(epoch from m.at)
      ) order by m.seq)
      from public.duel_moves m where m.table_id = p_table and m.seq > coalesce(p_after, 0)
    ), '[]'::jsonb)
  );
end;
$$;
