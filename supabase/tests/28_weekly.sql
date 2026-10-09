-- Le défi du moment (0062) : le serveur fait foi du compte des tentatives, de
-- la fenêtre (semaine et jour de Paris), du classement, des mesures des
-- trophées et des réactions.

select tests.new_user(n) from unnest(array['wa', 'wb', 'wc']) n;
select tests.new_user('wn', true);

create function tests.week() returns date
language sql stable security definer set search_path = public as $$ select week_id from public.weekly_window() $$;
create function tests.today() returns date
language sql stable security definer set search_path = public as $$ select day from public.weekly_window() $$;
create function tests.bot() returns uuid
language sql stable security definer set search_path = public as $$ select id from public.bots order by id limit 1 $$;
create function tests.attempts(p_label text) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.weekly_attempts where player_id = tests.uid(p_label)
$$;

-- ------------------------------------------------------------- fenêtre --

-- Le dimanche 21 h de Paris ouvre la semaine, en heure d'été comme d'hiver.
select tests.is((select week_id from public.weekly_window('2026-10-11 18:59:59+00')), date '2026-10-04', 'Sunday 20:59 Paris is still last week');
select tests.is((select week_id from public.weekly_window('2026-10-11 19:00:00+00')), date '2026-10-11', 'Sunday 21:00 Paris opens the week');
select tests.is((select week_id from public.weekly_window('2026-11-01 19:59:59+00')), date '2026-10-25', 'the same in winter time, before 21:00');
select tests.is((select week_id from public.weekly_window('2026-11-01 20:00:00+00')), date '2026-11-01', 'and at 21:00');
select tests.is((select day from public.weekly_window('2026-10-14 22:00:00+00')), date '2026-10-15', 'the day turns at Paris midnight');
select tests.is((select week_id from public.weekly_window('2026-10-14 12:00:00+00')), date '2026-10-11', 'a Wednesday belongs to the week opened the Sunday before');

-- ------------------------------------------------------------ tentatives --

select tests.login('wn');
select tests.throws(format($$select * from public.weekly_start(%L, 'fr', %L, 2)$$, tests.week(), tests.today()),
  'an anonymous player starts no attempt', '42501');
select tests.logout();

select tests.login_anon();
select tests.throws(format($$select * from public.weekly_start(%L, 'fr', %L, 2)$$, tests.week(), tests.today()),
  'a request with no session is refused', '42501');
select tests.logout();

select tests.login('wa');
create temp table a1 as select * from public.weekly_start(tests.week(), 'fr', tests.today(), 2);
create temp table a2 as select * from public.weekly_start(tests.week(), 'fr', tests.today(), 2);
grant select on a1, a2 to public;
select tests.is((select n from a1), 1, 'the first attempt is numbered 1');
select tests.is((select n from a2), 2, 'the second is numbered 2');
select tests.is((select count(*)::int from public.weekly_start(tests.week(), 'fr', tests.today(), 2)), 0, 'the quota refuses a third');
select tests.is((select n from public.weekly_start(tests.week(), 'fr', tests.today(), 3)), 3, 'a bigger quota, an ad watched, opens it');
select tests.is((select count(*)::int from public.weekly_start(tests.week(), 'fr', tests.today(), 99)), 1, 'whatever the client claims, 5 is the hard ceiling: a fourth is still granted');
select tests.is((select n from public.weekly_start(tests.week(), 'fr', tests.today(), 99)), 5, 'and a fifth');
select tests.is((select count(*)::int from public.weekly_start(tests.week(), 'fr', tests.today(), 99)), 0, 'and never a sixth');
select tests.is((select n from public.weekly_start(tests.week(), 'en', tests.today(), 2)), 1, 'another language is another game with its own count');
select tests.is((select count(*)::int from public.weekly_start(tests.week() - 7, 'fr', tests.today(), 2)), 0, 'a stale week is refused');
select tests.is((select count(*)::int from public.weekly_start(tests.week(), 'fr', tests.today() - 1, 2)), 0, 'a stale day is refused');
select tests.is((select count(*)::int from public.weekly_start(tests.week() + 1, 'fr', tests.today(), 2)), 0, 'a week that is not a Sunday is refused');
select tests.throws(format($$select * from public.weekly_start(%L, 'FR', %L, 2)$$, tests.week(), tests.today()), 'an invalid language is refused', '22023');
select tests.logout();

