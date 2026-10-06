-- Le duel en ligne (0046) : la table, ses invitations, son lancement, son
-- journal de coups et la revanche. Le serveur ne joue pas : il tient l'ordre
-- des coups et vérifie qui parle.

select tests.new_user(n) from unnest(array['dh', 'df', 'dg', 'dx', 'dk']) n;

-- Ce que le test lit derrière le dos des politiques : les tables du duel n'en
-- ont aucune, un joueur n'y voit rien hors des fonctions.
create function tests.bot() returns uuid
language sql stable security definer set search_path = public as $$ select id from public.bots order by id limit 1 $$;
create function tests.bots() returns integer
language sql stable security definer set search_path = public as $$ select count(*)::int from public.bots $$;
create function tests.seats(p_table uuid) returns integer
language sql stable security definer set search_path = public as $$ select public.duel_active_seats(p_table) $$;
create function tests.duel_status(p_table uuid) returns text
language sql stable security definer set search_path = public as $$ select status from public.duel_tables where id = p_table $$;
create function tests.duel_host(p_table uuid) returns uuid
language sql stable security definer set search_path = public as $$ select host from public.duel_tables where id = p_table $$;
create function tests.seat_numbers(p_table uuid) returns int[]
language sql stable security definer set search_path = public as $$
  select array_agg(seat order by seat)::int[] from public.duel_seats where table_id = p_table and seat is not null
$$;
create function tests.seat_of(p_table uuid, p_label text) returns int
language sql stable security definer set search_path = public as $$
  select seat::int from public.duel_seats where table_id = p_table and player = tests.uid(p_label)
$$;
-- Vieillit la dernière lecture d'une place : c'est ce qui fait d'un joueur un
-- absent, celui dont le meneur déclare le temps écoulé.
create function tests.age_seat(p_table uuid, p_seat int, p_seconds int) returns void
language sql security definer set search_path = public as $$
  update public.duel_seats set last_seen = clock_timestamp() - make_interval(secs => p_seconds)
   where table_id = p_table and seat = p_seat
$$;
select tests.new_user('dn', true);
select tests.befriend('dh', 'df');
select tests.befriend('dh', 'dk');
select tests.befriend('dg', 'dh');

-- ------------------------------------------------------------- salon --

select tests.login('dn');
select tests.throws($$select public.duel_create('fr', array['animaux'], 3)$$, 'an anonymous player opens no table', '42501');
select tests.logout();

select tests.login('dh');
create temp table duel as select public.duel_create('fr', array['animaux', 'pays', 'couleurs'], 3) as id;
grant select on duel to public;
select tests.is(tests.seats((select id from duel)), 1, 'the host sits at the table he opens');
select tests.is(
  (select count(*)::int from public.duel_candidates() where bot),
  tests.bots(), 'the house players are offered to every host'
);
select tests.ok(exists (select 1 from public.duel_candidates() where display_name = 'df' and not bot), 'and so are his friends');
select tests.ok(not exists (select 1 from public.duel_candidates() where display_name = 'dx'), 'but not strangers');
select tests.is(public.duel_invite((select id from duel), tests.uid('dx')), 'forbidden', 'a stranger is not invited');
select tests.is(public.duel_invite((select id from duel), tests.uid('df')), 'sent', 'a friend is');
select tests.is(public.duel_invite((select id from duel), tests.uid('dk')), 'sent', 'and another one');
select tests.is(
  public.duel_invite((select id from duel), tests.bot()), 'seated', 'a house player sits down at once'
);
select tests.is(tests.seats((select id from duel)), 2, 'host and house player are seated');
select tests.logout();

select tests.login('df');
select tests.is((select count(*)::int from public.duel_my_invites()), 1, 'the friend sees his invitation');
select tests.is((select host_name from public.duel_my_invites()), 'dh', 'named after the host');
select tests.is(public.duel_invite((select id from duel), tests.uid('dg')), 'forbidden', 'a guest invites nobody');
select tests.is(public.duel_join((select id from duel), 5), 'joined', 'and takes his seat');
select tests.is((select count(*)::int from public.duel_my_invites()), 0, 'the invitation is answered');
select tests.logout();

select tests.login('dg');
select tests.is(public.duel_join((select id from duel), 5), 'forbidden', 'nobody joins uninvited');
select tests.is(public.duel_sync((select id from duel), 0), null::jsonb, 'nor reads the table');
select tests.logout();

select tests.login('dk');
select tests.is(public.duel_join((select id from duel), 2), 'joined', 'the second friend sits down');
select tests.logout();

-- L'hôte expulse le second ami, qui l'apprend en relisant la table.
select tests.login('dh');
select tests.is(public.duel_kick((select id from duel), tests.uid('dk')), 'kicked', 'the host kicks a guest');
select tests.logout();
select tests.login('dk');
select tests.is(
  (select (s ->> 'kicked')::boolean from jsonb_array_elements(public.duel_sync((select id from duel), 0) -> 'seats') s
    where s ->> 'player' = tests.uid('dk')::text),
  true, 'the kicked player reads that he was kicked'
);
select tests.is(public.duel_join((select id from duel), 2), 'kicked', 'and cannot come back');
select tests.is(public.duel_ready((select id from duel), true), 'closed', 'nor declare himself ready');
select tests.logout();

