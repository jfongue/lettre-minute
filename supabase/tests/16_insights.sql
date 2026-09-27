-- The advanced leaderboards: the powers a run was played with, what a pair
-- letter + category yields, and the rhythm of runs and new accounts. Fed by
-- `report_prompts` (0025) and read by three functions no stranger may call.

-- La base porte déjà les joueurs maison de 0006 et leurs parties, tous datés
-- de sa construction : le test compte à partir de ce qu'elle avait.
create temp table baseline as
  select (select count(*)::int from public.runs) as runs,
         (select count(*)::int from auth.users where not is_anonymous) as accounts;
-- Lu plus loin sous le rôle d'un joueur : la table temporaire est à la session.
grant select on baseline to authenticated;

select tests.new_user(n) from unnest(array['ia', 'ib']) n;
select tests.new_user('ianon', true);

-- Two players, four runs, three of them with powers: the fourth says a run
-- played bare-handed weighs on no power.
insert into public.runs (player_id, seed, score, words, created_at, powers)
values (tests.uid('ia'), 1, 100, 2, now(), array['joker', 'hush']),
       (tests.uid('ia'), 2, 50, 1, now() - interval '3 hours', array['joker']),
       (tests.uid('ib'), 3, 300, 3, now() - interval '1 day', array['magic']),
       (tests.uid('ib'), 4, 7, 0, now(), '{}');

-- ------------------------------------------------------------- access --

select tests.login_anon();
select tests.throws($$select * from public.debug_powers()$$, 'a stranger reads no powers', '42501');
select tests.throws($$select * from public.debug_activity('day')$$, 'nor any rhythm', '42501');
select tests.throws($$select * from public.debug_pairs('fr')$$, 'nor what a pair yields', '42501');
select tests.throws($$select public.report_prompts(10, 'fr', '[]'::jsonb)$$, 'and reports no pair', '42501');
select tests.logout();

-- ----------------------------------------------------------- the powers --

select tests.login('ia');
select tests.is((select runs from public.debug_powers() where power = 'joker'), 2, 'a power counts every run that carried it');
select tests.is((select points from public.debug_powers() where power = 'joker'), 150, 'and sums what those runs scored');
select tests.is((select best from public.debug_powers() where power = 'joker'), 100, 'with the best of them');
select tests.is((select points from public.debug_powers() where power = 'magic'), 300, 'another power keeps its own tally');
select tests.is((select runs from public.debug_powers() where power = 'hush'), 1, 'a second power of the same run has its own line');
select tests.ok(not exists (select 1 from public.debug_powers() where power is null), 'a run played bare-handed names no power');

-- -------------------------------------------------------------- rhythm --

select tests.is((select count(*)::int from public.debug_activity('hour')), 24, 'the day view is twenty-four hours');
select tests.is((select count(*)::int from public.debug_activity('day')), 7, 'the week view is seven days');
select tests.is((select count(*)::int from public.debug_activity('week')), 12, 'the total view is twelve weeks');
select tests.is((select count(*)::int from public.debug_activity('nonsense')), 0, 'an unknown step says nothing');
select tests.is((select count(*)::int from public.debug_activity(null)), 0, 'nor does a null one');

select tests.is((select sum(runs)::int from public.debug_activity('hour')), (select runs + 3 from baseline),
                'the last day counts the runs of the last twenty-four hours');
select tests.is((select sum(runs)::int from public.debug_activity('day')), (select runs + 4 from baseline),
                'the week counts them all');
select tests.is((select sum(accounts)::int from public.debug_activity('day')), (select accounts + 2 from baseline),
                'a named account is counted when it is created');
select tests.is((select sum(accounts)::int from public.debug_activity('week')), (select accounts + 2 from baseline),
                'and never twice, whatever the view');
select tests.ok(exists (select 1 from public.debug_activity('hour') where runs = 0),
                'an hour nobody played shows as a zero, not as a gap');
select tests.is(
  (select max(bucket) from public.debug_activity('day')),
  date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris',
  'the last day bucket is today, Paris time'
);
select tests.is(
  (select min(bucket) from public.debug_activity('hour')),
  (select bucket from public.debug_activity('hour') limit 1),
  'the buckets read from the oldest to the newest'
);

