-- The advanced leaderboards: the powers a run was played with, what a pair
-- letter + category yields, and the rhythm of runs and new accounts. Fed by
-- `report_prompts` (0025), read by three functions no stranger may call, and
-- blind to the house bots (0026) — which also read the words of the runs that
-- were never reported.

-- La base porte déjà les joueurs maison de 0006 et leurs parties : le test
-- compte à partir de ce qu'elle avait, robots exclus.
create temp table baseline as
  select (select count(*)::int from public.runs r
           where not exists (select 1 from public.bots b where b.id = r.player_id)) as runs,
         (select count(*)::int from auth.users u
           where not u.is_anonymous
             and not exists (select 1 from public.bots b where b.id = u.id)) as accounts;
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

-- The house bots play every hour, but they are not the crowd: their runs and
-- their accounts stay out of the rhythm (0026), as they stay off the
-- leaderboards (0024).
-- Le robot joue à coup sûr : la base, elle, ne le fait jouer qu'au hasard de
-- sa construction (0006), donc rien n'y est supposé.
select tests.logout();
insert into public.runs (player_id, seed, score, words, created_at, powers)
select b.id, 9, 40, 1, now(), array['joker'] from public.bots b limit 1;
insert into public.run_words (run_id, word, category_id, points)
select r.id, 'chat', 'animaux', 90 from public.runs r
  join public.bots b on b.id = r.player_id where r.seed = 9;
select tests.login('ia');
select tests.is((select sum(runs)::int from public.debug_activity('hour')), (select runs + 3 from baseline),
                'a house bot run stays out of the rhythm');
select tests.ok(not exists (select 1 from public.debug_powers() where power = 'joker' and runs > 2),
                'nor does it weigh on a power');
select tests.ok(not exists (select 1 from public.debug_pairs('fr') where points = 90),
                'nor does its word enter a pair');

-- Une graine rapportée doit être une partie reçue (0056) : les trois rapports
-- qui suivent parlent de parties de `ia`.
insert into public.runs (player_id, seed, score, words)
values (tests.uid('ia'), 11, 30, 1), (tests.uid('ia'), 12, 30, 1), (tests.uid('ia'), 13, 30, 1);

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

select tests.throws($$insert into public.runs (player_id, seed, score, words, powers)
                      values (tests.uid('ia'), 20, 10, 1, array_fill('joker'::text, array[21]))$$,
                'a run cannot carry more powers than a challenge admits', '23514');

-- ------------------------------------------- l'histoire des couples --

-- Ce que les parties d'avant le rapport ont écrit : la lettre est celle que le
-- jeu juge, et un mot trouvé vaut un tirage au moins. Les couples choisis sont
-- ceux qu'aucun rapport de ce fichier n'a déjà comptés.
select tests.logout();
insert into public.runs (player_id, seed, score, words, created_at)
values (tests.uid('ia'), 30, 120, 3, now() - interval '2 days');
insert into public.run_words (run_id, word, category_id, points)
select r.id, w.word, w.category, w.points
  from public.runs r,
       (values ('Écarlate', 'couleurs', 40), ('Œil', 'corps-humain', 30), ('côte d''Ivoire', 'pays', 50)) as w(word, category, points)
 where r.player_id = tests.uid('ia') and r.seed = 30;

select tests.login('ia');
select tests.is((select letter from public.debug_pairs('fr') where category_id = 'couleurs'), 'E',
                'an accented word plays on its plain letter');
select tests.is((select letter from public.debug_pairs('fr') where category_id = 'corps-humain'), 'O',
                'a ligature plays on the letter the game draws');
select tests.is((select letter from public.debug_pairs('fr') where category_id = 'pays' and letter = 'C'), 'C',
                'so does a name read from its first letter');
select tests.is((select reported from public.debug_pairs('fr') where category_id = 'couleurs'), false,
                'a pair read from the runs says where it comes from');
select tests.is((select dealt from public.debug_pairs('fr') where category_id = 'couleurs'), 1,
                'and counts the runs that answered it');
select tests.is((select points from public.debug_pairs('fr') where category_id = 'couleurs'), 40,
                'with the points those words brought');

-- Deux mots du même couple dans la même partie : les points s'additionnent,
-- le tirage répondus ne se compte qu'une fois.
select tests.logout();
insert into public.run_words (run_id, word, category_id, points)
select r.id, 'Écru', 'couleurs', 20 from public.runs r where r.player_id = tests.uid('ia') and r.seed = 30;
select tests.login('ia');
select tests.is((select dealt from public.debug_pairs('fr') where category_id = 'couleurs'), 1,
                'two words of one run make one answered draw');
select tests.is((select words from public.debug_pairs('fr') where category_id = 'couleurs'), 2,
                'both words are counted');
select tests.is((select points from public.debug_pairs('fr') where category_id = 'couleurs'), 60,
                'and their points add up');

-- La partie rapporte enfin ses couples : l'histoire ne la compte plus.
select tests.is(
  public.report_prompts(30, 'fr', '[{"category":"couleurs","letter":"E","passed":false,"points":60,"words":2}]'::jsonb),
  true,
  'the run finally reports its pairs'
);
select tests.is((select count(*)::int from public.debug_pairs('fr') where category_id = 'couleurs'), 1,
                'the pair is not counted twice');
select tests.is((select reported from public.debug_pairs('fr') where category_id = 'couleurs'), true,
                'the report takes over from the history');
select tests.is((select points from public.debug_pairs('fr') where category_id = 'couleurs'), 60,
                'keeping the points it carried');

-- Une partie allemande ne parle qu'à l'allemand, préfixe compris.
select tests.logout();
insert into public.runs (player_id, seed, score, words, created_at)
values (tests.uid('ib'), 31, 60, 1, now() - interval '2 days');
insert into public.run_words (run_id, word, category_id, points)
select r.id, 'de:katze', 'de:animaux', 25 from public.runs r where r.player_id = tests.uid('ib') and r.seed = 31;

select tests.login('ib');
select tests.is((select count(*)::int from public.debug_pairs('fr') where points = 25), 0, 'a German word says nothing of the French pairs');
select tests.is((select category_id from public.debug_pairs('de') where points = 25), 'animaux', 'and reads bare in German');
select tests.is((select letter from public.debug_pairs('de') where points = 25), 'K', 'with the letter the German game draws');
select tests.is((select reported from public.debug_pairs('de') where points = 25), false, 'as a pair read from the runs');