select tests.login('wb');
select tests.is((select n from public.weekly_start(tests.week(), 'fr', tests.today(), 0)), null, 'a zero quota grants nothing');
select tests.is(tests.attempts('wb'), 0, 'and writes nothing');
select tests.logout();

-- ---------------------------------------------------------------- rendu --

select tests.login('wa');
select tests.is(public.weekly_finish((select attempt_id from a1), 31.5,
  '[{"categoryId":"animaux","key":"chat","display":"Chat","points":10,"tier":"courant","approximate":false,"seconds":2.4,"at":5},
    {"categoryId":"animaux","key":"okapi","display":"Okapi","points":40,"tier":"rare","approximate":false,"seconds":6.1,"at":14}]'::jsonb,
  'survival', 4), true, 'a result is taken');
select tests.is(public.weekly_finish((select attempt_id from a1), 99, '[]'::jsonb, 'survival'), false, 'once only');
select tests.is(public.weekly_finish((select attempt_id from a2), 44.0,
  '[{"categoryId":"animaux","key":"chat","display":"Chat","points":10,"tier":"courant","approximate":false,"seconds":1.1,"at":3},
    {"categoryId":"animaux","key":"hippopotame","display":"Hippopotame","points":30,"tier":"peu commun","approximate":false,"seconds":9,"at":20}]'::jsonb,
  'survival', 7), true, 'a second attempt is taken');
select tests.throws($$select public.weekly_finish(gen_random_uuid(), -1, '[]'::jsonb, 'score')$$, 'a negative value is refused', '22023');
select tests.throws($$select public.weekly_finish(gen_random_uuid(), 5, '[]'::jsonb, 'speed')$$, 'an unknown metric is refused', '22023');
select tests.throws($$select public.weekly_finish(gen_random_uuid(), 5, '{}'::jsonb, 'score')$$, 'words must be a list', '22023');
select tests.logout();

select tests.login('wc');
select tests.is(public.weekly_finish((select attempt_id from a1), 500, '[]'::jsonb, 'survival'), false, 'nobody finishes another player’s attempt');
select tests.is(tests.week()::text <> '', true, 'the window is readable');
create temp table c1 as select * from public.weekly_start(tests.week(), 'fr', tests.today(), 2);
grant select on c1 to public;
select tests.is(public.weekly_finish((select attempt_id from c1), 20,
  '[{"categoryId":"animaux","key":"chat","display":"Chat","points":10,"tier":"courant","approximate":false,"seconds":1.9,"at":4},
    {"categoryId":"animaux","key":"zebre","display":"Zèbre","points":20,"tier":"courant","approximate":true,"seconds":3,"at":9}]'::jsonb,
  'survival', 2), true, 'a third player plays');
select tests.logout();

select tests.login('wb');
create temp table b1 as select * from public.weekly_start(tests.week(), 'fr', tests.today(), 2);
grant select on b1 to public;
select tests.is(public.weekly_finish((select attempt_id from b1), 12.0, '[]'::jsonb, 'survival'), true, 'a fourth plays, with no words');
select tests.logout();

-- Une tentative lancée il y a plus d'une demi-heure n'est plus une partie.
select tests.login('wa');
create temp table a3 as select * from public.weekly_start(tests.week(), 'fr', tests.today(), 3);
grant select on a3 to public;
select tests.logout();
create function tests.age_attempt(p_attempt uuid) returns void
language sql security definer set search_path = public as $$
  update public.weekly_attempts set started_at = now() - interval '31 minutes' where id = p_attempt
$$;
select tests.age_attempt((select attempt_id from a3));
select tests.login('wa');
select tests.is(public.weekly_finish((select attempt_id from a3), 60, '[]'::jsonb, 'survival'), false, 'a stale attempt is refused');
select tests.logout();

