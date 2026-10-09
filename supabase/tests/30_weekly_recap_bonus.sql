-- 0064 : le rang du récap suit les jours joués, et la carte de modérateur
-- gagnée en bonus de niveau se prend avec un compte nommé et les XP du
-- premier niveau de bonus, vus par le serveur.

select tests.new_user(n) from unnest(array['ra', 'rb', 'rc', 'rd', 're']) n;
select tests.new_user('ran', true);

-- ------------------------------------------------------------ rang par jour --

create function tests.rplay(p_label text, p_day date, p_n integer, p_value numeric) returns void
language sql security definer set search_path = public as $$
  insert into public.weekly_attempts (player_id, week_id, lang, day, n, finished_at, metric, value, words)
  values (tests.uid(p_label), date '2026-10-04', 'fr', p_day, p_n, now(), 'score', p_value, '[]'::jsonb)
$$;
-- ra : 10 le lundi, 50 le mardi, 20 le mardi encore (la meilleure tient).
select tests.rplay('ra', date '2026-10-05', 1, 10);
select tests.rplay('ra', date '2026-10-06', 1, 50);
select tests.rplay('ra', date '2026-10-06', 2, 20);
-- rb : 30 le lundi, 20 le mardi ; rc : 40 le mardi seulement.
select tests.rplay('rb', date '2026-10-05', 1, 30);
select tests.rplay('rb', date '2026-10-06', 1, 20);
select tests.rplay('rc', date '2026-10-06', 1, 40);

select tests.login('ra');
select tests.is(jsonb_array_length(public.weekly_recap(date '2026-10-04', 'fr') -> 'ranks'), 2, 'one rank per day I played');
select tests.is(public.weekly_recap(date '2026-10-04', 'fr') #>> '{ranks,0,day}', '2026-10-05', 'in the order of the days');
select tests.is(public.weekly_recap(date '2026-10-04', 'fr') #> '{ranks,0}', '{"day": "2026-10-05", "rank": 2, "players": 2}'::jsonb,
                'Monday evening: behind the 30, with two players ranked so far');
select tests.is(public.weekly_recap(date '2026-10-04', 'fr') #> '{ranks,1}', '{"day": "2026-10-06", "rank": 1, "players": 3}'::jsonb,
                'Tuesday: first, the third player having come in');
select tests.is(public.weekly_recap(date '2026-10-04', 'fr') -> 'rank', '1'::jsonb, 'and the final rank is the last of them');
select tests.logout();

select tests.login('rb');
select tests.is(public.weekly_recap(date '2026-10-04', 'fr') #> '{ranks,0}', '{"day": "2026-10-05", "rank": 1, "players": 2}'::jsonb,
                'another player, his own Monday');
select tests.is(public.weekly_recap(date '2026-10-04', 'fr') #> '{ranks,1}', '{"day": "2026-10-06", "rank": 3, "players": 3}'::jsonb,
                'and a Tuesday passed by the others');
select tests.logout();

select tests.login('rd');
select tests.is(public.weekly_recap(date '2026-10-04', 'fr') -> 'ranks', '[]'::jsonb, 'no day played, no rank to follow');
select tests.logout();

-- ------------------------------------------------------ carte en bonus --

select tests.login('ran');
select tests.is(public.answer_moderator_offer('bonus', true), false, 'an anonymous player cannot take the card');
select tests.logout();

select tests.login('rd');
select tests.is(public.answer_moderator_offer('level', true), false, 'the level offer stays closed to a player without the xp');
select tests.is(public.answer_moderator_offer('bonus', false), true, 'the bonus card can be declined');
select tests.is((select count(*)::int from public.moderators where id = tests.uid('rd')), 0, 'declining makes nobody a moderator');
select tests.is((select count(*)::int from public.moderator_offers where player_id = tests.uid('rd')), 0, 'and closes no offer');
select tests.is(public.answer_moderator_offer('bonus', true), false, 'without the xp of a bonus level the server saw, no card');
select tests.logout();
insert into public.runs (player_id, seed, score, words, created_at)
values (tests.uid('rd'), 1, 3950, 40, now());
select tests.login('rd');
select tests.is(public.answer_moderator_offer('bonus', true), true, 'with them, a named player takes it');
select tests.logout();
select tests.is((select count(*)::int from public.moderators where id = tests.uid('rd')), 1, 'and moderates');
select tests.is((select invited_by from public.moderators where id = tests.uid('rd')), null, 'with nobody to thank');

select tests.login('rd');
select tests.is(public.answer_moderator_offer('bonus', true), false, 'a moderator has nothing left to take');
select tests.logout();

select tests.login('re');
select tests.is(public.answer_moderator_offer('words', true), false, 'the other reasons still need their conditions');
select tests.is(public.answer_moderator_offer('bonus ', true), false, 'and an unknown reason is no bonus');
select tests.is((select count(*)::int from public.moderators where id = tests.uid('re')), 0, 'nobody became a moderator by them');
select tests.logout();
