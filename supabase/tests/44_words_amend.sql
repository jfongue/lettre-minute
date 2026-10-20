-- L'écran des mots, deux portes du super modérateur : `add_word_direct` ajoute
-- un mot sans vote, `amend_word` corrige l'orthographe d'un mot et la note pour
-- l'import (0102). Et `admin_words` (0103) rend toujours ses parties « depuis ».

select tests.new_user(n) from unnest(array['aa', 'am', 'as', 'ap']) n;
select tests.make_moderator('am');
select tests.make_super_moderator('as');
insert into public.admins (id) values (tests.uid('aa'));

-- --------------------------------------------------------------- accès --

select tests.login_anon();
select tests.throws($$select public.add_word_direct('animaux', 'Ornithorynque')$$, 'a stranger adds nothing', '42501');
select tests.throws($$select public.amend_word('animaux', 'chat', 'Chat', 'Chatte')$$, 'nor amends', '42501');
select tests.logout();

select tests.login('am');
select tests.is(public.add_word_direct('animaux', 'Ornithorynque'), 'forbidden', 'a plain moderator does not add alone');
select tests.is(public.amend_word('animaux', 'chat', 'Chat', 'Chatte'), 'forbidden', 'nor amend');
select tests.logout();

select tests.login('ap');
select tests.is(public.add_word_direct('animaux', 'Ornithorynque'), 'forbidden', 'a player who is not a moderator neither');
select tests.logout();

-- ----------------------------------------------------------- l'ajout --

select tests.login('as');
select tests.is(public.add_word_direct('animaux', 'M'), 'invalid', 'a form the dictionaries never hold is refused');
select tests.is(public.add_word_direct('animaux', '  Ornithorynque '), 'added', 'a super moderator adds a word on the spot');
select tests.is(public.add_word_direct('animaux', 'ornithorynque'), 'known', 'adding it twice says it is there');
select tests.is(public.add_word_direct('de:animaux', 'Eule'), 'added', 'a German word too');
select tests.logout();

select tests.is(
  (select display from public.dictionary_words where category_id = 'animaux' and word = 'ornithorynque'),
  'Ornithorynque', 'the word is in the living dictionary, trimmed'
);
select tests.is(
  (select source from public.dictionary_words where category_id = 'de:animaux' and word = 'de:eule'),
  'community', 'a German one under its prefixed key'
);
select tests.is(
  (select status from public.word_reviews where category_id = 'animaux' and word = 'ornithorynque' and kind = 'add'),
  'accepted', 'its review is settled, the file keeps the trace'
);
select tests.is(
  (select v.verdict from public.moderation_votes v
     join public.word_reviews r on r.id = v.review_id
    where r.word = 'ornithorynque' and r.kind = 'add' and v.moderator_id = tests.uid('as')),
  'correct', 'with his vote on it'
);

-- Un joueur qui l'avait proposé touche sa récompense, une fois.
select tests.propose('ap', 'animaux', 'axolotl');
select tests.login('as');
select tests.is(public.add_word_direct('animaux', 'Axolotl'), 'added', 'a word a player proposed');
select tests.logout();
select tests.is(tests.xp('ap'), 150, 'its proposer is paid as for any accepted word');

-- ------------------------------------------------------ la correction --

insert into public.dictionary_words (category_id, word, display, source)
values ('animaux', 'ecureuil', 'Ecureuil', 'community');

select tests.login('as');
select tests.is(public.amend_word('animaux', 'ecureuil', 'Ecureuil', 'Écureuil'), 'amended', 'a living word changes its spelling');
select tests.is(public.amend_word('animaux', 'ecureuil', 'Écureuil', 'Écureuil'), 'known', 'the same spelling changes nothing');
select tests.is(public.amend_word('animaux', 'ecureuil', 'Ecureuil', 'Écureuil2'), 'invalid', 'a form the dictionaries never hold is refused');
-- Un mot que seuls les dictionnaires livrés portent : aucune copie vivante.
select tests.is(public.amend_word('animaux', 'cheval', 'Cheval', 'Chevale'), 'amended', 'a shipped word too');
select tests.is(public.amend_word('de:animaux', 'de:katze', 'Katze', 'Kätze'), 'amended', 'a German word, named bare or prefixed');
select tests.logout();

select tests.ok(
  not exists (select 1 from public.dictionary_words where category_id = 'animaux' and word = 'ecureuil'),
  'the old living key is gone'
);
select tests.is(
  (select display from public.dictionary_words where category_id = 'animaux' and word = lower('Écureuil')),
  'Écureuil', 'and the new spelling stands in its place'
);
select tests.is(
  (select display from public.dictionary_words where category_id = 'animaux' and word = 'chevale'),
  'Chevale', 'a shipped word gets its new spelling served meanwhile'
);
select tests.is(
  (select display from public.word_amendments where category_id = 'animaux' and word = 'ecureuil'),
  'Écureuil', 'the amendment is kept for the import'
);
select tests.is(
  (select word from public.word_amendments where category_id = 'de:animaux'),
  'katze', 'under its bare key, whatever the way it was named'
);

-- Corriger deux fois le même mot garde la dernière correction.
select tests.login('as');
select tests.is(public.amend_word('animaux', 'cheval', 'Cheval', 'Chevalle'), 'amended', 'a second correction of the same word');
select tests.logout();
select tests.is(
  (select display from public.word_amendments where category_id = 'animaux' and word = 'cheval'),
  'Chevalle', 'replaces the first'
);

-- Personne n'écrit ni ne lit la table à la main.
select tests.login('ap');
select tests.is((select count(*)::integer from public.word_amendments), 0, 'a player reads no amendment');
select tests.logout();

-- ------------------------------------------------- le relevé, toujours --

insert into public.runs (id, player_id, seed, score, words, created_at)
values ('55555555-5555-5555-5555-555555555555', tests.uid('ap'), 5, 10, 1, now() - interval '3 hours'),
       ('66666666-6666-6666-6666-666666666666', tests.uid('ap'), 6, 10, 1, now() + interval '1 hour');
insert into public.run_words (run_id, word, category_id, points)
values ('55555555-5555-5555-5555-555555555555', 'chat', 'animaux', 10),
       ('66666666-6666-6666-6666-666666666666', 'chat', 'animaux', 10);

select tests.login('aa');
select tests.is(
  (public.admin_words('fr', 'animaux') -> 'added' -> 0 ->> 'parties_since')::integer,
  1, 'the parties since a word came in count only the later ones of the language'
);
select tests.is((public.admin_words('fr') ->> 'lang_runs')::integer, 2, 'and the language has its two parties');
select tests.is(jsonb_array_length(public.admin_words('fr', 'animaux') -> 'amended'), 2, 'and it lists the amendments waiting for the import');
select tests.is(public.admin_words('fr', 'animaux') -> 'amended' -> 0 ->> 'old_display', 'Cheval', 'latest first, with the spelling it had');
select tests.logout();
