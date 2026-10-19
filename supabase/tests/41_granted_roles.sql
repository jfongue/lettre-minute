-- 0091 : un super modérateur offre ou reprend Premium et nomme ou retire un
-- modérateur ; personne d'autre. Reprendre ne touche jamais un achat, retirer
-- garde les votes et clôt les offres, et un super modérateur ne se retire pas.

select tests.new_user('gp');
select tests.new_user('buyer');
select tests.new_user('anon', true);
select tests.new_user('m1');
select tests.make_moderator('m1');
select tests.new_user('s1');
select tests.make_super_moderator('s1');
select tests.new_user('s2');
select tests.make_super_moderator('s2');

-- --------------------------------------------------------------- la porte --

select tests.login('m1');
select tests.is(public.grant_premium(tests.uid('gp'), true), 'forbidden', 'a moderator cannot offer Premium');
select tests.is(public.set_moderator(tests.uid('gp'), true), 'forbidden', 'nor name a moderator');
select tests.logout();
select tests.ok(not exists (select 1 from public.premium_grants), 'nothing was written');

-- ------------------------------------------------------------- Premium offert --

select tests.login('gp');
select tests.is(public.my_premium_origin(), null::text, 'no Premium before the gift');
select tests.logout();

select tests.login('s1');
select tests.is(public.grant_premium(tests.uid('gp'), true), 'ok', 'a super moderator offers Premium');
select tests.is(public.grant_premium(tests.uid('gp'), true), 'ok', 'twice is the same gift');
select tests.is(public.grant_premium(gen_random_uuid(), true), 'missing', 'nobody to offer it to');
select tests.logout();

select tests.login('gp');
select tests.is(public.my_premium_origin(), 'grant', 'the player reads a gift');
select tests.is(public.my_premium(), false, 'which my_premium, read by older clients, does not count');
select tests.logout();
select tests.ok(not exists (select 1 from public.purchases), 'a gift is not a purchase');

select tests.login('buyer');
select public.record_purchase('premium_lifetime', 'token-buyer-0001', 'GPA.9');
select tests.logout();
select tests.login('s1');
select tests.is(public.grant_premium(tests.uid('buyer'), true), 'ok', 'a buyer can be offered it too');
select tests.is(public.grant_premium(tests.uid('buyer'), false), 'ok', 'and have the gift taken back');
select tests.is(public.grant_premium(tests.uid('gp'), false), 'ok', 'a gift is taken back');
select tests.logout();

select tests.login('buyer');
select tests.is(public.my_premium_origin(), 'purchase', 'taking a gift back never touches a purchase');
select tests.logout();
select tests.login('gp');
select tests.is(public.my_premium_origin(), null::text, 'the gift is gone');
select tests.logout();

-- ---------------------------------------------------------------- modérateur --

select tests.login('s1');
select tests.is(public.set_moderator(tests.uid('anon'), true), 'anonymous', 'an anonymous account does not moderate');
select tests.is(public.set_moderator(tests.uid('gp'), true), 'ok', 'a super moderator names a moderator');
select tests.logout();
select tests.ok(exists (select 1 from public.moderators where id = tests.uid('gp') and not super and invited_by = tests.uid('s1')),
                'named by him, never super');

select tests.propose('buyer', 'animaux', 'zebrule');
select tests.vote('gp', 'animaux', 'zebrule', 'correct');
select tests.ok(exists (select 1 from public.moderation_votes where moderator_id = tests.uid('gp')), 'the new moderator votes');
insert into public.moderator_offers (player_id, reason, invited_by) values (tests.uid('gp'), 'friend', tests.uid('m1'))
on conflict (player_id, reason) do update set answered = false;

select tests.login('s1');
select tests.is(public.set_moderator(tests.uid('gp'), false), 'ok', 'and is removed');
select tests.is(public.set_moderator(tests.uid('s2'), false), 'super', 'a super moderator is not removed from here');
select tests.logout();
select tests.ok(not exists (select 1 from public.moderators where id = tests.uid('gp')), 'the role is gone');
select tests.ok(exists (select 1 from public.moderation_votes where moderator_id = tests.uid('gp')), 'his vote stays');
select tests.ok(exists (select 1 from public.moderators where id = tests.uid('s2') and super), 'the other super moderator stays');

select tests.is((select count(*)::integer from public.moderator_offers where player_id = tests.uid('gp') and not answered), 0,
                'and no offer brings the role back');
select tests.is((select count(*)::integer from public.moderator_offers where player_id = tests.uid('gp')), 3, 'every reason is closed');
