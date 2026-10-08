-- La partie rapide (0061) : une file par langue. Le premier qui attend ouvre
-- une table où il est déjà prêt, le suivant s'y assoit et la table part
-- d'elle-même, et demander deux fois la même file rend la même table. Les
-- lectures passent par des fonctions du schéma `tests`, les tables du duel
-- n'ayant aucune politique : un joueur n'y voit rien hors des fonctions.

select tests.new_user(n) from unnest(array['qa', 'qb', 'qc']) n;

create function tests.quick_status(p_table uuid) returns text
language sql stable security definer set search_path = public as $$ select status from public.duel_tables where id = p_table $$;
create function tests.quick_seats(p_table uuid) returns integer
language sql stable security definer set search_path = public as $$ select public.duel_active_seats(p_table) $$;
create function tests.quick_numbers(p_table uuid) returns int[]
language sql stable security definer set search_path = public as $$
select array_agg(seat order by seat)::int[] from public.duel_seats where table_id = p_table and seat is not null
$$;

-- ------------------------------------------------------------- la file --

select tests.login('qa');
create temp table waiting as select public.duel_quick('fr', array['animaux', 'pays'], 3) as id;
grant select on waiting to public;
select tests.is(tests.quick_seats((select id from waiting)), 1, 'the first player waits alone at his quick table');
select tests.is(tests.quick_status((select id from waiting)), 'lobby', 'and the table waits for him');
select tests.is(
public.duel_quick('fr', array['animaux', 'pays'], 3), (select id from waiting),
'asking again gives back the same table instead of a second one'
);
select tests.logout();

select tests.login('qb');
create temp table joined as select public.duel_quick('fr', array['animaux', 'pays'], 5) as id;
grant select on joined to public;
select tests.is((select id from joined), (select id from waiting), 'the next player sits at the table that waits');
select tests.is(tests.quick_seats((select id from waiting)), 2, 'two players are seated');
select tests.is(tests.quick_status((select id from waiting)), 'playing', 'and the quick table starts by itself');
select tests.is(tests.quick_numbers((select id from waiting)), array[0, 1], 'with numbered seats');
select tests.logout();

-- Une autre langue fait sa propre file, et une table déjà partie ne se
-- rejoint pas : le troisième ouvre donc la sienne.
select tests.login('qc');
create temp table other as select public.duel_quick('de', array['tiere'], 3) as id;
grant select on other to public;
select tests.ok((select id from other) <> (select id from waiting), 'another language opens its own table');
select tests.is(tests.quick_status((select id from other)), 'lobby', 'which waits in its turn');
select tests.logout();
