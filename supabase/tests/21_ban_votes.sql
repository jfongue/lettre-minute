-- Signaler un mot depuis l'écran des mots : les deux portes, et ce qu'une revue
-- de retrait demande. Cinq « correct » des autres la règlent, deux
-- « incorrect » gardent le mot (l'interface renverse les verdicts d'un ban :
-- « correct » veut dire « qu'il parte »). Un super modérateur ne tranche plus
-- une revue à lui seul — `force_ban` (0044) reste la porte qui décide
-- sur-le-champ, et sa voix compte double (0059).

select tests.new_user(n) from unnest(array['ba', 'bb', 'bc', 'bd', 'be', 'bs']) n;
select tests.make_super_moderator('bs');
select tests.make_moderator(n) from unnest(array['ba', 'bb', 'bc', 'bd', 'be']) n;

-- ------------------------------------------- signaler ouvre la revue --

select tests.login('ba');
select tests.is(
public.propose_ban('animaux', 'ornithorynque', 'Ornithorynque', 'Pas un animal.'),
'sent', 'an ordinary moderator opens a review alone'
);
select tests.logout();
select tests.is(
(select r.status from public.word_reviews r where r.word = 'ornithorynque' and r.kind = 'ban'),
'pending', 'and the word waits for the others'
);
select tests.login('bb');
select tests.ok(
exists (select 1 from public.moderation_queue('fr', 50) q where q.word = 'ornithorynque' and q.kind = 'ban'),
'the file hands it out to another moderator'
);
select tests.is(public.cast_vote(tests.review('animaux', 'ornithorynque'), 'correct'), 'pending',
'his « correct », with the signaler’s, is two of the five');
select tests.logout();
select tests.login('bc');
select tests.is(public.cast_vote(tests.review('animaux', 'ornithorynque'), 'correct'), 'pending', 'three');
select tests.logout();
select tests.login('bd');
select tests.is(public.cast_vote(tests.review('animaux', 'ornithorynque'), 'correct'), 'pending', 'four');
select tests.logout();
select tests.login('be');
select tests.is(public.cast_vote(tests.review('animaux', 'ornithorynque'), 'correct'), 'accepted',
'and a fifth removes the word');
select tests.logout();

-- ------------------------------------------------ deux refus le gardent --

select tests.login('ba');
select tests.is(
public.propose_ban('pays', 'yougoslavie', 'Yougoslavie', 'Ce pays n’existe plus.'),
'sent', 'a French word is reported the same way'
);
select tests.logout();
select tests.login('bb');
select tests.is(public.cast_vote(tests.review('pays', 'yougoslavie'), 'incorrect'), 'pending', 'one refusal leaves it open');
select tests.logout();
select tests.login('bc');
select tests.is(public.cast_vote(tests.review('pays', 'yougoslavie'), 'incorrect'), 'rejected', 'two keep the word');
select tests.logout();

-- ----------------------------------------- l'avis demandé par un super --

-- `propose_ban(…, true)` laisse la revue aux autres : la demande reste écrite
-- sur la revue, mais elle ne change plus les voix qu'il faut.
select tests.login('bs');
select tests.is(
public.propose_ban('animaux', 'paresseux', 'Paresseux', 'Trop lent.', true),
'sent', 'a super moderator asking the others leaves the review in the file'
);
select tests.logout();
select tests.is(
(select r.waiting from public.word_reviews r where r.word = 'paresseux' and r.kind = 'ban'),
true, 'with his request written on the review'
);
select tests.is(
(select r.status from public.word_reviews r where r.word = 'paresseux' and r.kind = 'ban'),
'pending', 'and the word still to judge'
);
select tests.login('bb');
select tests.is(public.cast_vote(tests.review('animaux', 'paresseux'), 'correct'), 'pending',
'his double voice, with one moderator, is three of the five');
select tests.logout();
select tests.login('bc');
select tests.is(public.cast_vote(tests.review('animaux', 'paresseux'), 'correct'), 'pending', 'four');
select tests.logout();
select tests.login('bd');
select tests.is(public.cast_vote(tests.review('animaux', 'paresseux'), 'correct'), 'accepted', 'and five remove it');
select tests.logout();

-- Sans l'avis demandé, sa voix ne suffit plus non plus : sa porte seule, c'est
-- le retrait d'office.
select tests.login('bs');
select tests.is(
public.propose_ban('animaux', 'kiwi', 'Kiwi', 'Un fruit.'),
'sent', 'a super moderator who does not ask still waits for the others'
);
select tests.logout();
select tests.is(
(select r.waiting from public.word_reviews r where r.word = 'kiwi' and r.kind = 'ban'),
false, 'his review does not ask anyone'
);
select tests.is(
(select r.status from public.word_reviews r where r.word = 'kiwi' and r.kind = 'ban'),
'pending', 'and his word alone removes nothing'
);
select tests.login('bs');
select tests.is(public.force_ban('animaux', 'kiwi', 'Kiwi', 'Un fruit.'), 'accepted', 'the forced door still decides alone');
select tests.logout();
select tests.is(
(select r.status from public.word_reviews r where r.word = 'kiwi' and r.kind = 'ban'),
'accepted', 'and writes the review accepted on the spot'
);

-- -------------------------- l'attente se pose sur une revue déjà ouverte --

-- Un mot déjà signalé : le super modérateur qui demande l'avis des autres
-- rejoint la revue et sa demande s'y écrit (0052), sans la régler.
select tests.login('ba');
select tests.is(
public.propose_ban('animaux', 'pangolin', 'Pangolin', 'Des écailles.'),
'sent', 'an ordinary moderator opens a review alone'
);
select tests.logout();
select tests.login('bs');
select tests.is(
public.propose_ban('animaux', 'pangolin', 'Pangolin', 'Des écailles.', true),
'sent', 'a super moderator asking the others on that word joins it'
);
select tests.logout();
select tests.is(
(select r.waiting from public.word_reviews r where r.word = 'pangolin' and r.kind = 'ban'),
true, 'and his request is written on the review'
);
select tests.is(
(select r.status from public.word_reviews r where r.word = 'pangolin' and r.kind = 'ban'),
'pending', 'the word stays to judge'
);
select tests.login('bb');
select tests.is(public.cast_vote(tests.review('animaux', 'pangolin'), 'correct'), 'pending',
'with his double voice that is four');
select tests.logout();
select tests.login('bc');
select tests.is(public.cast_vote(tests.review('animaux', 'pangolin'), 'correct'), 'accepted', 'and the fifth settles it');
select tests.logout();
