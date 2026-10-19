-- Les tables publiques du duel (0097) : l'hôte ouvre son salon au public, et la
-- file du matchmaking y assoit ses joueurs avant de les apparier entre eux.

select tests.new_user(n) from unnest(array['ph', 'pa', 'pb', 'pc', 'pd', 'pe', 'pf', 'pg', 'pi', 'px']) n;

create function tests.seats(p_table uuid) returns integer
language sql stable security definer set search_path = public as $$ select public.duel_active_seats(p_table) $$;
create function tests.queued(p_label text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.duel_queue where player = tests.uid(p_label))
$$;
create function tests.seated(p_table uuid, p_label text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.duel_seats where table_id = p_table and player = tests.uid(p_label) and left_at is null and kicked_at is null)
$$;
create function tests.block(p_blocker text, p_blocked text) returns void
language sql security definer set search_path = public as $$
  insert into public.blocks (blocker, blocked) values (tests.uid(p_blocker), tests.uid(p_blocked))
$$;
create function tests.age_table(p_table uuid, p_minutes int) returns void
language sql security definer set search_path = public as $$
  update public.duel_tables set created_at = now() - make_interval(mins => p_minutes) where id = p_table
$$;

-- ------------------------------------------------------------ l'interrupteur --

select tests.login('ph');
create temp table hosted as select public.duel_create('fr', array['animaux', 'pays'], 4) as id;
select tests.is((public.duel_sync((select id from hosted), 0) -> 'table' ->> 'public')::boolean, false, 'a new table is private');
select tests.is(public.duel_set_public((select id from hosted), true), 'public', 'the host opens the table to the public');
select tests.is((public.duel_sync((select id from hosted), 0) -> 'table' ->> 'public')::boolean, true, 'the table reads as public');
select tests.is(public.duel_set_public((select id from hosted), false), 'private', 'the host closes it again');
select tests.is(public.duel_set_public((select id from hosted), true), 'public', 'and opens it once more');
select tests.logout();

select tests.login('pa');
select tests.is(public.duel_set_public((select id from hosted), false), 'forbidden', 'only the host flips the switch');
select tests.logout();

select tests.login_anon();
select tests.throws($$select public.duel_set_public((select id from hosted), true)$$, 'an anonymous caller cannot reach the switch', '42501');
select tests.logout();

-- -------------------------------------------------------------- la file --

-- Le premier de la file trouve la table publique au lieu d'attendre.
select tests.login('pa');
create temp table first_seat as select public.duel_matchmake('fr', array['couleurs'], 2) as answer;
select tests.is((select answer ->> 'status' from first_seat), 'matched', 'a queued player is seated at a public table at once');
select tests.is((select answer ->> 'table' from first_seat), (select id::text from hosted), 'at the open table');
select tests.logout();
select tests.ok(tests.seated((select id from hosted), 'pa'), 'the player holds a seat');
select tests.ok(not tests.queued('pa'), 'and left the queue');

-- Une autre langue n'y est pas assise.
select tests.login('pb');
select tests.is(public.duel_matchmake('en', array['animals'], 2) ->> 'status', 'waiting', 'another language keeps waiting');
select public.duel_matchmake_cancel();
select tests.logout();

-- Un blocage avec un joueur assis, dans un sens ou dans l'autre, tient la table hors de portée.
select tests.block('pa', 'pb');
select tests.login('pb');
select tests.is(public.duel_matchmake('fr', array['animaux'], 2) ->> 'status', 'waiting', 'a player blocked by someone seated is not seated');
select public.duel_matchmake_cancel();
select tests.logout();
select tests.block('pc', 'ph');
select tests.login('pc');
select tests.is(public.duel_matchmake('fr', array['animaux'], 2) ->> 'status', 'waiting', 'a player who blocked someone seated is not seated');
select public.duel_matchmake_cancel();
select tests.logout();

-- L'hôte se déclare prêt, le joueur de la file aussi : la table part.
select tests.login('ph');
select tests.is(public.duel_ready((select id from hosted), true), 'waiting', 'the host is ready');
select tests.logout();
select tests.login('pa');
select tests.is(public.duel_ready((select id from hosted), true), 'started', 'the seated player''s ready starts the table');
select tests.logout();

-- Lancée, la table n'accueille plus personne : la file reprend son appariement.
select tests.login('pd');
select tests.is(public.duel_matchmake('fr', array['animaux'], 2) ->> 'status', 'waiting', 'a started table takes no one');
select tests.logout();
select tests.login('pe');
select tests.is(public.duel_matchmake('fr', array['animaux'], 2) ->> 'status', 'matched', 'two queued players pair as before');
select tests.logout();
select tests.login('pd');
select tests.is(public.duel_matchmake('fr', array['animaux'], 2) ->> 'status', 'matched', 'the one who waited finds the pair''s table');
select tests.logout();

-- ------------------------------------------------- pleine, expulsée, fermée --

select tests.login('ph');
create temp table second as select public.duel_create('fr', array['animaux'], 4) as id;
select public.duel_set_public((select id from second), true);
select tests.logout();

-- Trois joueurs de la file la remplissent ; la quatrième place prise, elle ne s'ouvre plus.
select tests.login('pf');
select tests.is(public.duel_matchmake('fr', array['animaux'], 2) ->> 'table', (select id::text from second), 'the open table seats a second player');
select tests.logout();
select tests.login('px');
select tests.is(public.duel_matchmake('fr', array['animaux'], 2) ->> 'table', (select id::text from second), 'and a third');
select tests.logout();

-- L'hôte retire un joueur : la file ne le rassoit pas.
select tests.login('ph');
select tests.is(public.duel_kick((select id from second), tests.uid('px')), 'kicked', 'the host keeps the kick');
select tests.logout();
select tests.login('px');
select tests.is(public.duel_matchmake('fr', array['animaux'], 2) ->> 'status', 'waiting', 'a kicked player is not seated again');
select public.duel_matchmake_cancel();
select tests.logout();

select tests.login('pd');
select tests.is(public.duel_matchmake('fr', array['animaux'], 2) ->> 'table', (select id::text from second), 'the freed seat goes to the next in line');
select tests.logout();
select tests.login('pb');
select tests.is(public.duel_matchmake('fr', array['animaux'], 2) ->> 'table', (select id::text from second), 'the fourth seat is taken');
select tests.logout();
select tests.is(tests.seats((select id from second)), 4, 'the table is full');

select tests.login('ph');
select tests.is(public.duel_set_public((select id from second), true), 'full', 'a full table cannot be opened');
select tests.logout();

select tests.login('pg');
select tests.is(public.duel_matchmake('fr', array['animaux'], 2) ->> 'status', 'waiting', 'a full table takes no one');
select public.duel_matchmake_cancel();
select tests.logout();

-- Un salon de plus d'un quart d'heure est oublié, même public.
select tests.login('ph');
create temp table stale as select public.duel_create('fr', array['animaux'], 4) as id;
select public.duel_set_public((select id from stale), true);
select tests.logout();
select tests.age_table((select id from stale), 20);
select tests.login('pi');
select tests.is(public.duel_matchmake('fr', array['animaux'], 2) ->> 'status', 'waiting', 'an old lobby takes no one');
select tests.logout();
select tests.login('ph');
select tests.is(public.duel_set_public((select id from stale), false), 'closed', 'its switch is closed too');
select tests.logout();
