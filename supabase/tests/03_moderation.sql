-- `cast_vote` and `settle_review`: thresholds, super moderators, special
-- cases, respelling, the queue, a race between two last votes, and
-- recruitment.

select tests.new_user('p1');
select tests.new_user('p2');
select tests.new_user('p3');
select tests.new_user('m' || i) from generate_series(1, 8) i;
select tests.make_moderator('m' || i) from generate_series(1, 8) i;
select tests.new_user('s1');
select tests.make_super_moderator('s1');

select tests.propose('p1', 'animaux', w)
  from unnest(array['loutre', 'blaireau', 'hermine', 'furet', 'martre', 'vison', 'genette', 'civette',
                    'lynks', 'chakal', 'bellette', 'ours', 'renard']) w;
select tests.propose('m1', 'animaux', 'fouine');
select tests.propose('p2', 'animaux', 'belette');
select tests.propose('p2', 'de:tiere', 'de:dachs');

create table xp0 as select id, xp from public.profiles;
create function pg_temp.gained(p_label text) returns integer
language sql as $$ select tests.xp(p_label) - (select xp from xp0 where id = tests.uid(p_label)) $$;

-- --------------------------------------------------------------- access --

select tests.is(tests.vote('p2', 'animaux', 'loutre', 'correct'), 'gone', 'a player who is not a moderator cannot vote');
select tests.login('p2');
select tests.is((select count(*)::int from public.moderation_queue('fr')), 0, 'nor read the queue');
select tests.throws($$insert into public.moderation_votes (review_id, moderator_id, verdict)
                      values (tests.review('animaux', 'loutre'), tests.uid('p2'), 'correct')$$,
                    'nor write a vote into the table', '42501');
select tests.login('m1');
select tests.throws($$insert into public.moderation_votes (review_id, moderator_id, verdict)
                      values (tests.review('animaux', 'loutre'), tests.uid('m1'), 'correct')$$,
                    'a moderator cannot bypass cast_vote either', '42501');
select tests.is(tests.affected($$update public.word_reviews set status = 'accepted'$$), 0,
                'nor settle a review by hand');
select tests.is(public.cast_vote(tests.review('animaux', 'loutre'), 'maybe'), 'gone', 'an unknown verdict is refused');
select tests.is(public.cast_vote(null, 'correct'), 'gone', 'a null review is refused');
select tests.is(public.cast_vote(gen_random_uuid(), 'correct'), 'gone', 'an unknown review is refused');
select tests.logout();

-- ----------------------------------------------------------- thresholds --

select tests.is(tests.vote('m1', 'animaux', 'loutre', 'correct'), 'pending', 'one « correct » leaves it pending');
select tests.is(tests.vote('m2', 'animaux', 'loutre', 'correct'), 'pending', 'two leave it pending');
select tests.is(tests.vote('m3', 'animaux', 'loutre', 'correct'), 'accepted', 'three let it in');
select tests.is(pg_temp.gained('p1'), 150, 'the author is paid 150 XP');
select tests.ok(exists (select 1 from public.dictionary_words where category_id = 'animaux' and word = 'loutre'),
                'the word enters the dictionary');
select tests.ok((select status = 'accepted' and decided_at is not null from public.word_reviews
                  where id = tests.review('animaux', 'loutre')), 'the review is decided');
select tests.is(tests.vote('m4', 'animaux', 'loutre', 'correct'), 'gone', 'a settled review takes no more votes');
select tests.is(pg_temp.gained('p1'), 150, 'and pays nothing more');

select tests.is(tests.vote('m1', 'animaux', 'blaireau', 'incorrect'), 'pending', 'one « incorrect » leaves it pending');
select tests.is(tests.vote('m2', 'animaux', 'blaireau', 'incorrect'), 'rejected', 'two block it');
select tests.ok((select status = 'rejected' and seen_at is not null from public.word_submissions
                  where word = 'blaireau'), 'the proposal is rejected, and needs no badge');
select tests.ok(not exists (select 1 from public.dictionary_words where word = 'blaireau'), 'nothing enters the dictionary');
select tests.is(pg_temp.gained('p1'), 150, 'a rejection pays nothing');

select tests.vote('m1', 'animaux', 'hermine', 'unsure');
select tests.vote('m2', 'animaux', 'hermine', 'unsure');
select tests.vote('m' || i, 'animaux', 'hermine', 'correct') from generate_series(3, 7) i;
select tests.is((select status from public.word_reviews where id = tests.review('animaux', 'hermine')), 'pending',
                'two « unsure » make it doubtful: five « correct » are not enough');
select tests.is(tests.vote('m8', 'animaux', 'hermine', 'correct'), 'accepted', 'six are');

