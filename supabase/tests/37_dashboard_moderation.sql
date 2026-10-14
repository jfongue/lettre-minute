-- 0080 : la part « modération » du tableau de bord, langue par langue — la
-- réserve, les juges, les sessions, les mots qui attendent, entrent, sortent.

select tests.new_user('m1');
select tests.new_user('m2');
select tests.new_user('s1');
select tests.make_moderator('m1');
select tests.make_moderator('m2');
select tests.make_super_moderator('s1');
update public.moderators set lang = 'de' where id = tests.uid('m2');

insert into public.moderation_reserve (category_id, word, display, released_at)
values ('de:tiere', 'dachs', 'Dachs', now()),
       ('de:tiere', 'elch', 'Elch', null),
       ('de:tiere', 'fuchs', 'Fuchs', null),
       ('animaux', 'blaireau', 'blaireau', null);

insert into public.word_reviews (category_id, word, display, status, kind, decided_at)
values ('de:tiere', 'dachs', 'Dachs', 'accepted', 'add', now()),
       ('de:tiere', 'igel', 'Igel', 'accepted', 'add', now()),
       ('de:tiere', 'hund', 'Hund', 'accepted', 'ban', now()),
       ('de:tiere', 'qux', 'Qux', 'rejected', 'add', now()),
       ('de:tiere', 'luchs', 'Luchs', 'pending', 'add', null),
       ('animaux', 'chat', 'chat', 'pending', 'ban', null);

-- Une session rapportée prend la langue de son modérateur.
insert into public.moderation_sessions (player_id) values (tests.uid('m2')), (tests.uid('m1'));
select tests.is((select lang from public.moderation_sessions where player_id = tests.uid('m2')), 'de',
                'a session is filed under its moderator''s language');

select tests.is(tests.vote('m2', 'de:tiere', 'luchs', 'correct'), 'pending', 'one vote in German');

create temp table de as
  select l from jsonb_array_elements(public.analytics_moderation(30) #> '{moderation_by_lang,langs}') l
   where l ->> 'lang' = 'de';
create temp table fr as
  select l from jsonb_array_elements(public.analytics_moderation(30) #> '{moderation_by_lang,langs}') l
   where l ->> 'lang' = 'fr';

select tests.is((select (l ->> 'moderators')::int from de), 1, 'one German judge');
select tests.is((select (l ->> 'active')::int from de), 1, 'who voted in the window');
select tests.is((select (l ->> 'thin')::boolean from de), true, 'so German is still thin');
select tests.is((select (l ->> 'moderators')::int from fr), 2, 'two French judges');
select tests.is((select (l ->> 'supers')::int from fr), 1, 'one of them super');
select tests.is((select (l ->> 'reserve_left')::int from de), 2, 'two German reserve words left');
select tests.is((select (l ->> 'reserve_released')::int from de), 1, 'one poured');
select tests.is((select (l ->> 'reserve_left')::int from fr), 1, 'French keeps its own reserve');
select tests.is((select (l ->> 'added')::int from de), 2, 'two German words came in');
select tests.is((select (l ->> 'added_reserve')::int from de), 1, 'one of them from the reserve');
select tests.is((select (l ->> 'removed')::int from de), 1, 'one went out');
select tests.is((select (l ->> 'rejected')::int from de), 1, 'one was refused');
select tests.is((select (l ->> 'pending_add')::int from de), 1, 'one waits to come in');
select tests.is((select (l ->> 'pending_ban')::int from fr), 1, 'a French one waits to go out');
select tests.is((select (l ->> 'sessions')::int from de), 1, 'one German session');
select tests.is((select (l ->> 'votes')::int from de), 1, 'one German vote');
select tests.ok(exists (select 1 from jsonb_array_elements(public.analytics_moderation(30) #> '{moderation_by_lang,langs}') l
                          where l ->> 'lang' = 'pt' and (l ->> 'moderators')::int = 0),
                'a language without judges is still listed');
select tests.ok(public.analytics_snapshot(30) ? 'moderation_by_lang', 'the snapshot carries it');
select tests.ok(public.analytics_snapshot(30) #> '{moderation,votes}' is not null, 'without overwriting the older moderation totals');
