-- Proposed words: who writes them, who reads them, withdrawal and amendment
-- while pending, and the 150 XP paid once by `accept_word`.

select tests.new_user('pia');
select tests.new_user('paul');
select tests.new_user('mona');
select tests.make_moderator('mona');

-- ------------------------------------------------------------ writing --

select tests.login('pia');

select tests.lives($$insert into public.word_submissions (player_id, category_id, word, display)
                     values (tests.uid('pia'), 'animaux', 'okapi', 'Okapi')$$,
                   'a player proposes a word');
select tests.throws($$insert into public.word_submissions (player_id, category_id, word, display)
                      values (tests.uid('paul'), 'animaux', 'yack', 'Yack')$$,
                    'a player cannot propose in another''s name', '42501');
select tests.throws($$insert into public.word_submissions (player_id, category_id, word, display)
                      values (tests.uid('pia'), 'animaux', 'okapi', 'Okapi')$$,
                    'the same word twice in a category is refused', '23505');
select tests.lives($$insert into public.word_submissions (player_id, category_id, word, display)
                     values (tests.uid('pia'), 'animaux', 'okapi', 'Okapi')
                     on conflict (player_id, category_id, word) do nothing$$,
                   'the app''s upsert ignores a duplicate');
select tests.throws($$insert into public.word_submissions (player_id, category_id, word, display)
                      values (tests.uid('pia'), 'animaux', null, 'X')$$,
                    'a null word is refused', '23502');
select tests.throws($$insert into public.word_submissions (player_id, category_id, word, display, status)
                      values (tests.uid('pia'), 'animaux', 'gnou', 'Gnou', 'maybe')$$,
                    'an unknown status is refused');

select tests.logout();

select tests.ok(tests.review('animaux', 'okapi') is not null, 'a proposal opens the review of its word');
select tests.is((select status from public.word_reviews where id = tests.review('animaux', 'okapi')), 'pending',
                'the review starts pending');

select tests.propose('paul', 'animaux', 'okapi');
select tests.is((select count(*)::int from public.word_reviews where category_id = 'animaux' and word = 'okapi'), 1,
                'a second proposal joins the same review');

-- ------------------------------------------------------------ reading --

select tests.login('pia');
select tests.is((select count(*)::int from public.word_submissions), 1, 'a player reads only his own proposals');
select tests.is((select proposals from public.submission_tally where category_id = 'animaux' and word = 'okapi'), 2,
                'the tally counts every player who proposed it');
select tests.is((select count(*)::int from public.word_reviews), 0, 'a player cannot read reviews');
select tests.is((select count(*)::int from public.moderation_votes), 0, 'a player cannot read votes');
select tests.is((select count(*)::int from public.moderators), 0, 'a player cannot read the moderators');
select tests.is(tests.affected($$update public.word_submissions set status = 'accepted'$$), 0,
                'a player cannot accept his own proposal');

select tests.login('mona');
select tests.is((select count(*)::int from public.word_submissions), 2, 'a moderator reads every proposal');
select tests.logout();

-- ---------------------------------------------------------- withdrawal --

select tests.propose('pia', 'animaux', 'zebu');
select tests.login('pia');
select tests.is(tests.affected($$delete from public.word_submissions where word = 'zebu'$$), 1,
                'a pending proposal can be withdrawn');
select tests.logout();

select tests.propose('pia', 'animaux', 'lama');
update public.word_submissions set status = 'rejected' where word = 'lama';
select tests.propose('pia', 'animaux', 'puma');
update public.word_submissions set status = 'accepted' where word = 'puma';
select tests.login('pia');
select tests.is(tests.affected($$delete from public.word_submissions where word in ('lama', 'puma')$$), 0,
                'a decided proposal cannot be withdrawn');
select tests.is(tests.affected($$delete from public.word_submissions where player_id = tests.uid('paul')$$), 0,
                'a player cannot withdraw another''s proposal');
select tests.logout();

-- ----------------------------------------------------------- amendment --

select tests.propose('pia', 'animaux', 'giraffe');
select tests.login('pia');
select tests.is(public.amend_submission((select id from public.word_submissions where word = 'giraffe'), 'girafe', 'Girafe'), true,
                'a pending proposal can be amended');
select tests.ok(exists (select 1 from public.word_submissions where word = 'girafe')
                and not exists (select 1 from public.word_submissions where word = 'giraffe'),
                'the amendment replaces the word');
select tests.is(public.amend_submission((select id from public.word_submissions where word = 'girafe'), '', 'X'), false,
                'an empty amendment is refused');
select tests.is(public.amend_submission((select id from public.word_submissions where word = 'girafe'), '   ', 'X'), false,
                'a blank amendment is refused');
select tests.is(public.amend_submission((select id from public.word_submissions where word = 'lama'), 'lamas', 'Lamas'), false,
                'a rejected proposal cannot be amended');
select tests.is(public.amend_submission((select id from public.word_submissions where word = 'puma'), 'pumas', 'Pumas'), false,
                'an accepted proposal cannot be amended');
select tests.is(public.amend_submission(gen_random_uuid(), 'x', 'X'), false, 'an unknown id is refused');
select tests.is(public.amend_submission(null, 'x', 'X'), false, 'a null id is refused');
select tests.is(public.amend_submission((select id from public.word_submissions where word = 'girafe'), 'okapi', 'Okapi'), true,
                'amending onto a word already proposed is accepted');
select tests.is((select count(*)::int from public.word_submissions where word in ('girafe', 'okapi')), 1,
                'and merges into the existing proposal');
select tests.logout();

select tests.login('paul');
select tests.is(public.amend_submission(tests.submission_id('pia', 'okapi'), 'yack', 'Yack'), false,
                'a player cannot amend another''s proposal');