select tests.vote('m1', 'animaux', 'furet', 'incorrect');
select tests.vote('m2', 'animaux', 'furet', 'correct');
select tests.vote('m3', 'animaux', 'furet', 'correct');
select tests.is(tests.vote('m4', 'animaux', 'furet', 'correct'), 'accepted', 'one « incorrect » does not outweigh three « correct »');

-- -------------------------------------------------------------- own word --

select tests.is(tests.vote('m1', 'animaux', 'fouine', 'correct'), 'gone', 'a moderator cannot vote on a word he proposed');
select tests.is((select count(*)::int from public.moderation_votes where review_id = tests.review('animaux', 'fouine')), 0,
                'and no vote is recorded');
select tests.is(tests.vote('m2', 'animaux', 'fouine', 'correct'), 'pending', 'another moderator can');
select tests.is(tests.vote('m2', 'animaux', 'fouine', 'correct'), 'gone', 'but only once');
select tests.is(tests.vote('m2', 'animaux', 'fouine', 'incorrect'), 'gone', 'even with another verdict');
select tests.is((select count(*)::int from public.moderation_votes where review_id = tests.review('animaux', 'fouine')), 1,
                'one vote is recorded');

-- ------------------------------------------------------ super moderators --

select tests.login('s1');
select tests.is((public.moderation_status('fr') ->> 'super')::boolean, true, 'five validated words make a super moderator');
select tests.logout();
select tests.login('m1');
select tests.is((public.moderation_status('fr') ->> 'super')::boolean, false, 'an ordinary moderator is not one');
select tests.logout();

select tests.is(tests.vote('s1', 'animaux', 'martre', 'correct'), 'accepted', 'a super moderator lets a word in alone');
select tests.is(tests.vote('s1', 'animaux', 'vison', 'incorrect'), 'pending', 'but does not block an ordinary word alone');

-- ------------------------------------------------------------- specials --

select tests.login('m1');
select tests.is(public.cast_vote(tests.review('animaux', 'genette'), 'special', '  synonyme de genêt ?  '), 'special',
                'a moderator flags a special case');
select tests.logout();
select tests.is((select note from public.moderation_votes where review_id = tests.review('animaux', 'genette')),
                'synonyme de genêt ?', 'the note is trimmed');
select tests.is(tests.vote('m2', 'animaux', 'genette', 'correct'), 'gone', 'an ordinary moderator cannot judge a special case');
select tests.login('m2');
select tests.ok(not exists (select 1 from public.moderation_queue('fr', 20) where word = 'genette'),
                'nor sees it in his queue');
select tests.login('s1');
select tests.is((select note from public.moderation_queue('fr', 20) where word = 'genette'), 'synonyme de genêt ?',
                'a super moderator sees it first, with its note');
select tests.is((select word from public.moderation_queue('fr', 1)), 'genette', 'specials come first');
select tests.logout();
select tests.is(tests.vote('s1', 'animaux', 'genette', 'correct'), 'accepted', 'and settles it');

select tests.vote('m1', 'animaux', 'civette', 'special');
select tests.is(tests.vote('s1', 'animaux', 'civette', 'incorrect'), 'rejected', 'a super « incorrect » rejects a special case');

-- ------------------------------------------------------------ respelling --

select tests.login('m1');
select tests.is(public.cast_vote(tests.review('animaux', 'lynks'), 'correct', null, 'lynx', ' Lynx '), 'pending',
                'a moderator corrects the spelling before any vote');
select tests.logout();
select tests.ok(tests.review('animaux', 'lynx') is not null and tests.review('animaux', 'lynks') is null,
                'the review takes the new spelling');
select tests.is((select display from public.word_submissions where player_id = tests.uid('p1') and word = 'lynx'), 'Lynx',
                'so does the proposal, trimmed');
select tests.vote('m2', 'animaux', 'lynx', 'correct');
select tests.is(tests.vote('m3', 'animaux', 'lynx', 'correct'), 'pending', 'a respelled word needs a fourth « correct »');
select tests.is(tests.vote('m4', 'animaux', 'lynx', 'correct'), 'accepted', 'and gets in with it');

select tests.vote('m1', 'animaux', 'chakal', 'unsure');
select tests.login('m2');
select tests.is(public.cast_vote(tests.review('animaux', 'chakal'), 'correct', null, 'chacal', 'Chacal'), 'gone',
                'the spelling is locked after the first vote');
select tests.is(public.cast_vote(tests.review('animaux', 'renard'), 'incorrect', null, 'renart', 'Renart'), 'gone',
                'a correction is a « correct »');
