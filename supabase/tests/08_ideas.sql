-- La boîte à idées : soumission, limites, et fonctions réservées au serveur.

select tests.new_user('ia');
select tests.new_user('ianon', true);

select tests.login('ia');
select tests.is(public.submit_idea('Ajouter un mode deux joueurs', 'fr'), true, 'une idée valide passe');
select tests.is(public.submit_idea('  ', 'fr'), false, 'un texte vide est refusé');
select tests.is(public.submit_idea('ok', 'fr'), false, 'un texte trop court est refusé');
select tests.is(public.submit_idea(repeat('x', 2001), 'fr'), false, 'un texte trop long est refusé');
select tests.is(public.submit_idea(null, 'fr'), false, 'un texte nul est refusé');
select tests.logout();
select tests.is((select count(*)::int from public.ideas where player_id = tests.uid('ia')), 1, 'seule l''idée valide s''enregistre');

-- Anonyme aussi, comme le reste de l'app côté joueur.
select tests.login('ianon');
select tests.is(public.submit_idea('Une idée envoyée sans compte nommé', 'fr'), true, 'un joueur anonyme peut proposer');
select tests.logout();

-- Dix par jour, pas onze.
select tests.login('ia');
select tests.ok((select bool_and(public.submit_idea('Idée numéro ' || n, 'fr'))
                   from generate_series(1, 9) n), 'neuf de plus passent (dix au total)');
select tests.is(public.submit_idea('La onzième idée du jour', 'fr'), false, 'la onzième du jour est refusée');
select tests.logout();
select tests.is((select count(*)::int from public.ideas where player_id = tests.uid('ia')), 10, 'seules dix sont écrites');

-- ----------------------------------------------------------------- RLS --

select tests.login_anon();
select tests.throws($$select public.submit_idea('Une idée sans session du tout', 'fr')$$,
                    'un rôle anon ne peut pas soumettre', '42501');
select tests.logout();

select tests.login('ia');
select tests.throws($$select * from public.claim_ideas()$$, 'un joueur connecté ne peut pas relever la file', '42501');
select tests.throws($$select public.finish_ideas(array[gen_random_uuid()])$$,
                    'ni la clore', '42501');
select tests.is((select count(*)::int from public.ideas), 0, 'et ne lit aucune idée par la table');
select tests.logout();

select tests.login_service();
select tests.is((select count(*)::int from public.claim_ideas()), 11, 'le service relève toutes les idées non envoyées');
select tests.lives($$select public.finish_ideas(array(select id from public.claim_ideas()))$$,
                   'le service peut les clore');
select tests.is((select count(*)::int from public.claim_ideas()), 0, 'une idée close ne revient plus');
select tests.logout();