-- ------------------------------------------------------------ classement --

select tests.login('wb');
create temp table board as select * from public.weekly_board(tests.week(), 'fr', 50);
grant select on board to public;
select tests.is((select count(*)::int from board), 3, 'one row per player, the best attempt of each');
select tests.is((select array_agg(display_name order by rank)::text from board), '{wa,wc,wb}', 'sorted by value, descending');
select tests.is((select value from board where display_name = 'wa'), 44.0, 'wa’s best attempt, not the last one');
select tests.is((select attempts from board where display_name = 'wa'), 2, 'counting the attempts that returned a result');
select tests.is((select me from board where display_name = 'wb'), true, 'the board says which row is mine');
select tests.is((select count(*)::int from public.weekly_board(tests.week(), 'fr', 1)), 1, 'the limit applies');
select tests.is((select count(*)::int from public.weekly_board(tests.week(), 'en', 50)), 0, 'another language has its own board');
select tests.logout();

-- Les joueurs maison jouent ailleurs : jamais ici, même s'ils y entraient.
create function tests.bot_plays() returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.weekly_attempts (player_id, week_id, lang, day, n, finished_at, metric, value, words)
  values (tests.bot(), tests.week(), 'fr', tests.today(), 1, now(), 'survival', 9999, '[]'::jsonb);
end;
$$;
select tests.bot_plays();
select tests.login('wb');
select tests.is((select count(*)::int from public.weekly_board(tests.week(), 'fr', 50)), 3, 'house players stay off the board');
select tests.is((select max(value) from public.weekly_board(tests.week(), 'fr', 50)), 44.0, 'whatever they would score');
select tests.logout();

-- ---------------------------------------------------------------- récap --

