-- Le versement depuis la réserve (0019) n'a lieu qu'une fois par heure, tous
-- modérateurs et toutes langues confondus : un second modérateur à sec dans
-- l'heure ne tire rien, mais les mots déjà versés restent à juger pour tout le
-- monde, et sa première visite une fois l'heure passée renfloue (0037).
--
-- L'heure est simulée en reculant `moderation_topup.released_at` : le harnais
-- enchaîne ses appels en millisecondes, là où la vraie vie laisse passer
-- l'heure.

select tests.new_user('hp');
select tests.new_user('hm');
select tests.make_moderator('hm');
select tests.new_user('hq');
select tests.make_moderator('hq');
select tests.new_user('hs');

-- Douze mots : de quoi verser deux sessions sans regarnir entre les blocs.
insert into public.moderation_reserve (category_id, word, display)
select 'metiers', w, w
  from unnest(array['plombier', 'maçon', 'couvreur', 'carreleur', 'vitrier', 'serrurier',
                     'menuisier', 'zingueur', 'peintre', 'carrossier', 'joaillier', 'tapissier']) w;

create function pg_temp.top_up(p_label text, p_lang text default 'fr') returns integer
language plpgsql as $$
declare
  v_released integer;
begin
  perform tests.login(p_label);
  v_released := public.top_up_moderation(p_lang);
  perform tests.logout();
  return v_released;
end;
$$;

create function pg_temp.waiting(p_label text, p_lang text default 'fr') returns integer
language plpgsql as $$
declare
  v_count integer;
begin
  perform tests.login(p_label);
  v_count := (select count(*)::integer from public.moderation_queue(p_lang, 20));
  perform tests.logout();
  return v_count;
end;
$$;

-- Le modérateur vote toute sa file.
create function pg_temp.drain(p_label text) returns void
language plpgsql as $$
declare
  v_word record;
begin
  perform tests.login(p_label);
  for v_word in select id from public.moderation_queue('fr', 20) loop
    perform public.cast_vote(v_word.id, 'correct');
  end loop;
  perform tests.logout();
end;
$$;

-- ------------------------------------------------------------ à l'ouverture --

select tests.is(pg_temp.top_up('hm'), 5, 'the first visit to an empty queue pours a whole session');
select tests.is(pg_temp.waiting('hm'), 5, 'five words wait');
select tests.is((select count(*)::int from public.word_submissions s join public.bots b on b.id = s.player_id), 5,
                'a house bot proposes them');

-- ------------------------------------------------------------ l'heure globale --

select tests.is(pg_temp.waiting('hq'), 5, 'another moderator has the same five to judge');
select tests.is(pg_temp.top_up('hq'), 0, 'a queue still full pours nothing');
select tests.is(pg_temp.top_up('hm'), 0, 'nor does his own second visit');
select tests.is((select count(*)::int from public.moderation_reserve where released_at is not null), 5,
                'the reserve has not moved');

select pg_temp.drain('hq');
select tests.is(pg_temp.waiting('hq'), 0, 'his queue is empty');
select tests.is(pg_temp.top_up('hq'), 0, 'but the hour is not up: the reserve stays put however dry he is');
select tests.is((select count(*)::int from public.moderation_reserve where released_at is not null), 5,
                'the reserve still has not moved');

-- ----------------------------------------------------------------- l'heure --

update public.moderation_topup set released_at = now() - interval '1 hour';

select tests.is(pg_temp.top_up('hq'), 5, 'the first visit after the hour pours a session');
select tests.is(pg_temp.waiting('hq'), 5, 'the queue holds it');
select tests.is((select count(*)::int from public.moderation_reserve where released_at is null), 2,
                'the reserve keeps what it has not poured');

-- Un second modérateur à sec dans la même heure : l'heure est close pour lui.
select pg_temp.drain('hm');
select tests.is(pg_temp.top_up('hm'), 0, 'a dry moderator is refused within the hour');

update public.moderation_topup set released_at = now() - interval '1 hour';
select tests.is(pg_temp.top_up('hm'), 2, 'his visit once the hour is up pours what the reserve has left');
select tests.is(pg_temp.waiting('hm'), 2, 'the queue holds those two');
select tests.is((select count(*)::int from public.moderation_reserve where released_at is null), 0,
                'and the reserve is dry');

-- Une réserve à sec ne referme pas l'heure : elle attend un vrai versement.
update public.moderation_topup set released_at = now() - interval '2 hours';
select pg_temp.drain('hm');
select tests.is(pg_temp.top_up('hm'), 0, 'a dry reserve pours nothing');
select tests.ok((select released_at from public.moderation_topup) < now() - interval '1 hour',
                'and leaves the hour open');

-- ------------------------------------------------------------- super modérateur --

delete from public.moderation_votes;
delete from public.word_submissions;
delete from public.word_reviews;
update public.moderation_reserve set released_at = null;
update public.moderation_topup set released_at = now() - interval '1 hour';
select tests.make_super_moderator('hs');
select tests.ok((select public.is_super_moderator(tests.uid('hs'))), 'a super moderator');
select tests.is(pg_temp.waiting('hs'), 0, 'with nothing to judge');
select tests.is(pg_temp.top_up('hs'), 5, 'is topped up on his first visit too');

-- ------------------------------------------------------------- toutes langues --

-- Le français vient de verser : l'allemand attend son heure comme les autres.
select tests.is(pg_temp.waiting('hq', 'de'), 0, 'German has none of the French words');
select tests.is(pg_temp.top_up('hq', 'de'), 0, 'a pour in French closes the hour for German too');
select tests.is(pg_temp.waiting('hq', 'de'), 0, 'nothing came in');

-- -------------------------------------------------------- deux à la même heure --

-- Deux modérateurs à sec, à la même seconde : un seul verse. Le verrou de
-- ligne ne se verrait qu'à deux transactions ouvertes en même temps, ce que le
-- harnais ne monte pas ici — ce qui est vérifié, c'est que la seconde visite
-- ne double pas le versement.
delete from public.moderation_votes;
delete from public.word_submissions;
delete from public.word_reviews;
update public.moderation_reserve set released_at = null;
update public.moderation_topup set released_at = now() - interval '1 hour';
select tests.is(pg_temp.waiting('hq'), 0, 'both moderators are dry');
select tests.is(pg_temp.waiting('hm'), 0, 'and neither has a word left to judge');

select tests.connect('h1', 'hq');
select tests.connect('h2', 'hm');
-- Les deux appels passent par une table : `tests.remote` dans une liste de
-- `select` rend null, dblink n'ayant alors pas consommé son résultat.
create temp table race (appel text);
insert into race select tests.remote('h1', 'select public.top_up_moderation(''fr'')::text');
insert into race select tests.remote('h2', 'select public.top_up_moderation(''fr'')::text');
-- Hors transaction, pour lire ce que les deux ont réellement écrit.
select tests.logout();

select tests.is((select count(*)::int from public.moderation_reserve where released_at is not null), 5,
                'two moderators arriving at once cannot pour ten words');
select tests.is((select count(*)::int from race), 2, 'both were answered');
