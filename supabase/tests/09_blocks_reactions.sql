-- Blocking: by name, it ends the friendship, and the blocked player's next
-- requests vanish without telling them. Reactions: players who played only,
-- one per target, a known emoji, and a null one takes it back.

select tests.new_user(n) from unnest(array['ba', 'bb', 'bc']) n;
select tests.new_user('banon', true);
select tests.befriend('ba', 'bb');

-- ------------------------------------------------------------ blocking --

select tests.login('banon');
select tests.is(public.block_player('ba'), 'anonymous', 'an anonymous player cannot block');
select tests.login('ba');
select tests.is(public.block_player('nobody'), 'unknown', 'an unknown name is unknown');
select tests.is(public.block_player(null), 'unknown', 'a null name is unknown');
select tests.is(public.block_player(' BA '), 'self', 'nobody blocks himself');
select tests.is(public.block_player(' BB '), 'blocked', 'a name is blocked trimmed, whatever the case');
select tests.is(public.block_player('bb'), 'blocked', 'blocking twice is harmless');
select tests.is((select count(*)::int from public.my_friends()), 0, 'the friendship is gone');
select tests.is((select display_name from public.my_blocks()), 'bb', 'the blocked player is listed');
select tests.is((select count(*)::int from public.blocks), 0, 'the table itself stays unreadable');

select tests.login('bb');
select tests.is(public.request_friend('ba'), 'sent', 'the blocked player is told the request went');
select tests.is((select count(*)::int from public.my_friends()), 0, 'but nothing waits on either side');
select tests.login('ba');
select tests.is((select count(*)::int from public.my_friends()), 0, 'the blocker sees no request');

select tests.is(public.request_friend('bb'), 'sent', 'asking a blocked player unblocks them');
select tests.is((select count(*)::int from public.my_blocks()), 0, 'and the block is gone');

select tests.login('bc');
select public.request_friend('ba');
select tests.login('ba');
select tests.is(public.block_player('bc'), 'blocked', 'an incoming request can be answered with a block');
select tests.ok(not exists (select 1 from public.friendships where tests.uid('bc') in (requester, addressee)),
                'which drops the request');
select public.unblock_player(tests.uid('bc'));
select tests.is((select count(*)::int from public.my_blocks()), 0, 'unblocking lifts it');
select tests.logout();

select tests.login_anon();
select tests.throws('select public.block_player(''ba'')', 'the anon role cannot block');
select tests.logout();

-- ----------------------------------------------------------- reactions --

select tests.befriend('ba', 'bc');
select tests.login('ba');
select public.create_challenge('fr', 3, '{animaux}', array[tests.uid('bc')]) as duel \gset
select tests.is(public.react_in_challenge(:'duel', 'trophy:fastest', '👏'), false, 'nobody reacts before playing');
select public.submit_challenge_run(:'duel', 10, 0, 1, '[]'::jsonb);
select tests.is(public.react_in_challenge(:'duel', 'trophy:fastest', '👏'), true, 'a player who played reacts');
select tests.is(public.react_in_challenge(:'duel', 'trophy:fastest', '🔥'), true, 'and may change his mind');
select tests.is(public.react_in_challenge(:'duel', 'trophy:fastest', 'lol'), false, 'an unknown emoji is refused');
select tests.is(public.react_in_challenge(:'duel', repeat('x', 300), '👏'), false, 'a huge target is refused');
select tests.is((select count(*)::int from public.reactions_of_challenge(:'duel')), 1, 'one reaction per target');
select tests.is((select emoji from public.reactions_of_challenge(:'duel')), '🔥', 'the last one');

select tests.login('bb');
select tests.is(public.react_in_challenge(:'duel', 'trophy:fastest', '👏'), false, 'an outsider cannot react');
select tests.is((select count(*)::int from public.reactions_of_challenge(:'duel')), 0, 'nor read the reactions');

select tests.login('bc');
select tests.is((select count(*)::int from public.reactions_of_challenge(:'duel')), 1, 'a guest reads them');
select tests.login('ba');
select tests.is(public.react_in_challenge(:'duel', 'trophy:fastest', null), true, 'a null emoji takes it back');
select tests.is((select count(*)::int from public.reactions_of_challenge(:'duel')), 0, 'and it is gone');
select tests.logout();
