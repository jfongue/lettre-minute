-- Les gagnants du défi du moment (0065) : une semaine close par ligne, le
-- meilleur résultat d'abord, départagé par l'heure du rendu, anonymes et
-- joueurs ordinateur écartés, et la métrique de la semaine qui voyage avec elle.

select tests.new_user(n) from unnest(array['wga', 'wgb', 'wgc']) n;
select tests.new_user('wx', true);

create function tests.week() returns date
language sql stable security definer set search_path = public as $$ select week_id from public.weekly_window() $$;
create function tests.bot() returns uuid
language sql stable security definer set search_path = public as $$ select id from public.bots order by id limit 1 $$;
create function tests.win(
  p_player text, p_week date, p_lang text, p_n integer, p_value numeric,
  p_finished timestamptz, p_metric text default 'score'
) returns void
language sql security definer set search_path = public as $$
  insert into public.weekly_attempts (player_id, week_id, lang, day, n, finished_at, metric, value, words)
  values (tests.uid(p_player), p_week, p_lang, p_week + 1, p_n, p_finished, p_metric, p_value, '[]'::jsonb)
$$;

-- ------------------------------------------------------------ gagnants --

-- Semaine close la plus ancienne : wga 40, wgb 55 (endurance, donc des secondes).
select tests.win('wga', tests.week() - 14, 'fr', 1, 40, now() - interval '20 hours', 'survival');
select tests.win('wgb', tests.week() - 14, 'fr', 1, 55, now() - interval '18 hours', 'survival');
-- Semaine close la plus récente : deux fois 70, wgb la plus tôt.
select tests.win('wga', tests.week() - 7, 'fr', 1, 70, now() - interval '10 hours');
select tests.win('wgb', tests.week() - 7, 'fr', 1, 70, now() - interval '11 hours');
-- Une tentative non terminée, plus grosse, ne gagne rien.
select tests.win('wga', tests.week() - 7, 'fr', 2, 100, null);
-- Un anonyme et un joueur ordinateur, plus gros encore : écartés.
select tests.win('wx', tests.week() - 7, 'fr', 1, 9999, now() - interval '9 hours');
create function tests.bot_wins() returns void
language sql security definer set search_path = public as $$
  insert into public.weekly_attempts (player_id, week_id, lang, day, n, finished_at, metric, value, words)
  values (tests.bot(), tests.week() - 7, 'fr', tests.week() - 6, 1, now() - interval '8 hours', 'score', 9999, '[]'::jsonb)
$$;
select tests.bot_wins();
-- La semaine en cours ne compte pas ; une autre langue joue la même semaine.
select tests.win('wgc', tests.week(), 'fr', 1, 500, now());
select tests.win('wgc', tests.week() - 7, 'en', 1, 60, now());

select tests.login_anon();
select tests.throws($$select * from public.weekly_winners('fr', 50)$$, 'a request with no session is refused', '42501');
select tests.logout();

select tests.login('wga');
create temp table won as select * from public.weekly_winners('fr', 50);
grant select on won to public;
select tests.is((select count(*)::int from won), 2, 'one winner per closed week, the current one left out');
select tests.is((select week_id from public.weekly_winners('fr', 50) limit 1), tests.week() - 7, 'the most recent week first');
select tests.is((select week_id from public.weekly_winners('fr', 50) offset 1 limit 1), tests.week() - 14, 'and the oldest last');
select tests.is((select display_name from won where week_id = tests.week() - 7), 'wgb', 'equal values: the earliest result wins');
select tests.is((select value from won where week_id = tests.week() - 7), 70.0, 'the biggest score of that week, not the unfinished one');
select tests.is((select metric from won where week_id = tests.week() - 7), 'score', 'the metric travels with the week');
select tests.is((select metric from won where week_id = tests.week() - 14), 'survival', 'a week in endurance keeps its seconds');
select tests.is((select display_name from won where week_id = tests.week() - 14), 'wgb', 'each week has its own winner');
select tests.is((select count(*)::int from public.weekly_winners('fr', 1)), 1, 'the limit applies');
select tests.is((select count(*)::int from public.weekly_winners('en', 50)), 2, 'every language reads the same winners');
select tests.is((select value from public.weekly_winners('en', 50) limit 1), 70.0, 'the best of all languages wins the week');
select tests.logout();
