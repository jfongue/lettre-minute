-- The leaderboards page: seven measures over three periods, named accounts
-- only, ties sharing a place, and the player's own line past the fifty.

select tests.new_user(n) from unnest(array['ka', 'kb', 'kc']) n;
select tests.new_user('kanon', true);

select tests.run_at('ka', now(), 100, array['k-one', 'k-two']);
select tests.run_at('ka', now() - interval '1 second', 40);
select tests.run_at('kb', now(), 100);
select tests.run_at('kc', public.period_start('week') - interval '1 day', 900);
select tests.run_at('kanon', now(), 5000);

select tests.login('ka');
select tests.is((select value from public.leaderboard_stat('best', 'day') where display_name = 'ka'), 100, 'best: the best run of the day');
select tests.is((select value from public.leaderboard_stat('points', 'day') where display_name = 'ka'), 140, 'points: every run summed');
select tests.is((select value from public.leaderboard_stat('runs', 'day') where display_name = 'ka'), 2, 'runs: counted');
select tests.is((select value from public.leaderboard_stat('words', 'day') where display_name = 'ka'), 2, 'words: summed');
select tests.is((select value from public.leaderboard_stat('discoveries', 'all') where display_name = 'ka'), 2, 'discoveries: all time');
select tests.is((select place from public.leaderboard_stat('best', 'day') where display_name = 'kb'),
                (select place from public.leaderboard_stat('best', 'day') where display_name = 'ka'), 'equal values share a place');
select tests.ok(not exists (select 1 from public.leaderboard_stat('best', 'week') where display_name = 'kc'), 'last week is off the week');
select tests.is((select value from public.leaderboard_stat('best', 'all') where display_name = 'kc'), 900, 'but on the total');
select tests.ok(not exists (select 1 from public.leaderboard_stat('best', 'all') where value = 5000), 'never an anonymous player');
select tests.is((select mine from public.leaderboard_stat('best', 'day') where display_name = 'ka'), true, 'the player sees his own line');
select tests.is((select count(*)::int from public.leaderboard_stat('best', 'day') where mine), 1, 'and only his');
select tests.is((select count(*)::int from public.leaderboard_stat('nonsense', 'day')), 0, 'an unknown measure is empty');
select tests.is((select count(*)::int from public.leaderboard_stat('best', null)), 0, 'so is a null period');
select tests.ok(not exists (select 1 from public.leaderboard_stat('added', 'all') where value <= 0), 'no zero line');

-- The house bots play every hour (0006): their runs are really there, and no
-- measure of any period shows them (0024).
select tests.logout();
insert into public.runs (player_id, seed, score, words, created_at)
select b.id, 1, 9999, 4, now() from public.bots b;

select tests.ok(exists (select 1 from public.runs r join public.bots b on b.id = r.player_id where r.score = 9999),
                'house bots do play');
select tests.ok(not exists (select 1 from public.leaderboard_values('best', now() - interval '1 day') v
                              join public.bots b on b.id = v.player_id),
                'no house bot among the raw values');

select tests.login('ka');
select tests.ok(not exists (select 1
                              from unnest(array['best', 'points', 'runs', 'words', 'discoveries', 'combo', 'added']) as st(stat)
                              cross join unnest(array['day', 'week', 'all']) as pe(period)
                              cross join lateral public.leaderboard_stat(st.stat, pe.period) l
                              join public.profiles p on p.display_name = l.display_name
                              join public.bots b on b.id = p.id),
                'nor on any measure of any period');

-- Sixty players ahead: the player's line comes last, flagged beyond the page.
select tests.new_user('crowd' || n) from generate_series(1, 60) n;
select tests.run_at('crowd' || n, now(), 1000 + n) from generate_series(1, 60) n;
select tests.is((select count(*)::int from public.leaderboard_stat('best', 'day') where not extra), 50, 'fifty rows on the page');
select tests.is((select place from public.leaderboard_stat('best', 'day') where extra), 61, 'and the player past them, at his place');
select tests.is((select mine from public.leaderboard_stat('best', 'day') where extra), true, 'which is his own');
select tests.logout();

-- A word accepted by the moderators counts for the one who proposed it.
select tests.new_user('kadd');
select tests.propose('kadd', 'animaux', 'k-mot');
select tests.new_user(n) from unnest(array['km1', 'km2', 'km3']) n;
select tests.make_moderator(n) from unnest(array['km1', 'km2', 'km3']) n;
select tests.vote(n, 'animaux', 'k-mot', 'correct') from unnest(array['km1', 'km2', 'km3']) n;
select tests.login('ka');
select tests.is((select value from public.leaderboard_stat('added', 'day') where display_name = 'kadd'), 1, 'added: an accepted word');
select tests.logout();

select tests.login_anon();
select tests.throws($$select * from public.leaderboard_stat('best', 'day')$$, 'a request with no session reads nothing', '42501');
select tests.throws($$select * from public.leaderboard_values('best', now())$$, 'nor the raw values', '42501');
select tests.logout();
