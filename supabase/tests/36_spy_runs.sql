-- `spy_runs` (0079) : un super modérateur lit les parties d'un autre joueur,
-- par son compte ou par son nom, page par page et avec leurs mots ; personne
-- d'autre, modérateur compris. « Anonyme » ne désigne personne.

select tests.new_user('lea');
select tests.new_user('ghost', true);
select tests.new_user('m1');
select tests.make_moderator('m1');
select tests.new_user('s1');
select tests.make_super_moderator('s1');

insert into public.runs (id, player_id, seed, score, best_combo, skips, created_at)
select ('00000000-0000-0000-0000-00000000000' || i)::uuid, tests.uid('lea'), i, 10 * i, i, 0, now() - make_interval(hours => i)
  from generate_series(1, 3) i;
insert into public.run_words (run_id, word, category_id, points)
values ('00000000-0000-0000-0000-000000000001', 'chat', 'animaux', 10),
       ('00000000-0000-0000-0000-000000000001', 'chili', 'pays', 20);
insert into public.runs (player_id, seed, score) values (tests.uid('ghost'), 9, 5);

-- --------------------------------------------------------------- la porte --

select tests.login('lea');
select tests.is(public.spy_runs('lea', null, 30), null::jsonb, 'a player does not spy, not even on himself');
select tests.logout();

select tests.login('m1');
select tests.is(public.spy_runs('lea', null, 30), null::jsonb, 'nor does a moderator');
select tests.logout();

-- --------------------------------------------------------- le super modérateur --

select tests.login('s1');
select tests.is(jsonb_array_length(public.spy_runs('LEA', null, 30) -> 'runs'), 3, 'a super moderator reads her runs by name, any case');
select tests.is(public.spy_runs('lea', null, 30) -> 'runs' -> 0 ->> 'score', '10', 'newest first');
select tests.is(jsonb_array_length(public.spy_runs('lea', null, 30) -> 'runs' -> 0 -> 'run_words'), 2, 'with the words it said');
select tests.is(public.spy_runs('lea', null, 30) ->> 'name', 'lea', 'and her name');
select tests.is(jsonb_array_length(public.spy_runs('lea', null, 2) -> 'runs'), 2, 'one page at a time');
select tests.is(
  jsonb_array_length(public.spy_runs('lea', now() - interval '90 minutes', 30) -> 'runs'), 2,
  'older than the cursor only');
select tests.is(jsonb_array_length(public.spy_runs(tests.uid('ghost')::text, null, 30) -> 'runs'), 1,
                'an account id reaches an anonymous player');
select tests.is(public.spy_runs('Anonyme', null, 30), null::jsonb, '« Anonyme » names nobody');
select tests.is(public.spy_runs('nobody', null, 30), null::jsonb, 'nor does a name no one holds');
select tests.logout();
