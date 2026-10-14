-- Le matchmaking du duel et l'étiquette de plateforme (0072).

select tests.new_user(n) from unnest(array['ma', 'mb', 'mc', 'md', 'me']) n;
select tests.new_user('mn', true);

create function tests.queued(p_label text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.duel_queue where player = tests.uid(p_label))
$$;
create function tests.age_queue(p_label text, p_seconds int) returns void
language sql security definer set search_path = public as $$
  update public.duel_queue set seen_at = now() - make_interval(secs => p_seconds) where player = tests.uid(p_label)
$$;
create function tests.block(p_blocker text, p_blocked text) returns void
language sql security definer set search_path = public as $$
  insert into public.blocks (blocker, blocked) values (tests.uid(p_blocker), tests.uid(p_blocked))
$$;
create function tests.seat_count(p_table uuid) returns integer
language sql stable security definer set search_path = public as $$ select public.duel_active_seats(p_table) $$;
create function tests.table_platform(p_table uuid) returns text
language sql stable security definer set search_path = public as $$ select platform from public.duel_tables where id = p_table $$;
create function tests.table_host(p_table uuid) returns uuid
language sql stable security definer set search_path = public as $$ select host from public.duel_tables where id = p_table $$;

-- --------------------------------------------------------------- file --

select tests.login('mn');
select tests.throws($$select public.duel_matchmake('fr', array['animaux'], 3)$$, 'an anonymous player does not queue', '42501');
select tests.logout();

select tests.login('ma');
select tests.throws($$select public.duel_matchmake('France', array['animaux'], 3)$$, 'a malformed language is refused', '22023');
select tests.throws($$select public.duel_matchmake('fr', array[]::text[], 3)$$, 'an empty pool is refused', '22023');
select tests.is(public.duel_matchmake('fr', array['animaux', 'pays'], 3) ->> 'status', 'waiting', 'alone, the first player waits');
select tests.is(public.duel_matchmake('fr', array['animaux', 'pays'], 3) ->> 'status', 'waiting', 'asking again keeps waiting');
select tests.logout();
select tests.ok(tests.queued('ma'), 'the waiting player is in the queue');

-- Une autre langue ne s'apparie pas.
select tests.login('mb');
select tests.is(public.duel_matchmake('en', array['animals'], 2) ->> 'status', 'waiting', 'another language does not match');
select public.duel_matchmake_cancel();
select tests.logout();
select tests.ok(not tests.queued('mb'), 'cancelling leaves the queue');

-- Le second de la même langue ouvre la table, l'attendant en est l'hôte.
select tests.login('mc');
create temp table pairing as select public.duel_matchmake('fr', array['couleurs'], 5) as answer;
select tests.is((select answer ->> 'status' from pairing), 'matched', 'the second player is matched at once');
select tests.is(tests.seat_count(((select answer ->> 'table' from pairing))::uuid), 2, 'both players are seated');
select tests.is(tests.table_host(((select answer ->> 'table' from pairing))::uuid), tests.uid('ma'), 'the one who waited hosts');
select tests.ok(not tests.queued('mc'), 'the joiner leaves the queue');
select tests.logout();

-- L'hôte trouve sa table à sa prochaine lecture, une seule fois.
select tests.login('ma');
select tests.is(public.duel_matchmake('fr', array['animaux', 'pays'], 3) ->> 'table', (select answer ->> 'table' from pairing), 'the waiting player finds the table');
select tests.logout();
select tests.ok(not tests.queued('ma'), 'the match is read once');

-- Chacun déclare lui-même qu'il est prêt, comme à une table d'amis.
select tests.login('ma');
select tests.is(public.duel_ready(((select answer ->> 'table' from pairing))::uuid, true), 'waiting', 'the first ready waits for the other');
select tests.logout();
select tests.login('mc');
select tests.is(public.duel_ready(((select answer ->> 'table' from pairing))::uuid, true), 'started', 'the last ready starts the table');
select tests.logout();

-- Un joueur qui ne relit plus quitte la file.
select tests.login('md');
select public.duel_matchmake('fr', array['animaux'], 1);
select tests.logout();
select tests.age_queue('md', 30);
select tests.login('me');
select tests.is(public.duel_matchmake('fr', array['animaux'], 1) ->> 'status', 'waiting', 'an absent player is not matched');
select tests.logout();
select tests.ok(not tests.queued('md'), 'the absent player left the queue');

-- Un blocage, dans un sens ou dans l'autre, empêche l'appariement.
select tests.block('me', 'ma');
select tests.login('ma');
select tests.is(public.duel_matchmake('fr', array['animaux'], 1) ->> 'status', 'waiting', 'a blocked pair is not matched');
select tests.logout();
select tests.ok(tests.queued('ma') and tests.queued('me'), 'both keep waiting');

-- L'étiquette de plateforme vient de l'en-tête du client.
select tests.login('mb');
select set_config('request.headers', '{"x-client-info": "supabase-js/2.117.0; platform=crazygames"}', false);
create temp table tagged as select public.duel_create('fr', array['animaux'], 1) as id;
select tests.is(tests.table_platform((select id from tagged)), 'crazygames', 'a duel table carries the client''s platform');
select set_config('request.headers', '{"x-client-info": "supabase-js/2.117.0; runtime=web"}', false);
create temp table untagged as select public.duel_create('fr', array['animaux'], 1) as id;
select tests.is(tests.table_platform((select id from untagged)), null::text, 'an older client leaves it null');
select tests.logout();
