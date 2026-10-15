-- 0083 : le renflouage passe `safeupdate`, et l'offre « niveau » lit l'XP du
-- profil.

select tests.new_user(n) from unnest(array['sa', 'sb']) n;

-- ------------------------------------------------- safeupdate, partout --

-- PostgREST précharge `safeupdate` (rôle `authenticator`) : un `update` ou un
-- `delete` sans `where` y lève, et toute la transaction de l'appel repart en
-- arrière. Ce Postgres d'essai ne l'a pas : la règle se vérifie sur le texte
-- des fonctions. Un `insert … on conflict do update` n'est pas concerné.
select tests.is(
  (select coalesce(string_agg(distinct p.proname, ', '), '')
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     cross join lateral regexp_matches(p.prosrc, '(?:^|[^a-z_])((?:update\s+(?:public\.)?[a-z_]+\s+set|delete\s+from\s+(?:public\.)?[a-z_]+)[^;]*);', 'gi') m
    where n.nspname = 'public'
      and m[1] !~* '\mwhere\M'
      and m[1] !~* '^update\s+set\M'),
  '',
  'no public function updates or deletes without a where clause');

-- Le renflouage verse bien, et ferme l'heure.
insert into public.moderation_reserve (category_id, word, display)
select 'animaux', w, w from unnest(array['zouave', 'yack', 'xerus', 'wombat', 'vison']) w;
insert into public.moderators (id) values (tests.uid('sa'));
update public.moderation_topup set released_at = now() - interval '2 hours' where id;

select tests.login('sa');
select tests.is(public.top_up_moderation('fr'), 5, 'an empty queue is topped up to a session');
select tests.logout();
select tests.ok((select released_at > now() - interval '1 minute' from public.moderation_topup),
'and the hour closes behind it');

-- ------------------------------------------- l'XP du profil vaut niveau --

-- Un joueur CrazyGames : 4000 XP gagnés en invité, une seule petite partie
-- montée au serveur.
select tests.run_at('sb', now(), 120, array['sb-un'], 'en:animaux');
update public.profiles set xp = 4000 where id = tests.uid('sb');
insert into public.moderation_reserve (category_id, word, display)
select 'en:animaux', w, w from unnest(array['zebu', 'yak', 'xerus', 'wombat', 'vole']) w;

select tests.login('sb');
select tests.is(public.moderation_status('en') ->> 'offer', 'level',
'the profile''s xp reaches level 6 though the runs sent do not');
select tests.logout();
