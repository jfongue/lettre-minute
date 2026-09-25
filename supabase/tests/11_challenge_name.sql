-- A challenge's optional name: trimmed, capped, carried to its rematch, and
-- read by every player from the detail and from the list.

select tests.new_user(n) from unnest(array['na', 'nb']) n;
select tests.befriend('na', 'nb');

select tests.login('na');
select public.create_challenge('fr', 5, '{animaux}', array[tests.uid('nb')]) as bare \gset
select tests.is(public.challenge_detail(:'bare') ->> 'name', null, 'a challenge has no name by default');
select public.create_challenge('fr', 6, '{animaux}', array[tests.uid('nb')], true, '   ') as blank \gset
select tests.is(public.challenge_detail(:'blank') ->> 'name', null, 'blanks are no name');
select public.create_challenge('fr', 7, '{animaux}', array[tests.uid('nb')], true, '  La revanche du jeudi  ') as named \gset
select tests.is(public.challenge_detail(:'named') ->> 'name', 'La revanche du jeudi', 'the name is trimmed');
select public.create_challenge('fr', 8, '{animaux}', array[tests.uid('nb')], true, repeat('x', 60)) as long \gset
select tests.is(char_length(public.challenge_detail(:'long') ->> 'name'), 40, 'and cut at forty characters');
select public.submit_challenge_run(:'named', 10, 0, 1, '[]'::jsonb);
select tests.login('nb');
select tests.is((select name from public.my_challenges() where id = :'named'), 'La revanche du jeudi', 'a guest reads it in the list');
select public.submit_challenge_run(:'named', 12, 0, 1, '[]'::jsonb);
select public.rematch_challenge(:'named', 9, '{animaux}') as again \gset
select tests.is(public.challenge_detail(:'again') ->> 'name', 'La revanche du jeudi', 'the rematch keeps it');
select tests.logout();
