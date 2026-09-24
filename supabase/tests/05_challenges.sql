-- Challenges: who may be invited, eight players at most, one run each,
-- hidden words, closing by play or by clock, one recap, one rematch, and
-- two races the row lock must settle.

select tests.new_user('co');
select tests.new_user('c' || i) from generate_series(1, 8) i;
select tests.befriend('co', 'c' || i) from generate_series(1, 8) i;
select tests.new_user('cx');
select tests.new_user('canon', true);
select tests.befriend('co', 'canon');
insert into public.friendships (requester, addressee, status)
select tests.uid('co'), id, 'accepted' from public.bots b where b.id = (select id from public.profiles where display_name = 'Maxitoon');

\set words '''[{"key": "chat", "category": "animaux", "points": 10, "at": 3.5, "rarity": 1}]'''

-- ------------------------------------------------------------- opening --

select tests.login('canon');
select tests.is(public.create_challenge('fr', 1, '{animaux}', array[tests.uid('co')]), null,
                'an anonymous player cannot open a challenge');
select tests.login('co');
select tests.is(public.create_challenge('fr', 1, '{animaux}', '{}'), null, 'a challenge needs someone to invite');
select tests.is(public.create_challenge('fr', 1, '{animaux}', null), null, 'a null list invites nobody');
select tests.is(public.create_challenge('fr', 1, '{animaux}', array[tests.uid('cx')]), null, 'only friends are invited');
select tests.is(public.create_challenge('fr', 1, '{animaux}', array[tests.uid('canon')]), null, 'never an anonymous friend');
select tests.is(public.create_challenge('fr', 1, '{animaux}', array[(select id from public.profiles where display_name = 'Maxitoon')]),
                null, 'never a house bot');
select tests.is(public.create_challenge('fr', 1, '{animaux}', array[tests.uid('co')]), null, 'nor oneself');
select tests.is(public.create_challenge('fr', 1, '{animaux}', array[null::uuid]), null, 'nor nobody');
select tests.is(public.create_challenge('fr', 1, '{animaux}', (select array_agg(tests.uid('c' || i)) from generate_series(1, 8) i)),
                null, 'nine players are too many');

select public.create_challenge('fr', 42, '{animaux,pays}',
                               (select array_agg(tests.uid('c' || i)) from generate_series(1, 7) i) || tests.uid('c1')) as big \gset
select tests.logout();
select tests.ok(:'big' is not null, 'eight players are allowed');
select tests.is((select count(*)::int from public.challenge_players where challenge_id = :'big'), 8,
                'a friend listed twice is invited once');
select tests.ok((select seen_invite_at is not null from public.challenge_players
                  where challenge_id = :'big' and player_id = tests.uid('co')), 'the owner has nothing to be told');
select tests.is((select count(*)::int from public.push_outbox where challenge_id = :'big' and kind = 'invite'), 7,
                'each guest gets an invitation push');
select tests.ok(not exists (select 1 from public.push_outbox where challenge_id = :'big' and player_id = tests.uid('co')),
                'the owner gets none');

-- Bad input from the client raises; what matters is that nothing is left behind.
select tests.login('co');
select tests.throws(format('select public.create_challenge(%L, 1, %L, array[%L::uuid])', 'FRA', '{animaux}', tests.uid('c1')),
                    'a malformed language is refused');
select tests.throws(format('select public.create_challenge(%L, 1, %L, array[%L::uuid])', 'fr', '{}', tests.uid('c1')),
                    'a challenge needs a category');
select tests.throws(format('select public.create_challenge(%L, 1, %L, array[%L::uuid])', 'fr', '{a,b,c,d,e,f}', tests.uid('c1')),
                    'six categories are too many');
select tests.logout();
select tests.is((select count(*)::int from public.challenges), 1, 'and none of them opened anything');

-- ------------------------------------------------------------ inviting --

select tests.login('co');
select public.create_challenge('fr', 7, '{animaux}', array[tests.uid('c1')]) as small \gset
select tests.login('c1');
select tests.is(public.invite_to_challenge(:'small', array[tests.uid('c2')]), 'forbidden', 'only the owner invites');
select tests.login('co');
select tests.is(public.invite_to_challenge(gen_random_uuid(), array[tests.uid('c2')]), 'forbidden', 'an unknown challenge is forbidden');
select tests.is(public.invite_to_challenge(:'small', (select array_agg(tests.uid('c' || i)) from generate_series(2, 7) i)), 'sent',
                'the owner invites up to eight');
select tests.is(public.invite_to_challenge(:'small', array[tests.uid('c8')]), 'full', 'and no more');
select tests.is(public.invite_to_challenge(:'small', array[tests.uid('c1'), tests.uid('cx')]), 'sent',
                'members and strangers are skipped');
select tests.logout();
select tests.is((select count(*)::int from public.challenge_players where challenge_id = :'small'), 8, 'the challenge holds eight');

-- ------------------------------------------------------------- playing --

