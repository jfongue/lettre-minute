-- `delete_my_account` takes everything a player owns, found from the
-- catalogue rather than listed by hand so that a new table cannot slip
-- through; and `complete_merge` pours an anonymous account into a named one.

-- ---------------------------------------------------------- the schema --

select tests.is((select count(*)::int from pg_constraint
                  where contype = 'f' and confrelid = 'public.profiles'::regclass and confdeltype not in ('c', 'n')), 0,
                'every reference to a profile cascades or nulls on delete');
select tests.is((select string_agg(conrelid::regclass::text, ',') from pg_constraint
                  where contype = 'f' and confrelid = 'auth.users'::regclass), 'profiles',
                'only profiles references auth.users: the rest hangs from profiles');

-- ------------------------------------------------------------ deletion --

select tests.new_user(n) from unnest(array['dv', 'do', 'do2']) n;
select tests.make_moderator('dv');
select tests.make_moderator('do');
update public.moderators set invited_by = tests.uid('dv') where id = tests.uid('do');
insert into public.moderator_offers (player_id, reason, answered) values (tests.uid('dv'), 'level', true);
insert into public.moderator_offers (player_id, reason, invited_by) values (tests.uid('do2'), 'friend', tests.uid('dv'));
select tests.befriend('dv', 'do');
insert into public.friendships (requester, addressee) values (tests.uid('do2'), tests.uid('dv'));

select tests.run_at('dv', now(), 60, array['chat', 'chien']);
select tests.propose('dv', 'animaux', 'dahu');
select tests.propose('do', 'animaux', 'yeti');
select tests.vote('dv', 'animaux', 'yeti', 'unsure');

select tests.login('dv');
select public.save_push_token('dv-phone-token-000000000', 'android', 'fr');
select public.create_challenge('fr', 1, '{animaux}', array[tests.uid('do')]) as owned \gset
select tests.login('do');
select public.save_push_token('do-phone-token-000000000', 'android', 'fr');
select public.create_challenge('fr', 2, '{animaux}', array[tests.uid('dv')]) as joined \gset
select public.submit_challenge_run(:'joined', 10, 0, 0, null);
select tests.logout();
insert into public.account_merges (anon_id) values (tests.uid('dv'));

create table victim as select tests.uid('dv') as id;
create table survivor as select tests.uid('do') as id;

select tests.ok(not public.challenge_finished(:'joined'), 'the joined challenge waits on the victim');

select tests.login_anon();
select tests.throws('select public.delete_my_account()', 'a request with no session cannot delete an account', '42501');
select tests.logout();
select set_config('request.jwt.claims', '{}', false);
set role authenticated;
select public.delete_my_account();
select tests.logout();
select tests.is((select count(*)::int from auth.users where id = (select id from victim)), 1,
                'a session without a user deletes nothing');

select tests.login('dv');
select public.delete_my_account();
select tests.logout();

do $$
declare
  v_ref record;
  v_left bigint;
begin
  for v_ref in
    select c.conrelid::regclass as tab, a.attname as col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass
     order by 1, 2
  loop
    execute format('select count(*) from %s where %I = $1', v_ref.tab, v_ref.col) into v_left using (select id from victim);
    perform tests.is(v_left, 0::bigint, format('nothing of the deleted player is left in %s.%s', v_ref.tab, v_ref.col));
  end loop;
end;
$$;

select tests.is((select count(*)::int from auth.users where id = (select id from victim)), 0, 'the auth user is gone');
select tests.is((select count(*)::int from public.profiles where id = (select id from victim)), 0, 'so is the profile');
select tests.is((select count(*)::int from public.run_words w left join public.runs r on r.id = w.run_id where r.id is null), 0,
                'no run word outlives its run');
select tests.ok(exists (select 1 from public.challenges where id = :'owned' and owner is null),
                'a challenge he led goes on without a leader');
select tests.ok(public.challenge_finished(:'joined'), 'a challenge that waited on him no longer does');
select tests.ok(exists (select 1 from public.moderators where id = (select id from survivor) and invited_by is null),
                'the moderator he elected stays one');
select tests.ok(exists (select 1 from public.moderator_offers where player_id = tests.uid('do2') and invited_by is null),
                'the offer he made stays open');
select tests.ok(exists (select 1 from public.word_submissions where player_id = (select id from survivor)),
                'the other player''s proposals stay');
select tests.ok(exists (select 1 from public.push_tokens where player_id = (select id from survivor)),
                'and his phone');
