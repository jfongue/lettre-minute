-- Les fonctionnalités paramétrables (0045) : lues par tous, réglées par les
-- seuls super modérateurs, une case à la fois.

select tests.new_user(n) from unnest(array['ga', 'gm', 'gs']) n;
select tests.make_moderator('gm');
select tests.make_super_moderator('gs');

select tests.login('gs');
select tests.is(public.set_feature_flag('duel', 'super_moderator', 'on'), 'saved', 'a super moderator opens the duel to super moderators');
select tests.is(public.set_feature_flag('duel', 'everyone', 'off'), 'saved', 'and closes it to everyone else');
select tests.is(public.set_feature_flag('duel', 'everyone', 'maybe'), 'invalid', 'a value outside on/off/neutral is refused');
select tests.is(public.set_feature_flag('duel', 'admins', 'on'), 'invalid', 'so is an unknown audience');
select tests.is(public.set_feature_flag('du el', 'everyone', 'on'), 'invalid', 'and a feature id that is not a plain word');
select tests.logout();

select tests.login('gm');
select tests.is(public.set_feature_flag('duel', 'everyone', 'on'), 'forbidden', 'a plain moderator cannot change a flag');
select tests.throws($$insert into public.feature_flags (feature, everyone) values ('x', 'on')$$, 'nor write the table directly');
select tests.is((select count(*)::int from public.feature_flags), 1, 'but reads it');
select tests.logout();

select tests.login_anon();
select tests.is(
  (select everyone || '/' || moderator || '/' || premium || '/' || super_moderator from public.feature_flags where feature = 'duel'),
  'off/neutral/neutral/on', 'a device without an account reads every cell at startup'
);
select tests.throws($$select public.set_feature_flag('duel', 'everyone', 'on')$$, 'nor may it even call the setter', '42501');
select tests.logout();
