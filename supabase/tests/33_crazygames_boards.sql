-- Les classements lus sans session et les comptes CrazyGames (0073).

select tests.new_user(n) from unnest(array['cga', 'cgb', 'cgc']) n;
select tests.new_user('cgx', true);

-- Un compte que la fonction Edge vient de créer : nommé, mais encore « Anonyme ».
create function tests.portal_user(p_label text) returns uuid
language sql security definer set search_path = public as $$
  insert into auth.users (instance_id, aud, role, email, is_anonymous, raw_app_meta_data, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_label || '@test.invalid', false, '{}', '{}')
  returning id
$$;
create function tests.name_of(p_label text) returns text
language sql stable security definer set search_path = public as $$
  select display_name from public.profiles where id = tests.uid(p_label)
$$;

select tests.run_at('cga', now(), 80);
select tests.run_at('cgb', now(), 50);
select tests.run_at('cgc', now(), 50);
-- Un anonyme fait mieux que tout le monde : il ne compte pas.
select tests.run_at('cgx', now(), 99);

-- ------------------------------------------------------------- invité --

select tests.login_anon();
select tests.is((select count(*)::integer from public.leaderboard_stat('best', 'day')), 3, 'a guest reads the named players of a board');
select tests.is((select count(*)::integer from public.leaderboard_stat('best', 'day') where mine), 0, 'nothing on it is a guest''s own');
select tests.is((select count(*)::integer from public.leaderboard_board('day')), 3, 'a guest reads the home board');
select tests.is(public.leaderboard_rank('best', 'day', 90), 1, 'a value above all is first');
select tests.is(public.leaderboard_rank('best', 'day', 80), 1, 'a tie shares the place');
select tests.is(public.leaderboard_rank('best', 'day', 60), 2, 'under one player, second');
select tests.is(public.leaderboard_rank('best', 'day', 10), 4, 'under three, fourth — the anonymous run does not count');
select tests.is(public.leaderboard_rank('moderation', 'day', 10), null::integer, 'the moderation board stays closed');
select tests.is(public.leaderboard_rank('best', 'year', 10), null::integer, 'an unknown period answers nothing');
select tests.is(public.leaderboard_rank('best', 'day', 0), null::integer, 'nothing to place for zero');
select tests.throws($$select * from public.crazygames_accounts$$, 'a guest cannot read the account links', '42501');
select tests.throws($$select public.crazygames_link('x', gen_random_uuid(), 'x')$$, 'a guest cannot link an account', '42501');
select tests.logout();

select tests.login('cga');
select tests.throws($$select * from public.crazygames_accounts$$, 'a player cannot read the account links', '42501');
select tests.throws($$select public.crazygames_link('x', tests.uid('cga'), 'x')$$, 'a player cannot link an account', '42501');
select tests.logout();

-- ------------------------------------------------------- lien du portail --

select tests.portal_user('cgp1');
select tests.portal_user('cgp2');
select tests.portal_user('cgp3');

select tests.login_service();
select tests.is(public.crazygames_link('portal-1', tests.uid('cgp1'), 'Singing.Cheese'), tests.uid('cgp1'), 'a new link answers its own account');
select tests.is(public.crazygames_link('portal-1', tests.uid('cgp2'), 'Singing.Cheese'), tests.uid('cgp1'), 'a second link of the same id answers the first account');
select tests.is(public.crazygames_link('portal-2', tests.uid('cgp2'), 'CGA'), tests.uid('cgp2'), 'another id links its own account');
select tests.is(public.crazygames_link('portal-3', tests.uid('cgp3'), 'cga'), tests.uid('cgp3'), 'a third one too');
select tests.logout();

select tests.is(tests.name_of('cgp1'), 'Singing', 'the portal name, without its extension, becomes the account''s');
select tests.is(tests.name_of('cgp2'), 'CGA_2', 'a taken name takes the first free number');
select tests.is(tests.name_of('cgp3'), 'cga_3', 'and the next one the number after');

-- Le même pseudo ne renomme rien ; un pseudo changé sur le portail renomme.
update public.profiles set display_name = 'Elsewhere' where id = tests.uid('cgp2');
select tests.login_service();
select public.crazygames_link('portal-2', tests.uid('cgp2'), 'CGA');
select tests.logout();
select tests.is(tests.name_of('cgp2'), 'Elsewhere', 'the same portal name renames nothing');
select tests.login_service();
select public.crazygames_link('portal-2', tests.uid('cgp2'), 'Crazytonno.ab12');
select tests.logout();
select tests.is(tests.name_of('cgp2'), 'Crazytonno', 'a portal name changed on the portal renames the account');
