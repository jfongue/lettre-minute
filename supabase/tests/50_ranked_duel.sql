-- Le duel classé (0122) : la file qui propose avant d'asseoir, l'attente
-- estimée, l'Elo réglé sur des rapports concordants, les abandons et le retour.

select tests.new_user(n) from unnest(array['ra', 'rb', 'rc', 'rd', 're', 'rf', 'rg', 'rh']) n;

create function tests.queued(p_label text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.duel_queue where player = tests.uid(p_label))
$$;
create function tests.age_offer(p_label text, p_seconds int) returns void
language sql security definer set search_path = public as $$
  update public.duel_queue set offered_at = now() - make_interval(secs => p_seconds) where player = tests.uid(p_label)
$$;
create function tests.age_join(p_label text, p_seconds int) returns void
language sql security definer set search_path = public as $$
  update public.duel_queue set joined_at = now() - make_interval(secs => p_seconds) where player = tests.uid(p_label)
$$;
create function tests.set_rating(p_label text, p_rating int, p_games int) returns void
language sql security definer set search_path = public as $$
  insert into public.duel_ratings (player, rating, games) values (tests.uid(p_label), p_rating, p_games)
  on conflict (player) do update set rating = excluded.rating, games = excluded.games
$$;
create function tests.rating(p_label text) returns int
language sql stable security definer set search_path = public as $$
  select rating from public.duel_ratings where player = tests.uid(p_label)
$$;
create function tests.games(p_label text) returns int
language sql stable security definer set search_path = public as $$
  select games from public.duel_ratings where player = tests.uid(p_label)
$$;
create function tests.table_of(p_table uuid) returns public.duel_tables
language sql stable security definer set search_path = public as $$ select * from public.duel_tables where id = p_table $$;
create function tests.outcomes(p_label text) returns text[]
language sql stable security definer set search_path = public as $$
  select array_agg(coalesce(outcome, 'open') order by id) from public.duel_queue_log where player = tests.uid(p_label)
$$;
create function tests.seat_index(p_table uuid, p_label text) returns int
language sql stable security definer set search_path = public as $$
  select seat::int from public.duel_seats where table_id = p_table and player = tests.uid(p_label)
$$;
create function tests.move(p_table uuid, p_label text, p_kind text) returns void
language sql security definer set search_path = public as $$
  insert into public.duel_moves (table_id, seq, seat, kind, payload, by)
  select p_table, coalesce(max(seq), 0) + 1, tests.seat_index(p_table, p_label), p_kind, '', tests.uid(p_label)
    from public.duel_moves where table_id = p_table
$$;
create function tests.age_finish(p_table uuid, p_seconds int) returns void
language sql security definer set search_path = public as $$
  update public.duel_tables set finished_at = now() - make_interval(secs => p_seconds) where id = p_table
$$;
create function tests.silence(p_table uuid, p_minutes int) returns void
language sql security definer set search_path = public as $$
  update public.duel_seats set last_seen = now() - make_interval(mins => p_minutes) where table_id = p_table;
  update public.duel_tables set started_at = now() - make_interval(mins => p_minutes + 1) where id = p_table;
$$;
create function tests.log_wait(p_lang text, p_seconds int, p_count int) returns void
language sql security definer set search_path = public as $$
  insert into public.duel_queue_log (lang, joined_at, ended_at, outcome)
  select p_lang, now() - make_interval(secs => p_seconds), now(), 'matched' from generate_series(1, p_count)
$$;

-- ------------------------------------------------------------- l'Elo pur --