-- The house bots play too: their runs are the crowd's rhythm, unlike the
-- leaderboards (0024), and they carry no power.
select tests.logout();
insert into public.runs (player_id, seed, score, words, created_at, powers)
select b.id, 9, 40, 1, now(), '{}' from public.bots b limit 1;
select tests.login('ia');
select tests.is((select sum(runs)::int from public.debug_activity('hour')), (select runs + 4 from baseline),
                'a house bot run counts in the rhythm');
select tests.is((select coalesce(sum(runs), 0)::int from public.debug_powers() where power = ''), 0,
                'and adds no power of its own');

-- ------------------------------------------------- what a pair yields --

select tests.is(
  public.report_prompts(11, 'fr', '[{"category":"animaux","letter":"A","passed":false,"points":64,"words":2},
                                   {"category":"animaux","letter":"B","passed":true,"points":0,"words":0},
                                   {"category":"pays","letter":"A","passed":false,"points":12,"words":1}]'::jsonb),
  true,
  'a run reports what each pair yielded'
);
select tests.is((select points from public.debug_pairs('fr') where category_id = 'animaux' and letter = 'A'), 64,
                'the points of a pair are kept');
select tests.is((select words from public.debug_pairs('fr') where category_id = 'animaux' and letter = 'A'), 2,
                'with the words it gave');
select tests.is((select dealt from public.debug_pairs('fr') where category_id = 'animaux' and letter = 'B'), 1,
                'a pair left empty still counts as dealt');
select tests.is((select passed from public.debug_pairs('fr') where category_id = 'animaux' and letter = 'B'), 1,
                'and as passed');
select tests.is((select points from public.debug_pairs('fr') where category_id = 'pays' and letter = 'A'), 12,
                'each pair keeps its own');
select tests.is((select count(*)::int from public.debug_pairs('de')), 0, 'another language reads nothing of it');
select tests.is(public.report_prompts(11, 'fr', '[{"category":"animaux","letter":"Z","passed":false}]'::jsonb), false,
                'a seed that already spoke says nothing twice');
select tests.is((select count(*)::int from public.debug_pairs('fr') where letter = 'Z'), 0, 'and writes no pair');

-- A client from before 0025 sends no points: the pair is still counted, and
-- its yield stays at zero rather than making the report fail.
select tests.is(public.report_prompts(12, 'fr', '[{"category":"animaux","letter":"C","passed":false}]'::jsonb), true,
                'an older client still reports its pairs');
select tests.is((select dealt from public.debug_pairs('fr') where letter = 'C'), 1, 'the pair is counted');
select tests.is((select points from public.debug_pairs('fr') where letter = 'C'), 0, 'with nothing scored');

-- ------------------------------------------------------ doubtful numbers --

select tests.is(
  public.report_prompts(13, 'fr', '[{"category":"animaux","letter":"D","passed":false,"points":-40,"words":-2},
                                   {"category":"animaux","letter":"E","passed":false,"points":99999999,"words":999},
                                   {"category":"animaux","letter":"F","passed":false,"points":"12","words":true}]'::jsonb),
  true,
  'a report with doubtful numbers goes through'
);
select tests.is((select points from public.debug_pairs('fr') where letter = 'D'), 0, 'a negative yield counts as zero');
select tests.is((select words from public.debug_pairs('fr') where letter = 'D'), 0, 'so do negative words');
select tests.is((select points from public.debug_pairs('fr') where letter = 'E'), 100000, 'an absurd yield is capped');
select tests.is((select words from public.debug_pairs('fr') where letter = 'E'), 60, 'so is an absurd word count');
select tests.is((select points from public.debug_pairs('fr') where letter = 'F'), 0, 'a yield that is not a number counts as none');
select tests.is((select words from public.debug_pairs('fr') where letter = 'F'), 0, 'so do words of another type');

-- ------------------------------------------------- a run's own powers --

select tests.throws($$insert into public.runs (player_id, seed, score, powers)
                      values (tests.uid('ia'), 20, 10, array_fill('joker'::text, array[21]))$$,
                'a run cannot carry more powers than a challenge admits', '23514');
