-- The words board: what the draw gave each letter + category, what the players
-- wrote, and what moderation added, removed or still holds. Read by
-- `admin_words` (0042), which nobody but the administrator may call — and
-- which scopes every line to its language, the server prefixing them.

select tests.new_user(n) from unnest(array['wa', 'wb', 'wm']) n;
insert into public.admins (id) values (tests.uid('wa'));
select tests.make_moderator('wm');

-- Une partie française de deux mots — dont un écrit de travers — et une
-- allemande : les deux langues ne se voient pas.
insert into public.runs (id, player_id, seed, score, words, created_at)
values ('11111111-1111-1111-1111-111111111111', tests.uid('wb'), 1, 100, 2, now() - interval '2 hours'),
       ('22222222-2222-2222-2222-222222222222', tests.uid('wb'), 2, 50, 1, now() - interval '1 hour');
insert into public.run_words (run_id, word, category_id, points, approximate)
values ('11111111-1111-1111-1111-111111111111', 'chat', 'animaux', 80, false),
       ('11111111-1111-1111-1111-111111111111', 'chats', 'animaux', 40, true),
       ('22222222-2222-2222-2222-222222222222', 'de:katze', 'de:animaux', 25, false);

insert into public.prompt_stats (lang, category_id, letter, dealt, passed, points, words)
values ('fr', 'animaux', 'C', 4, 1, 100, 3),
       ('de', 'animaux', 'K', 2, 0, 25, 1);

-- Ce que la modération a fait d'un mot : entré la veille, signalé puis retiré,
-- et un troisième qui attend encore.
insert into public.word_reviews (id, category_id, word, display, status, kind, created_at, decided_at)
values ('aaaaaaaa-1111-1111-1111-111111111111', 'animaux', 'ornithorynque', 'Ornithorynque', 'accepted', 'add',
        now() - interval '2 days', now() - interval '1 day'),
       ('bbbbbbbb-1111-1111-1111-111111111111', 'pays', 'yougoslavie', 'Yougoslavie', 'accepted', 'ban',
        now() - interval '5 days', now() - interval '3 days'),
       ('cccccccc-1111-1111-1111-111111111111', 'metiers', 'taxidermiste', 'Taxidermiste', 'pending', 'add',
        now() - interval '3 hours', null);
insert into public.word_submissions (player_id, category_id, word, display, status)
values (tests.uid('wb'), 'animaux', 'ornithorynque', 'Ornithorynque', 'accepted'),
       (tests.uid('wa'), 'metiers', 'taxidermiste', 'Taxidermiste', 'pending');
insert into public.moderation_votes (review_id, moderator_id, verdict, note)
values ('aaaaaaaa-1111-1111-1111-111111111111', tests.uid('wm'), 'correct', null),
       ('bbbbbbbb-1111-1111-1111-111111111111', tests.uid('wm'), 'correct', 'Ce pays n’existe plus.'),
       ('cccccccc-1111-1111-1111-111111111111', tests.uid('wm'), 'unsure', 'Deux mots, un métier ?');

-- Deux fois le mot avant son entrée au dictionnaire, une fois après : le
-- « depuis » de l'ajout ne compte que la seconde.
insert into public.runs (id, player_id, seed, score, words, created_at)
values ('44444444-4444-4444-4444-444444444444', tests.uid('wb'), 4, 30, 1, now() - interval '2 days');
insert into public.run_words (run_id, word, category_id, points)
values ('44444444-4444-4444-4444-444444444444', 'ornithorynque', 'animaux', 70),
       ('11111111-1111-1111-1111-111111111111', 'ornithorynque', 'animaux', 70);

-- En allemand, les deux formes du serveur se rencontrent : une proposition
-- préfixe son mot (`de:eule`), un signalement de retrait le laisse nu
-- (`katze`) parce que c'est sous cette forme que l'import le retire.
insert into public.word_reviews (id, category_id, word, display, status, kind, created_at, decided_at)
values ('dddddddd-1111-1111-1111-111111111111', 'de:animaux', 'katze', 'Katze', 'accepted', 'ban',
        now() - interval '4 days', now() - interval '2 days'),
       ('eeeeeeee-1111-1111-1111-111111111111', 'de:animaux', 'de:eule', 'Eule', 'accepted', 'add',
        now() - interval '2 days', now() - interval '1 day');
insert into public.moderation_votes (review_id, moderator_id, verdict, note)
values ('dddddddd-1111-1111-1111-111111111111', tests.uid('wm'), 'correct', 'Kein Tier.');

-- Un mot écrit avant le retrait : c'est ce qu'il rapportait.
insert into public.runs (id, player_id, seed, score, words, created_at)
values ('33333333-3333-3333-3333-333333333333', tests.uid('wb'), 3, 70, 1, now() - interval '4 days');
insert into public.run_words (run_id, word, category_id, points)
values ('33333333-3333-3333-3333-333333333333', 'yougoslavie', 'pays', 60);

-- --------------------------------------------------------------- access --

select tests.login_anon();
select tests.throws($$select public.admin_words('fr')$$, 'a stranger reads no word of the dictionary', '42501');
select tests.logout();
select tests.login('wb');
select tests.is(public.admin_words('fr'), null, 'nor does a player who is not the administrator');
select tests.logout();

-- -------------------------------------------------------- le préfixe --

select tests.is(public.words_unscoped('de', 'de:katze'), 'katze', 'a German word reads bare in German');
select tests.is(public.words_unscoped('fr', 'de:katze'), null, 'and says nothing in French');
select tests.is(public.words_unscoped('fr', 'chat'), 'chat', 'a French word keeps its name');
select tests.is(public.words_unscoped('de', 'chat'), null, 'and says nothing in German');

