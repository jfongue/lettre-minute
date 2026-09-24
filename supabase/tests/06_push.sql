-- Push tokens, the outbox read only by service_role, the wake-up call through
-- pg_net, and the Vault configuration of 0010.

select tests.new_user('ta');
select tests.new_user('tb');
select tests.befriend('ta', 'tb');

\set token '''fcm-token-0123456789-abcdef'''

-- ------------------------------------------------------------- tokens --

select tests.login('ta');
select tests.is(public.save_push_token('short', 'android', 'fr'), false, 'a token under twenty characters is refused');
select tests.is(public.save_push_token(repeat('x', 4097), 'android', 'fr'), false, 'so is one over 4096');
select tests.is(public.save_push_token(:token, 'android', ''), true, 'a token is saved');
select tests.is((select count(*)::int from public.push_tokens), 0, 'the token table is closed to direct reads');
select tests.logout();
select tests.is((select lang from public.push_tokens where token = :token), 'fr', 'an empty language falls back to French');

select tests.login('tb');
select tests.is(public.save_push_token(:token, 'ios', 'de'), true, 'another account signs in on the same phone');
select tests.logout();
select tests.ok((select player_id = tests.uid('tb') and lang = 'de' and platform = 'ios' from public.push_tokens where token = :token),
                'the token follows the last account');
select tests.is((select count(*)::int from public.push_tokens), 1, 'one row per token');

select tests.login('ta');
select public.forget_push_token(:token);
select tests.logout();
select tests.is((select count(*)::int from public.push_tokens), 1, 'a player cannot forget another''s token');
select tests.login('tb');
select public.forget_push_token(:token);
select tests.logout();
select tests.is((select count(*)::int from public.push_tokens), 0, 'the owner can');

select tests.login_anon();
select tests.throws(format('select public.save_push_token(%L, %L, %L)', repeat('y', 30), 'android', 'fr'),
                    'a request with no session cannot save a token', '42501');
select tests.logout();

-- -------------------------------------------------------------- outbox --

select tests.login('tb');
select public.save_push_token(:token, 'android', 'de');
select tests.login('ta');
select public.create_challenge('fr', 1, '{animaux}', array[tests.uid('tb')]) as ch \gset
select tests.throws('select * from public.claim_push_batch()', 'a player cannot read the outbox', '42501');
select tests.throws('select public.finish_push_batch(''{1}'', ''{}'')', 'nor close it', '42501');
select tests.throws('select public.push_config(''https://evil.invalid'')', 'nor redirect the pushes', '42501');
select tests.throws('select public.kick_push()', 'nor wake the function', '42501');
select tests.throws('select public.push_tick()', 'nor run the tick', '42501');
select tests.is((select count(*)::int from public.push_outbox), 0, 'the outbox is closed to direct reads');
select tests.logout();

select tests.ok(exists (select 1 from vault.secrets where name = 'push_secret' and length(secret) = 64),
                '0010 drew a 64-character push secret');
select tests.is((select count(*)::int from net.http_request_queue), 0, 'no wake-up before the function registered its address');

select tests.login_service();
select tests.is(public.push_config('https://project.invalid/functions/v1/push'),
                (select decrypted_secret from vault.decrypted_secrets where name = 'push_secret'),
                'push_config hands the secret to service_role');
select public.push_config('https://project.invalid/functions/v1/push');
select public.push_config('https://moved.invalid/functions/v1/push');
select tests.logout();
select tests.is((select string_agg(secret, ',') from vault.secrets where name = 'push_url'), 'https://moved.invalid/functions/v1/push',
                'the address is kept once and follows the function');

select tests.login('ta');
select public.create_challenge('fr', 3, '{pays}', array[tests.uid('tb')]);
select tests.logout();
select tests.ok((select headers ->> 'x-push-secret' = (select secret from vault.secrets where name = 'push_secret')
                   and url = 'https://moved.invalid/functions/v1/push'
                   from net.http_request_queue order by id desc limit 1),
                'a queued push wakes the function with the secret');

select tests.login_service();
create temp table batch as select * from public.claim_push_batch();
select tests.logout();
select tests.ok((select bool_and(token = :token and lang = 'de' and owner_name = 'ta') from batch where kind = 'invite'),
                'the batch carries the phone''s token and language');
select tests.ok((select bool_and(attempts = 1 and claimed_at is not null) from public.push_outbox), 'claiming counts an attempt');

select tests.login_service();
select tests.is((select count(*)::int from public.claim_push_batch()), 0, 'a claimed message is not handed out twice');
select public.finish_push_batch((select array_agg(id) from batch), array[:token]);
select tests.logout();
select tests.ok((select bool_and(sent_at is not null) from public.push_outbox), 'finishing marks the batch sent');
select tests.is((select count(*)::int from public.push_tokens), 0, 'and drops the dead tokens');

update public.push_outbox set sent_at = null, claimed_at = now() - interval '3 minutes';
select tests.login_service();
select tests.ok((select count(*) > 0 from public.claim_push_batch()), 'a claim older than two minutes is taken again');
select tests.logout();
update public.push_outbox set sent_at = null, claimed_at = null, attempts = 5;
select tests.login_service();
select tests.is((select count(*)::int from public.claim_push_batch()), 0, 'after five attempts a message is dropped');
select tests.logout();

-- A broken pg_net must not cost a game.
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
                                         headers jsonb default '{}', timeout_milliseconds integer default 5000)
returns bigint language plpgsql as $$ begin raise exception 'network down'; end; $$;
select tests.login('ta');
select public.create_challenge('fr', 2, '{animaux}', array[tests.uid('tb')]) as ch2 \gset
select tests.ok(:'ch2' is not null, 'a challenge opens while the network is down');
select tests.is(public.submit_challenge_run(:'ch2', 10, 0, 0, null), true, 'and takes its run');
select tests.logout();

select tests.login('ta');
select tests.is(public.save_push_token(repeat('t', 30), 'web', 'fr'), false, 'an unknown platform is refused');
select tests.is(public.save_push_token(repeat('t', 30), null, 'fr'), false, 'so is a null one');
select tests.is(public.save_push_token(repeat('t', 30), 'android', 'fra'), false, 'and a malformed language');
select tests.is(public.save_push_token(null, 'android', 'fr'), false, 'and a null token');
select tests.logout();