select tests.login('cx');
select tests.is(public.submit_challenge_run(:'big', 50, 0, 1, :words), false, 'a stranger cannot play');
select tests.is(public.challenge_detail(:'big'), null, 'nor read the challenge');
select tests.login('c1');
select tests.is(public.submit_challenge_run(:'big', -5, -1, -2, :words), true, 'a guest plays');
select tests.is(public.submit_challenge_run(:'big', 90, 0, 1, :words), false, 'once');
select tests.logout();
select tests.ok((select score = 0 and skips = 0 and best_combo = 0 from public.challenge_players
                  where challenge_id = :'big' and player_id = tests.uid('c1')), 'negative numbers are floored at zero');

select tests.login('c2');
select tests.is((select p -> 'words' -> 0 from jsonb_array_elements(public.challenge_detail(:'big') -> 'players') p
                  where (p ->> 'id')::uuid = tests.uid('c1')), '{"at": 3.5, "points": 10}'::jsonb,
                'before playing, the others'' words show only their instant and points');
select tests.throws(format('select public.submit_challenge_run(%L, 10, 0, 0, %L)', :'big', '{"key": "chat"}'),
                    'words must be an array', '23514');
select tests.throws(format('select public.submit_challenge_run(%L, 10, 0, 0, %L)', :'big',
                           (select jsonb_agg(jsonb_build_object('key', i)) from generate_series(1, 201) i)),
                    'two hundred words at most', '23514');
select tests.is((select me_played from public.my_challenges() where id = :'big'), false, 'a refused run is not recorded');
select tests.is(public.submit_challenge_run(:'big', 30, 0, 0, null), true, 'a run without words is fine');
select tests.is((select p -> 'words' -> 0 ->> 'key' from jsonb_array_elements(public.challenge_detail(:'big') -> 'players') p
                  where (p ->> 'id')::uuid = tests.uid('c1')), 'chat', 'after playing, they show in full');
select tests.is((select played from public.my_challenges() where id = :'big'), 2, 'my_challenges counts who played');
select tests.is((select finished from public.my_challenges() where id = :'big'), false, 'and the challenge is still open');
select public.mark_challenge_seen(:'big', 'recap');
select public.mark_challenge_seen(:'big', 'nonsense');
select tests.is((select seen_recap from public.my_challenges() where id = :'big'), true, 'mark_challenge_seen marks the recap');
select tests.logout();

-- -------------------------------------------------------------- closing --

select tests.login('co');
select public.create_challenge('fr', 8, '{animaux}', array[tests.uid('c1')]) as duo \gset
select tests.is(public.rematch_challenge(:'duo', 9, '{animaux}'), null, 'no rematch while the challenge runs');
select public.submit_challenge_run(:'duo', 40, 0, 1, :words);
select tests.login('c1');
select public.submit_challenge_run(:'duo', 60, 0, 1, :words);
select tests.is((select finished from public.my_challenges() where id = :'duo'), true, 'the last run closes the challenge');
select tests.is(public.submit_challenge_run(:'duo', 60, 0, 1, :words), false, 'a closed challenge takes no run');
select tests.logout();
select tests.is((select count(*)::int from public.push_outbox where challenge_id = :'duo' and kind = 'recap'), 2,
                'the recap is queued for both players');
select tests.ok((select recap_queued_at is not null from public.challenges where id = :'duo'), 'and marked as queued');
select public.push_tick();
select public.queue_recaps(:'duo');
select tests.is((select count(*)::int from public.push_outbox where challenge_id = :'duo' and kind = 'recap'), 2,
                'the recap is announced once');

select tests.login('co');
select public.create_challenge('fr', 10, '{animaux}', array[tests.uid('c1'), tests.uid('c2')]) as slow \gset
select public.submit_challenge_run(:'slow', 40, 0, 1, :words);
select tests.logout();
update public.challenge_players set played_at = now() - interval '25 hours' where challenge_id = :'slow' and played_at is not null;
select tests.login('c1');
select tests.is((select finished from public.my_challenges() where id = :'slow'), true,
                'a day after the last run, the challenge is closed');
select tests.is(public.submit_challenge_run(:'slow', 40, 0, 1, :words), false, 'and takes no more runs');
select tests.is(public.rematch_challenge(:'slow', 11, '{animaux}'), null, 'a guest who did not play cannot ask a rematch');
select tests.logout();
select public.push_tick();
select tests.is((select array_agg(player_id) from public.push_outbox where challenge_id = :'slow' and kind = 'recap'),
                array[tests.uid('co')], 'the clock''s recap goes only to those who played');

select tests.login('co');
select public.create_challenge('fr', 12, '{animaux}', array[tests.uid('c1')]) as idle \gset
select tests.logout();
update public.challenges set created_at = now() - interval '25 hours' where id = :'idle';
select tests.ok(public.challenge_finished(:'idle'), 'a challenge nobody played closes a day after it opened');

-- ------------------------------------------------------------- rematch --