select tests.is(public.duel_elo_deltas(array[1000, 1000], array[0, 0]), array[30, -30], 'equal newcomers move by half of K 60 (0123)');
select tests.is(public.duel_elo_deltas(array[1000, 1000], array[12, 12]), array[20, -20], 'then half of K 40 until twenty games');
select tests.is(public.duel_elo_deltas(array[1000, 1000], array[20, 20]), array[10, -10], 'equal veterans move by half of K 20');
select tests.is(public.duel_elo_deltas(array[1200, 1000], array[20, 20]), array[5, -5], 'the favourite gains little');
select tests.is(public.duel_elo_deltas(array[1000, 1200], array[20, 20]), array[15, -15], 'the underdog gains much');
select tests.is(public.duel_elo_deltas(array[1000, 1000, 1000], array[20, 20, 20]), array[10, 0, -10], 'three players split by placement');
select tests.is(public.duel_settled_rating(1400, 3), 1400, 'no placement ceiling any more (0123)');
select tests.is(public.duel_settled_rating(40, 3), 100, 'only the floor');
select tests.is(public.duel_settled_rating(1400, 4), 1400, 'later games are not clamped');
select tests.is(public.duel_effective_rating(1200, now() - interval '6 days'), 1200, 'a week of rest costs nothing');
select tests.is(public.duel_effective_rating(1200, now() - interval '10 days'), 1185, 'then 5 a day');
select tests.is(public.duel_effective_rating(1200, now() - interval '200 days'), 1050, 'at most 150');
select tests.is(public.duel_effective_rating(980, now() - interval '200 days'), 950, 'never below 950 from above it');
select tests.is(public.duel_effective_rating(900, now() - interval '200 days'), 900, 'and never lower for those already under');
select tests.is(public.duel_rating_window(0), 100, 'the window opens at 100');
select tests.is(public.duel_rating_window(12), 200, 'it widens by 50 every 5 s');
select tests.is(public.duel_rating_window(30), 100000, 'after 30 s anyone fits');

-- ---------------------------------------------- l'attente et la proposition --

select tests.login('ra');
create temp table waiting as select public.duel_queue_poll('fr', array['animaux', 'pays'], 3, false) as answer;
select tests.is((select answer ->> 'status' from waiting), 'waiting', 'alone, the first player waits');
select tests.ok((select answer ? 'estimate' from waiting), 'the wait carries an estimate field');
select tests.is((select (answer -> 'me' ->> 'rating')::int from waiting), 950, 'a newcomer starts at Silver III while Gold is nearly empty');
select tests.logout();
select tests.is(tests.outcomes('ra'), array['open'], 'the passage is logged');

-- Trop loin en Elo, au début : pas d'appariement.
select tests.set_rating('rb', 1400, 30);
select tests.login('rb');
select tests.is(public.duel_queue_poll('fr', array['animaux'], 2, false) ->> 'status', 'waiting', 'a 400 gap does not match at once');
select tests.logout();

-- Après trente secondes, si.
select tests.age_join('ra', 31);
select tests.login('rb');
create temp table offer as select public.duel_queue_poll('fr', array['animaux'], 2, false) as answer;
select tests.is((select answer ->> 'status' from offer), 'found', 'a widened window finds the opponent');
select tests.ok((select (answer ->> 'ranked')::boolean from offer), 'the table is ranked');
select tests.is((select answer -> 'opponent' ->> 'name' from offer), 'ra', 'the card names the opponent');
select tests.is((select (answer -> 'opponent' ->> 'rating')::int from offer), 950, 'and their rating');
select tests.ok((select (answer ->> 'deadline')::numeric - (answer ->> 'now')::numeric between 18 and 21 from offer), 'twenty seconds to accept');
select tests.logout();
select tests.is((tests.table_of((select answer ->> 'table' from offer)::uuid)).status, 'lobby', 'nobody is ready yet');

-- L'autre voit la même proposition.
select tests.login('ra');
select tests.is(public.duel_queue_poll('fr', array['animaux', 'pays'], 3, false) ->> 'table', (select answer ->> 'table' from offer), 'the waiting player reads the same offer');
select tests.is(public.duel_offer_answer(true) ->> 'status', 'found', 'the first to accept waits');
select tests.logout();
select tests.login('rb');
select tests.is(public.duel_queue_poll('fr', array['animaux'], 2, false) -> 'opponent' ->> 'accepted', 'true', 'the other sees the acceptance');
select tests.is(public.duel_offer_answer(true) ->> 'status', 'matched', 'the second acceptance starts the table');
select tests.logout();
select tests.is((tests.table_of((select answer ->> 'table' from offer)::uuid)).status, 'playing', 'the table plays');
select tests.login('ra');
select tests.is(public.duel_queue_poll('fr', array['animaux', 'pays'], 3, false) ->> 'status', 'matched', 'the first reads the start');
select tests.logout();
select tests.ok(not tests.queued('ra') and not tests.queued('rb'), 'both left the queue');
select tests.is(tests.outcomes('ra'), array['matched'], 'the passage ends matched');

