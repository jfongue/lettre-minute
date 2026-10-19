-- 0094 : l'usage des fonctions, les sessions de modération au fil des jours, et
-- la réserve reconstruite jour par jour depuis ses dates d'entrée et de versement.

select tests.new_user('ua');
select tests.new_user('ub');
select tests.new_user('um');
select tests.make_moderator('um');
update public.moderators set lang = 'de' where id = tests.uid('um');

insert into public.events (player_id, device, session, kind, props, lang, platform, at)
values
  (tests.uid('ua'), 'dev-a', 'a1', 'feature', '{"name":"power_used","power":"joker"}', 'fr', 'android', now()),
  (tests.uid('ua'), 'dev-a', 'a1', 'feature', '{"name":"power_used","power":"hush"}', 'fr', 'android', now()),
  (tests.uid('ub'), 'dev-b', 'b1', 'feature', '{"name":"power_used","power":"joker"}', 'fr', 'android', now()),
  (tests.uid('ub'), 'dev-b', 'b1', 'feature', '{"name":"theme","theme":"dark"}', 'fr', 'android', now() - interval '10 days'),
  (tests.uid('ub'), 'dev-b', 'b1', 'run_start', '{"mode":"challenge"}', 'fr', 'android', now()),
  (tests.uid('ub'), 'dev-b', 'b1', 'run_start', '{}', 'fr', 'android', now());

create temp table usage as
  select f from jsonb_array_elements(public.analytics_usage(30) -> 'features') f;
select tests.is((select (f ->> 'n30')::int from usage where f ->> 'name' = 'power_used'), 3, 'three uses of powers');
select tests.is((select (f ->> 'u30')::int from usage where f ->> 'name' = 'power_used'), 2, 'by two players');
update public.events set created_at = now() - interval '10 days' where props ->> 'name' = 'theme';
drop table usage;
create temp table usage as
  select f from jsonb_array_elements(public.analytics_usage(30) -> 'features') f;
select tests.is((select (f ->> 'n1')::int from usage where f ->> 'name' = 'theme'), 0, 'a use ten days ago is not today''s');
select tests.is((select (f ->> 'n14')::int from usage where f ->> 'name' = 'theme'), 1, 'but is in the fortnight');
select tests.is((select (f ->> 'n7')::int from usage where f ->> 'name' = 'theme'), 0, 'and not in the week');
select tests.is((select (f ->> 'n30')::int from usage where f ->> 'name' = 'run_challenge'), 1, 'runs count by mode');
select tests.is((select (f ->> 'n30')::int from usage where f ->> 'name' = 'run_solo'), 1, 'a run without a mode is solo');
select tests.ok(public.analytics_snapshot(30) ? 'usage', 'the snapshot carries the usage');

-- Les sessions de modération, par jour et par langue.
insert into public.moderation_sessions (player_id, at)
values (tests.uid('um'), now()), (tests.uid('um'), now() - interval '3 days');
create temp table sessions as
  select s from jsonb_array_elements(public.analytics_moderation_history(30) -> 'sessions_daily') s;
select tests.is((select sum((s ->> 'n')::int)::int from sessions where s ->> 'lang' = 'de'), 2, 'two German sessions in the window');
select tests.is((select count(*)::int from sessions), 2, 'on two different days');

-- La réserve : un mot versé il y a deux jours, entré il y a dix ; un autre
-- d'avant la colonne, jamais versé ; un troisième entré hier.
insert into public.moderation_reserve (category_id, word, display, added_at, released_at)
values ('de:tiere', 'dachs', 'Dachs', now() - interval '10 days', now() - interval '2 days'),
       ('de:tiere', 'elch', 'Elch', null, null),
       ('de:tiere', 'fuchs', 'Fuchs', now() - interval '1 day', null);
create temp table reserve as
  select r from jsonb_array_elements(public.analytics_moderation_history(30) -> 'reserve_daily') r
   where r ->> 'lang' = 'de';
select tests.is((select (r ->> 'left')::int from reserve where r ->> 'day' = ((now() at time zone 'Europe/Paris')::date - 15)::text), 1, 'before the entry: only the old word');
select tests.is((select (r ->> 'left')::int from reserve where r ->> 'day' = ((now() at time zone 'Europe/Paris')::date - 5)::text), 2, 'poured words are still there before their release');
select tests.is((select (r ->> 'left')::int from reserve where r ->> 'day' = (now() at time zone 'Europe/Paris')::date::text), 2, 'today: the old word and the one added yesterday');
select tests.ok(public.analytics_snapshot(30) ? 'moderation_history', 'the snapshot carries the history');
