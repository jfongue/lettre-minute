-- Ce que les parties disent des couples lettre + catégorie : agrégé à l'envoi
-- de la partie, une fois par graine, et lu par le tirage du client.

select tests.new_user('pw');
select tests.new_user('px');

create function pg_temp.report(p_label text, p_seed bigint, p_lang text, p_prompts jsonb) returns boolean
language plpgsql as $$
declare
  v_ok boolean;
begin
  perform tests.login(p_label);
  v_ok := public.report_prompts(p_seed, p_lang, p_prompts);
  perform tests.logout();
  return v_ok;
end;
$$;

create function pg_temp.counted(p_lang text, p_category text, p_letter text) returns text
language sql stable as $$
  select coalesce((select dealt || '/' || passed from public.prompt_stats
                    where lang = p_lang and category_id = p_category and letter = p_letter), 'rien');
$$;

-- ------------------------------------------------------------- access --

select tests.login_anon();
select tests.throws($$select public.report_prompts(1, 'fr', '[]'::jsonb)$$, 'reporting takes a session', '42501');
select tests.is((select count(*)::int from public.prompt_stats), 0, 'and a stranger reads no odds');
select tests.logout();

-- ------------------------------------------------------------- the tally --

select tests.is(pg_temp.report('pw', 11, 'fr', '[{"category":"animaux","letter":"A","passed":false}]'), true,
                'a player reports the pairs his run left');
select tests.is(pg_temp.counted('fr', 'animaux', 'A'), '1/0', 'the pair he answered is counted');
select tests.is(pg_temp.report('pw', 12, 'fr', '[{"category":"animaux","letter":"A","passed":true}]'), true,
                'another run of his adds to it');
select tests.is(pg_temp.counted('fr', 'animaux', 'A'), '2/1', 'the pair he left empty is counted too');
select tests.is(pg_temp.report('px', 12, 'fr', '[{"category":"animaux","letter":"A","passed":false}]'), true,
                'every player carries his own');
select tests.is(pg_temp.counted('fr', 'animaux', 'A'), '3/1', 'the crowd adds up');

select tests.is(pg_temp.report('pw', 13, 'de', '[{"category":"animaux","letter":"A","passed":true}]'), true, 'a German run');
select tests.is(pg_temp.counted('de', 'animaux', 'A'), '1/1', 'counts in its own dictionary');
select tests.is(pg_temp.counted('fr', 'animaux', 'A'), '3/1', 'without touching the French one');

-- ------------------------------------------------------- once per run --

select tests.is(pg_temp.report('pw', 12, 'fr', '[{"category":"animaux","letter":"B","passed":true}]'), false,
                'a seed that already spoke says nothing twice');
select tests.is(pg_temp.counted('fr', 'animaux', 'B'), 'rien', 'and writes nothing');
select tests.is(pg_temp.counted('fr', 'animaux', 'A'), '3/1', 'nor moves what it had counted');

-- ------------------------------------------------- what never counts --

select tests.is(
  pg_temp.report('pw', 14, 'fr', '[{"category":"animaux","letter":"a","passed":true},
                                   {"category":"de:animaux","letter":"B","passed":true},
                                   {"category":"animaux","letter":"C","passed":"oui"},
                                   {"category":"animaux","letter":"D"},
                                   "personne"]'),
  true, 'a report carries what it can');
select tests.is(pg_temp.counted('fr', 'animaux', 'a'), 'rien', 'a lowercase letter is not a pair');
select tests.is(pg_temp.counted('fr', 'de:animaux', 'B'), 'rien', 'nor a language smuggled into the category');
select tests.is(pg_temp.counted('fr', 'animaux', 'C'), 'rien', 'nor a verdict that is not true or false');
select tests.is(pg_temp.counted('fr', 'animaux', 'D'), 'rien', 'nor a pair without one');
select tests.is((select count(*)::int from public.prompt_stats), 2, 'and nothing else slipped in');

select tests.is(
  pg_temp.report('pw', 15, 'fr', (select jsonb_agg(jsonb_build_object('category', 'animaux', 'letter', 'E', 'passed', false))
                                    from generate_series(1, 31))),
  false, 'a run that claims thirty-one pairs is not believed');
select tests.is(pg_temp.counted('fr', 'animaux', 'E'), 'rien', 'and counts for nothing');

select tests.is(pg_temp.report('pw', 16, 'FR', '[]'::jsonb), false, 'an unknown language is refused');

-- ------------------------------------------------------------ reading --

select tests.login('px');
select tests.is((select count(*)::int from public.prompt_stats), 2, 'a player reads the odds');
select tests.logout();
select tests.login_anon();
select tests.is((select count(*)::int from public.prompt_stats), 0, 'and no one without a session');
select tests.is((select count(*)::int from public.prompt_reports), 0, 'nor the reports themselves');
select tests.logout();
select tests.is((select count(*)::int from public.prompt_reports), 5, 'while the server keeps every run that spoke');