select tests.login('df');
select tests.is(public.duel_kick((select id from duel), tests.uid('dh')), 'forbidden', 'only the host kicks');
select tests.is(public.duel_ready((select id from duel), true), 'waiting', 'the friend is ready, the host is not');
select tests.logout();

select tests.login('dh');
select tests.is(public.duel_ready((select id from duel), true), 'started', 'the last ready launches the table');
select tests.is(tests.duel_status((select id from duel)), 'playing', 'the table is playing');
select tests.is(tests.seat_numbers((select id from duel)), array[0, 1, 2], 'three seats numbered in arrival order');
select tests.is(tests.seat_of((select id from duel), 'dh'), 0, 'the host first');
select tests.is(tests.seat_of((select id from duel), 'dk'), null::int, 'and no seat for the kicked player');
select tests.is(public.duel_kick((select id from duel), tests.uid('df')), 'closed', 'nobody is kicked once the game is on');

-- --------------------------------------------------------------- coups --

select tests.is(public.duel_move((select id from duel), 1, 0, 'pick', 'animaux'), 'ok', 'the host picks his category');
select tests.is(public.duel_move((select id from duel), 1, 1, 'pick', 'pays'), 'stale', 'a move at a number already taken is stale');
select tests.is(public.duel_move((select id from duel), 3, 1, 'pick', 'pays'), 'stale', 'so is one that skips a number');
select tests.is(public.duel_move((select id from duel), 2, 1, 'pick', 'pays'), 'ok', 'anyone seated may play the house player');
select tests.is(public.duel_move((select id from duel), 3, 2, 'word', 'chat'), 'forbidden', 'but not a word for another player');
-- Le temps écoulé d'un autre ne se déclare que pour un absent (0049) : le test
-- vieillit la dernière lecture de sa place avant de le lui faire déclarer.
select tests.age_seat((select id from duel), 2, 60);
select tests.is(public.duel_move((select id from duel), 3, 2, 'timeout', ''), 'ok', 'a timeout for an absent player is fine');
select tests.is(public.duel_move((select id from duel), 4, 2, 'dance', ''), 'forbidden', 'an unknown kind of move is refused');
select tests.is(
  jsonb_array_length(public.duel_sync((select id from duel), 1) -> 'moves'), 2, 'the sync returns the moves after a number'
);
select tests.is(
  (public.duel_sync((select id from duel), 0) -> 'moves' -> 0 ->> 'payload'), 'animaux', 'in order, with their payload'
);
select tests.ok((public.duel_sync((select id from duel), 0) ->> 'now')::numeric > 0, 'with the server clock');
-- Le mot d'un joueur maison, lui, est déclaré par le meneur (0049) : sans lui,
-- la table resterait à jamais sur son tour.
select tests.is(public.duel_move((select id from duel), 4, 1, 'word', 'chat'), 'ok', 'a seated player plays the house player''s word');
select tests.is(public.duel_move((select id from duel), 5, 1, 'pass', ''), 'ok', 'and his pass');
select tests.is(public.duel_move((select id from duel), 6, 2, 'cheer', 'animaux'), 'forbidden', 'nobody cheers from another seat');
select tests.is(public.duel_move((select id from duel), 6, 1, 'cheer', 'animaux'), 'forbidden', 'nor for a house player');
select tests.is(public.duel_move((select id from duel), 6, 0, 'cheer', 'animaux'), 'ok', 'a player cheers from his own');
select tests.age_seat((select id from duel), 2, 0);
select tests.is(public.duel_move((select id from duel), 7, 2, 'timeout', ''), 'forbidden', 'a player still reading his table is not timed out by another');
select tests.throws($$insert into public.duel_moves (table_id, seq, seat, kind) values ((select id from duel), 9, 0, 'pass')$$,
  'nobody writes the journal directly');
select tests.logout();

select tests.login('dx');
select tests.is(public.duel_move((select id from duel), 4, 0, 'pass', ''), 'forbidden', 'a stranger plays no move');
select tests.logout();

-- ---------------------------------------------------------- revanche --

select tests.login('df');
select public.duel_finish((select id from duel));
select tests.is(tests.duel_status((select id from duel)), 'over', 'a seated player closes the game');
create temp table rematch as select public.duel_rematch((select id from duel), 5) as id;
grant select on rematch to public;
select tests.is(public.duel_rematch((select id from duel), 5), (select id from rematch), 'one rematch per table, whoever asks');
select tests.is(tests.duel_host((select id from rematch)), tests.uid('df'), 'hosted by who opened it');
select tests.is(tests.seats((select id from rematch)), 2, 'the house player sits down again');
select tests.logout();