-- ----------------------------------------------------- le règlement --

create temp table ranked as select (answer ->> 'table')::uuid as id from offer;
grant select on ranked to authenticated;
select tests.move((select id from ranked), 'ra', 'timeout');
-- Le perdant rapporte d'abord : on attend l'autre, encore là.
select tests.login('ra');
select public.duel_report((select id from ranked), array[tests.seat_index((select id from ranked), 'rb'), tests.seat_index((select id from ranked), 'ra')]);
select tests.logout();
select tests.ok((tests.table_of((select id from ranked))).settled_at is null, 'one report waits for the other player still seated');
select tests.login('rb');
select public.duel_report((select id from ranked), array[tests.seat_index((select id from ranked), 'rb'), tests.seat_index((select id from ranked), 'ra')]);
select tests.logout();
select tests.ok((tests.table_of((select id from ranked))).settled_at is not null, 'two matching reports settle');
select tests.is(tests.rating('rb'), 1400 + 2, 'the favourite gains 1, doubled while diamonds are few');
select tests.is(tests.rating('ra'), 950 - 8, 'the newcomer loses 4 (K 60), doubled');
select tests.is(tests.games('ra'), 1, 'one game counted');
select tests.login('rb');
select tests.is(jsonb_array_length(public.duel_sync((select id from ranked), 0) -> 'table' -> 'ratings'), 2, 'the table shows both changes');
-- Les places se lisent de leur ligne (0126), aux mêmes valeurs que `duel_rating_json`.
create temp table synced_seats as
  select s ->> 'player' as player, s -> 'rating' as rating, s -> 'games' as games, s -> 'rank' as rank, s -> 'masters' as masters
    from jsonb_array_elements(public.duel_sync((select id from ranked), 0) -> 'seats') s;
select tests.is((select rank::int from synced_seats where player = tests.uid('rb')::text), 1, 'the favourite ranks first');
-- Un rapport de plus ne règle pas deux fois.
select public.duel_report((select id from ranked), array[0, 1]);
select tests.logout();
select tests.is(tests.games('rb'), 31, 'a table settles once');
select tests.is((select count(*)::int from synced_seats s
                  where s.rating = public.duel_rating_json(s.player::uuid) -> 'rating'
                    and s.games = public.duel_rating_json(s.player::uuid) -> 'games'
                    and s.rank = public.duel_rating_json(s.player::uuid) -> 'rank'
                    and s.masters = public.duel_rating_json(s.player::uuid) -> 'masters'), 2,
  'each seat reads the rating, games, rank and masters its player''s rating gives');

-- ------------------------------------------------- un rapport mensonger --