select tests.login('wa');
select tests.is(public.weekly_recap(tests.week(), 'fr') -> 'rank', '1'::jsonb, 'my final rank');
select tests.is(public.weekly_recap(tests.week(), 'fr') -> 'players', '3'::jsonb, 'out of the players ranked');
select tests.is(public.weekly_recap(tests.week(), 'fr') -> 'best', '44.0'::jsonb, 'my best');
select tests.is(jsonb_array_length(public.weekly_recap(tests.week(), 'fr') -> 'attempts'), 5, 'every attempt I started, in the order played');
select tests.is(public.weekly_recap(tests.week(), 'fr') #>> '{attempts,0,value}', '31.5', 'the first one first');
select tests.logout();
select tests.login('wb');
select tests.is(public.weekly_recap(tests.week(), 'fr') -> 'rank', '3'::jsonb, 'another player, another rank');
select tests.logout();

-- La semaine en cours n'est pas encore « jouée » ; une close l'est.
select tests.login('wa');
select tests.is(public.weekly_last_played('fr'), null::date, 'the week under way does not count for a recap');
select tests.logout();
create function tests.shift_week() returns void
language sql security definer set search_path = public as $$
  update public.weekly_attempts set week_id = week_id - 7, day = day - 7 where player_id = tests.uid('wa')
$$;
select tests.shift_week();
select tests.login('wa');
select tests.is(public.weekly_last_played('fr'), tests.week() - 7, 'a closed week with a result is the one to recap');
select tests.is(public.weekly_last_played('en'), null::date, 'in its own language');
select tests.logout();
-- Revenu à la semaine en cours pour la suite.
create function tests.unshift_week() returns void
language sql security definer set search_path = public as $$
  update public.weekly_attempts set week_id = week_id + 7, day = day + 7 where player_id = tests.uid('wa')
$$;
select tests.unshift_week();

-- ------------------------------------------------------------- mesures --

select tests.login('wb');
create temp table measures as select * from public.weekly_measures(tests.week(), 'fr');
grant select on measures to public;
select tests.is((select count(*)::int from measures), 3, 'one row of measures per player');
select tests.is((select original from measures m join public.profiles p on p.id = m.player_id where p.display_name = 'wa'), 2, 'wa wrote two words nobody else did (okapi, hippopotame)');
select tests.is((select sheep from measures m join public.profiles p on p.id = m.player_id where p.display_name = 'wa'), 1, 'and shared one (chat), counted once across attempts');
select tests.is((select rarest_word from measures m join public.profiles p on p.id = m.player_id where p.display_name = 'wa'), 'Okapi', 'wa’s rarest word');
select tests.is((select rarest_tier from measures m join public.profiles p on p.id = m.player_id where p.display_name = 'wa'), 2, 'at its tier');
select tests.is((select climb from measures m join public.profiles p on p.id = m.player_id where p.display_name = 'wa'), 12.5, 'the climb from the first attempt to the best');
select tests.is((select m.best_combo from measures m join public.profiles p on p.id = m.player_id where p.display_name = 'wa'), 7, 'the best series');
select tests.is((select fastest from measures m join public.profiles p on p.id = m.player_id where p.display_name = 'wa'), 1.1, 'the quickest answer');
select tests.is((select longest_word from measures m join public.profiles p on p.id = m.player_id where p.display_name = 'wa'), 'Hippopotame', 'the longest word');
select tests.is((select longest from measures m join public.profiles p on p.id = m.player_id where p.display_name = 'wa'), 11, 'in letters');
select tests.is((select attempts from measures m join public.profiles p on p.id = m.player_id where p.display_name = 'wa'), 5, 'attempts counted from those started');
select tests.is((select fastest from measures m join public.profiles p on p.id = m.player_id where p.display_name = 'wc'), 1.9, 'a corrected word is not a quick answer: only the exact one counts');
select tests.is((select longest from measures m join public.profiles p on p.id = m.player_id where p.display_name = 'wb'), 0, 'no words, no longest');
select tests.logout();

-- ------------------------------------------------------------ réactions --

select tests.login('wa');
select tests.is(public.react_in_weekly(tests.week(), 'fr', 'trophy:weekly-rarest', '🔥'), true, 'a player who played reacts');
select tests.is(public.react_in_weekly(tests.week(), 'fr', 'podium:1', '👏'), true, 'on a podium place too');
select tests.is(public.react_in_weekly(tests.week(), 'fr', 'podium:1', '🏆'), true, 'a second reaction on a target replaces the first');
select tests.is(public.react_in_weekly(tests.week(), 'fr', 'podium:1', '💩'), false, 'only the six emojis');
select tests.logout();
select tests.login('wb');
select tests.is(public.react_in_weekly(tests.week(), 'fr', 'trophy:weekly-rarest', '🔥'), true, 'a second player reacts');
select tests.logout();
select tests.login('wn');
select tests.is(public.react_in_weekly(tests.week(), 'fr', 'trophy:weekly-rarest', '🔥'), false, 'someone who did not play cannot');
select tests.is((select count(*)::int from public.weekly_reaction_counts(tests.week(), 'fr')), 0, 'nor read them');
select tests.logout();

select tests.login('wa');
create temp table counts as select * from public.weekly_reaction_counts(tests.week(), 'fr');
grant select on counts to public;
select tests.is((select n from counts where target = 'trophy:weekly-rarest' and emoji = '🔥'), 2, 'counts are aggregated per target and emoji');
select tests.is((select mine from counts where target = 'trophy:weekly-rarest' and emoji = '🔥'), true, 'mine is flagged');
select tests.is((select emoji from counts where target = 'podium:1'), '🏆', 'the replaced reaction is the only one left');
select tests.is(public.react_in_weekly(tests.week(), 'fr', 'podium:1', null), true, 'a null emoji takes it back');
select tests.is((select count(*)::int from public.weekly_reaction_counts(tests.week(), 'fr') where target = 'podium:1'), 0, 'and it is gone');
select tests.logout();

select tests.login('wb');
select tests.is((select mine from public.weekly_reaction_counts(tests.week(), 'fr') where target = 'trophy:weekly-rarest'), true, 'mine is per reader');
select tests.is((select count(*)::int from public.weekly_attempts), 0, 'the table is closed to players: RLS shows them nothing');
select tests.logout();