select tests.ok(tests.review('animaux', 'dahu') is not null, 'a review outlives its author: others may have joined it');

select tests.login('do');
select tests.is(public.invite_to_challenge(:'owned', array[tests.uid('do2')]), 'forbidden', 'nobody inherits the lead');
select tests.logout();

-- ---------------------------------------------------------------- merge --

select tests.new_user('mn');
select tests.new_user('mo');
select tests.new_user('ma', true);
update public.profiles set xp = 1000, runs = 10, best_score = 50, words_found = 40, best_combo = 2 where id = tests.uid('mn');
update public.profiles set xp = 100, runs = 2, best_score = 80, words_found = 5, best_combo = 3 where id = tests.uid('ma');
select tests.run_at('ma', now(), 80, array['merle']);
select tests.run_at('ma', now(), 20);
select tests.run_at('mn', now(), 50);
select tests.propose('ma', 'animaux', 'shared');
select tests.propose('mn', 'animaux', 'shared');
select tests.propose('ma', 'animaux', 'alone');

select tests.login('mn');
select tests.is(public.prepare_merge(), null, 'a named account has nothing to merge');
select tests.login_anon();
select tests.throws('select public.prepare_merge()', 'a request with no session cannot prepare a merge', '42501');
select tests.login('ma');
select public.prepare_merge() as token \gset
select tests.is((select count(*)::int from public.account_merges), 0, 'the merge tokens are closed to direct reads');
select tests.login('mn');
select public.complete_merge(:'token');
select tests.logout();

select tests.is((select count(*)::int from auth.users where id = tests.uid('ma')), 0, 'the anonymous account is gone');
select tests.is((select count(*)::int from public.runs where player_id = tests.uid('mn')), 3, 'its runs are the account''s');
select tests.ok(exists (select 1 from public.run_words w join public.runs r on r.id = w.run_id
                         where r.player_id = tests.uid('mn') and w.word = 'merle'), 'with their words');
select tests.is((select count(*)::int from public.word_submissions where player_id = tests.uid('mn')), 2,
                'its proposals too, the shared one once');
select tests.ok((select xp = 1100 and runs = 12 and best_score = 80 and words_found = 45 and best_combo = 3
                   from public.profiles where id = tests.uid('mn')),
                'totals add up, records keep the best');

select tests.login('mn');
select public.complete_merge(:'token');
select tests.logout();
select tests.is(tests.xp('mn'), 1100, 'a token serves once');

select tests.new_user('ma2', true);
select tests.login('ma2');
select public.prepare_merge() as stale \gset
select tests.logout();
update public.account_merges set created_at = now() - interval '2 hours' where token = :'stale';
select tests.login('mn');
select public.complete_merge(:'stale');
select tests.logout();
select tests.ok(tests.uid('ma2') is not null, 'a token older than an hour merges nothing');

select tests.login('ma2');
select public.prepare_merge() as own \gset
select public.complete_merge(:'own');
select tests.logout();
select tests.ok(tests.uid('ma2') is not null, 'an account cannot merge into itself');

select tests.login('ma2');
select public.prepare_merge() as upgraded \gset
select tests.logout();
update auth.users set is_anonymous = false where id = tests.uid('ma2');
select tests.login('mn');
select public.complete_merge(:'upgraded');
select public.complete_merge(gen_random_uuid());
select public.complete_merge(null);
select tests.logout();
select tests.ok(tests.uid('ma2') is not null, 'an account that registered since is not merged');
select tests.is(tests.xp('mn'), 1100, 'nor are unknown or null tokens');

-- Two accounts presenting the same token at once: one gets it.
select tests.new_user('ma3', true);
update public.profiles set xp = 7 where id = tests.uid('ma3');
select tests.login('ma3');
select public.prepare_merge() as raced \gset
select tests.logout();
select tests.connect('a', 'mn');
select tests.connect('b', 'mo');
select dblink_exec('a', 'begin');
select tests.remote('a', format('select public.complete_merge(%L)::text', :'raced'));
select dblink_send_query('b', format('select public.complete_merge(%L)::text', :'raced'));
select pg_sleep(0.2);
select dblink_exec('a', 'commit');
select * from dblink_get_result('b') as t(v text);
select dblink_disconnect('a');
select dblink_disconnect('b');
select tests.ok(tests.xp('mn') = 1107 and tests.xp('mo') = 0, 'a token raced by two accounts merges into one');
