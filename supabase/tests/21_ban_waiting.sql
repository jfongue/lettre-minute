-- « Proposer à la modération » depuis l'écran des mots demande l'avis des
-- autres : un super modérateur qui signale ainsi ne règle pas la revue à lui
-- seul (0048) — sa voix compte pour une des trois, comme celle de n'importe
-- qui. Ce que la file rend, et ce que deux autres modérateurs en font.

select tests.new_user(n) from unnest(array['ba', 'bb', 'bc', 'bs']) n;
select tests.make_super_moderator('bs');
select tests.make_moderator('ba');
select tests.make_moderator('bb');
select tests.make_moderator('bc');

-- ------------------------------------------------- l'avis demandé attend --

select tests.login('bs');
select tests.is(
  public.propose_ban('animaux', 'ornithorynque', 'Ornithorynque', 'Pas un animal.', true),
  'sent', 'a super moderator asking the others leaves the review in the file'
);
select tests.logout();
select tests.is(
  (select r.status from public.word_reviews r where r.word = 'ornithorynque' and r.kind = 'ban'),
  'pending', 'the review is still pending'
);
select tests.is(
  (select r.waiting from public.word_reviews r where r.word = 'ornithorynque' and r.kind = 'ban'),
  true, 'and says its signaler asked the others'
);

-- Un autre modérateur la voit dans sa file : c'est tout l'objet du mode.
select tests.login('ba');
select tests.ok(
  exists (select 1 from public.moderation_queue('fr', 50) q where q.word = 'ornithorynque' and q.kind = 'ban'),
  'the file hands it out to another moderator'
);
select tests.is(
  public.cast_vote(tests.review('animaux', 'ornithorynque'), 'correct'),
  'pending', 'his « correct », with the signaler’s, is two of the three needed'
);
select tests.logout();

select tests.login('bb');
select tests.is(
  public.cast_vote(tests.review('animaux', 'ornithorynque'), 'correct'),
  'accepted', 'a third « correct » settles it'
);
select tests.logout();

select tests.login('bc');
select tests.is(
  public.cast_vote(tests.review('animaux', 'ornithorynque'), 'correct'),
  'gone', 'and it is no longer to judge'
);
select tests.logout();

-- --------------------------------------------- la porte qui tranche seule --

-- Sans l'avis demandé, la voix du super modérateur règle la revue comme avant.
select tests.login('bs');
select tests.is(
  public.propose_ban('animaux', 'paresseux', 'Paresseux', 'Trop lent.', false),
  'accepted', 'a super moderator who does not ask decides alone'
);
select tests.logout();
select tests.is(
  (select r.waiting from public.word_reviews r where r.word = 'paresseux' and r.kind = 'ban'),
  false, 'and his review is not waiting'
);

-- Le retrait d'office tranche aussi, et ne pose pas l'attente.
select tests.login('bs');
select tests.is(public.force_ban('animaux', 'kiwi', 'Kiwi', 'Un fruit.'), 'accepted', 'the forced door still decides alone');
select tests.logout();
select tests.is(
  (select r.waiting from public.word_reviews r where r.word = 'kiwi' and r.kind = 'ban'),
  false, 'without asking anyone'
);

-- Une revue laissée aux autres se refuse aux mêmes seuils : deux « incorrect ».
select tests.login('bs');
select tests.is(
  public.propose_ban('pays', 'yougoslavie', 'Yougoslavie', 'Ce pays n’existe plus.', true),
  'sent', 'a French word waits too'
);
select tests.logout();
select tests.login('ba');
select tests.is(public.cast_vote(tests.review('pays', 'yougoslavie'), 'incorrect'), 'pending', 'one refusal leaves it open');
select tests.logout();
select tests.login('bb');
select tests.is(public.cast_vote(tests.review('pays', 'yougoslavie'), 'incorrect'), 'rejected', 'two keep the word');
select tests.logout();

-- -------------------------- l'attente se pose sur une revue déjà ouverte --

-- Un mot déjà signalé par un modérateur ordinaire : la revue existe, et le
-- super modérateur qui demande l'avis des autres doit écrire cette demande sur
-- elle. Sans quoi sa voix la réglerait seule, ce que 0048 interdit (0052).
select tests.login('ba');
select tests.is(
 public.propose_ban('animaux', 'pangolin', 'Pangolin', 'Des écailles.', false),
 'sent', 'an ordinary moderator opens a review alone');
select tests.logout();
select tests.is(
 (select r.waiting from public.word_reviews r where r.word = 'pangolin' and r.kind = 'ban'),
 false, 'which does not ask the others');
select tests.login('bs');
select tests.is(
 public.propose_ban('animaux', 'pangolin', 'Pangolin', 'Des écailles.', true),
 'sent', 'a super moderator asking the others on that word does not settle it');
select tests.logout();
select tests.is(
 (select r.waiting from public.word_reviews r where r.word = 'pangolin' and r.kind = 'ban'),
 true, 'and his request is written on the review');
select tests.is(
 (select r.status from public.word_reviews r where r.word = 'pangolin' and r.kind = 'ban'),
 'pending', 'the word stays to judge');
select tests.login('bc');
select tests.ok(
 exists (select 1 from public.moderation_queue('fr', 50) q where q.word = 'pangolin' and q.kind = 'ban'),
 'and it is handed to a moderator who has not voted yet');
select tests.is(
 public.cast_vote(tests.review('animaux', 'pangolin'), 'correct'),
 'accepted', 'a third « correct » settles it, the signaler’s voice counting for one');
select tests.logout();