-- --------------------------------------------------------- les compterus --

select tests.login('wa');
select tests.is((public.admin_words('nonsense')), null, 'a language that is not one reads nothing');
select tests.is((public.admin_words(null) -> 'words') is not null, true, 'no language at all reads French');

select tests.is(
  (select (w ->> 'uses')::int from jsonb_array_elements(public.admin_words('fr') -> 'words') w where w ->> 'word' = 'chat'),
  1, 'a word said once counts once'
);
select tests.is(
  (select (w ->> 'approx')::int from jsonb_array_elements(public.admin_words('fr') -> 'words') w where w ->> 'word' = 'chats'),
  1, 'a word the dictionary corrected is counted apart'
);
select tests.is(
  (select (w ->> 'approx')::int from jsonb_array_elements(public.admin_words('fr') -> 'words') w where w ->> 'word' = 'chat'),
  0, 'an exact word is not'
);
select tests.is(
  (select count(*)::int from jsonb_array_elements(public.admin_words('fr') -> 'words') w where w ->> 'word' = 'katze'),
  0, 'a German word stays out of the French counts'
);
select tests.is(
  (select w ->> 'word' from jsonb_array_elements(public.admin_words('de') -> 'words') w limit 1),
  'katze', 'and reads bare among the German ones'
);
select tests.is(
  (select (w ->> 'uses')::int from jsonb_array_elements(public.admin_words('de') -> 'words') w where w ->> 'word' = 'katze'),
  1, 'with its own count'
);

-- Une catégorie filtre les mots comme les couples.
select tests.is(
  (select count(*)::int from jsonb_array_elements(public.admin_words('fr', 'pays') -> 'words') w where w ->> 'word' = 'chat'),
  0, 'a category leaves out the words of another'
);
select tests.is(
  (select count(*)::int from jsonb_array_elements(public.admin_words('fr', 'animaux') -> 'words') w where w ->> 'word' = 'chat'),
  1, 'and keeps its own'
);
select tests.is(
  (select count(*)::int from jsonb_array_elements(public.admin_words('fr', 'animaux') -> 'pairs') p),
  1, 'a category filters the pairs too'
);
select tests.is(
  (select p ->> 'category' from jsonb_array_elements(public.admin_words('fr') -> 'pairs') p where p ->> 'letter' = 'C'),
  'animaux', 'a French pair reads bare in French'
);
select tests.is(
  (select (p ->> 'dealt')::int from jsonb_array_elements(public.admin_words('de') -> 'pairs') p where p ->> 'letter' = 'K'),
  2, 'and a German pair keeps its own draws'
);

-- --------------------------------------------------- ce que la modération a fait --

select tests.is(
  (select (a ->> 'uses')::int from jsonb_array_elements(public.admin_words('fr') -> 'added') a where a ->> 'word' = 'ornithorynque'),
  2, 'an added word counts every time it was written'
);
select tests.is(
  (select (a ->> 'uses_since')::int from jsonb_array_elements(public.admin_words('fr') -> 'added') a where a ->> 'word' = 'ornithorynque'),
  1, 'and, apart, those written since it went in'
);
select tests.is(
  (select a -> 'requesters' -> 0 ->> 'name' from jsonb_array_elements(public.admin_words('fr') -> 'added') a where a ->> 'word' = 'ornithorynque'),
  'wb', 'and names who asked for it'
);
select tests.is(
  (select a -> 'moderators' -> 0 ->> 'name' from jsonb_array_elements(public.admin_words('fr') -> 'added') a where a ->> 'word' = 'ornithorynque'),
  'wm', 'with the moderator who let it in'
);
select tests.is(
  (select (r ->> 'uses_before')::int from jsonb_array_elements(public.admin_words('fr') -> 'removed') r where r ->> 'word' = 'yougoslavie'),
  1, 'a removed word says what it gave before it left'
);
select tests.is(
  (select r -> 'moderators' -> 0 ->> 'note' from jsonb_array_elements(public.admin_words('fr') -> 'removed') r where r ->> 'word' = 'yougoslavie'),
  'Ce pays n’existe plus.', 'and carries the reason of the one who flagged it'
);
select tests.is(
  (select p ->> 'kind' from jsonb_array_elements(public.admin_words('fr') -> 'pending') p where p ->> 'word' = 'taxidermiste'),
  'add', 'a word still waiting is listed as such'
);
select tests.is(
  (select (p ->> 'proposals')::int from jsonb_array_elements(public.admin_words('fr') -> 'pending') p where p ->> 'word' = 'taxidermiste'),
  1, 'with how many players asked for it'
);
select tests.is(
  (select p -> 'votes' -> 0 ->> 'verdict' from jsonb_array_elements(public.admin_words('fr') -> 'pending') p where p ->> 'word' = 'taxidermiste'),
  'unsure', 'and the votes it already gathered'
);
select tests.is(
  (select count(*)::int from jsonb_array_elements(public.admin_words('de') -> 'pending') p),
  0, 'another language has none of them'
);
select tests.is(
  (select r ->> 'word' from jsonb_array_elements(public.admin_words('de') -> 'removed') r limit 1),
  'katze', 'a German ban reads bare, its category carrying the prefix'
);
select tests.is(
  (select count(*)::int from jsonb_array_elements(public.admin_words('fr') -> 'removed') r where r ->> 'word' = 'katze'),
  0, 'and stays out of the French ones'
);
select tests.is(
  (select a ->> 'word' from jsonb_array_elements(public.admin_words('de') -> 'added') a limit 1),
  'eule', 'a German addition reads bare too, whatever the prefix it was stored under'
);
select tests.logout();