select tests.is(public.cast_vote(tests.review('animaux', 'renard'), 'correct', null, 'renart', '  '), 'gone',
                'a correction needs something to display');
select tests.is(public.cast_vote(tests.review('animaux', 'bellette'), 'correct', null, 'belette', 'Belette'), 'pending',
                'a correction onto a word already under review merges the two');
select tests.logout();
select tests.ok(tests.review('animaux', 'bellette') is null, 'the misspelled review is gone');
select tests.is((select count(*)::int from public.word_submissions where word = 'belette'), 2,
                'both proposals now wait on the same review');
select tests.ok((select respelled from public.word_reviews where id = tests.review('animaux', 'belette')),
                'which counts as respelled');
select tests.is((select count(*)::int from public.moderation_votes where review_id = tests.review('animaux', 'belette')), 1,
                'with the corrector''s vote');

-- ----------------------------------------------------------------- queue --

select tests.login('m1');
select tests.ok(not exists (select 1 from public.moderation_queue('fr', 20) where word = 'fouine'),
                'the queue leaves out the moderator''s own words');
select tests.ok(not exists (select 1 from public.moderation_queue('fr', 20) where word = 'chakal'),
                'and those he voted on');
select tests.ok(not exists (select 1 from public.moderation_queue('fr', 20) where word = 'loutre'),
                'and those already settled');
select tests.ok(not exists (select 1 from public.moderation_queue('fr', 20) where category_id like '%:%'),
                'French reads the unprefixed categories only');
select tests.is((select word from public.moderation_queue('de', 20)), 'de:dachs', 'another language reads its prefix');
select tests.is((select count(*)::int from public.moderation_queue('fr', 0)), 1, 'a limit below one is raised to one');
select tests.ok((select count(*) from public.moderation_queue('fr', 100000)) <= 20, 'a huge limit is capped at twenty');
select tests.is((select count(*)::int from public.moderation_queue(null, 5)), 0, 'a null language reads nothing');
select tests.logout();

-- A note over 140 characters must not leave half a vote behind.
select tests.login('m5');
do $$
begin
  perform public.cast_vote(tests.review('animaux', 'renard'), 'unsure', repeat('x', 141));
exception when others then
  null;
end;
$$;
select tests.logout();
select tests.is((select count(*)::int from public.moderation_votes where review_id = tests.review('animaux', 'renard')), 0,
                'a vote whose note is too long is not recorded');

-- ------------------------------------------------------------------ race --

-- The third and fourth « correct » arrive at once: the row lock makes one of
-- them settle the review and the other find it gone, and the XP is paid once.
select tests.vote('m1', 'animaux', 'ours', 'correct');
select tests.vote('m2', 'animaux', 'ours', 'correct');
select tests.connect('a', 'm3');
select tests.connect('b', 'm4');
select dblink_exec('a', 'begin');
select tests.is(tests.remote('a', format('select public.cast_vote(%L, %L)', tests.review('animaux', 'ours'), 'correct')),
                'accepted', 'the first of two simultaneous last votes settles the review');
select dblink_send_query('b', format('select public.cast_vote(%L, %L)', tests.review('animaux', 'ours'), 'correct'));
select pg_sleep(0.2);
select tests.is(dblink_is_busy('b'), 1, 'the second waits on the review''s lock');
select dblink_exec('a', 'commit');
select tests.is((select v from dblink_get_result('b') as t(v text)), 'gone', 'then finds it gone');
select dblink_disconnect('a');
select dblink_disconnect('b');
select tests.is(pg_temp.gained('p1'), 1050, 'every accepted word paid its author once');

-- ----------------------------------------------------------- recruitment --

select tests.new_user('rookie');
select tests.new_user('shadow', true);
update public.profiles set xp = 2549 where id = tests.uid('rookie');
select tests.login('rookie');
select tests.is(public.moderation_status('fr') ->> 'offer', null, 'no offer below level 6');
select tests.logout();
update public.profiles set xp = 2550 where id in (tests.uid('rookie'), tests.uid('shadow'));
select tests.login('rookie');
select tests.is(public.moderation_status('fr') ->> 'offer', 'level', 'level 6 brings an offer');
select tests.is(public.answer_moderator_offer('words', true), false, 'an offer that is not due cannot be taken');
select tests.is(public.answer_moderator_offer('level', true), true, 'the offer is taken');
select tests.is((public.moderation_status('fr') ->> 'moderator')::boolean, true, 'and makes a moderator');
select tests.is(public.answer_moderator_offer('level', true), false, 'an offer is answered once');
select tests.logout();

