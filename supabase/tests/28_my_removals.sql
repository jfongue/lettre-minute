-- Annuler un retrait depuis « Mes demandes » : `my_removals` (0061) liste les
-- revues de ban que le joueur a votées et qui attendent encore, et
-- `cancel_removal` efface son vote — la revue part avec lui si personne d'autre
-- ne l'a rejointe, sinon elle continue sans lui. Une fois la revue réglée,
-- plus rien ne se retire.
--
-- Les revues et les votes se lisent après `tests.logout()` : la RLS les cache
-- au rôle `authenticated`, seules les fonctions les rendent.

select tests.new_user(n) from unnest(array['ma', 'mb', 'mc', 'md', 'me']) n;
select tests.make_moderator(n) from unnest(array['ma', 'mb', 'mc', 'md', 'me']) n;

-- ---------------------------------- le signalement se lit dans mes demandes --

select tests.login('ma');
select tests.is(
  public.propose_ban('animaux', 'ornithorynque', 'Ornithorynque', 'Pas un animal.'),
  'sent', 'an ordinary moderator opens a review alone'
);
select tests.is((select count(*) from public.my_removals()), 1::bigint, 'and « Mes demandes » lists it');
select tests.is((select display from public.my_removals()), 'Ornithorynque', 'with the word it targets');
select tests.logout();

-- ----------------------------- le vote des autres se retire aussi du sien --

select tests.login('mb');
select tests.is((select count(*) from public.my_removals()), 0::bigint, 'another moderator has nothing of his own');
select tests.is(
  public.cast_vote(tests.review('animaux', 'ornithorynque'), 'correct'),
  'pending', 'his « correct », with the signaler’s, is two of the five'
);
select tests.is((select count(*) from public.my_removals()), 1::bigint, 'his agreement shows up as his to take back');
select tests.is(public.cancel_removal(tests.review('animaux', 'ornithorynque')), true, 'and he takes it back');
select tests.is((select count(*) from public.my_removals()), 0::bigint, 'his waiting list forgets it again');
select tests.logout();

select tests.is(
  (select count(*) from public.word_reviews r
   where r.category_id = 'animaux' and r.word = 'ornithorynque' and r.kind = 'ban'),
  1::bigint, 'the review stays open without him'
);
select tests.is(
  (select count(*) from public.moderation_votes where review_id = tests.review('animaux', 'ornithorynque')),
  1::bigint, 'with only the signaler’s vote left'
);

-- -------------------------- le signalement seul emporte la revue avec lui --

select tests.login('ma');
select tests.is(public.cancel_removal(tests.review('animaux', 'ornithorynque')), true, 'the signaler withdraws his own report');
select tests.is((select count(*) from public.my_removals()), 0::bigint, 'his waiting list is empty again');
select tests.logout();

select tests.ok(
  not exists (select 1 from public.word_reviews r where r.category_id = 'animaux' and r.word = 'ornithorynque'),
  'and the review goes with him when nobody is left'
);

-- --------------------------------- une revue réglée ne se retire plus --

select tests.login('ma');
select tests.is(
  public.propose_ban('pays', 'yougoslavie', 'Yougoslavie', 'Ce pays n’existe plus.'),
  'sent', 'a report for a country'
);
select tests.logout();
select tests.vote('mb', 'pays', 'yougoslavie', 'correct');
select tests.vote('mc', 'pays', 'yougoslavie', 'correct');
select tests.vote('md', 'pays', 'yougoslavie', 'correct');
select tests.vote('me', 'pays', 'yougoslavie', 'correct');
select tests.is(
  (select status from public.word_reviews where category_id = 'pays' and word = 'yougoslavie' and kind = 'ban'),
  'accepted', 'five « correct » settle the removal'
);
select tests.login('ma');
select tests.is((select count(*) from public.my_removals()), 0::bigint, 'a settled removal leaves the waiting list');
select tests.is(public.cancel_removal(tests.review('pays', 'yougoslavie')), false, 'and cannot be taken back');
select tests.logout()
