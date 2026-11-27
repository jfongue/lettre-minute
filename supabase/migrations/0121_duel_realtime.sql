-- Le duel prévenu par Realtime plutôt que relu à l'aveugle — le terrain
-- seulement : aucun client ne s'abonne encore (docs/realtime-migration.md).
--
-- Broadcast depuis la base, pas Postgres Changes : les quatre tables du duel
-- n'ont aucune politique et doivent le rester (tout passe par les fonctions
-- `duel_*`), et Postgres Changes ne livre une ligne qu'à qui peut la lire. Ici
-- chaque écriture qui change ce qu'une table montre sonne sur un canal privé,
-- `duel:<table>` pour ceux qui y sont assis, `duel-invites:<joueur>` pour
-- l'invité, et le message ne porte rien qui ne soit déjà à l'écran : l'appareil
-- réveillé relit `duel_sync` ou `duel_my_invites` comme aujourd'hui. Un message
-- perdu ou doublé coûte une lecture, jamais une partie fausse — le journal
-- reste ordonné par `seq`, et le relevé lent du client reste le filet.
--
-- Une sonnerie par instruction et par table (déclencheurs d'instruction, tables
-- de transition) : l'effacement d'un journal par `duel_unstart` sonne une fois,
-- pas une fois par coup. `last_seen`, que chaque lecture rafraîchit toutes les
-- deux secondes, ne sonne jamais : chaque lecture réveillerait toute la table,
-- qui relirait, et ainsi de suite. Le meneur absent se voit au relevé lent.
--
-- Ni publication `supabase_realtime` ni `replica identity` : ils ne servent
-- qu'à Postgres Changes. Aucune politique d'écriture sur `realtime.messages` :
-- un client ne peut pas sonner lui-même sur ces canaux.

create function public.duel_ring(p_topic text, p_event text, p_payload jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(p_payload, p_event, p_topic, true);
exception when others then
  -- Une sonnerie manquée ne coûte qu'une lecture ; un coup refusé coûterait la partie.
  raise warning 'duel_ring %: %', p_topic, sqlerrm;
end;
$$;

revoke execute on function public.duel_ring(text, text, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------- le journal --

create function public.duel_ring_moves() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.duel_ring('duel:' || table_id, 'moves', jsonb_build_object('seq', max(seq)))
       from fresh group by table_id;
  else
    perform public.duel_ring('duel:' || table_id, 'moves', jsonb_build_object('seq', 0))
       from (select distinct table_id from gone) cleared;
  end if;
  return null;
end;
$$;

create trigger duel_moves_ring_insert after insert on public.duel_moves
  referencing new table as fresh for each statement execute function public.duel_ring_moves();
create trigger duel_moves_ring_delete after delete on public.duel_moves
  referencing old table as gone for each statement execute function public.duel_ring_moves();

-- ------------------------------------------------------------- la table --

create function public.duel_ring_tables() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.duel_ring('duel:' || n.id, 'table')
     from fresh n join gone o on o.id = n.id
    where (n.status, n.started_at, n.rematch, n.listed, n.seed, n.categories, n.host)
          is distinct from (o.status, o.started_at, o.rematch, o.listed, o.seed, o.categories, o.host);
  -- Une table qui quitte le salon retire ses invitations des accueils.
  perform public.duel_ring('duel-invites:' || i.invitee, 'invites')
     from fresh n join gone o on o.id = n.id
     join public.duel_invites i on i.table_id = n.id and i.answered_at is null
    where n.status is distinct from o.status;
  return null;
end;
$$;

create trigger duel_tables_ring after update on public.duel_tables
  referencing new table as fresh old table as gone for each statement execute function public.duel_ring_tables();

-- ----------------------------------------------------------- les places --

create function public.duel_ring_seats() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    perform public.duel_ring('duel:' || table_id, 'seats')
       from (
         select distinct n.table_id from fresh n join gone o using (table_id, player)
          where (n.ready, n.seat, n.left_at, n.kicked_at, n.owned, n.is_bot)
                is distinct from (o.ready, o.seat, o.left_at, o.kicked_at, o.owned, o.is_bot)
       ) changed;
  elsif tg_op = 'INSERT' then
    perform public.duel_ring('duel:' || table_id, 'seats') from (select distinct table_id from fresh) seated;
  else
    perform public.duel_ring('duel:' || table_id, 'seats') from (select distinct table_id from gone) left_;
  end if;
  return null;
end;
$$;

create trigger duel_seats_ring_insert after insert on public.duel_seats
  referencing new table as fresh for each statement execute function public.duel_ring_seats();
create trigger duel_seats_ring_update after update on public.duel_seats
  referencing new table as fresh old table as gone for each statement execute function public.duel_ring_seats();
create trigger duel_seats_ring_delete after delete on public.duel_seats
  referencing old table as gone for each statement execute function public.duel_ring_seats();

-- ------------------------------------------------------ les invitations --

-- Le salon de l'hôte montre ses invitations en attente, l'accueil de l'invité
-- sa carte : les deux sonnent. Une mise à jour ne sonne que si l'invitation
-- est posée de nouveau ou répondue : `queued_at` et `cancelled_at` ne sont que
-- la comptabilité des notifications push (0060).
create function public.duel_ring_invites() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    perform public.duel_ring(topic, 'invites') from (
      select distinct v.topic
        from fresh n join gone o using (table_id, invitee)
       cross join lateral (values ('duel:' || n.table_id), ('duel-invites:' || n.invitee)) v(topic)
       where (n.created_at, n.answered_at) is distinct from (o.created_at, o.answered_at)
    ) rung;
  elsif tg_op = 'INSERT' then
    perform public.duel_ring(topic, 'invites') from (
      select distinct v.topic from fresh n
       cross join lateral (values ('duel:' || n.table_id), ('duel-invites:' || n.invitee)) v(topic)
    ) rung;
  else
    perform public.duel_ring(topic, 'invites') from (
      select distinct v.topic from gone o
       cross join lateral (values ('duel:' || o.table_id), ('duel-invites:' || o.invitee)) v(topic)
    ) rung;
  end if;
  return null;
end;
$$;

create trigger duel_invites_ring_insert after insert on public.duel_invites
  referencing new table as fresh for each statement execute function public.duel_ring_invites();
create trigger duel_invites_ring_update after update on public.duel_invites
  referencing new table as fresh old table as gone for each statement execute function public.duel_ring_invites();
create trigger duel_invites_ring_delete after delete on public.duel_invites
  referencing old table as gone for each statement execute function public.duel_ring_invites();

revoke execute on function
  public.duel_ring_moves(), public.duel_ring_tables(), public.duel_ring_seats(), public.duel_ring_invites()
  from public, anon, authenticated;

-- ------------------------------------------------------- qui entend quoi --

-- Celui qui lit la table par `duel_sync` entend son canal : la même règle, une
-- place à son nom, partie ou expulsée comprise — l'expulsé doit apprendre qu'il
-- l'est.
create function public.duel_channel_member(p_topic text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_topic ~ '^duel:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and exists (
       select 1 from public.duel_seats
        where table_id = substr(p_topic, 6)::uuid and player = auth.uid()
     );
$$;

revoke execute on function public.duel_channel_member(text) from public, anon;
grant execute on function public.duel_channel_member(text) to authenticated;

create policy duel_channels_listen on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (
    realtime.topic() = 'duel-invites:' || auth.uid()::text
    or public.duel_channel_member(realtime.topic())
  )
);
