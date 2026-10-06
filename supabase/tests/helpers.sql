-- Assertions and fixtures shared by the test files, loaded after the
-- migrations. Every assertion reports through a notice (`ok - …`) or a
-- warning (`not ok - …`) instead of raising, so one failure does not hide
-- the ones after it; `scripts/test-db.sh` counts them.
--
-- Players are named by a label (their e-mail's local part), because psql
-- variables do not reach inside `do $$ … $$` bodies.

create extension dblink;

create schema tests;
grant usage on schema tests to public;

-- ------------------------------------------------------------ assertions --

create function tests.ok(p_cond boolean, p_what text) returns void
language plpgsql as $$
begin
  if p_cond then
    raise notice 'ok - %', p_what;
  else
    raise warning 'not ok - %', p_what;
  end if;
end;
$$;

create function tests.is(p_got anyelement, p_want anyelement, p_what text) returns void
language plpgsql as $$
begin
  if p_got is not distinct from p_want then
    raise notice 'ok - %', p_what;
  else
    raise warning 'not ok - % (got %, want %)', p_what, coalesce(p_got::text, 'NULL'), coalesce(p_want::text, 'NULL');
  end if;
end;
$$;

-- Runs `p_sql` as the current role; passes when it raises, with `p_state`
-- as SQLSTATE when given. The statement's effects are rolled back either way.
create function tests.throws(p_sql text, p_what text, p_state text default null) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_state is null or sqlstate = p_state then
      raise notice 'ok - %', p_what;
    else
      raise warning 'not ok - % (raised % %, want %)', p_what, sqlstate, sqlerrm, p_state;
    end if;
    return;
  end;
  raise warning 'not ok - % (did not raise)', p_what;
end;
$$;

create function tests.lives(p_sql text, p_what text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise notice 'ok - %', p_what;
exception when others then
  raise warning 'not ok - % (raised % %)', p_what, sqlstate, sqlerrm;
end;
$$;

-- ---------------------------------------------------------------- players --

create function tests.uid(p_label text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from auth.users where email = p_label || '@test.invalid';
$$;

-- A named player gets `p_label` as display name; an anonymous one keeps
-- « Anonyme », as the app leaves it.
create function tests.new_user(p_label text, p_anonymous boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  insert into auth.users (instance_id, aud, role, email, is_anonymous, raw_app_meta_data, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_label || '@test.invalid', p_anonymous, '{}', '{}')
  returning id into v_id;
  if not p_anonymous then
    update public.profiles set display_name = p_label where id = v_id;
  end if;
  return v_id;
end;
$$;

create function tests.claims(p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('sub', id, 'role', 'authenticated', 'is_anonymous', is_anonymous)::text
    from auth.users where id = p_id;
$$;

-- Session-wide on purpose: psql runs each statement in its own transaction,
-- and a local setting would vanish before the next one.
create function tests.login(p_label text) returns void
language plpgsql as $$
begin
  perform set_config('role', 'none', false);
  perform set_config('request.jwt.claims', tests.claims(tests.uid(p_label)), false);
  perform set_config('role', 'authenticated', false);
end;
$$;

-- The API's `anon` role: a request with no session at all.
create function tests.login_anon() returns void
language plpgsql as $$
begin
  perform set_config('role', 'none', false);
  perform set_config('request.jwt.claims', '{"role": "anon"}', false);
  perform set_config('role', 'anon', false);
end;
$$;

create function tests.login_service() returns void
language plpgsql as $$
begin
  perform set_config('role', 'none', false);
  perform set_config('request.jwt.claims', '{"role": "service_role"}', false);
  perform set_config('role', 'service_role', false);
end;
$$;

create function tests.logout() returns void
language plpgsql as $$
begin
  perform set_config('role', 'none', false);
  perform set_config('request.jwt.claims', '', false);
end;
$$;

-- ------------------------------------------------------------- fixtures --

create function tests.befriend(p_a text, p_b text) returns void
language sql security definer set search_path = public as $$
  insert into public.friendships (requester, addressee, status)
  values (tests.uid(p_a), tests.uid(p_b), 'accepted');
$$;

create function tests.make_moderator(p_label text) returns void
language sql security definer set search_path = public as $$
  insert into public.moderators (id) values (tests.uid(p_label));
$$;

-- A super moderator is a role given (0047), not earned; the five words he
-- said « correct » stay, for the tests that count validations.
create function tests.make_super_moderator(p_label text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_review uuid;
begin
  insert into public.moderators (id, super) values (tests.uid(p_label), true)
  on conflict (id) do update set super = true;
  for i in 1..5 loop
    insert into public.word_reviews (category_id, word, display, status, decided_at)
    values ('seed', p_label || '-seed-' || i, 'seed', 'accepted', now())
    returning id into v_review;
    insert into public.moderation_votes (review_id, moderator_id, verdict)
    values (v_review, tests.uid(p_label), 'correct');
  end loop;
end;
$$;

-- A proposal made by the player himself, through RLS, as the app does. The
-- display never carries the language prefix the app puts on the word itself.
create function tests.propose(p_label text, p_category text, p_word text) returns uuid
language plpgsql as $$
declare
  v_id uuid;
begin
  perform tests.login(p_label);
  insert into public.word_submissions (player_id, category_id, word, display)
  values (tests.uid(p_label), p_category, p_word, initcap(regexp_replace(p_word, '^[a-z]{2}:', '')))
  returning id into v_id;
  perform tests.logout();
  return v_id;
end;
$$;

create function tests.review(p_category text, p_word text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.word_reviews where category_id = p_category and word = p_word;
$$;

create function tests.vote(p_label text, p_category text, p_word text, p_verdict text) returns text
language plpgsql as $$
declare
  v_result text;
begin
  perform tests.login(p_label);
  v_result := public.cast_vote(tests.review(p_category, p_word), p_verdict);
  perform tests.logout();
  return v_result;
end;
$$;

create function tests.xp(p_label text) returns integer
language sql stable security definer set search_path = public as $$
  select xp from public.profiles where id = tests.uid(p_label);
$$;

-- A run as superuser, for fixtures that need a chosen date.
create function tests.run_at(p_label text, p_at timestamptz, p_score integer, p_words text[] default '{}',
                             p_category text default 'animaux') returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_run uuid;
begin
  insert into public.runs (player_id, seed, score, words, created_at)
  values (tests.uid(p_label), 1, p_score, cardinality(p_words), p_at)
  returning id into v_run;
  insert into public.run_words (run_id, word, category_id)
  select v_run, w, p_category from unnest(p_words) w;
  return v_run;
end;
$$;

-- --------------------------------------------------------------- dblink --

-- A second session logged in as a player, to race the first one: dblink
-- connections see only committed rows and take their own locks.
create function tests.connect(p_name text, p_label text) returns void
language plpgsql as $$
begin
  perform dblink_connect(p_name, 'dbname=' || current_database() || ' user=postgres');
  perform * from dblink(p_name, format('select set_config(%L, %L, false)', 'request.jwt.claims',
                                       tests.claims(tests.uid(p_label)))) as t(v text);
  perform dblink_exec(p_name, 'set role authenticated');
end;
$$;

create function tests.remote(p_name text, p_sql text) returns text
language sql as $$
  select v from dblink(p_name, p_sql) as t(v text);
$$;

create function tests.submission_id(p_label text, p_word text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.word_submissions where player_id = tests.uid(p_label) and word = p_word;
$$;

-- How many rows `p_sql` touched: RLS hides rows from an update or delete
-- instead of refusing it.
create function tests.affected(p_sql text) returns integer
language plpgsql as $$
declare
  v_count integer;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
