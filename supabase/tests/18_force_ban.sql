-- Retirer un mot d'office : la porte du super modérateur sur l'écran des mots.
-- Sa voix règle le signalement seule (0007) et la copie communautaire part
-- aussitôt — le dictionnaire embarqué, lui, ne bouge qu'au prochain import.

select tests.new_user(n) from unnest(array['fa', 'fm', 'fs', 'fp']) n;
-- Un super modérateur : cinq mots validés par lui, entrés sans « incorrect ».
select tests.make_super_moderator('fs');
select tests.make_moderator('fm');

-- Un mot de la liste communautaire, et sa copie allemande préfixée.
insert into public.dictionary_words (category_id, word, display, source)
values ('animaux', 'ornithorynque', 'Ornithorynque', 'community'),
       ('de:animaux', 'de:eule', 'Eule', 'community');

-- --------------------------------------------------------------- accès --

select tests.login_anon();
select tests.throws($$select public.force_ban('animaux', 'ornithorynque', 'Ornithorynque')$$, 'a stranger removes nothing', '42501');
select tests.logout();

select tests.login('fm');
select tests.is(public.force_ban('animaux', 'ornithorynque', 'Ornithorynque'), 'forbidden', 'a plain moderator does not decide alone');
select tests.is(public.force_ban('', 'ornithorynque', null), 'forbidden', 'nor without a category');
select tests.is(public.force_ban('animaux', 'a', null), 'forbidden', 'nor a word of one letter');
select tests.ok(exists (select 1 from public.dictionary_words where word = 'ornithorynque'), 'and the word stays where it was');
select tests.logout();

-- ------------------------------------------------ ce qu'un super fait --

select tests.login('fp');
select tests.is(public.force_ban('animaux', 'ornithorynque', 'Ornithorynque', 'Pas un animal.'), 'forbidden', 'a player who is not a moderator neither');
select tests.logout();

select tests.login('fs');
select tests.is(public.force_ban('animaux', 'ornithorynque', 'Ornithorynque', 'Pas un animal.'), 'accepted', 'a super moderator removes the word on the spot');
select tests.ok(
  not exists (select 1 from public.dictionary_words where word = 'ornithorynque'),
  'and its community copy leaves the server at once'
);
select tests.is(public.force_ban('animaux', 'ornithorynque', 'Ornithorynque'), 'known', 'removing it twice says it is already settled');

-- Une langue préfixée : la revue nomme le mot nu, la liste communautaire le
-- range préfixé — le retrait doit atteindre les deux.
select tests.is(public.force_ban('de:animaux', 'eule', 'Eule', 'Kein Tier.'), 'accepted', 'a German word goes too');
select tests.ok(
  not exists (select 1 from public.dictionary_words where word = 'de:eule'),
  'with its prefixed community copy'
);
select tests.logout();

-- Lu sans session : la file de modération n'a aucune politique de lecture,
-- tout passe par ses fonctions.
select tests.is(
  (select r.status from public.word_reviews r where r.word = 'ornithorynque' and r.kind = 'ban'),
  'accepted', 'the review is settled, not waiting'
);
select tests.is(
  (select v.verdict from public.moderation_votes v
    join public.word_reviews r on r.id = v.review_id
   where r.word = 'ornithorynque' and r.kind = 'ban' and v.moderator_id = tests.uid('fs')),
  'correct', 'with his vote on it'
);
select tests.is(
  (select v.note from public.moderation_votes v
    join public.word_reviews r on r.id = v.review_id
   where r.word = 'ornithorynque' and r.kind = 'ban' and v.moderator_id = tests.uid('fs')),
  'Pas un animal.', 'and his reason, which the file keeps'
);
select tests.is(
  (select r.word from public.word_reviews r where r.category_id = 'de:animaux' and r.kind = 'ban'),
  'eule', 'while the review keeps the bare name the import expects'
);