select tests.login('shadow');
select tests.is(public.moderation_status('fr') ->> 'offer', 'level', 'an anonymous player is offered too');
select tests.is(public.answer_moderator_offer('level', true), false, 'but cannot accept');
select tests.is((public.moderation_status('fr') ->> 'moderator')::boolean, false, 'and stays a player');
select tests.is(public.answer_moderator_offer('level', false), true, 'he can decline');
select tests.is(public.moderation_status('fr') ->> 'offer', null, 'which ends the offer');
select tests.logout();

select tests.login('p1');
select tests.is(public.moderation_status('fr') ->> 'offer', 'words', 'three accepted words bring an offer');
select tests.is(public.invite_moderator(tests.uid('p2')), 'forbidden', 'a player cannot invite a moderator');
select tests.logout();

select tests.befriend('m1', 'p3');
select tests.login('m1');
select tests.is(public.invite_moderator(tests.uid('p2')), 'not-friend', 'a moderator invites only a friend');
select tests.is(public.invite_moderator(tests.uid('shadow')), 'not-friend', 'never an anonymous player');
select tests.is(public.invite_moderator(tests.uid('p3')), 'sent', 'a friend is invited');
select tests.is(public.invite_moderator(tests.uid('p3')), 'already', 'once');
select tests.is(public.invite_moderator(null), 'not-friend', 'a null friend is nobody');
select tests.logout();
select tests.login('p3');
select tests.is(public.moderation_status('fr') ->> 'invited_by', 'm1', 'the friend sees who invited him');
select tests.is(public.answer_moderator_offer('friend', true), true, 'and accepts');
select tests.logout();
select tests.is((select invited_by from public.moderators where id = tests.uid('p3')), tests.uid('m1'),
                'the moderator remembers who elected him');
select tests.login('m1');
select tests.is(public.invite_moderator(tests.uid('p3')), 'already', 'a moderator cannot be invited again');
select tests.is((select moderator from public.my_friends() where id = tests.uid('p3')), true,
                'my_friends shows him as a moderator');
select tests.logout();

-- ---------------------------------------------------- correction edges --

-- Proposals corrected onto an accepted word are paid like any other.
select tests.propose('p2', 'animaux', 'castor');
update public.word_reviews set status = 'accepted' where id = tests.review('animaux', 'castor');
select public.accept_word('animaux', 'castor');
select tests.propose('p3', 'animaux', 'kastor');
select tests.login('m5');
select tests.is(public.cast_vote(tests.review('animaux', 'kastor'), 'correct', null, 'castor', 'Castor'), 'accepted',
                'a correction onto an accepted word accepts the proposal');
select tests.logout();
select tests.is(pg_temp.gained('p3'), 150, 'and pays its author');
select tests.is((select status from public.word_submissions where player_id = tests.uid('p3') and word = 'castor'), 'accepted',
                'once');

select tests.propose('m6', 'animaux', 'marmotte');
select tests.propose('p2', 'animaux', 'marmote');
select tests.login('m6');
select tests.is(public.cast_vote(tests.review('animaux', 'marmote'), 'correct', null, 'marmotte', 'Marmotte'), 'gone',
                'a moderator cannot correct a word onto his own proposal');
select tests.logout();
select tests.ok(not exists (select 1 from public.moderation_votes
                             where review_id = tests.review('animaux', 'marmotte') and moderator_id = tests.uid('m6')),
                'and so cannot vote on it');
select tests.ok(tests.review('animaux', 'marmote') is not null, 'the misspelling stays under review');

select tests.login('m7');
select tests.is(public.cast_vote(tests.review('animaux', 'marmote'), null), 'gone', 'a null verdict is « gone »');
select tests.is(public.cast_vote(tests.review('animaux', 'marmote'), 'correct', null, 'marmottes', null), 'gone',
                'so is a correction without display');
select tests.is(public.cast_vote(tests.review('animaux', 'marmote'), 'correct', null, '   ', 'Marmotte'), 'gone',
                'and a correction to blanks');
select tests.is(public.cast_vote(tests.review('animaux', 'marmote'), 'correct', null, repeat('m', 101), 'Marmotte'), 'gone',
                'and one over 100 characters');
select tests.logout();
select tests.is((select count(*)::int from public.moderation_votes where review_id = tests.review('animaux', 'marmote')), 0,
                'none of them leaves a vote');

select tests.login('m1');
select tests.is(tests.affected($$update public.word_submissions set status = 'accepted' where word = 'marmote'$$), 0,
                'an ordinary moderator cannot accept a proposal by hand');
select tests.throws($$insert into public.dictionary_words (category_id, word, display) values ('animaux', 'dahu', 'Dahu')$$,
                    'nor write the dictionary alone', '42501');
select tests.ok((select count(*) from public.word_submissions) > 1, 'he still reads every proposal');
select tests.logout();
