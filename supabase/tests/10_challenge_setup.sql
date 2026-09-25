-- A challenge's own rules: powers allowed or not, carried to its rematch,
-- and read back by every player.

select tests.new_user(n) from unnest(array['sa', 'sb']) n;
select tests.befriend('sa', 'sb');

select tests.login('sa');
select public.create_challenge('fr', 5, '{animaux,pays}', array[tests.uid('sb')]) as plain \gset
select tests.is((public.challenge_detail(:'plain') ->> 'powers_allowed')::boolean, true, 'powers are allowed by default');
select public.create_challenge('fr', 6, '{animaux}', array[tests.uid('sb')], false) as bare \gset
select tests.is((public.challenge_detail(:'bare') ->> 'powers_allowed')::boolean, false, 'the owner may bar them');
select tests.is(public.challenge_detail(:'bare') -> 'category_ids', '["animaux"]'::jsonb, 'with the categories he chose');
select public.submit_challenge_run(:'bare', 10, 0, 1, '[]'::jsonb);
select tests.login('sb');
select tests.is((public.challenge_detail(:'bare') ->> 'powers_allowed')::boolean, false, 'a guest reads the same rule');
select public.submit_challenge_run(:'bare', 12, 0, 1, '[]'::jsonb);
select public.rematch_challenge(:'bare', 7, '{pays}') as again \gset
select tests.is((public.challenge_detail(:'again') ->> 'powers_allowed')::boolean, false, 'the rematch keeps the rule');
select tests.logout();
