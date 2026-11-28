-- Les canaux Realtime du duel (0121) : seuls ceux qui lisent la table par
-- `duel_sync` entendent son canal. Les déclencheurs qui y sonnaient à chaque
-- écriture sont retirés (0126) tant qu'aucun client n'écoute.

select tests.new_user(n) from unnest(array['rh', 'rf', 'rx']) n;
select tests.befriend('rh', 'rf');

-- Ce que le test lit derrière le dos des politiques.
create function tests.last_ring(p_topic text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('event', event, 'payload', payload, 'private', private)
    from realtime.messages where topic = p_topic order by inserted_at desc, id desc limit 1
$$;
create function tests.clear_journal(p_table uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.duel_moves where table_id = p_table
$$;
-- Ce que fait le serveur Realtime quand un client rejoint un canal privé :
-- lire `realtime.messages` sous le rôle du client, le canal posé dans `realtime.topic`.
create function tests.hears(p_topic text) returns boolean
language plpgsql as $$
declare
  v_seen integer;
begin
  perform set_config('realtime.topic', p_topic, false);
  select count(*) into v_seen from realtime.messages where topic = realtime.topic();
  perform set_config('realtime.topic', '', false);
  return v_seen > 0;
end;
$$;

select tests.login('rh');
create temp table rt as select public.duel_create('fr', array['animaux', 'pays'], 2) as id;
grant select on rt to authenticated, anon;
select tests.logout();
create temp table topics as select 'duel:' || id as duel, 'duel-invites:' || tests.uid('rf') as invites from rt;
grant select on topics to authenticated, anon;

create function tests.seat_at(p_table uuid, p_label text) returns int
language sql stable security definer set search_path = public as $$
  select seat::int from public.duel_seats where table_id = p_table and player = tests.uid(p_label)
$$;
create function tests.all_rings() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from realtime.messages
$$;
-- La sonnette elle-même reste, pour le jour où un client écoute.
create function tests.ring_by_hand(p_topic text) returns void
language sql security definer set search_path = public as $$
  select public.duel_ring(p_topic, 'moves')
$$;

-- Plus aucune écriture du duel ne sonne (0126) : sans service Realtime, chaque
-- `realtime.send` était refusé en production, faute de partition.
select tests.login('rh');
select tests.is(public.duel_invite((select id from rt), tests.uid('rf')), 'sent', 'the host invites a friend');
select tests.logout();
select tests.login('rf');
select tests.is(public.duel_join((select id from rt), 3), 'joined', 'the friend sits down');
select tests.is(public.duel_ready((select id from rt), true), 'waiting', 'the friend is ready');
select tests.logout();
select tests.login('rh');
select tests.is(public.duel_ready((select id from rt), true), 'started', 'the host launches the table');
select tests.is(public.duel_move((select id from rt), 1, tests.seat_at((select id from rt), 'rh'), 'pick', 'animaux'), 'ok', 'the host picks');
select public.duel_sync((select id from rt), 0) is not null as synced;
select tests.logout();
select tests.clear_journal((select id from rt));
select tests.is(tests.all_rings(), 0, 'no duel write rings any more (0126)');

select tests.ring_by_hand((select duel from topics));
select tests.ring_by_hand((select invites from topics));
select tests.is(tests.last_ring((select invites from topics)), '{"event": "moves", "payload": {}, "private": true}'::jsonb, 'the doorbell still rings on a private channel when called');

-- ------------------------------------------------------ qui entend quoi --

select tests.login('rf');
select tests.ok(tests.hears((select duel from topics)), 'a seated player hears the table');
select tests.ok(tests.hears((select invites from topics)), 'and their own invitations');
select tests.throws(
  $$insert into realtime.messages (topic, extension, event, payload) select duel, 'broadcast', 'moves', '{}' from topics$$,
  'but rings nothing themselves', '42501'
);
select tests.throws($$select public.duel_ring('duel:x', 'moves')$$, 'nor calls the doorbell', '42501');
select tests.logout();

select tests.login('rh');
select tests.ok(not tests.hears((select invites from topics)), 'nobody hears another player''s invitations');
select tests.logout();

select tests.login('rx');
select tests.ok(not tests.hears((select duel from topics)), 'a stranger does not hear the table');
select tests.ok(not tests.hears('duel:not-a-table'), 'a malformed channel is simply closed');
select tests.logout();

select tests.login_anon();
select tests.ok(not tests.hears((select duel from topics)), 'nor does a request without a session');
select tests.logout();
