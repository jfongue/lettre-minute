-- `spy_profile` (0092) : la fiche d'un joueur pour la page d'espionnage —
-- compte, plateformes, Premium et son origine, rôle, amis, pouvoirs,
-- modération, rythme et fonctions touchées. Un super modérateur seul la lit.

select tests.new_user('lea');
select tests.new_user('max');
select tests.new_user('m1');
select tests.make_moderator('m1');
select tests.new_user('s1');
select tests.make_super_moderator('s1');
select tests.befriend('lea', 'max');

insert into public.runs (player_id, seed, score, powers, platform, created_at)
values (tests.uid('lea'), 1, 100, '{joker}', 'android', now() - interval '1 hour'),
       (tests.uid('lea'), 2, 60, '{joker,silence}', 'android', now() - interval '2 days'),
       (tests.uid('lea'), 3, 40, '{}', 'web', now() - interval '3 days'),
       (tests.uid('lea'), 4, 70, '{}', null, now() - interval '200 days');
insert into public.events (player_id, device, session, kind, props, platform, version, at)
values (tests.uid('lea'), 'd1', 's1', 'open', '{}', 'crazygames', '1.0.0', now() - interval '10 minutes'),
       (tests.uid('lea'), 'd1', 's1', 'feature', '{"name": "swap"}', 'crazygames', '1.0.0', now() - interval '9 minutes'),
       (tests.uid('lea'), 'd1', 's1', 'feature', '{"name": "swap"}', 'crazygames', '1.0.0', now() - interval '8 minutes'),
       (tests.uid('lea'), 'd2', 's2', 'feature', '{"name": "theme"}', 'android', '1.8.3', now() - interval '100 days');
insert into public.moderation_sessions (player_id) values (tests.uid('m1'));
select tests.propose('lea', 'animaux', 'zebrule');
select tests.vote('m1', 'animaux', 'zebrule', 'correct');
insert into public.premium_grants (account, granted_by) values (tests.uid('lea'), tests.uid('s1'));

-- --------------------------------------------------------------- la porte --

select tests.login('lea');
select tests.is(public.spy_profile('lea'), null::jsonb, 'a player does not read a profile');
select tests.logout();
select tests.login('m1');
select tests.is(public.spy_profile('lea'), null::jsonb, 'nor does a moderator');
select tests.logout();

-- ---------------------------------------------------------- la fiche --

select tests.login('s1');
select tests.is(public.spy_profile('LEA') ->> 'id', tests.uid('lea')::text, 'by name, any case');
select tests.is(public.spy_profile(tests.uid('lea')::text) ->> 'name', 'lea', 'or by account');
select tests.is(public.spy_profile('Anonyme'), null::jsonb, '« Anonyme » names nobody');
select tests.is(public.spy_profile('nobody'), null::jsonb, 'nor a name no one holds');
select tests.is(public.spy_profile('lea') ->> 'friends', '1', 'her friends');
select tests.is(public.spy_profile('lea') -> 'last_open' ->> 'platform', 'crazygames', 'where she opened the game last');
select tests.is(jsonb_array_length(public.spy_profile('lea') -> 'platforms'), 3, 'one line per platform, runs and opens together');
select tests.is(
  (select (p ->> 'runs')::integer from jsonb_array_elements(public.spy_profile('lea') -> 'platforms') p where p ->> 'platform' = 'android'),
  2, 'runs on each');
select tests.is(
  (select (p ->> 'runs')::integer from jsonb_array_elements(public.spy_profile('lea') -> 'powers') p where p ->> 'power' = 'joker'),
  2, 'a power counts the runs that carried it');
select tests.is(
  (select (p ->> 'points')::integer from jsonb_array_elements(public.spy_profile('lea') -> 'powers') p where p ->> 'power' = 'joker'),
  160, 'and what they scored');
select tests.is((public.spy_profile('lea') -> 'without_powers' ->> 'runs')::integer, 2, 'runs without a power apart');
select tests.is(jsonb_array_length(public.spy_profile('lea') -> 'daily'), 90, 'ninety days, empty ones included');
select tests.is(
  (select sum((d ->> 'runs')::integer)::integer from jsonb_array_elements(public.spy_profile('lea') -> 'daily') d),
  3, 'the older run falls outside');
select tests.is(
  (select (f ->> 'n')::integer from jsonb_array_elements(public.spy_profile('lea') -> 'features') f where f ->> 'name' = 'swap'),
  2, 'features touched, counted');
select tests.is(jsonb_array_length(public.spy_profile('lea') -> 'features'), 1, 'over the last ninety days only');
select tests.is(public.spy_profile('lea') -> 'premium' -> 'grant' ->> 'by', 's1', 'a gift says who gave it');
select tests.is(jsonb_array_length(public.spy_profile('lea') -> 'premium' -> 'purchases'), 0, 'and is no purchase');
select tests.is(public.spy_profile('lea') -> 'moderation' -> 'proposed' ->> 'pending', '1', 'the words she proposed');
select tests.is(public.spy_profile('lea') -> 'moderator', 'null'::jsonb, 'she does not moderate');
select tests.is(public.spy_profile('m1') -> 'moderator' ->> 'super', 'false', 'm1 does');
select tests.is(public.spy_profile('m1') -> 'moderation' -> 'votes' ->> 'correct', '1', 'with his votes');
select tests.is(public.spy_profile('m1') -> 'moderation' ->> 'sessions', '1', 'and his sessions');
select tests.logout();
