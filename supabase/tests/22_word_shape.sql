-- Une proposition dont la forme n'entrera jamais au dictionnaire livré ne doit
-- pas ouvrir de revue : trois modérateurs la valideraient, `accept_word`
-- verserait 150 XP à son auteur, et l'import la jetterait pour toujours
-- (0051). Les mêmes cas vivent dans `src/domain/wordShape.test.ts` : la règle
-- du domaine et celle du serveur doivent rester d'accord sur ce qu'un
-- dictionnaire peut porter.
--
-- La règle SQL est volontairement plus large sur l'alphabet : elle ne sait pas
-- nommer les plages de l'alphabet latin, si bien qu'une lettre exotique passe
-- ici et serait refusée par l'import. Ce qui compte est de ne jamais refuser un
-- mot que le dictionnaire livré sait porter.

-- ------------------------------------------------------ la forme admise --

select tests.ok(public.word_shape_ok('cœur'), 'a ligature survives');
select tests.ok(public.word_shape_ok('maître d’hôtel'), 'an apostrophe and a space too');
select tests.ok(public.word_shape_ok('Nouvelle-Zélande'), 'and a hyphen');
select tests.ok(not public.word_shape_ok('M'), 'one letter is not a word');
select tests.ok(not public.word_shape_ok('C&A'), 'nor is a brand with an ampersand');
select tests.ok(not public.word_shape_ok('3e âge'), 'a digit is refused');
select tests.ok(not public.word_shape_ok('chat (félin)'), 'a parenthesis too');
select tests.ok(not public.word_shape_ok('sp. chose'), 'and the Wiktionary abbreviation');
select tests.ok(not public.word_shape_ok(repeat('a', 29)), 'a card has no room past twenty-eight letters');

-- ------------------------------------------------ la proposition est close --

select tests.new_user('ws');
select tests.new_user('wa');
select tests.new_user('wb');
select tests.new_user('wc');
select tests.new_user('wd');
select tests.new_user('we');
select tests.make_moderator('wa');
select tests.make_moderator('wb');
select tests.make_moderator('wc');
select tests.make_moderator('wd');
select tests.make_moderator('we');

select tests.propose('ws', 'marques', 'H&M');
select tests.is(
 (select s.status from public.word_submissions s where s.word = 'H&M'),
 'rejected', 'a proposal no dictionary could carry is closed at once');
select tests.ok(
 not exists (select 1 from public.word_reviews r where r.word = 'H&M'),
 'without opening a review');
select tests.is(
 (select count(*)::int from public.word_submissions s where s.word = 'H&M' and s.seen_at is not null),
 1, 'and the player is told at once');

-- Une forme que le dictionnaire sait porter suit le chemin ordinaire.
select tests.propose('ws', 'marques', 'Nouvelle-Zélande');
select tests.is(
 (select r.status from public.word_reviews r where r.word = 'Nouvelle-Zélande'),
 'pending', 'a word the dictionary could hold still waits for votes');
select tests.is(tests.vote('wa', 'marques', 'Nouvelle-Zélande', 'correct'), 'pending', 'one « correct » is not enough');
select tests.is(tests.vote('wb', 'marques', 'Nouvelle-Zélande', 'correct'), 'pending', 'nor two');
select tests.is(tests.vote('wc', 'marques', 'Nouvelle-Zélande', 'correct'), 'pending', 'nor three');
select tests.is(tests.vote('wd', 'marques', 'Nouvelle-Zélande', 'correct'), 'pending', 'nor four');
select tests.is(tests.vote('we', 'marques', 'Nouvelle-Zélande', 'correct'), 'accepted', 'five let it in');
