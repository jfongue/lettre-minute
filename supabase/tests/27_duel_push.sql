-- Le push du duel (0060) : une invitation prévient le téléphone de l'invité, et
-- son retrait part dès que la table n'attend plus personne — réponse donnée,
-- table lancée, salon fermé, quart d'heure écoulé, ou invitation retirée.
--
-- FCM ne reprend pas un message affiché : le retrait est une ligne
-- `duel_cancel`, que la fonction Edge envoie en message muet portant le même
-- `tag`.

select tests.new_user(n) from unnest(array['pa', 'pb', 'pc', 'pd']) n;
select tests.befriend('pa', 'pb');
select tests.befriend('pa', 'pc');
select tests.befriend('pa', 'pd');

\set token '''fcm-token-duel-0123456789-abcdef'''

select tests.login('pb');
select public.save_push_token(:token, 'android', 'de');
select tests.logout();

-- -------------------------------------------------------- une invitation --

select tests.login('pa');
create temp table table1 as select public.duel_create('fr', array['animaux', 'pays'], 3) as id;
grant select on table1 to public;
select tests.is(public.duel_invite((select id from table1), tests.uid('pb')), 'sent', 'a friend is invited to the table');
select tests.logout();

select tests.is((select count(*)::int from public.push_outbox where kind = 'duel'), 1, 'the invitation queues one push');
select tests.ok((select player_id = tests.uid('pb') and table_id = (select id from table1) and challenge_id is null
from public.push_outbox where kind = 'duel'),
'it aims at the invitee and the table, and at no challenge');

select tests.login_service();
create temp table batch as select * from public.claim_push_batch();
select tests.logout();
select tests.ok((select bool_and(kind = 'duel' and token = :token and lang = 'de' and owner_name = 'pa'
and players = 1 and table_id = (select id from table1)) from batch),
'the batch carries the phone, the host and the seats already taken');
select public.finish_push_batch((select array_agg(id) from batch), array[]::text[]);

-- ------------------------------------------------------------ le retrait --

select tests.login('pb');
select tests.is(public.duel_join((select id from table1), 3), 'joined', 'the invitee sits down');
select tests.logout();
select tests.is((select count(*)::int from public.push_outbox where kind = 'duel_cancel'), 0, 'the retraction waits for the sweep');
select public.push_tick();
select tests.ok((select kind = 'duel_cancel' and player_id = tests.uid('pb') and table_id = (select id from table1)
from public.push_outbox where kind = 'duel_cancel'),
'the sweep retracts the invitation that has been answered');
select public.push_tick();
select tests.is((select count(*)::int from public.push_outbox where kind = 'duel_cancel'), 1, 'and retracts it once');

-- Une invitation déclinée puis reposée repart : le salon rouvre la ligne.
select tests.login('pa');
select tests.is(public.duel_invite((select id from table1), tests.uid('pc')), 'sent', 'a second friend is invited');
select tests.logout();
select tests.login('pc');
select public.duel_decline((select id from table1));
select tests.logout();
select public.push_tick();
select tests.login('pa');
select tests.is(public.duel_invite((select id from table1), tests.uid('pc')), 'sent', 'he is invited again');
select tests.logout();
select tests.is((select count(*)::int from public.push_outbox where kind = 'duel' and player_id = tests.uid('pc')), 2,
'a declined invitation that comes back queues a second push');

-- L'hôte ferme le salon : ce qui restait en suspens s'éteint.
select tests.login('pa');
select public.duel_leave((select id from table1));
select tests.logout();
select public.push_tick();
select tests.ok((select bool_and(table_id = (select id from table1)) from public.push_outbox
where kind = 'duel_cancel' and player_id = tests.uid('pc')),
'closing the lobby retracts the invitation still waiting');

-- Le lancement de la table aussi, sans attendre la passe.
select tests.login('pa');
create temp table table2 as select public.duel_create('fr', array['animaux', 'pays'], 3) as id;
grant select on table2 to public;
select public.duel_invite((select id from table2), tests.uid('pd'));
select tests.logout();
select tests.login('pd');
select tests.is(public.duel_join((select id from table2), 3), 'joined', 'the invited friend sits down');
select tests.is(public.duel_ready((select id from table2), true), 'waiting', 'the table waits for its host');
select tests.logout();
select tests.login('pa');
select tests.is(public.duel_ready((select id from table2), true), 'started', 'the host starts it');
select tests.logout();
select public.push_tick();
select tests.ok((select count(*) = 1 from public.push_outbox
where kind = 'duel_cancel' and player_id = tests.uid('pd') and table_id = (select id from table2)),
'starting the table retracts the invitation that seated him');

-- Une invitation retirée à la main part sans passé par la passe.
select tests.login('pa');
create temp table table3 as select public.duel_create('fr', array['animaux'], 3) as id;
grant select on table3 to public;
select public.duel_invite((select id from table3), tests.uid('pc'));
select tests.is(public.duel_kick((select id from table3), tests.uid('pc')), 'kicked', 'the host takes the invitation back');
select tests.logout();
select tests.ok((select count(*) = 1 from public.push_outbox
where kind = 'duel_cancel' and player_id = tests.uid('pc') and table_id = (select id from table3)),
'the retraction is written before the invitation row goes');

-- Un salon qu'on laisse dormir un quart d'heure ne prévient plus personne.
select tests.login('pa');
create temp table table4 as select public.duel_create('fr', array['animaux'], 3) as id;
grant select on table4 to public;
select public.duel_invite((select id from table4), tests.uid('pc'));
select tests.logout();
update public.duel_tables set created_at = now() - interval '16 minutes' where id = (select id from table4);
select public.push_tick();
select tests.ok((select count(*) = 1 from public.push_outbox
where kind = 'duel_cancel' and player_id = tests.uid('pc') and table_id = (select id from table4)),
'a lobby older than a quarter of an hour is retracted too');

-- Un invité sans téléphone inscrit : le retrait revient quand même, sans jeton,
-- pour être clos plutôt que repris à chaque passe.
select tests.login_service();
create temp table silent as select * from public.claim_push_batch() where kind = 'duel_cancel' and token is null;
select tests.logout();
select tests.ok((select count(*) > 0 from silent), 'a retraction aimed at a phone-less player comes back tokenless');
