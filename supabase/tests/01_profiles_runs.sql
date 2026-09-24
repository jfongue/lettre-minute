-- Profiles born with the account, and what RLS lets a player read and write
-- among profiles, runs and run words.

select tests.new_user('alice');
select tests.new_user('bob');
select tests.new_user('ghost', true);

-- ------------------------------------------------------------- birth --

select tests.is((select count(*)::int from public.profiles where id = tests.uid('ghost')), 1,
                'an anonymous account gets a profile at birth');
select tests.is((select display_name from public.profiles where id = tests.uid('ghost')), 'Anonyme',
                'the profile is born « Anonyme »');
select tests.is((select xp + runs + best_score + words_found + best_combo from public.profiles where id = tests.uid('ghost')), 0,
                'the profile is born with zeroed totals');
select tests.ok((select count(*) from public.profiles p left join auth.users u on u.id = p.id where u.id is null) = 0,
                'no profile without its auth user');
select tests.is((select count(*)::int from public.bots b join public.profiles p on p.id = b.id), 2,
                'both house bots exist with a profile');
select tests.ok(exists (select 1 from cron.job where jobname = 'house-bots'), 'house-bots is scheduled');
select tests.ok(exists (select 1 from cron.job where jobname = 'push-challenges'), 'push-challenges is scheduled');

-- ------------------------------------------------------------ profiles --

select tests.login('alice');

select tests.ok((select count(*) from public.profiles) >= 3, 'a player reads every profile');
select tests.is(tests.affected($$update public.profiles set xp = 42 where id = tests.uid('alice')$$), 1, 'a player updates his own profile');
select tests.is(tests.affected($$update public.profiles set xp = 42 where id = tests.uid('bob')$$), 0, 'a player cannot update another profile');
select tests.throws($$update public.profiles set id = gen_random_uuid() where id = tests.uid('alice')$$,
                    'a player cannot move his profile to another id', '42501');
select tests.throws($$insert into public.profiles (id) values (gen_random_uuid())$$,
                    'a player cannot insert a profile', '42501');
select tests.is(tests.affected($$delete from public.profiles$$), 0,
                'a player cannot delete profiles');

select tests.throws($$update public.profiles set display_name = 'BOB' where id = tests.uid('alice')$$,
                    'names are unique whatever the case', '23505');
select tests.throws($$update public.profiles set display_name = '' where id = tests.uid('alice')$$,
                    'an empty name is refused', '23514');
select tests.throws($$update public.profiles set display_name = repeat('x', 25) where id = tests.uid('alice')$$,
                    'a 25-character name is refused', '23514');
select tests.lives($$update public.profiles set display_name = repeat('é', 24) where id = tests.uid('alice')$$,
                   'a 24-character name counts characters, not bytes');
select tests.throws($$update public.profiles set display_name = null where id = tests.uid('alice')$$,
                    'a null name is refused', '23502');
select tests.throws($$update public.profiles set xp = -1 where id = tests.uid('alice')$$,
                    'negative totals are refused', '23514');
select tests.lives($$update public.profiles set display_name = 'O''Brien; drop table runs' where id = tests.uid('alice')$$,
                   'a name with quotes is stored as data');
select tests.lives($$update public.profiles set display_name = 'alice' where id = tests.uid('alice')$$,
                   'a player takes his name back');

select tests.logout();

select tests.lives($$update public.profiles set display_name = 'Anonyme' where id in (tests.uid('alice'), tests.uid('bob'))$$,
                   '« Anonyme » may be shared');
update public.profiles set display_name = 'alice' where id = tests.uid('alice');
update public.profiles set display_name = 'bob' where id = tests.uid('bob');

-- -------------------------------------------------------------- runs --

select tests.login('alice');

select tests.lives($$insert into public.runs (player_id, seed, score, words) values (tests.uid('alice'), 7, 80, 2)$$,
                   'a player inserts his own run');
select tests.throws($$insert into public.runs (player_id, seed, score) values (tests.uid('bob'), 7, 999)$$,
                    'a player cannot insert a run for another', '42501');
select tests.throws($$insert into public.runs (player_id, seed, score) values (tests.uid('alice'), 7, -5)$$,
                    'a negative score is refused', '23514');
select tests.throws($$insert into public.runs (player_id, seed, score) values (tests.uid('alice'), null, 5)$$,
                    'a run needs its seed', '23502');
select tests.is(tests.affected($$update public.runs set score = 9999$$), 0,
                'a run is never updated');
select tests.is(tests.affected($$delete from public.runs$$), 0,
                'a run is never deleted');
select tests.is((select score from public.runs where player_id = tests.uid('alice')), 80,
                'the score stays as inserted');

select tests.lives($$insert into public.run_words (run_id, word, category_id, points)
                     select id, 'chat', 'animaux', 10 from public.runs where player_id = tests.uid('alice')$$,
                   'a player adds words to his own run');
select tests.throws($$insert into public.run_words (run_id, word, category_id, points)
                      select id, 'chat', 'animaux', 10 from public.runs where player_id = tests.uid('alice')$$,
                    'a word appears once per run', '23505');
select tests.is(tests.affected($$update public.run_words set points = 500$$), 0,
                'run words are never updated');

select tests.logout();
select tests.run_at('bob', now(), 30);
select tests.login('alice');

select tests.throws($$insert into public.run_words (run_id, word, category_id)
                      select id, 'chien', 'animaux' from public.runs where player_id = tests.uid('bob')$$,
                    'a player cannot add words to another''s run', '42501');
select tests.ok((select count(*) from public.runs where player_id = tests.uid('bob')) = 1,
                'a player reads the runs of others');

-- Daily seeds are the server's to set.
select tests.throws($$insert into public.daily_challenges (day, seed) values (current_date, 1)$$,
                    'a player cannot write the daily seed', '42501');
select tests.throws($$insert into public.dictionary_words (category_id, word, display) values ('animaux', 'licorne', 'Licorne')$$,
                    'a player cannot write the dictionary', '42501');

select tests.login_anon();

select tests.is((select count(*)::int from public.profiles), 0, 'a request with no session reads no profile');
select tests.is((select count(*)::int from public.runs), 0, 'a request with no session reads no run');
select tests.throws($$insert into public.runs (player_id, seed, score) values (tests.uid('alice'), 7, 1)$$,
                    'a request with no session cannot insert a run', '42501');

select tests.logout();
