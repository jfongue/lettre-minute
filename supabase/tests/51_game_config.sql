-- Les réglages du jeu (0125) : une table lisible par tous, des valeurs que le
-- classement lit, et des instantanés figés pour les parties que chaque
-- appareil rejoue — un défi à sa création, un duel à son lancement.

select tests.new_user(n) from unnest(array['ga', 'gb', 'gc']) n;

create function tests.set_config_value(p_key text, p_value numeric) returns void
language sql security definer set search_path = public as $$
  update public.game_config set value = p_value where key = p_key
$$;
create function tests.client(p_rules int) returns void
language sql as $$
  select set_config('request.headers', json_build_object('x-client-info', 'supabase-js/2; runtime=web; platform=android' || case when p_rules > 1 then '; duel=' || p_rules else '' end)::text, false)
$$;
create function tests.lobby(p_a text, p_b text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.duel_tables (host, lang, seed, categories) values (tests.uid(p_a), 'fr', 9, array['animaux']) returning id into v_id;
  insert into public.duel_seats (table_id, player, joined_at)
  values (v_id, tests.uid(p_a), clock_timestamp()), (v_id, tests.uid(p_b), clock_timestamp() + interval '1 ms');
  return v_id;
end;
$$;
create function tests.table_tuning(p_table uuid) returns jsonb
language sql stable security definer set search_path = public as $$ select tuning from public.duel_tables where id = p_table $$;
create function tests.new_challenge(p_owner text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.challenges (owner, lang, seed, category_ids) values (tests.uid(p_owner), 'fr', 7, array['animaux']) returning id into v_id;
  insert into public.challenge_players (challenge_id, player_id) values (v_id, tests.uid(p_owner));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------- lecture --

select tests.login_anon();
select tests.ok((select count(*) from public.game_config) > 80, 'a guest without an account reads the settings');
select tests.is((select value from public.game_config where key = 'run.seconds.solo'), 60::numeric, 'the defaults are the shipped values');
select tests.logout();

select tests.login('ga');
select tests.is(public.game_config_value('run.seconds.solo', 0), 60::numeric, 'a value reads back');
select tests.is(public.game_config_value('nothing.here', 42), 42::numeric, 'a missing key falls back');
select tests.logout();

select tests.set_config_value('duel.reserve', 999);
select tests.login('ga');
select tests.is(public.game_config_value('duel.reserve', 30), 30::numeric, 'a value out of its range falls back to the default');
select tests.logout();
select tests.set_config_value('duel.reserve', 30);

-- ------------------------------------------------------------- classement --

select tests.is(public.duel_k_factor(3), 60, 'the early step is the default 60');
select tests.set_config_value('ranked.kEarly', 70);
select tests.is(public.duel_k_factor(3), 70, 'a migration changes the early step');
select tests.set_config_value('ranked.kEarly', 60);
select tests.is(public.duel_offer_seconds(), 20, 'twenty seconds to accept');
select tests.set_config_value('ranked.offerSeconds', 25);
select tests.is(public.duel_offer_seconds(), 25, 'the offer window follows the setting');
select tests.set_config_value('ranked.offerSeconds', 20);
select tests.is(public.duel_start_rating(), 950, 'an empty ladder starts at Silver III');
select tests.set_config_value('ranked.startEarly', 1000);
select tests.is(public.duel_start_rating(), 1000, 'the start follows the setting');
select tests.set_config_value('ranked.startEarly', 950);
select tests.is(public.duel_effective_rating(1200, now() - interval '17 days'), 1150, 'ten idle days past the grace cost fifty');
select tests.set_config_value('ranked.decayPerDay', 10);
select tests.is(public.duel_effective_rating(1200, now() - interval '17 days'), 1100, 'the decay follows the setting');
select tests.set_config_value('ranked.decayPerDay', 5);

-- ------------------------------------------------------------- instantanés --

select tests.set_config_value('run.seconds.solo', 45);
create temp table c1 as select tests.new_challenge('ga') as id;
grant select on c1 to authenticated;
select tests.set_config_value('run.seconds.solo', 60);
select tests.login('ga');
select tests.is((public.challenge_detail((select id from c1)) -> 'tuning' ->> 'run.seconds.solo')::numeric, 45::numeric, 'a challenge keeps the settings it was created with');
select tests.ok(public.challenge_detail((select id from c1)) -> 'tuning' ->> 'duel.reserve' is null, 'only the run settings');
select tests.logout();

-- Deux clients qui lisent les réglages : la table les fige au lancement.
select tests.set_config_value('duel.reserve', 40);
create temp table t3 as select tests.lobby('ga', 'gb') as id;
grant select on t3 to authenticated;
select tests.client(3);
select tests.login('ga');
select public.duel_ready((select id from t3), true);
select tests.ok(tests.table_tuning((select id from t3)) is null, 'nothing is frozen in the lobby');
select tests.logout();
select tests.login('gb');
select tests.is(public.duel_ready((select id from t3), true), 'started', 'the table starts');
select tests.logout();
select tests.is(tests.table_tuning((select id from t3)) ->> 'duel.reserve', '40', 'the duel settings are frozen at the start');
select tests.ok(tests.table_tuning((select id from t3)) ->> 'run.seconds.solo' is null, 'only the duel settings');
select tests.set_config_value('duel.reserve', 30);
select tests.is(tests.table_tuning((select id from t3)) ->> 'duel.reserve', '40', 'a later change leaves a started table alone');
select tests.login('ga');
select tests.is(public.duel_sync((select id from t3), 0) -> 'table' -> 'tuning' ->> 'duel.reserve', '40', 'the table tells its settings');
select tests.logout();

-- Un client d'avant les règles 3 à la table : rien n'est figé, tous jouent les défauts.
create temp table t2 as select tests.lobby('ga', 'gc') as id;
grant select on t2 to authenticated;
select tests.client(3);
select tests.login('ga');
select public.duel_ready((select id from t2), true);
select tests.logout();
select tests.client(2);
select tests.login('gc');
select public.duel_ready((select id from t2), true);
select tests.logout();
select tests.ok(tests.table_tuning((select id from t2)) is null, 'an older client keeps the table on the shipped values');
