-- Le rapport de tirage parle d'une partie reçue (0056) : sa graine doit exister
-- dans `runs` pour ce compte. Sans cela, n'importe quelle graine inventée
-- déplaçait la cote de tirage des autres joueurs.

select tests.new_user('ra');

-- `run_at` pose la graine 1.
select tests.run_at('ra', now(), 100, array['r-un']);

select tests.login('ra');
select tests.is(public.report_prompts(1, 'fr', '[{"category":"animaux","letter":"A","passed":true}]'::jsonb), true,
                'a played run reports its prompts');
select tests.is(public.report_prompts(1, 'fr', '[]'::jsonb), false,
                'the same run reports only once');
select tests.is(public.report_prompts(999, 'fr', '[]'::jsonb), false,
                'a seed nobody played is refused');
select tests.is(public.report_prompts(999, 'fr', '[{"category":"animaux","letter":"B","passed":true}]'::jsonb), false,
                'and writes nothing');
select tests.is((select count(*)::int from public.prompt_stats where letter = 'B'), 0,
                'the counters did not move');
select tests.logout();
select tests.is((select count(*)::int from public.prompt_reports where player_id = tests.uid('ra')), 1,
                'only the played run was reported');