select tests.login('dh');
select tests.is((select table_id from public.duel_my_invites()), (select id from rematch), 'the old host is invited to it');
select tests.logout();

select tests.login('dk');
select tests.is((select count(*)::int from public.duel_my_invites()), 0, 'the kicked player is not');
select tests.logout();

-- L'hôte d'un salon qui part le ferme.
select tests.login('df');
select public.duel_leave((select id from rematch));
select tests.is(tests.duel_status((select id from rematch)), 'closed', 'a host leaving his lobby closes it');
select tests.logout();
select tests.login('dh');
select tests.is(public.duel_join((select id from rematch), 1), 'closed', 'and nobody joins a closed table');
select tests.logout();

-- -------------------------------------------------------------- quitter --

-- Une place libérée en pleine partie laisse la table jouer : les autres
-- continuent, et le meneur suivant prend la main. Dès qu'il ne reste plus un
-- humain, la table se ferme (0049).
select tests.login('dh');
create temp table abandon as select public.duel_create('fr', array['animaux', 'pays'], 4) as id;
grant select on abandon to public;
select public.duel_invite((select id from abandon), tests.bot());
select public.duel_invite((select id from abandon), tests.uid('df'));
select public.duel_invite((select id from abandon), tests.uid('dk'));
select tests.logout();

select tests.login('df');
select public.duel_join((select id from abandon), 5);
select public.duel_ready((select id from abandon), true);
select tests.logout();
select tests.login('dk');
select public.duel_join((select id from abandon), 5);
select public.duel_ready((select id from abandon), true);
select tests.logout();
select tests.login('dh');
select tests.is(public.duel_ready((select id from abandon), true), 'started', 'three players and a house player open the table');
select tests.logout();

select tests.login('df');
select public.duel_leave((select id from abandon));
select tests.is(tests.duel_status((select id from abandon)), 'playing', 'a player leaving the game leaves the table playing');
select tests.logout();
select tests.login('dh');
select tests.is(
  (select (s ->> 'left')::boolean from jsonb_array_elements(public.duel_sync((select id from abandon), 0) -> 'seats') s
   where s ->> 'player' = tests.uid('df')::text),
  true, 'and the table reads that he left'
);
select tests.logout();

select tests.login('dk');
select public.duel_leave((select id from abandon));
select tests.is(tests.duel_status((select id from abandon)), 'playing', 'the table still has its host');
select tests.logout();
select tests.login('dh');
select public.duel_leave((select id from abandon));
select tests.is(tests.duel_status((select id from abandon)), 'closed', 'the last player leaving closes it, house player and all');
select tests.logout();

-- ------------------------------------------ un compte effacé en partie --

-- La place garde son rang quand le compte s'efface : le rejeu adresse la place
-- et non le joueur, donc une ligne disparue réécrivait l'histoire (0050).
select tests.login('dh');
create temp table erased as select public.duel_create('fr', array['animaux', 'pays'], 4) as id;
grant select on erased to public;
select public.duel_invite((select id from erased), tests.bot());
select public.duel_invite((select id from erased), tests.uid('df'));
select tests.logout();

select tests.login('df');
select public.duel_join((select id from erased), 5);
select public.duel_ready((select id from erased), true);
select tests.logout();

select tests.login('dh');
select tests.is(public.duel_ready((select id from erased), true), 'started', 'a table opens with a friend and a house player');
select tests.is(public.duel_move((select id from erased), 1, 0, 'pick', 'animaux'), 'ok', 'the host opens the draft');
select tests.logout();

select tests.login('df');
select public.delete_my_account();
select tests.logout();

select tests.login('dh');
select tests.is(tests.duel_status((select id from erased)), 'playing', 'a deleted account leaves the table playing');
select tests.is(
  (select count(*)::int from jsonb_array_elements(public.duel_sync((select id from erased), 0) -> 'seats') s),
  3, 'his seat is still read, at its rank'
);
select tests.is(
  (select (s ->> 'seat') is not null from jsonb_array_elements(public.duel_sync((select id from erased), 0) -> 'seats') s
   where s ->> 'player' is null),
  true, 'and the seat carries no player any more'
);
select tests.is(
  (select (s ->> 'left')::boolean from jsonb_array_elements(public.duel_sync((select id from erased), 0) -> 'seats') s
   where s ->> 'player' is null),
  true, 'and reads as gone'
);
select tests.age_seat((select id from erased), (select (s ->> 'seat')::int from jsonb_array_elements(public.duel_sync((select id from erased), 0) -> 'seats') s where s ->> 'player' is null), 10);
select tests.is(
  public.duel_move((select id from erased), 2, (select (s ->> 'seat')::int from jsonb_array_elements(public.duel_sync((select id from erased), 0) -> 'seats') s where s ->> 'player' is null), 'timeout', ''),
  'ok', 'and the driver still buries the seat that left'
);
select tests.logout();
