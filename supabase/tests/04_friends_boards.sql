-- Friendships through their three functions, and the three boards: named
-- accounts only, periods in Paris time, discoveries judged on the seven days
-- before each run.

select tests.new_user(n) from unnest(array['fa', 'fb', 'fc', 'fd']) n;
select tests.new_user('fanon', true);

-- ------------------------------------------------------------ requests --

select tests.login('fanon');
select tests.is(public.request_friend('fa'), 'anonymous', 'an anonymous player cannot ask');
select tests.logout();

select tests.login('fa');
select tests.is(public.request_friend('nobody'), 'unknown', 'an unknown name is unknown');
select tests.is(public.request_friend(null), 'unknown', 'a null name is unknown');
select tests.is(public.request_friend(''), 'unknown', 'an empty name is unknown');
select tests.is(public.request_friend(repeat('fb', 50000)), 'unknown', 'a huge name is unknown');
select tests.is(public.request_friend('Anonyme'), 'unknown', 'an anonymous player cannot be found');
select tests.is(public.request_friend('%'), 'unknown', 'a name is not a pattern');
select tests.is(public.request_friend(' FA '), 'self', 'a player cannot ask himself');
select tests.is(public.request_friend('  FB  '), 'sent', 'a name is found trimmed, whatever the case');
select tests.is(public.request_friend('fb'), 'already', 'a request is sent once');
select tests.is((select relation from public.my_friends() where id = tests.uid('fb')), 'outgoing', 'the asker sees it outgoing');
select tests.logout();

select tests.login('fb');
select tests.is((select relation from public.my_friends() where id = tests.uid('fa')), 'incoming', 'the other sees it incoming');
select tests.is(public.request_friend('fa'), 'accepted', 'asking back accepts');
select tests.is(public.request_friend('fa'), 'already', 'and then they are friends');
select tests.is((select relation from public.my_friends() where id = tests.uid('fa')), 'friend', 'on both sides');
select tests.logout();
select tests.is((select count(*)::int from public.friendships
                  where tests.uid('fa') in (requester, addressee) and tests.uid('fb') in (requester, addressee)), 1,
                'a friendship is one row');

-- ------------------------------------------------------------- answers --

select tests.login('fa');
select public.request_friend('fc');
select public.respond_friend(tests.uid('fc'), true);
select tests.is((select relation from public.my_friends() where id = tests.uid('fc')), 'outgoing',
                'a player cannot accept his own request');
select tests.login('fd');
select public.respond_friend(tests.uid('fa'), true);
select tests.is((select count(*)::int from public.my_friends()), 0, 'nor can a third player');
select public.remove_friend(tests.uid('fa'));
select tests.login('fc');
select public.respond_friend(tests.uid('fa'), false);
select tests.is((select count(*)::int from public.my_friends()), 0, 'refusing deletes the request');
select tests.logout();

select tests.login('fa');
select tests.is(public.request_friend('fc'), 'sent', 'a refused player may ask again');
select tests.login('fc');
select public.respond_friend(tests.uid('fa'), true);
select tests.is((select relation from public.my_friends() where id = tests.uid('fa')), 'friend', 'the addressee accepts');
select public.respond_friend(tests.uid('fa'), false);
select tests.is((select relation from public.my_friends() where id = tests.uid('fa')), 'friend',
                'refusing an accepted friendship does nothing');
select public.remove_friend(tests.uid('fa'));
select tests.is((select count(*)::int from public.my_friends() where id = tests.uid('fa')), 0, 'the addressee may remove it');
select tests.login('fa');
select public.request_friend('fc');
select public.remove_friend(tests.uid('fc'));
select tests.is((select count(*)::int from public.my_friends() where id = tests.uid('fc')), 0, 'the asker may cancel');
select public.remove_friend(null);
select public.respond_friend(null, true);
select tests.is((select count(*)::int from public.my_friends()), 1, 'null arguments change nothing');

select tests.is(public.request_friend('maxitoon'), 'sent', 'a house bot is asked like anyone');
select tests.is((select relation from public.my_friends() where display_name = 'Maxitoon'), 'friend',
                'and accepts at once');

