-- 0116 : plafond quotidien de propositions, bans de proposition (d'office et
-- par un super modérateur), profils à juger, score des modérateurs et poids
-- d'un modérateur laxiste, raisons des refus dans la file, offre de super
-- modérateur.

update public.proposal_quota set base = 10, trusted = 30, low = 3;
select tests.full_french();

select tests.new_user(n) from unnest(array['q1', 'q2', 'b1', 'd1', 'lax', 'good', 'fresh']) n;
select tests.new_user('m' || i) from generate_series(1, 6) i;
select tests.make_moderator('m' || i) from generate_series(1, 6) i;
select tests.make_moderator(n) from unnest(array['lax', 'good', 'fresh']) n;
select tests.new_user('s1');
select tests.make_super_moderator('s1');

-- --------------------------------------------------------------- plafond --

select tests.propose('q1', 'animaux', 'qq' || chr(96 + i)) from generate_series(1, 10) i;
select tests.login('q1');
select tests.is((public.proposal_room() ->> 'room')::int, 0, 'ten proposals use up a new player''s day');
select tests.is((public.proposal_room() ->> 'quota')::int, 10, 'whose cap is ten');
select tests.throws($$insert into public.word_submissions (player_id, category_id, word, display)
                      values (tests.uid('q1'), 'animaux', 'qqk', 'Qqk')$$,
                    'the eleventh is refused by the server', '54000');
select tests.is(public.amend_submission(tests.submission_id('q1', 'qqa'), 'qqun', 'Qqun'), true,
                'a correction does not count against the cap');
select tests.logout();

-- Hier ne compte pas.
update public.word_submissions set created_at = now() - interval '2 days' where player_id = tests.uid('q1');
select tests.login('q1');
select tests.is((public.proposal_room() ->> 'room')::int, 10, 'a new day gives the room back');
select tests.logout();

-- Sept mots acceptés sur dix : trente par jour. Sept refusés : trois.
update public.word_submissions set status = 'accepted'
 where player_id = tests.uid('q1') and word in (select 'qq' || chr(96 + i) from generate_series(2, 8) i);
update public.word_submissions set status = 'rejected'
 where player_id = tests.uid('q1') and word in ('qqi', 'qqj', 'qqun');
select tests.login('q1');
select tests.is((public.proposal_room() ->> 'quota')::int, 30, 'a reliable player may propose thirty a day');
select tests.logout();

select tests.propose('q2', 'animaux', 'rr' || chr(96 + i)) from generate_series(1, 10) i;
update public.word_submissions set created_at = now() - interval '2 days' where player_id = tests.uid('q2');
update public.word_submissions set status = 'accepted'
 where player_id = tests.uid('q2') and word in ('rra', 'rrb', 'rrc');
update public.word_submissions set status = 'rejected'
 where player_id = tests.uid('q2') and word in (select 'rr' || chr(96 + i) from generate_series(4, 10) i);
select tests.login('q2');
select tests.is((public.proposal_room() ->> 'quota')::int, 3, 'a player mostly refused only three');
select tests.logout();
select tests.is((select state from public.proposer_reviews where player_id = tests.uid('q2')), 'open',
                'and seven refusals out of ten send his profile to the super moderators');
select tests.is((select banned from public.proposer_reviews where player_id = tests.uid('q2')), false,
                'without banning him');

update public.proposal_quota set base = 1000, trusted = 1000, low = 1000;

-- ------------------------------------------------------- ban d'office --

select tests.propose('b1', 'animaux', 'bb' || chr(96 + i)) from generate_series(1, 17) i;
update public.word_submissions set status = 'accepted' where player_id = tests.uid('b1') and word in ('bba', 'bbb');
update public.word_submissions set status = 'rejected'
 where player_id = tests.uid('b1') and word in (select 'bb' || chr(96 + i) from generate_series(3, 16) i);
select tests.is((select banned and auto from public.proposer_reviews where player_id = tests.uid('b1')), true,
                'fourteen refusals out of sixteen ban a player on the spot');
select tests.is((select count(*)::int from public.word_submissions where player_id = tests.uid('b1') and status = 'pending'), 0,
                'his pending proposals are withdrawn');
select tests.is(tests.review('animaux', 'bbq'), null::uuid, 'with their review, which nobody else wanted');
select tests.login('b1');
select tests.is((public.proposal_room() ->> 'banned')::boolean, true, 'he is told he is banned');
select tests.throws($$insert into public.word_submissions (player_id, category_id, word, display)
                      values (tests.uid('b1'), 'animaux', 'bbr', 'Bbr')$$,
                    'and the server refuses his next word', '42501');
select tests.logout();

-- ----------------------------------------------------------- le doute --

select tests.propose('d1', 'animaux', 'dd' || chr(96 + i)) from generate_series(1, 20) i;
update public.word_submissions set status = 'accepted'
 where player_id = tests.uid('d1') and word in (select 'dd' || chr(96 + i) from generate_series(1, 5) i);
update public.word_submissions set status = 'rejected'
 where player_id = tests.uid('d1') and word in (select 'dd' || chr(96 + i) from generate_series(6, 10) i);
select tests.is((select state || '/' || banned from public.proposer_reviews where player_id = tests.uid('d1')), 'open/false',
                'half refused after ten: the profile goes up, unbanned');