select tests.logout();
select tests.ok(tests.submission_id('pia', 'okapi') is not null, 'which stays where it was');

select tests.propose('paul', 'animaux', 'elan');
select tests.vote('mona', 'animaux', 'elan', 'unsure');
select tests.login('paul');
select tests.is(public.amend_submission((select id from public.word_submissions where word = 'elan'), 'élan', 'Élan'), false,
                'a proposal a moderator voted on cannot be amended');
select tests.logout();

-- ------------------------------------------------------------- reward --

select tests.login('pia');
select tests.throws($$select public.accept_word('animaux', 'okapi')$$,
                    'a player cannot call accept_word', '42501');
select tests.throws($$select public.settle_review(tests.review('animaux', 'okapi'))$$,
                    'a player cannot call settle_review', '42501');
select tests.throws($$select public.reject_word('animaux', 'okapi')$$,
                    'a player cannot call reject_word', '42501');
select tests.login_anon();
select tests.throws($$select public.accept_word('animaux', 'okapi')$$,
                    'a request with no session cannot call accept_word', '42501');
select tests.logout();

create temp table xp_before as select id, xp from public.profiles;

select public.accept_word('animaux', 'okapi');
select tests.is(tests.xp('pia') - (select xp from xp_before where id = tests.uid('pia')), 150, 'acceptance pays 150 XP');
select tests.is(tests.xp('paul') - (select xp from xp_before where id = tests.uid('paul')), 150, 'to every player who proposed it');
select tests.ok(exists (select 1 from public.dictionary_words where category_id = 'animaux' and word = 'okapi' and source = 'community'),
                'the word enters the dictionary');

select public.accept_word('animaux', 'okapi');
select tests.is(tests.xp('pia') - (select xp from xp_before where id = tests.uid('pia')), 150, 'a second acceptance pays nothing more');

select public.accept_word('animaux', 'nothing-here');
select tests.ok(not exists (select 1 from public.dictionary_words where word = 'nothing-here'),
                'accepting a word nobody proposed does nothing');

-- A late proposal of an accepted word is paid at once, and alone.
update public.word_reviews set status = 'accepted' where id = tests.review('animaux', 'okapi');
select tests.new_user('late');
select tests.propose('late', 'animaux', 'okapi');
select tests.is(tests.xp('late'), 150, 'a late proposal of an accepted word is paid');
select tests.is(tests.xp('pia') - (select xp from xp_before where id = tests.uid('pia')), 150, 'without paying the others again');
select tests.is((select status from public.word_submissions where player_id = tests.uid('late')), 'accepted',
                'and is accepted');

update public.word_reviews set status = 'rejected' where id = tests.review('animaux', 'elan');
select tests.propose('late', 'animaux', 'elan');
select tests.ok((select status = 'rejected' and seen_at is not null from public.word_submissions
                  where player_id = tests.uid('late') and word = 'elan'),
                'a late proposal of a rejected word is rejected at once');

-- ------------------------------------------------------ my submissions --

select tests.login('late');
select tests.is((select count(*)::int from public.my_submissions()), 2, 'my_submissions lists the player''s proposals');
select tests.is((select fresh from public.my_submissions() where display = 'Okapi'), true, 'an unseen acceptance is fresh');
select tests.is((public.moderation_status('fr') ->> 'news')::int, 1, 'and counts as news');
select public.mark_requests_seen();
select tests.is((select fresh from public.my_submissions() where display = 'Okapi'), false, 'mark_requests_seen clears it');
select tests.is((select locked from public.my_submissions() where display = 'Elan'), true,
                'a word a moderator voted on is locked');
select tests.logout();

-- ------------------------------------------------------------- forgery --

select tests.new_user('forger');
select tests.login('forger');
select tests.throws($$insert into public.word_submissions (player_id, category_id, word, display, status)
                      values (tests.uid('forger'), 'animaux', 'fake', 'Fake', 'accepted')$$,
                    'a client cannot insert a proposal already accepted', '42501');
select tests.throws($$insert into public.word_submissions (player_id, category_id, word, display, seen_at)
                      values (tests.uid('forger'), 'animaux', 'fake', 'Fake', now())$$,
                    'nor one already seen', '42501');
select tests.is(public.moderation_status('fr') ->> 'offer', null, 'so no forged acceptance earns a moderator offer');

select tests.throws(format('insert into public.word_submissions (player_id, category_id, word, display) values (%L, %L, %L, %L)',
                           tests.uid('forger'), 'animaux', 'long', repeat('x', 100000)),
                    'a 100 000-character display is refused', '23514');
select tests.throws(format('insert into public.word_submissions (player_id, category_id, word, display) values (%L, %L, %L, %L)',
                           tests.uid('forger'), 'animaux', (select string_agg(md5(i::text), '') from generate_series(1, 200) i), 'Long'),
                    'a 6 400-character word is refused by its check, not by the index', '23514');
select tests.lives(format('insert into public.word_submissions (player_id, category_id, word, display) values (%L, %L, %L, %L)',
                          tests.uid('forger'), 'animaux', repeat('w', 100), repeat('W', 100)),
                   'a 100-character word is accepted');
select tests.logout();

select tests.propose('forger', 'animaux', 'ibis');
select tests.login('forger');
select tests.is(public.amend_submission(tests.submission_id('forger', 'ibis'), null, 'X'), false, 'amending to a null word is refused');
select tests.is(public.amend_submission(tests.submission_id('forger', 'ibis'), 'ibiss', null), false, 'so is a null display');
select tests.is(public.amend_submission(tests.submission_id('forger', 'ibis'), repeat('i', 101), 'Ibis'), false,
                'and a word over 100 characters');
select tests.logout();
select tests.ok(tests.submission_id('forger', 'ibis') is not null, 'a refused amendment keeps the proposal');
