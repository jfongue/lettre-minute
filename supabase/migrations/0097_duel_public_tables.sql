-- Les tables publiques du duel : au salon, l'hôte ouvre sa table au public
-- d'un bouton, et la referme de même. Le matchmaking (0072) y assoit alors les
-- joueurs de la file avant de les apparier deux à deux : une table qui attend
-- du monde passe avant un face-à-face à créer.
--
-- Rien d'autre ne change : la table reste un salon d'un quart d'heure, l'hôte
-- y garde l'expulsion, et le joueur assis par la file se déclare prêt tout seul
-- à sa première lecture (`quick`, src/state/duel.ts), comme après un
-- appariement. Une table pleine, lancée ou fermée n'accueille plus personne,
-- même ouverte. Un blocage, dans un sens ou dans l'autre, avec l'un des
-- joueurs assis tient la table hors de portée, et un joueur qui y a déjà eu une
-- place — parti ou expulsé — n'y est pas rassis par la file.

alter table public.duel_tables add column listed boolean not null default false;

create index duel_tables_listed_idx on public.duel_tables (lang, created_at) where listed and status = 'lobby';

-- 'public', 'private', 'full' (on n'ouvre pas une table pleine), 'closed' ou 'forbidden'.
create function public.duel_set_public(p_table uuid, p_public boolean) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
begin
  select * into v_table from public.duel_tables where id = p_table for update;
  if not found or v_table.host <> auth.uid() then
    return 'forbidden';
  end if;
  if not public.duel_lobby_open(v_table) then
    return 'closed';
  end if;
  if coalesce(p_public, false) and public.duel_active_seats(p_table) >= 4 then
    return 'full';
  end if;
  update public.duel_tables set listed = coalesce(p_public, false) where id = p_table;
  return case when coalesce(p_public, false) then 'public' else 'private' end;
end;
$$;

-- La table que la file offre à ce joueur : ouverte au public, de sa langue,
-- encore au salon, une place libre, aucun blocage avec ceux qui y sont assis,
-- et aucune place déjà tenue par lui. La plus remplie d'abord — elle part plus
-- tôt —, puis la plus ancienne.
create function public.duel_open_table_for(p_player uuid, p_lang text) returns uuid
language sql stable security definer set search_path = public as $$
  select t.id
    from public.duel_tables t
   where t.listed and t.lang = p_lang and public.duel_lobby_open(t)
     and public.duel_active_seats(t.id) < 4
     and not exists (select 1 from public.duel_seats s where s.table_id = t.id and s.player = p_player)
     and not exists (
       select 1 from public.duel_seats s join public.blocks b
         on (b.blocker = s.player and b.blocked = p_player) or (b.blocker = p_player and b.blocked = s.player)
        where s.table_id = t.id and s.left_at is null and s.kicked_at is null
     )
   order by public.duel_active_seats(t.id) desc, t.created_at
   limit 1;
$$;

-- La file de 0072, qui regarde d'abord les tables publiques : un joueur en
-- attente y est assis dès qu'une s'ouvre, à sa relecture suivante.
create or replace function public.duel_matchmake(p_lang text, p_categories text[], p_owned integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me public.duel_queue;
  v_other public.duel_queue;
  v_table uuid;
begin
  if not public.is_named_account() then
    raise exception 'named account required' using errcode = '42501';
  end if;
  if p_lang !~ '^[a-z]{2}$' or coalesce(cardinality(p_categories), 0) not between 1 and 60 then
    raise exception 'invalid queue entry' using errcode = '22023';
  end if;

  -- Les absents quittent la file ; les appariements lus depuis longtemps s'effacent.
  delete from public.duel_queue
   where (table_id is null and seen_at < now() - public.duel_queue_patience())
      or (table_id is not null and seen_at < now() - interval '2 minutes');

  select * into v_me from public.duel_queue where player = auth.uid() for update;
  if found and v_me.table_id is not null then
    delete from public.duel_queue where player = auth.uid();
    if exists (select 1 from public.duel_tables t where t.id = v_me.table_id and public.duel_lobby_open(t)) then
      return jsonb_build_object('status', 'matched', 'table', v_me.table_id);
    end if;
  end if;

  -- Une table publique attend du monde : la place s'y prend, pas prête.
  v_table := public.duel_open_table_for(auth.uid(), p_lang);
  if v_table is not null then
    perform 1 from public.duel_tables where id = v_table for update;
    if public.duel_active_seats(v_table) < 4 then
      insert into public.duel_seats (table_id, player, owned)
      values (v_table, auth.uid(), greatest(0, least(coalesce(p_owned, 0), 999)));
      delete from public.duel_queue where player = auth.uid();
      return jsonb_build_object('status', 'matched', 'table', v_table);
    end if;
  end if;

  select * into v_other from public.duel_queue q
   where q.table_id is null and q.player <> auth.uid() and q.lang = p_lang
     and not exists (
       select 1 from public.blocks b
        where (b.blocker = auth.uid() and b.blocked = q.player) or (b.blocker = q.player and b.blocked = auth.uid())
     )
   order by q.joined_at
   limit 1
   for update skip locked;

  if not found then
    insert into public.duel_queue (player, lang, owned, categories)
    values (auth.uid(), p_lang, greatest(0, least(coalesce(p_owned, 0), 999)), p_categories)
    on conflict (player) do update
      set lang = excluded.lang, owned = excluded.owned, categories = excluded.categories,
          seen_at = now(), table_id = null;
    return jsonb_build_object('status', 'waiting');
  end if;

  -- L'hôte est celui qui attendait ; les deux sont assis, pas prêts.
  insert into public.duel_tables (host, lang, seed, categories)
  values (v_other.player, v_other.lang, floor(random() * 4294967295)::bigint, v_other.categories)
  returning id into v_table;
  insert into public.duel_seats (table_id, player, owned, joined_at)
  values (v_table, v_other.player, v_other.owned, clock_timestamp()),
         (v_table, auth.uid(), greatest(0, least(coalesce(p_owned, 0), 999)), clock_timestamp() + interval '1 millisecond');
  update public.duel_queue set table_id = v_table, seen_at = now() where player = v_other.player;
  delete from public.duel_queue where player = auth.uid();
  return jsonb_build_object('status', 'matched', 'table', v_table);
end;
$$;

-- La lecture de 0050, qui dit en plus si la table est ouverte au public.
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
      'rematch', v_table.rematch,
      'public', v_table.listed
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

revoke execute on function
  public.duel_set_public(uuid, boolean),
  public.duel_open_table_for(uuid, text)
  from public, anon, authenticated;

grant execute on function public.duel_set_public(uuid, boolean) to authenticated;
