-- L'offre de modération (0082) : le niveau 6 au seuil du jeu, une file qui
-- n'a que sa réserve à verser, et une invitation posée à la main pour un
-- joueur que le serveur ne peut pas vérifier.

select tests.new_user(n) from unnest(array['oa', 'ob', 'oc']) n;

-- ---------------------------------------------------- niveau 6 : 1650 XP --

-- 1700 points reçus : le niveau 6 depuis 0018, sous les 2550 que 0055 avait
-- gardés de 0007.
select tests.run_at('oa', now(), 1700, array['oa-un']);
select tests.login('oa');
select tests.is(public.moderation_status('fr') ->> 'offer', null,
'a short queue with nothing in reserve still offers nothing');
select tests.logout();

-- La réserve compte comme des mots à juger : cinq mots français à verser.
insert into public.moderation_reserve (category_id, word, display)
select 'animaux', w, w from unnest(array['zouave', 'yack', 'xerus', 'wombat', 'vison']) w;

select tests.login('oa');
select tests.is(public.moderation_status('fr') ->> 'offer', 'level',
'1700 points earned reach level 6, and the reserve has five words to pour');
select tests.is(public.moderation_status('de') ->> 'offer', null,
'while a language with an empty reserve offers nothing');
select tests.logout();

-- Le refus tient : une offre déjà déclinée ne revient pas, même avec de quoi
-- juger et le seuil atteint.
select tests.run_at('ob', now(), 1700, array['ob-un']);
select tests.login('ob');
select tests.is(public.answer_moderator_offer('level', false), true, 'a level offer is declined');
select tests.is(public.answer_moderator_offer('level', true), false, 'and is answered once');
select tests.is(public.moderation_status('fr') ->> 'offer', null, 'so it does not come back');
select tests.logout();

-- --------------------------------------------- invitation posée à la main --

-- Un compte CrazyGames dont les parties jouées en invité ne sont jamais
-- montées : le serveur ne voit rien de son niveau. L'invitation posée dans
-- `moderator_offers` est la seule trace qui reste.
select tests.login('oc');
select tests.is(public.moderation_status('fr') ->> 'offer', null, 'nothing is due before the invitation is posed');
select tests.logout();
insert into public.moderator_offers (player_id, reason) values (tests.uid('oc'), 'level');
select tests.login('oc');
select tests.is(public.moderation_status('fr') ->> 'offer', 'level', 'a hand-posed invitation is due at any xp');
select tests.is(public.answer_moderator_offer('level', true), true, 'and is accepted like any other');
select tests.is((public.moderation_status('fr') ->> 'moderator')::boolean, true, 'which makes him a moderator');
select tests.logout();
select tests.is((select count(*)::int from public.moderators where id = tests.uid('oc')), 1, 'on the server too');
