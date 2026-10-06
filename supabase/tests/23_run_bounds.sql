-- Une partie doit tenir debout : le classement lit `runs.score` (0054). Les
-- plafonds sont ceux du barème — 74 points pour un mot (30 × 1,9 × 1,3), dix de
-- plus par palier de trois mots sans faute —, et un compte ne pose pas plus de
-- trois cents parties par jour.
--
-- Ce qui reste au client : le mot rare qu'il prétend avoir écrit (il paie
-- alors 74) et son palier de rareté. Le serveur ne peut pas les vérifier sans
-- le dictionnaire embarqué ; c'est la partie déclarative du score.

select tests.new_user('rb');

select tests.login('rb');

-- ------------------------------------------------ ce que le barème permet --

select tests.lives($$insert into public.runs (player_id, seed, score, words) values (tests.uid('rb'), 1, 74, 1)$$,
                   'a word on the last combo pays its ceiling, seventy-four');
select tests.lives($$insert into public.runs (player_id, seed, score, words) values (tests.uid('rb'), 2, 380, 5)$$,
                   'five words and one flawless streak reach three hundred and eighty');
select tests.throws($$insert into public.runs (player_id, seed, score, words) values (tests.uid('rb'), 3, 75, 1)$$,
                    'one point past a word''s ceiling is refused', '42501');
select tests.throws($$insert into public.runs (player_id, seed, score, words) values (tests.uid('rb'), 4, 381, 5)$$,
                    'and one past five words'' total too', '42501');
select tests.throws($$insert into public.runs (player_id, seed, score, words) values (tests.uid('rb'), 5, 10, 0)$$,
                    'a score no word covers is refused', '42501');
select tests.throws($$insert into public.runs (player_id, seed, score, words) values (tests.uid('rb'), 6, 10, 201)$$,
                    'nor does one run hold two hundred and one words', '42501');
select tests.throws($$insert into public.runs (player_id, seed, score, words, best_combo) values (tests.uid('rb'), 7, 10, 2, 3)$$,
                    'a chain is never longer than the words it chained', '42501');

-- ------------------------------------------------- le mot payé au barème --

select tests.lives($$insert into public.runs (player_id, seed, score, words) values (tests.uid('rb'), 8, 74, 1)$$,
                   'a run to hang its words on');
select tests.lives($$insert into public.run_words (run_id, word, category_id, points)
                     select id, 'chat', 'animaux', 74 from public.runs where player_id = tests.uid('rb') and seed = 8$$,
                   'a word pays at most its ceiling');
select tests.throws($$insert into public.run_words (run_id, word, category_id, points)
                      select id, 'chien', 'animaux', 75 from public.runs where player_id = tests.uid('rb') and seed = 8$$,
                    'seventy-five is out of the barème', '42501');

-- ------------------------------------------------------- le flot de parties --

-- Trois cents parties dans la journée ferment la porte. Elles sont posées ici
-- par le serveur — une policy d'insertion ne le voit pas —, puis effacées :
-- les tableaux que lisent les autres fichiers ne doivent pas les compter.
select tests.logout();
insert into public.runs (player_id, seed, score, words)
select tests.uid('rb'), g, 10, 1 from generate_series(1, 300) g;

select tests.login('rb');
select tests.throws($$insert into public.runs (player_id, seed, score, words) values (tests.uid('rb'), 999, 10, 1)$$,
                    'a player cannot flood the boards past three hundred runs a day', '42501');
select tests.logout();

delete from public.runs where player_id = tests.uid('rb');
