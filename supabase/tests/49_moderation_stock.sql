-- La modération se règle sur son stock (0119) : plus une langue a de mots qui
-- attendent, moins il faut de « correct » pour en faire entrer un, et plus il
-- lui faut de juges avant de cesser d'en recruter.

select tests.new_user(n) from unnest(array['p1', 'p2', 'oa', 'ob']) n;
select tests.new_user('m' || i) from generate_series(1, 5) i;
select tests.make_moderator('m' || i) from generate_series(1, 5) i;
select tests.new_user('full' || i) from generate_series(1, 10) i;
select tests.make_moderator('full' || i) from generate_series(1, 10) i;

-- Quinze juges français : la langue n'est pas courte, son seuil suit le stock.
select tests.is(public.thin_language('animaux'), false, 'fifteen French judges');

-- ------------------------------------------------------------ seuil --

-- Une file presque vide : sept « correct ».
select tests.propose('p1', 'animaux', 'loutre');
select tests.is(public.moderation_stock('fr'), 1, 'one word waits in French');
select tests.is(public.stock_yes_needed('fr'), 7, 'a near-empty stock asks seven « correct »');
select tests.vote('m' || i, 'animaux', 'loutre', 'correct') from generate_series(1, 5) i;
select tests.is(tests.vote('full1', 'animaux', 'loutre', 'correct'), 'pending', 'six leave it pending');
select tests.is(tests.vote('full2', 'animaux', 'loutre', 'correct'), 'accepted', 'seven let it in');

-- Dix mots : six ; vingt-cinq : cinq.
insert into public.moderation_reserve (category_id, word, display)
select 'animaux', 'peu' || i, 'Peu' || i from generate_series(1, 10) i;
select tests.is(public.stock_yes_needed('fr'), 6, 'ten waiting words ask six');
insert into public.moderation_reserve (category_id, word, display)
select 'animaux', 'moyen' || i, 'Moyen' || i from generate_series(1, 15) i;
select tests.is(public.stock_yes_needed('fr'), 5, 'twenty-five ask five');
delete from public.moderation_reserve where word like 'peu%' or word like 'moyen%';

-- 150 mots en réserve : trois suffisent.
insert into public.moderation_reserve (category_id, word, display)
select 'animaux', 'reserve' || i, 'Reserve' || i from generate_series(1, 149) i;
select tests.propose('p1', 'animaux', 'castor');
select tests.is(public.moderation_stock('fr'), 150, 'the reserve counts in the stock');
select tests.is(tests.vote('m1', 'animaux', 'castor', 'correct'), 'pending', 'one leaves it pending');
select tests.is(tests.vote('m2', 'animaux', 'castor', 'correct'), 'pending', 'two leave it pending');
select tests.is(tests.vote('m3', 'animaux', 'castor', 'correct'), 'accepted', 'three let it in at 150 waiting');

-- Le doute garde son prix, posé sur le seuil du stock.
select tests.propose('p1', 'animaux', 'blaireau');
select tests.is(tests.vote('m1', 'animaux', 'blaireau', 'unsure'), 'pending', 'a doubt');
select tests.is(tests.vote('m2', 'animaux', 'blaireau', 'correct'), 'pending', 'one');
select tests.is(tests.vote('m3', 'animaux', 'blaireau', 'correct'), 'pending', 'two');
select tests.is(tests.vote('m4', 'animaux', 'blaireau', 'correct'), 'pending', 'three');
select tests.is(tests.vote('m5', 'animaux', 'blaireau', 'correct'), 'pending', 'four');
select tests.is(tests.vote('full1', 'animaux', 'blaireau', 'correct'), 'accepted', 'the doubt asked two more');

-- 300 mots : deux, et jamais un seul juge.
insert into public.moderation_reserve (category_id, word, display)
select 'animaux', 'surplus' || i, 'Surplus' || i from generate_series(1, 150) i;
select tests.propose('p1', 'animaux', 'hermine');
select tests.is(public.stock_yes_needed('fr'), 2, 'a full stock asks two « correct »');
select tests.is(tests.vote('m1', 'animaux', 'hermine', 'correct'), 'pending', 'one judge never suffices');
select tests.is(tests.vote('m2', 'animaux', 'hermine', 'correct'), 'accepted', 'two let it in');

-- Le refus ne bouge pas.
select tests.propose('p1', 'animaux', 'licorne');
select tests.is(tests.vote('m1', 'animaux', 'licorne', 'incorrect'), 'pending', 'one refusal does not block');
select tests.is(tests.vote('m2', 'animaux', 'licorne', 'incorrect'), 'rejected', 'two still do');

-- Les paliers se règlent sans migration.
update public.moderation_stock_steps set yes_needed = 3 where stock_from = 300;
select tests.is(public.stock_yes_needed('fr'), 3, 'a step is tuned in its table');

-- --------------------------------------------------------- recrutement --

-- Un joueur au niveau 6 dans une langue sans juge et avec du stock : l'offre.
insert into public.moderation_reserve (category_id, word, display)
select 'de:tiere', 'de:tier' || i, 'Tier' || i from generate_series(1, 6) i;
select tests.run_at('oa', now(), 1700, array['oa-un']);
select tests.login('oa');
select tests.is(public.moderation_status('de') ->> 'offer', 'level', 'a German stock with no judge recruits');
select tests.logout();

-- Deux juges allemands couvrent six mots (un pour trois) : plus d'offre.
update public.moderators set lang = 'de' where id in (tests.uid('m1'), tests.uid('m2'));
select tests.is(public.moderators_wanted('de'), 2, 'six words want two judges');
select tests.login('oa');
select tests.is(public.moderation_status('de') ->> 'offer', null, 'a staffed language stops recruiting');
select tests.logout();

-- Le stock monte : il en faut davantage, l'offre revient.
insert into public.moderation_reserve (category_id, word, display)
select 'de:tiere', 'de:mehr' || i, 'Mehr' || i from generate_series(1, 6) i;
select tests.is(public.moderators_wanted('de'), 4, 'twelve words want four judges');
select tests.login('oa');
select tests.is(public.moderation_status('de') ->> 'offer', 'level', 'a growing stock recruits again');
select tests.logout();

-- Une invitation posée sort même dans une langue qui a son compte de juges.
update public.moderators set lang = 'de' where id in (tests.uid('m3'), tests.uid('m4'));
insert into public.moderator_offers (player_id, reason) values (tests.uid('ob'), 'level');
select tests.login('oa');
select tests.is(public.moderation_status('de') ->> 'offer', null, 'four judges cover twelve words');
select tests.logout();
select tests.login('ob');
select tests.is(public.moderation_status('de') ->> 'offer', 'level', 'but a posed invitation still shows');
select tests.logout();

-- ------------------------------------------------- revues orphelines --

-- Un ajout dont la proposition a disparu (auteur banni, 0116) ne se montre
-- plus dans la file : il ne compte pas dans le stock (0120).
select tests.propose('p2', 'de:tiere', 'de:dachs');
select tests.is(public.moderation_stock('de'), 13, 'a fresh proposal counts');
delete from public.word_submissions where category_id = 'de:tiere' and word = 'de:dachs';
select tests.is(public.moderation_stock('de'), 12, 'an orphan review does not');