-- ----------------------------------------------------------------- RLS --

select tests.login('fd');
select tests.is((select count(*)::int from public.friendships), 0, 'a player reads only his own friendships');
select tests.throws($$insert into public.friendships (requester, addressee, status)
                      values (tests.uid('fd'), tests.uid('fa'), 'accepted')$$,
                    'a player cannot write a friendship by hand', '42501');
select tests.login('fa');
select tests.is(tests.affected($$update public.friendships set status = 'accepted'$$), 0,
                'nor accept one by hand');
select tests.is(tests.affected($$delete from public.friendships$$), 0,
                'nor delete one by hand');
select tests.login_anon();
select tests.throws($$select public.request_friend('fa')$$, 'a request with no session cannot ask', '42501');
select tests.throws($$select * from public.my_friends()$$, 'nor list friends', '42501');
select tests.logout();

-- -------------------------------------------------------------- boards --

select tests.new_user(n) from unnest(array['la', 'lb', 'lc']) n;
select tests.new_user('lanon', true);

select tests.run_at('la', now(), 100);
select tests.run_at('lanon', now(), 500);
select tests.run_at('lb', public.period_start('week') - interval '1 second', 900);
select tests.run_at('lc', now(), 50);
select tests.run_at('lc', now() - interval '1 second', 70);
update public.profiles set runs = 1, best_score = 500 where id = tests.uid('lanon');
update public.profiles set runs = 1, best_score = 100 where id = tests.uid('la');

select tests.login('la');
select tests.is((select value from public.leaderboard_board('day') where display_name = 'la'), 100, 'the day board shows a named player');
select tests.is((select value from public.leaderboard_board('day') where display_name = 'lc'), 70, 'with his best run of the day');
select tests.ok(not exists (select 1 from public.leaderboard_board('day') where value = 500), 'never an anonymous one');
select tests.ok(not exists (select 1 from public.leaderboard_board('day') where display_name = 'Anonyme'), 'not even by name');
select tests.ok(not exists (select 1 from public.leaderboard_board('week') where display_name = 'lb'),
                'a run before Monday is off the week board');
select tests.ok(exists (select 1 from public.leaderboard_board('week') where display_name = 'la'), 'a run today is on it');
select tests.ok((select bool_and(a.value >= b.value) from
                  (select value, row_number() over () n from public.leaderboard_board('day')) a
                  join (select value, row_number() over () n from public.leaderboard_board('day')) b on b.n = a.n + 1),
                'the board is sorted by value');
select tests.is((select count(*)::int from public.leaderboard_board('nonsense')), (select count(*)::int from public.leaderboard_board('day')),
                'an unknown board reads as the day');
select tests.is((select count(*)::int from public.leaderboard_board(null)), (select count(*)::int from public.leaderboard_board('day')),
                'so does a null one');
select tests.ok(exists (select 1 from public.leaderboard where display_name = 'la'), 'the record board shows named players');
select tests.ok(not exists (select 1 from public.leaderboard where id = tests.uid('lanon')), 'and hides anonymous ones');
select tests.login_anon();
select tests.throws($$select * from public.leaderboard_board('day')$$, 'a request with no session reads no board', '42501');
select tests.logout();

-- --------------------------------------------------------- house bots --

-- They play every hour (0006) and their runs are really there; no board
-- shows one of them (0024). Read before the login: RLS shows a player only
-- his own runs.
insert into public.runs (player_id, seed, score, words, created_at)
select b.id, 1, 999, 4, now() from public.bots b;

select tests.ok(exists (select 1 from public.runs r join public.bots b on b.id = r.player_id where r.score = 999),
                'house bots do play');

select tests.login('la');
select tests.ok(not exists (select 1 from public.leaderboard_board('day') d
                              join public.profiles p on p.display_name = d.display_name
                              join public.bots b on b.id = p.id),
                'no house bot on the day board');
select tests.ok(not exists (select 1 from public.leaderboard_board('week') d
                              join public.profiles p on p.display_name = d.display_name
                              join public.bots b on b.id = p.id),
                'nor on the week one');
