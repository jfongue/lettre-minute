-- Rejoindre une table par la salle du portail (0104) : sans invitation, mais
-- jamais à côté de quelqu'un qui bloque ou qu'on bloque.

select tests.new_user(n) from unnest(array['rh', 'ra', 'rb', 'rc', 'rd', 're']) n;
select tests.new_user('rn', true);

create function tests.seated(p_table uuid, p_label text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.duel_seats where table_id = p_table and player = tests.uid(p_label) and left_at is null and kicked_at is null)
$$;
create function tests.pending_invite(p_table uuid, p_label text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.duel_invites where table_id = p_table and invitee = tests.uid(p_label) and answered_at is null)
$$;
create function tests.block(p_blocker text, p_blocked text) returns void
language sql security definer set search_path = public as $$
  insert into public.blocks (blocker, blocked) values (tests.uid(p_blocker), tests.uid(p_blocked))
$$;

select tests.login('rh');
create temp table room as select public.duel_create('en', array['animaux', 'pays'], 4) as id;
grant select on room to public;
select tests.logout();

select tests.login('ra');
select tests.is(public.duel_join((select id from room), 3), 'forbidden', 'an uninvited player still cannot join by the table alone');
select tests.is(public.duel_join_room((select id from room), 3), 'joined', 'but the room the portal shares seats him');
select tests.is(public.duel_join_room((select id from room), 3), 'joined', 'and answers the same when he is already there');
select tests.logout();
select tests.ok(tests.seated((select id from room), 'ra'), 'he holds a seat');
select tests.ok(not tests.pending_invite((select id from room), 'ra'), 'with no invitation left waiting on his home screen');

select tests.login('rn');
select tests.is(public.duel_join_room((select id from room), 3), 'forbidden', 'an anonymous player joins no room');
select tests.logout();

-- Un blocage dans un sens ou dans l'autre ferme la salle, sans le dire.
select tests.block('ra', 'rb');
select tests.login('rb');
select tests.is(public.duel_join_room((select id from room), 3), 'closed', 'a player blocked by someone seated reads a closed table');
select tests.logout();
select tests.ok(not tests.pending_invite((select id from room), 'rb'), 'and keeps no invitation');
select tests.block('rc', 'rh');
select tests.login('rc');
select tests.is(public.duel_join_room((select id from room), 3), 'closed', 'nor does one who blocked the host');
select tests.logout();

-- Quatre places, pas une de plus.
select tests.login('rd');
select tests.is(public.duel_join_room((select id from room), 3), 'joined', 'the third player sits down');
select tests.logout();
select tests.login('re');
select tests.is(public.duel_join_room((select id from room), 3), 'joined', 'the fourth too');
select tests.logout();
select tests.new_user('rf');
select tests.login('rf');
select tests.is(public.duel_join_room((select id from room), 3), 'full', 'a fifth finds the table full');
select tests.logout();
select tests.ok(not tests.pending_invite((select id from room), 'rf'), 'and keeps no invitation');

-- Un expulsé ne revient pas par la salle.
select tests.login('rh');
select public.duel_kick((select id from room), tests.uid('re'));
select tests.logout();
select tests.login('re');
select tests.is(public.duel_join_room((select id from room), 3), 'kicked', 'a kicked player cannot come back through the room');
select tests.logout();
