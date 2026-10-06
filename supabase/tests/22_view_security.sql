-- Les vues exposées à PostgREST : « security invoker » et sans lecture
-- d'`auth.users` (0053), c'est ce que le linter Supabase vérifie. Ce qu'un
-- joueur n'a pas le droit de lire lui-même — les propositions des autres, les
-- comptes anonymes — passe par une fonction `security definer`, sans que la vue
-- perde ce qu'elle rendait.

select tests.ok(not exists (
  select 1
  from pg_depend d
  join pg_rewrite r on r.oid = d.objid
  join pg_class c on c.oid = r.ev_class
  join pg_namespace n on n.oid = c.relnamespace
  join pg_class u on u.oid = d.refobjid
  join pg_namespace un on un.oid = u.relnamespace
  where n.nspname = 'public' and c.relkind in ('v', 'm')
  and un.nspname = 'auth' and u.relname = 'users'
), 'no view of the public schema reads auth.users');

select tests.ok((
  select bool_and(coalesce(c.reloptions, '{}') && array['security_invoker=true', 'security_invoker=on'])
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
), 'every view of the public schema is security invoker');

select tests.new_user(n) from unnest(array['va', 'vb']) n;
select tests.new_user('vanon', true);

select tests.run_at('va', now(), 30, array['v-mot']);
select tests.run_at('vb', now(), 20, array['v-mot']);
select tests.run_at('vanon', now(), 900, array['v-mot']);
update public.profiles set runs = 1, best_score = 30 where id = tests.uid('va');
update public.profiles set runs = 1, best_score = 900 where id = tests.uid('vanon');

select tests.propose('va', 'animaux', 'v-okapi');
select tests.propose('vb', 'animaux', 'v-okapi');

select tests.login('va');
select tests.is((select count(*)::int from public.word_submissions), 1, 'a player still reads only his own proposals');
select tests.is((select proposals from public.submission_tally where category_id = 'animaux' and word = 'v-okapi'), 2,
'the tally still counts the other proposer');
select tests.is((select uses from public.word_popularity where word = 'v-mot'), 3, 'the crowd usage still counts every run');
select tests.ok(exists (select 1 from public.leaderboard where id = tests.uid('va')), 'a named player is on the record board');
select tests.ok(not exists (select 1 from public.leaderboard where id = tests.uid('vanon')), 'an anonymous one is not');
select tests.logout();
