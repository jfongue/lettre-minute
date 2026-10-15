-- 0084 : les choix de montée de niveau, la langue des joueurs, les
-- ouvertures par version (l'invité CrazyGames compris), la rétention, et les
-- arrivés du jour séparés des revenants.

select tests.new_user('ca');
select tests.new_user('cb');
select tests.new_user('old');

-- Un invité CrazyGames envoie ses événements sans compte, pour son seul appareil.
select tests.login_anon();
select tests.is(public.track('[
  {"device":"cg-1","session":"g1","kind":"open","props":{"cold":true},"platform":"crazygames","lang":"en","at":"2020-01-01T00:00:00Z"},
  {"device":"cg-1","session":"g1","kind":"run_start","props":{},"platform":"crazygames","lang":"en"},
  {"device":"cg-2","session":"g2","kind":"open","props":{},"platform":"crazygames"},
  {"device":"cg-1","session":"g3","kind":"open","props":{},"platform":"web"}
]'::jsonb), 2, 'a CrazyGames guest tracks its own device only');
select tests.is(public.track('[{"device":"cg-2","session":"g2","kind":"open","props":{},"platform":"crazygames"}]'::jsonb), 1,
                'another guest, in its own batch');
select tests.logout();
select tests.is((select count(*)::int from public.events where player_id is null and device = 'cg-1'), 2, 'written without an account');

-- Les choix : une offre de deux cartes, et un choix d'avant qui ne la disait pas.
insert into public.events (player_id, device, session, kind, props, lang, platform, at)
values
  (tests.uid('ca'), 'dev-a', 'a1', 'feature', '{"name":"power_chosen","power":"joker","offered":["joker","hush"]}', 'de', 'android', now()),
  (tests.uid('cb'), 'dev-b', 'b1', 'feature', '{"name":"power_chosen","power":"hush","offered":["joker","hush"]}', 'fr', 'android', now()),
  (tests.uid('cb'), 'dev-b', 'b1', 'feature', '{"name":"power_chosen","power":"joker"}', 'fr', 'android', now()),
  (tests.uid('cb'), 'dev-b', 'b1', 'feature', '{"name":"bonus_chosen","bonus":"slot","offered":["slot","reveal"]}', 'fr', 'android', now()),
  (tests.uid('cb'), 'dev-b', 'b1', 'run_start', '{}', 'fr', 'android', now());

create temp table joker as
  select i from jsonb_array_elements(public.analytics_insights(30) #> '{choices,items}') i
   where i ->> 'kind' = 'power' and i ->> 'item' = 'joker';
select tests.is((select (i ->> 'offered')::int from joker), 2, 'joker was offered twice');
select tests.is((select (i ->> 'chosen')::int from joker), 2, 'and chosen twice');
select tests.is((select (i ->> 'picked')::int from joker), 1, 'once from an offer that said what it held');
select tests.is((select (i ->> 'offered')::int from jsonb_array_elements(public.analytics_insights(30) #> '{choices,items}') i
                  where i ->> 'item' = 'reveal'), 1, 'a bonus offered but not taken is listed');
select tests.is((select (k ->> 'with_offer')::int from jsonb_array_elements(public.analytics_insights(30) #> '{choices,kinds}') k
                  where k ->> 'kind' = 'power'), 2, 'two power choices carried their offer');

-- Les ouvertures par version : l'invité CrazyGames a la sienne.
select tests.is((select (r ->> 'with_run')::int from jsonb_array_elements(public.analytics_insights(30) #> '{sessions_by_platform,totals}') r
                  where r ->> 'platform' = 'crazygames'), 1, 'the CrazyGames session with a run');
select tests.is((select (r ->> 'total')::int from jsonb_array_elements(public.analytics_insights(30) #> '{sessions_by_platform,totals}') r
                  where r ->> 'platform' = 'crazygames'), 2, 'and the one without');

-- Les arrivés du jour et les revenants.
update auth.users set created_at = now() - interval '20 days' where id = tests.uid('old');
select tests.run_at('old', now() - interval '20 days', 100, array['loup']);
select tests.run_at('old', now() - interval '19 days', 100, array['loup']);
select tests.run_at('old', now(), 100, array['wolf'], 'en:animals');
select tests.run_at('ca', now(), 100, array['hund'], 'de:tiere');

select tests.is((select (d ->> 'runs_new')::int from jsonb_array_elements(public.analytics_insights(30) -> 'split') d
                  where (d ->> 'day')::date = (now() at time zone 'Europe/Paris')::date), 1, 'one run today by a player arrived today');
select tests.is((select (d ->> 'players_new')::int from jsonb_array_elements(public.analytics_insights(30) -> 'split') d
                  where (d ->> 'day')::date = (now() at time zone 'Europe/Paris')::date), 2, 'two players arrived today were active');

-- La rétention : arrivé il y a vingt jours, revenu le lendemain et aujourd'hui.
create temp table curve as select c from jsonb_array_elements(public.analytics_insights(30) -> 'retention_curve') c;
select tests.is((select (c ->> 'exact')::int from curve where (c ->> 'day')::int = 1), 1, 'back the next day');
select tests.is((select (c ->> 'exact')::int from curve where (c ->> 'day')::int = 2), 0, 'not on the second day');
select tests.is((select (c ->> 'rolling')::int from curve where (c ->> 'day')::int = 2), 1, 'but later');
select tests.is((select (c ->> 'eligible')::int from curve where (c ->> 'day')::int = 1), 1, 'only a finished day counts');
select tests.ok(jsonb_array_length(public.analytics_insights(30) -> 'cohorts') >= 1, 'weekly cohorts are listed');
select tests.is((select (r ->> 'd1')::int from jsonb_array_elements(public.analytics_insights(30) -> 'retention_by') r
                  where r ->> 'by' = 'lang' and r ->> 'value' = 'en'), 1, 'retention by language reads the last run''s words');

-- La langue des joueurs nommés.
select tests.is((select p ->> 'lang' from jsonb_array_elements(public.analytics_people(30) -> 'top_players') p
                  where p ->> 'name' = 'ca'), 'de', 'a top player says the language of their last trace');
select tests.ok(public.analytics_snapshot(30) #> '{top_players,0}' ? 'lang', 'the snapshot carries it');
select tests.ok(public.analytics_snapshot(30) ? 'insights', 'and the insights');
select tests.ok(public.analytics_snapshot(30) #> '{daily,0}' ? 'opens', 'without overwriting the core series');

-- La qualité : une session qui lève une erreur, une ouverture qui suit une
-- fermeture brutale, une autre qui a gelé.
insert into public.events (player_id, device, session, kind, props, lang, platform, version, at)
values
  (tests.uid('ca'), 'dev-q', 'q1', 'open', '{"cold":true,"unclean":false}', 'fr', 'android', '1.9.0', now()),
  (tests.uid('ca'), 'dev-q', 'q1', 'ready', '{"ms":1200}', 'fr', 'android', '1.9.0', now()),
  (tests.uid('ca'), 'dev-q', 'q1', 'error', '{"message":"boom","source":"app.js:1","screen":"over"}', 'fr', 'android', '1.9.0', now()),
  (tests.uid('ca'), 'dev-q', 'q1', 'hide', '{"seconds":60,"freezes":1,"long_ms":900,"long_max":700}', 'fr', 'android', '1.9.0', now()),
  (tests.uid('ca'), 'dev-q', 'q2', 'open', '{"cold":true,"unclean":true}', 'fr', 'android', '1.9.0', now()),
  (tests.uid('ca'), 'dev-q', 'q2', 'ready', '{"ms":3000}', 'fr', 'android', '1.9.0', now()),
  (tests.uid('ca'), 'dev-q', 'q2', 'hide', '{"seconds":60,"freezes":0,"long_ms":0,"long_max":0}', 'fr', 'android', '1.9.0', now());

create temp table v19 as
  select v from jsonb_array_elements(public.analytics_quality(30) -> 'by_version') v where v ->> 'version' = '1.9.0';
select tests.is((select (v ->> 'sessions')::int from v19), 2, 'two sessions of the version');
select tests.is((select (v ->> 'error_sessions')::int from v19), 1, 'one hit by an error');
select tests.is((select (v ->> 'unclean')::int from v19), 1, 'one followed an abrupt exit');
select tests.is((select (v ->> 'frozen')::int from v19), 1, 'one froze');
select tests.is((select (v ->> 'ready_p50')::numeric from v19), 2100::numeric, 'the median start time');
select tests.is((select e ->> 'screen' from jsonb_array_elements(public.analytics_quality(30) -> 'errors') e
                  where e ->> 'message' = 'boom'), 'over', 'an error says its screen');
select tests.ok(public.analytics_snapshot(30) ? 'quality', 'the snapshot carries the quality');