create function tests.fresh_ranked(p_a text, p_b text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.duel_tables (host, lang, seed, categories, status, started_at, ranked)
  values (tests.uid(p_a), 'fr', 7, array['animaux'], 'playing', now(), true) returning id into v_id;
  insert into public.duel_seats (table_id, player, ready, seat, joined_at)
  values (v_id, tests.uid(p_a), true, 0, clock_timestamp()), (v_id, tests.uid(p_b), true, 1, clock_timestamp() + interval '1 ms');
  return v_id;
end;
$$;

-- rc prétend avoir gagné alors que rd n'a ni temps écoulé ni abandon.
create temp table liar as select tests.fresh_ranked('rc', 'rd') as id;
grant select on liar to authenticated;
select tests.login('rc');
select public.duel_report((select id from liar), array[0, 1]);
select tests.logout();
select tests.age_finish((select id from liar), 40);
select tests.login('rc');
select public.duel_my_rating();
select tests.logout();
select tests.ok((tests.table_of((select id from liar))).voided, 'a ranking the journal does not support is voided');
select tests.is(tests.rating('rc'), null, 'nobody moves');

-- Deux rapports contradictoires : la partie ne compte pas.
create temp table clash as select tests.fresh_ranked('rc', 'rd') as id;
grant select on clash to authenticated;
select tests.move((select id from clash), 'rc', 'timeout');
select tests.move((select id from clash), 'rd', 'timeout');
select tests.login('rc');
select public.duel_report((select id from clash), array[0, 1]);
select tests.logout();
select tests.login('rd');
select public.duel_report((select id from clash), array[1, 0]);
select tests.logout();
select tests.ok((tests.table_of((select id from clash))).voided, 'contradicting reports void the game');

-- Un seul rapport, l'autre parti sans rapporter : réglé trente secondes après la fin.
create temp table lone as select tests.fresh_ranked('re', 'rf') as id;
grant select on lone to authenticated;
select tests.move((select id from lone), 'rf', 'timeout');
select tests.login('re');
select public.duel_report((select id from lone), array[0, 1]);
select tests.logout();
select tests.ok((tests.table_of((select id from lone))).settled_at is null, 'a lone report waits while the other is seated');
select tests.age_finish((select id from lone), 40);
select tests.login('re');
select public.duel_my_rating();
select tests.logout();
select tests.is(tests.rating('re'), 1010, 'after 30 s the lone consistent report settles');

-- L'inactivité se fige au règlement : la partie repart de l'Elo qui restait.
update public.duel_ratings set rating = 1300, games = 20, last_played_at = now() - interval '27 days' where player = tests.uid('re');
create temp table rested as select tests.fresh_ranked('re', 'rf') as id;
grant select on rested to authenticated;
select tests.move((select id from rested), 'rf', 'timeout');
select tests.login('re');
select tests.is((public.duel_my_rating() ->> 'rating')::int, 1200, 'twenty idle days past the week read 100 lower');
select public.duel_report((select id from rested), array[0, 1]);
select tests.logout();
select tests.login('rf');
select public.duel_report((select id from rested), array[0, 1]);
select tests.logout();
select tests.is((select before from public.duel_rating_changes where table_id = (select id from rested) and player = tests.uid('re')), 1200, 'the game starts from the decayed rating');

-- ----------------------------------------------------- l'abandon --

create temp table quit as select tests.fresh_ranked('rg', 'rh') as id;
grant select on quit to authenticated;
select tests.login('rh');
select tests.is(public.duel_resign((select id from quit)), 'resigned', 'a player resigns mid-game');
select tests.is(public.duel_resign((select id from quit)), 'resigned', 'resigning twice is harmless');
select tests.is(public.duel_rejoin((select id from quit)), 'closed', 'a resigned player cannot come back');
select tests.logout();
select tests.is((select count(*)::int from public.duel_moves where table_id = (select id from quit) and kind = 'resign'), 1, 'one resign move in the journal');
select tests.login('rg');
select tests.is(public.duel_move((select id from quit), 99, 0, 'resign', ''), 'forbidden', 'a client cannot post a resign move itself');
select public.duel_report((select id from quit), array[0, 1]);
select tests.logout();
select tests.is(tests.rating('rg'), 1010, 'the one who stayed wins at once');
select tests.is(tests.rating('rh'), 890, 'the one who resigned loses');

-- Revenir après une coupure, tant qu'on n'a pas abandonné.
create temp table cut as select tests.fresh_ranked('rc', 'rd') as id;
grant select on cut to authenticated;
select tests.login('rd');
select public.duel_leave((select id from cut));
select tests.is(public.duel_rejoin((select id from cut)), 'back', 'a player who dropped takes the seat back');
select tests.logout();
select tests.ok((select left_at is null from public.duel_seats where table_id = (select id from cut) and player = tests.uid('rd')), 'the seat is present again');

-- Une table abandonnée de tous se ferme à la lecture suivante de la file.
select tests.silence((select id from cut), 4);
select tests.login('ra');
select public.duel_queue_poll('fr', array['animaux'], 3, false);
select public.duel_queue_leave();
select tests.logout();
select tests.is((tests.table_of((select id from cut))).status, 'over', 'a silent table closes');

-- ---------------------------------------- refus, oubli et pénalité --

select tests.login('rc');
select public.duel_queue_poll('fr', array['animaux'], 3, false);
select tests.logout();
select tests.login('rd');
create temp table second as select public.duel_queue_poll('fr', array['animaux'], 3, false) as answer;
select tests.is((select answer ->> 'status' from second), 'found', 'rc and rd are offered to each other');
select tests.is(public.duel_offer_answer(false) ->> 'status', 'declined', 'rd declines');
select tests.logout();
select tests.ok(not tests.queued('rd'), 'the one who declined leaves the queue');
select tests.ok(tests.queued('rc'), 'the other keeps their place');
select tests.login('rc');
select tests.is(public.duel_queue_poll('fr', array['animaux'], 3, false) ->> 'status', 'waiting', 'and is told to wait again');
select tests.logout();

-- rc accepte, re laisse passer : rc reste, re sort et compte un oubli.
-- re a pris de l'avance au classement : rc attend depuis assez longtemps pour l'accepter.
select tests.age_join('rc', 31);
select tests.login('re');
select tests.is(public.duel_queue_poll('fr', array['animaux'], 3, false) ->> 'status', 'found', 're is offered rc');
select tests.logout();
select tests.login('rc');
select public.duel_offer_answer(true);
select tests.logout();
select tests.age_offer('rc', 25);
select tests.age_offer('re', 25);
select tests.login('rc');
select tests.is(public.duel_queue_poll('fr', array['animaux'], 3, false) ->> 'status', 'waiting', 'the one who accepted goes back to waiting');
select tests.logout();
select tests.ok((select table_id is not null from public.duel_queue where player = tests.uid('re')), 'the silent one is out of the search, held on the closed table');
select tests.is((tests.outcomes('re'))[1], 'missed', 'their passage is a miss');
select tests.login('rc');
select public.duel_queue_leave();
select tests.logout();
select tests.login('re');
select tests.is(public.duel_queue_poll('fr', array['animaux'], 3, false) ->> 'status', 'missed', 'the silent one is told they missed it, not put back in the queue');
select tests.logout();
select tests.ok(not tests.queued('re'), 'and leaves the queue');
select tests.is(array_length(tests.outcomes('re'), 1), 1, 'one passage, one miss');
select tests.login('re');
select tests.is(public.duel_queue_poll('fr', array['animaux'], 3, false) ->> 'status', 'waiting', 'one miss alone is no penalty');
select public.duel_queue_leave();
select tests.logout();

-- Trois manquements en une heure : cinq minutes de pause.
insert into public.duel_queue_log (player, lang, joined_at, ended_at, outcome)
select tests.uid('rf'), 'fr', now() - interval '10 minutes', now() - interval '1 minute', 'missed' from generate_series(1, 3);
select tests.login('rf');
select tests.is(public.duel_queue_poll('fr', array['animaux'], 3, false) ->> 'status', 'cooldown', 'three misses cool down');
select tests.logout();
select tests.ok(not tests.queued('rf'), 'a cooling player is not queued');
-- La pause s'allonge avec les manquements du jour.
select tests.is(public.duel_cooldown_length(2), null, 'two misses are free');
select tests.is(public.duel_cooldown_length(3), interval '5 minutes', 'three: five minutes');
select tests.is(public.duel_cooldown_length(6), interval '15 minutes', 'six: a quarter of an hour');
select tests.is(public.duel_cooldown_length(9), interval '1 hour', 'nine: an hour');
select tests.is(public.duel_cooldown_length(12), interval '4 hours', 'twelve: four hours');
select tests.is(public.duel_cooldown_length(40), interval '24 hours', 'then a day');
insert into public.duel_queue_log (player, lang, joined_at, ended_at, outcome)
select tests.uid('rf'), 'fr', now() - interval '3 hours', now() - interval '20 minutes', 'missed' from generate_series(1, 3);
select tests.login('rf');
select tests.ok((public.duel_queue_poll('fr', array['animaux'], 3, false) ->> 'until')::numeric - extract(epoch from now()) > 10 * 60, 'six misses in a day: a quarter of an hour from the last');
select tests.logout();

-- Occupé (partie seule) : en file, jamais apparié.
select tests.login('rg');
select tests.is(public.duel_queue_poll('fr', array['animaux'], 3, true) ->> 'status', 'waiting', 'a busy player waits');
select tests.logout();
select tests.login('rh');
select tests.is(public.duel_queue_poll('fr', array['animaux'], 3, false) ->> 'status', 'waiting', 'a busy player is not offered');
select tests.logout();

-- ------------------------------------------------------- l'estimation --

select tests.log_wait('de', 40, 6);
select tests.login('rg');
select tests.is((public.duel_queue_poll('de', array['animaux'], 3, false) ->> 'estimate')::numeric, 40::numeric, 'five recent matches give the median wait');
select tests.logout();
select tests.is(public.duel_wait_estimate('it'), null, 'no samples, no estimate');

-- ----------------------------------------------------- le classement --

select tests.set_rating('ra', 1300, 12);
select tests.login('ra');
select tests.ok(jsonb_array_length(public.duel_ladder(10) -> 'rows') >= 2, 'the ladder lists placed players');
select tests.is((public.duel_ladder(10) -> 'rows' -> 0 ->> 'name'), 'rb', 'the best comes first');
select tests.is((public.duel_ladder(10) -> 'me' ->> 'rank')::int, 2, 'and says my rank');
select tests.logout();

select tests.login('rg');
select public.duel_queue_leave();
select tests.logout();
select tests.login('rh');
select public.duel_queue_leave();
select tests.logout();

-- Les versions livrées appellent encore duel_matchmake : elles s'apparient
-- avec la file classée sans rien casser.
select tests.login('rc');
select public.duel_queue_leave();
select tests.logout();
select tests.login('rd');
select tests.is(public.duel_queue_poll('fr', array['animaux'], 3, false) ->> 'status', 'waiting', 'a new client waits');
select tests.logout();
select tests.login('rc');
select tests.is(public.duel_matchmake('fr', array['animaux'], 3) ->> 'status', 'matched', 'an old client seats itself against them');
select tests.logout();
select tests.login('rd');
select tests.is(public.duel_queue_poll('fr', array['animaux'], 3, false) ->> 'status', 'found', 'the new client gets an offer to accept');
select tests.logout();

-- ------------------------------------------- les mots trouvés hors de son tour --

create function tests.client(p_rules int) returns void
language sql as $$
  select set_config('request.headers', json_build_object('x-client-info', 'supabase-js/2; runtime=web; platform=android' || case when p_rules > 1 then '; duel=' || p_rules else '' end)::text, false)
$$;
create function tests.lobby(p_a text, p_b text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.duel_tables (host, lang, seed, categories) values (tests.uid(p_a), 'fr', 9, array['animaux']) returning id into v_id;
  insert into public.duel_seats (table_id, player, joined_at)
  values (v_id, tests.uid(p_a), clock_timestamp()), (v_id, tests.uid(p_b), clock_timestamp() + interval '1 ms');
  return v_id;
end;
$$;

-- Deux clients qui connaissent la règle : la table la joue.
create temp table echoes as select tests.lobby('rc', 'rd') as id;
grant select on echoes to authenticated;
select tests.client(2);
select tests.login('rc');
select public.duel_ready((select id from echoes), true);
select tests.logout();
select tests.login('rd');
select tests.is(public.duel_ready((select id from echoes), true), 'started', 'both ready, the table starts');
select tests.logout();
select tests.is((tests.table_of((select id from echoes))).rules, 2::smallint, 'two new clients play the echo rules');
select tests.login('rd');
select tests.is(public.duel_move((select id from echoes), 1, 1, 'echo', 'zèbre'), 'ok', 'a player echoes from their own seat');
select tests.is(public.duel_move((select id from echoes), 2, 0, 'echo', 'zébu'), 'forbidden', 'never from another seat');
select tests.logout();

-- Un client livré avant la règle à la table : elle ne la joue pas.
create temp table mixed as select tests.lobby('rc', 'rd') as id;
grant select on mixed to authenticated;
select tests.client(2);
select tests.login('rc');
select public.duel_ready((select id from mixed), true);
select tests.logout();
select tests.client(1);
select tests.login('rd');
select public.duel_ready((select id from mixed), true);
select tests.logout();
select tests.is((tests.table_of((select id from mixed))).rules, 1::smallint, 'an older client keeps the table on the old rules');
select tests.client(2);
select tests.login('rc');
select tests.is(public.duel_move((select id from mixed), 1, 0, 'echo', 'zèbre'), 'forbidden', 'and nobody can echo there');
select tests.is((public.duel_sync((select id from mixed), 0) -> 'table' ->> 'rules')::int, 1, 'the table tells its rules');
select tests.logout();

-- ------------------------------------------------ la file, l'app fermée --

select tests.new_user(n) from unnest(array['wa', 'wb', 'wc']) n;
create function tests.outbox(p_label text, p_kind text) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.push_outbox where player_id = tests.uid(p_label) and kind = p_kind
$$;
create function tests.age_seen(p_label text, p_seconds int) returns void
language sql security definer set search_path = public as $$
  update public.duel_queue set seen_at = now() - make_interval(secs => p_seconds) where player = tests.uid(p_label)
$$;
insert into public.push_tokens (token, player_id) values ('token-wa', tests.uid('wa'));

-- Sans notifications, l'arrière-plan ne garde pas la place.
select tests.login('wb');
select public.duel_queue_poll('fr', array['animaux'], 3, false);
select tests.is(public.duel_queue_away(), false, 'without a push token the place is not kept');
select public.duel_queue_leave();
select tests.logout();

-- Avec : la place tient bien au-delà des vingt secondes.
select tests.login('wa');
select public.duel_queue_poll('fr', array['animaux'], 3, false);
select tests.is(public.duel_queue_away(), true, 'with a push token the place is kept in the background');
select tests.logout();
select tests.age_seen('wa', 120);
select tests.login('wc');
create temp table called as select public.duel_queue_poll('fr', array['animaux'], 3, false) as answer;
select tests.is((select answer ->> 'status' from called), 'found', 'a player in the background is still found');
select tests.ok((select (answer ->> 'deadline')::numeric - (answer ->> 'now')::numeric between 58 and 61 from called), 'the offer gives a minute to come back');
select tests.logout();
select tests.is(tests.outbox('wa', 'match'), 1, 'and calls them with a notification');
select tests.is(tests.outbox('wc', 'match'), 0, 'the one in the app gets none');

-- Revenu par la notification, il accepte ; la notification se retire.
select tests.login('wa');
select tests.is(public.duel_queue_poll('fr', array['animaux'], 3, false) ->> 'status', 'found', 'back in the app, the offer waits');
select public.duel_offer_answer(true);
select tests.logout();
select tests.login('wc');
select tests.is(public.duel_offer_answer(true) ->> 'status', 'matched', 'both accept, the table starts');
select tests.logout();
select tests.is(tests.outbox('wa', 'duel_cancel'), 1, 'the notification is taken down once the offer is settled');

-- La fonction Edge lit le nom de l'adversaire, pas celui de l'hôte.
select tests.login_service();
select tests.is((select owner_name from public.claim_push_batch(50) where kind = 'match' limit 1), 'wc', 'a match push names the opponent');
select tests.logout();

-- Les versions livrées ne voient pas un joueur en arrière-plan.
select tests.login('wa');
select tests.is(public.duel_queue_poll('fr', array['animaux'], 3, false) ->> 'status', 'matched', 'the one who accepted first reads the start');
select public.duel_queue_poll('fr', array['animaux'], 3, false);
select public.duel_queue_away();
select tests.logout();
select tests.login('wb');
select tests.is(public.duel_matchmake('fr', array['animaux'], 3) ->> 'status', 'waiting', 'an old client does not seat a player who is away');
select public.duel_matchmake_cancel();
select tests.logout();
select tests.ok(tests.queued('wa'), 'nor drops them from the queue');

-- ------------------------------------------- les rangs sur les classements --

select tests.login('rb');
select tests.is((public.duel_my_rating() ->> 'masters')::boolean, false, 'no masters while fewer than ten players are diamond');
select tests.is(jsonb_array_length(public.duel_ladder_view('master', 50) -> 'rows'), 0, 'the masters view is empty');
select tests.logout();

select tests.new_user('m' || n) from generate_series(1, 12) n;
select tests.set_rating('m' || n, 1700 - n * 10, 20) from generate_series(1, 12) n;

select tests.login_anon();
select tests.is((public.duel_badges(array['m1', 'm12', 'nobody']) -> 'm1' ->> 'rank')::int, 1, 'a guest reads the rank of a listed name');
select tests.is((public.duel_badges(array['m1', 'm12', 'nobody']) -> 'm12' ->> 'rank')::int, 12, 'past the top ten too');
select tests.ok(not (public.duel_badges(array['m1', 'nobody']) ? 'nobody'), 'an unplaced name has no badge');
select tests.logout();

select tests.login('rb');
select tests.is((public.duel_my_rating() ->> 'masters')::boolean, true, 'ten diamonds open the masters');
select tests.is(jsonb_array_length(public.duel_ladder_view('master', 50) -> 'rows'), 10, 'the masters are the top ten');
select tests.is(public.duel_ladder_view('diamond', 50) -> 'rows' -> 0 ->> 'name', 'm11', 'a league starts after the masters');
select tests.ok(not exists (
  select 1 from jsonb_array_elements(public.duel_ladder_view('diamond', 50) -> 'rows') r where (r ->> 'rank')::int <= 10
), 'and holds no master');
select tests.is(public.duel_ladder_view('platinum', 50) -> 'rows' -> 0 ->> 'name', 'ra', 'each league lists its own');
select tests.ok(exists (
  select 1 from jsonb_array_elements(public.duel_ladder_view('me', 50) -> 'rows') r where r ->> 'name' = 'rb'
), 'the view around me holds my own line');
select tests.ok(jsonb_array_length(public.duel_ladder_view('me', 50) -> 'rows') <= 15, 'and seven places on each side at most');
select tests.logout();

-- ------------------------------------------- le bot de niveau, classé (0123) --

select tests.new_user('bq');
select tests.login('bq');
create temp table botwin as select public.duel_report_bot(true) as answer;
select tests.is((select answer ->> 'status' from botwin), 'settled', 'a win against the level bot is ranked');
select tests.is((select (answer ->> 'before')::int from botwin), 950, 'from the start of the moment');
select tests.is((select (answer ->> 'after')::int from botwin), 980, 'half of K 60, no longer doubled with ten diamonds');
select tests.is(public.duel_report_bot(false) ->> 'status', 'too_soon', 'one game a minute at most');
select tests.logout();
select tests.login_service();
insert into public.feature_flags (feature, everyone) values ('rankedBots', 'off')
on conflict (feature) do update set everyone = 'off';
select tests.logout();
update public.duel_ratings set last_played_at = now() - interval '2 minutes' where player = tests.uid('bq');
select tests.login('bq');
select tests.is(public.duel_report_bot(true) ->> 'status', 'closed', 'closing the feature closes it on the server too');
select tests.logout();

-- Cinquante joueurs en Or : les nouveaux repartent du Bronze III.
select tests.new_user('g' || n) from generate_series(1, 50) n;
select tests.set_rating('g' || n, 1150, 20) from generate_series(1, 50) n;
select tests.new_user('late');
select tests.login('late');
select tests.is((public.duel_my_rating() ->> 'rating')::int, 800, 'with fifty gold players a newcomer starts at Bronze III');
select tests.logout();