select tests.ok(not exists (select 1 from public.leaderboard where id in (select id from public.bots)),
                'nor on the record board');
select tests.logout();

-- ---------------------------------------------------------- discoveries --

select tests.run_at('lb', now() - interval '3 days', 10, array['x-seen']);
select tests.run_at('lc', now() - interval '8 days', 10, array['y-old']);
select tests.run_at('lc', now() - interval '7 days' + interval '1 minute', 10, array['edge-in']);
select tests.run_at('lc', now() - interval '7 days' - interval '1 minute', 10, array['edge-out']);
select tests.run_at('lanon', now() - interval '2 seconds', 10, array['v-anon']);
select tests.run_at('la', now() - interval '1 second', 10, array['w-twice']);
select tests.run_at('la', now(), 10, array['x-seen', 'y-old', 'z-new', 'w-twice', 'edge-in', 'edge-out', 'v-anon']);
select tests.run_at('la', now(), 10, array['x-seen'], 'fruits');

select tests.login('la');
select tests.is((select value from public.leaderboard_board('discoveries') where display_name = 'la'), 5,
                'discoveries: new, forgotten for a week, other category, first of two; not seen within seven days');
select tests.ok(not exists (select 1 from public.leaderboard_board('discoveries') where display_name = 'Anonyme'),
                'an anonymous player has no discoveries shown, though his words count against others');
select tests.logout();
select tests.ok(not exists (select 1 from public.leaderboard_board('discoveries') d join public.bots b on true
                             join public.profiles p on p.id = b.id where d.display_name = p.display_name),
                'house bots discover nothing');

-- ----------------------------------------------------------- run dates --

select tests.new_user('early');
select tests.login('early');
select tests.throws($$insert into public.runs (player_id, seed, score, created_at)
                      values (tests.uid('early'), 1, 9999, now() + interval '10 years')$$,
                    'a client cannot date a run in the future', '42501');
select tests.throws($$insert into public.runs (player_id, seed, score, created_at)
                      values (tests.uid('early'), 2, 10, now() - interval '1 hour')$$,
                    'nor in the past', '42501');
select tests.lives($$insert into public.runs (player_id, seed, score, words) values (tests.uid('early'), 3, 10, 1)$$,
                   'a run goes in as the app sends it');
select tests.lives($$insert into public.run_words (run_id, word, category_id)
                     select id, 'sphinx', 'animaux' from public.runs where player_id = tests.uid('early') and seed = 3$$,
                   'and its words right after');
select tests.logout();
select tests.run_at('early', now() - interval '2 days', 10);
select tests.login('early');
select tests.throws($$insert into public.run_words (run_id, word, category_id)
                      select id, 'phenix', 'animaux' from public.runs
                       where player_id = tests.uid('early') and created_at < now() - interval '1 day'$$,
                    'words cannot be added to an old run', '42501');
select tests.logout();

-- ----------------------------------------------------------------- race --

-- Two players asking each other at the same moment: the pair index makes the
-- second wait, then accept the first.
select tests.new_user('ra');
select tests.new_user('rb');
select tests.connect('a', 'ra');
select tests.connect('b', 'rb');
select dblink_exec('a', 'begin');
select tests.is(tests.remote('a', 'select public.request_friend(''rb'')'), 'sent', 'the first of two crossed requests is sent');
select dblink_send_query('b', 'select public.request_friend(''ra'')');
select pg_sleep(0.2);
select dblink_exec('a', 'commit');
select tests.is((select v from dblink_get_result('b') as t(v text)), 'accepted', 'the second accepts it');
select dblink_disconnect('a');
select dblink_disconnect('b');
select tests.is((select string_agg(status, ',') from public.friendships
                  where tests.uid('ra') in (requester, addressee) and tests.uid('rb') in (requester, addressee)), 'accepted',
                'they make one friendship');
select tests.throws(format('insert into public.friendships (requester, addressee) values (%L, %L)', tests.uid('rb'), tests.uid('ra')),
                    'the reverse row cannot exist', '23505');
