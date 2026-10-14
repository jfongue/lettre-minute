-- `settle_review` et `top_up_moderation` (0078) : une langue qui compte moins
-- de dix modérateurs se règle sur deux « correct », jamais sur la double voix
-- d'un super modérateur seul, et repasse à cinq dès que dix juges y sont.
-- `moderators.lang` dit la langue de chaque juge : « fr » tant qu'il n'a pas
-- ouvert de file, celle de la file qu'il ouvre ensuite.

select tests.new_user('p1');
select tests.new_user('p2');
select tests.new_user('m' || i) from generate_series(1, 10) i;
select tests.make_moderator('m' || i) from generate_series(1, 10) i;
select tests.new_user('s1');
select tests.make_super_moderator('s1');

-- `make_moderator` ne pose pas de langue : le défaut est le français nu.
select tests.is((select count(*)::int from public.moderators where lang = 'fr'), 11,
                'every moderator counts for French until he opens a queue');

-- ------------------------------------------------------ ouverture de file --

-- La langue de la file qu'il ouvre est celle qu'il modère : c'est le seul
-- moment où le client la dit au serveur.
select tests.login('m1');
select tests.is(public.top_up_moderation('de'), 0, 'the German queue has nothing to pour');
select tests.logout();
select tests.is((select lang from public.moderators where id = tests.uid('m1')), 'de',
                'and the moderator is now a German one');
select tests.is(public.thin_language('de:tiere'), true, 'one German judge is thin');

-- ----------------------------------------------------- langue courte (nl) --

update public.moderators set lang = 'nl' where id in (tests.uid('m2'), tests.uid('m3'));
select tests.is(public.thin_language('nl:dieren'), true, 'a language under ten judges is thin');
select tests.is((select count(*)::int from public.moderators where lang = 'fr'), 8, 'eight judges left in French');

select tests.propose('p1', 'nl:dieren', 'das');
select tests.propose('p2', 'nl:dieren', 'vos');
select tests.propose('p1', 'nl:dieren', 'moll');

select tests.is(tests.vote('m2', 'nl:dieren', 'das', 'correct'), 'pending', 'one « correct » leaves it pending');
select tests.is(tests.vote('m3', 'nl:dieren', 'das', 'correct'), 'accepted', 'two let it in where judges are rare');
select tests.ok(exists (select 1 from public.dictionary_words where category_id = 'nl:dieren' and word = 'das'),
                'the word enters the dictionary');

-- Deux voix d'une seule personne restent une seule voix : un super modérateur
-- ne règle pas seul une langue neuve.
select tests.is(tests.vote('s1', 'nl:dieren', 'vos', 'correct'), 'pending',
                'a super moderator alone still does not let a word in');
select tests.is(tests.vote('m2', 'nl:dieren', 'vos', 'correct'), 'accepted',
                'a second judge, with his double voice, settles it');

select tests.is(tests.vote('m3', 'nl:dieren', 'moll', 'incorrect'), 'pending', 'one refusal does not block');
select tests.is(tests.vote('m2', 'nl:dieren', 'moll', 'incorrect'), 'rejected', 'two block, in a thin language too');

-- ----------------------------------------------------- langue fournie (fr) --

-- Dix juges français : le seuil revient à cinq, la double voix comprise.
update public.moderators set lang = 'fr' where id in (tests.uid('m2'), tests.uid('m3'));
select tests.is((select count(*)::int from public.moderators where lang = 'fr'), 10, 'ten French judges');
select tests.is(public.thin_language('animaux'), false, 'ten judges, and the language is no longer thin');

select tests.propose('p1', 'animaux', 'loutre');
select tests.is(tests.vote('m4', 'animaux', 'loutre', 'correct'), 'pending', 'one leaves it pending again');
select tests.is(tests.vote('m5', 'animaux', 'loutre', 'correct'), 'pending', 'two leave it pending');
select tests.is(tests.vote('m6', 'animaux', 'loutre', 'correct'), 'pending', 'three leave it pending');
select tests.is(tests.vote('m7', 'animaux', 'loutre', 'correct'), 'pending', 'four leave it pending');
select tests.is(tests.vote('m8', 'animaux', 'loutre', 'correct'), 'accepted', 'five let it in where judges are many');

-- Une correction d'orthographe coûte une voix de plus, même dans une langue
-- courte : deux « correct » n'y suffisent plus.
select tests.propose('p1', 'nl:dieren', 'gans');
select tests.login('m2');
select tests.is(public.cast_vote(tests.review('nl:dieren', 'gans'), 'correct', null, 'ganzen', 'Ganzen'), 'pending',
                'a respelled word asks one voice more');
select tests.logout();
select tests.is(tests.vote('m3', 'nl:dieren', 'ganzen', 'correct'), 'pending', 'two voices fall one short');
select tests.is(tests.vote('m4', 'nl:dieren', 'ganzen', 'correct'), 'accepted', 'the third lets it in');