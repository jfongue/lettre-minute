-- Le niveau qui ouvre la modération se recompte sur les parties reçues et les
-- mots acceptés (0055) : un compte peut toujours s'écrire l'xp qu'il veut, il
-- n'en devient pas modérateur pour autant. `moderator_offer_due` n'est pas
-- ouverte au client : c'est `answer_moderator_offer` qui la consulte.

select tests.new_user(n) from unnest(array['mo', 'mq']) n;

-- Deux parties reçues valent 2600 XP au serveur : le seuil du niveau 6 est là.
select tests.run_at('mo', now(), 1300, array['m-un']);
select tests.run_at('mo', now(), 1300, array['m-deux']);

-- Le même xp, écrit par le client, sans une seule partie.
select tests.login('mq');
select tests.lives($$update public.profiles set xp = 9999 where id = tests.uid('mq')$$,
                   'a player may still write his own xp');
select tests.is(tests.xp('mq'), 9999, 'the profile keeps it');
select tests.is(public.answer_moderator_offer('level', true), false,
                'and earns no offer from it');
select tests.is((select count(*)::int from public.moderators where id = tests.uid('mq')), 0,
                'so he does not become a moderator');
select tests.logout();

select tests.login('mo');
select tests.is(tests.xp('mo'), 0, 'the player who really played has no xp of his own');
select tests.is(public.answer_moderator_offer('level', true), true,
                'his runs alone earn him the level offer');
select tests.logout();
select tests.is((select count(*)::int from public.moderators where id = tests.uid('mo')), 1,
                'and he moderates');
select tests.is((select count(*)::int from public.moderators where id = tests.uid('mq')), 0,
                'while the writer of xp does not');
