-- Les sonneries Realtime du duel (0119) : chaque écriture qui change ce que la
-- table montre sonne une fois sur son canal privé, sans rien porter de plus que
-- l'écran, et seuls ceux qui lisent la table par `duel_sync` l'entendent.

select tests.new_user(n) from unnest(array['rh', 'rf', 'rx']) n;
select tests.befriend('rh', 'rf');

-- Ce que le test lit derrière le dos des politiques.
create function tests.rings(p_topic text) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from realtime.messages where topic = p_topic
$$;
create function tests.rings(p_topic text, p_event text) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from realtime.messages where topic = p_topic and event = p_event
$$;
create function tests.last_ring(p_topic text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('event', event, 'payload', payload, 'private', private)
    from realtime.messages where topic = p_topic order by inserted_at desc, id desc limit 1
$$;
create function tests.age_seen(p_table uuid) returns void
language sql security definer set search_path = public as $$
  update public.duel_seats set last_seen = clock_timestamp() - interval '1 minute' where table_id = p_table
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

select tests.is(tests.rings((select duel from topics), 'seats'), 1, 'the host sitting down rings the table once');
select tests.is((tests.last_ring((select duel from topics)) ->> 'private')::boolean, true, 'on a private channel');

-- ------------------------------------------------------------ invitation --

select tests.login('rh');
select tests.is(public.duel_invite((select id from rt), tests.uid('rf')), 'sent', 'the host invites a friend');
select tests.logout();
select tests.is(tests.rings((select invites from topics)), 1, 'the invitee hears it on their own channel');
select tests.is(tests.last_ring((select invites from topics)) -> 'payload', '{}'::jsonb, 'with nothing but the doorbell');
select tests.is(tests.rings((select duel from topics), 'invites'), 1, 'and the host lobby hears it too');

-- --------------------------------------------------------- la relecture --

-- Chaque lecture rafraîchit `last_seen` : si elle sonnait, chaque lecture
-- réveillerait toute la table, qui relirait sans fin.
select tests.age_seen((select id from rt));
select tests.login('rh');
create temp table before_sync as select tests.rings((select duel from topics)) as n;
select public.duel_sync((select id from rt), 0) is not null as synced;
select tests.is(tests.rings((select duel from topics)), (select n from before_sync), 'a read that only refreshes last_seen never rings');
select tests.logout();

-- --------------------------------------------------------- le salon --

select tests.login('rf');
select tests.is(public.duel_join((select id from rt), 3), 'joined', 'the friend sits down');
select tests.logout();
select tests.ok(tests.rings((select duel from topics), 'seats') >= 2, 'a new seat rings the table');
select tests.ok(tests.rings((select invites from topics)) >= 2, 'the answered invitation rings the invitee again, so the card leaves home');

select tests.login('rf');
select tests.is(public.duel_ready((select id from rt), true), 'waiting', 'the friend is ready');
select tests.logout();
select tests.login('rh');
create temp table before_start as select tests.rings((select duel from topics), 'table') as n;
select tests.is(public.duel_ready((select id from rt), true), 'started', 'the host launches the table');
select tests.is(tests.rings((select duel from topics), 'table'), (select n from before_start) + 1, 'the launch rings the table once');

select tests.logout();

-- ------------------------------------------------------------ les coups --

create function tests.seat_at(p_table uuid, p_label text) returns int
language sql stable security definer set search_path = public as $$
  select seat::int from public.duel_seats where table_id = p_table and player = tests.uid(p_label)
$$;

select tests.login('rh');
select tests.is(public.duel_move((select id from rt), 1, tests.seat_at((select id from rt), 'rh'), 'pick', 'animaux'), 'ok', 'the host picks');
select tests.is(tests.last_ring((select duel from topics)), '{"event": "moves", "payload": {"seq": 1}, "private": true}'::jsonb, 'a move rings with its number alone');
select tests.logout();
select tests.login('rf');
select tests.is(public.duel_move((select id from rt), 2, tests.seat_at((select id from rt), 'rf'), 'pick', 'pays'), 'ok', 'the friend picks');
select tests.logout();
select tests.is(tests.rings((select duel from topics), 'moves'), 2, 'one ring per move');

-- Un journal effacé d'un coup (`duel_unstart`) sonne une fois, pas une par coup.
select tests.clear_journal((select id from rt));
select tests.is(tests.rings((select duel from topics), 'moves'), 3, 'clearing the journal rings once');
select tests.is(tests.last_ring((select duel from topics)) -> 'payload', '{"seq": 0}'::jsonb, 'with the journal back at zero');

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