select tests.login('m1');
select tests.is(public.profile_queue(), '[]'::jsonb, 'an ordinary moderator sees no profile');
select tests.is(public.judge_profile(tests.uid('d1'), true), 'gone', 'nor judges one');
select tests.is((public.moderation_status('fr') ->> 'profiles')::int, 0, 'nor counts them');
select tests.logout();

select tests.login('s1');
select tests.is((public.moderation_status('fr') ->> 'profiles')::int, 3, 'a super moderator has three profiles to judge');
select tests.is((select jsonb_array_length(e -> 'words') from jsonb_array_elements(public.profile_queue()) e
                  where e ->> 'id' = tests.uid('d1')::text), 20, 'each with its latest words');
select tests.is(public.judge_profile(tests.uid('d1'), false), 'cleared', 'he lets the doubtful player be');
select tests.is(public.judge_profile(tests.uid('b1'), false), 'cleared', 'and lifts the ban made on the spot');
select tests.is(public.judge_profile(tests.uid('b1'), false), 'gone', 'a profile is judged once');
select tests.logout();

select tests.login('b1');
select tests.is((public.proposal_room() ->> 'banned')::boolean, false, 'the player whose ban was lifted');
select tests.lives($$insert into public.word_submissions (player_id, category_id, word, display)
                     values (tests.uid('b1'), 'animaux', 'bbr', 'Bbr')$$, 'proposes again');
select tests.logout();

update public.word_submissions set status = 'rejected'
 where player_id = tests.uid('d1') and word in (select 'dd' || chr(96 + i) from generate_series(11, 19) i);
select tests.is((select state from public.proposer_reviews where player_id = tests.uid('d1')), 'cleared',
                'nine more refusals do not bring a cleared profile back');
update public.word_submissions set status = 'rejected' where player_id = tests.uid('d1') and word = 'ddt';
select tests.is((select state from public.proposer_reviews where player_id = tests.uid('d1')), 'open',
                'the tenth does');

select tests.propose('d1', 'animaux', 'ddu');
select tests.login('s1');
select tests.is(public.judge_profile(tests.uid('d1'), true), 'banned', 'a super moderator bans him');
select tests.logout();
select tests.is((select count(*)::int from public.word_submissions where player_id = tests.uid('d1') and status = 'pending'), 0,
                'which withdraws what he still had waiting');

-- ------------------------------------------------ score et poids --

select tests.propose('q1', 'animaux', w) from unnest(array['vrai', 'faux', 'mou', 'tiede']) w;

-- « faux » : refusé par deux modérateurs, dont « good » ; « lax » l'avait validé.
select tests.vote('lax', 'animaux', 'faux', 'correct');
select tests.vote('good', 'animaux', 'faux', 'incorrect');
select tests.is(tests.vote('m1', 'animaux', 'faux', 'incorrect'), 'rejected', 'two refusals block a word');
select tests.is((select score from public.moderators where id = tests.uid('good')), 100::smallint,
                'a shared refusal is a perfect score');
select tests.is((select judged from public.moderators where id = tests.uid('good')), 1, 'counted once');
select tests.is((select score from public.moderators where id = tests.uid('lax')), 0::smallint,
                'a validation the others refused is none');
select tests.is((select score from public.moderators where id = tests.uid('fresh')), null::smallint,
                'a moderator with no settled vote has no score');

-- « lax » a assez jugé pour peser : son « correct » ne vaut plus qu'une demi-voix.
update public.moderators set judged = 20, score = 40 where id = tests.uid('lax');
select tests.vote(n, 'animaux', 'vrai', 'correct') from unnest(array['m2', 'm3', 'm4', 'm5']) n;
select tests.is(tests.vote('lax', 'animaux', 'vrai', 'correct'), 'pending',
                'four voices and a lax one do not make five');
select tests.is(tests.vote('m6', 'animaux', 'vrai', 'correct'), 'accepted', 'a fifth full voice does');

-- Ses refus restent entiers.
select tests.vote('lax', 'animaux', 'mou', 'incorrect');
select tests.is(tests.vote('m2', 'animaux', 'mou', 'incorrect'), 'rejected', 'a lax moderator''s refusal still counts whole');

-- ------------------------------------------------- raisons dans la file --

select tests.login('m3');
select public.cast_vote(tests.review('animaux', 'tiede'), 'incorrect', 'Ce n’est pas un animal');
select tests.logout();
select tests.login('m4');
select tests.is((select reasons from public.moderation_queue('fr', 20) where word = 'tiede'),
                '[{"verdict": "incorrect", "note": "Ce n’est pas un animal"}]'::jsonb,
                'the next moderator reads why the first refused');
select tests.logout();

-- --------------------------------------------- offre de super modérateur --

update public.moderators set judged = 60, score = 92 where id in (tests.uid('good'), tests.uid('m6'));
select tests.login('m6');
select tests.is(public.moderation_status('fr') ->> 'offer', 'super', 'an excellent moderator is offered the super role');
select tests.is(public.answer_moderator_offer('super', false), true, 'he may decline it');
select tests.is(public.moderation_status('fr') ->> 'offer', null, 'and is not asked again');
select tests.is(public.answer_moderator_offer('super', true), false, 'nor can take it back later');
select tests.logout();

select tests.login('good');
select tests.is(public.answer_moderator_offer('super', true), true, 'another accepts');
select tests.is((public.moderation_status('fr') ->> 'super')::boolean, true, 'and is a super moderator');
select tests.logout();

select tests.login('m5');
select tests.is(public.answer_moderator_offer('super', true), false, 'an ordinary score earns nothing');
select tests.logout();