select tests.login('c2');
select tests.is(public.rematch_challenge(:'duo', 9, '{animaux}'), null, 'a stranger cannot ask a rematch');
select tests.login('co');
select public.rematch_challenge(:'duo', 9, '{pays}') as again \gset
select tests.ok(:'again' is not null, 'a player asks a rematch');
select tests.login('c1');
select tests.is(public.rematch_challenge(:'duo', 99, '{metiers}')::text, :'again', 'the second to ask joins the first one''s');
select tests.logout();
select tests.ok((select previous_id = :'duo' and owner = tests.uid('co') and category_ids = '{pays}' from public.challenges where id = :'again'),
                'the rematch follows the challenge, led by who asked');
select tests.is((select count(*)::int from public.challenge_players where challenge_id = :'again'), 2,
                'everyone who played is in it');
select tests.is(public.rematch_challenge(null, 1, '{pays}'), null, 'a null challenge has no rematch');

-- ---------------------------------------------------------------- RLS --

select tests.login('co');
select tests.is((select count(*)::int from public.challenges), 0, 'the challenge tables are closed to direct reads');
select tests.is((select count(*)::int from public.challenge_players), 0, 'both of them');
select tests.throws(format('insert into public.challenge_players (challenge_id, player_id) values (%L, %L)', :'big', tests.uid('cx')),
                    'and to direct writes', '42501');
select tests.is(tests.affected($$update public.challenge_players set score = 999$$), 0,
                'a score cannot be rewritten');
select tests.throws(format('select public.open_challenge(%L, 1, %L, array[%L::uuid], null)', 'fr', '{animaux}', tests.uid('cx')),
                    'open_challenge is not for clients', '42501');
select tests.throws(format('select public.challenge_finished(%L)', :'big'), 'nor challenge_finished', '42501');
select tests.logout();

-- --------------------------------------------------------------- races --

-- Two invitations sent at once must not make nine.
select tests.login('co');
select public.create_challenge('fr', 13, '{animaux}', array[tests.uid('c1')]) as race \gset
select tests.logout();
select tests.connect('a', 'co');
select tests.connect('b', 'co');
select dblink_exec('a', 'begin');
select tests.remote('a', format('select public.invite_to_challenge(%L, %L::uuid[])', :'race',
                                (select array_agg(tests.uid('c' || i)) from generate_series(2, 5) i)));
select dblink_send_query('b', format('select public.invite_to_challenge(%L, %L::uuid[])', :'race',
                                     (select array_agg(tests.uid('c' || i)) from generate_series(6, 8) i)));
select pg_sleep(0.2);
select dblink_exec('a', 'commit');
select tests.is((select v from dblink_get_result('b') as t(v text)), 'full', 'of two simultaneous invitations, the second finds it full');
select tests.is((select count(*)::int from public.challenge_players where challenge_id = :'race'), 6, 'and adds no one');
select dblink_disconnect('a');
select dblink_disconnect('b');

-- Two players asking a rematch at the same second get the same one.
select tests.login('co');
select public.create_challenge('fr', 14, '{animaux}', array[tests.uid('c1')]) as twin \gset
select public.submit_challenge_run(:'twin', 1, 0, 0, null);
select tests.login('c1');
select public.submit_challenge_run(:'twin', 2, 0, 0, null);
select tests.logout();
select tests.connect('a', 'co');
select tests.connect('b', 'c1');
select dblink_exec('a', 'begin');
select tests.remote('a', format('select public.rematch_challenge(%L, 15, %L)', :'twin', '{animaux}')) as first_rematch \gset
select dblink_send_query('b', format('select public.rematch_challenge(%L, 16, %L)', :'twin', '{animaux}'));
select pg_sleep(0.2);
select dblink_exec('a', 'commit');
select tests.is((select v from dblink_get_result('b') as t(v text)), :'first_rematch', 'two simultaneous rematches are one');
select tests.is((select count(*)::int from public.challenges where previous_id = :'twin'), 1, 'only one was opened');
select dblink_disconnect('a');
select dblink_disconnect('b');

-- A challenge played in turn closes more than four days after it opened:
-- its recap must still go.
select tests.login('co');
select public.create_challenge('fr', 17, '{animaux}', (select array_agg(tests.uid('c' || i)) from generate_series(1, 4) i)) as relay \gset
select tests.logout();
alter table public.challenge_players disable trigger challenge_players_push_recap;
update public.challenges set created_at = now() - interval '5 days' where id = :'relay';
update public.challenge_players p
   set played_at = now() - t.ago, score = 10
  from (values ('c1', interval '98 hours'), ('c2', interval '77 hours'), ('c3', interval '55 hours'), ('co', interval '26 hours')) t(label, ago)
 where p.challenge_id = :'relay' and p.player_id = tests.uid(t.label);
alter table public.challenge_players enable trigger challenge_players_push_recap;
select tests.ok(public.challenge_finished(:'relay'), 'the relay challenge has closed by the clock');
select public.push_tick();
select tests.is((select count(*)::int from public.push_outbox where challenge_id = :'relay' and kind = 'recap'), 4,
                'its recap goes to the four who played');
