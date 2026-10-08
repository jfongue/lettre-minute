-- La partie rapide : une file par langue. Le premier qui attend ouvre une
-- table marquée « quick » où il est déjà prêt ; le suivant s'y assoit et la
-- table part d'elle-même — une partie rapide ne demande à personne de se
-- déclarer prêt, et ne s'ouvre qu'à ceux qui la cherchent : sans cela, la
-- table du salon n'accepterait que des invités (`duel_join`, 0046). Resté
-- seul au bout de quinze secondes, l'appareil y assoit les joueurs maison du
-- serveur (`duel_invite`), les seuls qu'une table en ligne puisse montrer à
-- tout le monde.

alter table public.duel_tables add column quick boolean not null default false;

-- La recherche ne lit que les tables rapides en salon, de la plus ancienne à
-- la plus récente : l'index partiel porte exactement cette lecture.
create index duel_tables_quick_idx on public.duel_tables (lang, created_at) where quick and status = 'lobby';

-- Ouvre une table rapide, ou m'assoit à celle qui attend dans ma langue.
-- Répond l'identifiant de la table, comme `duel_create`.
create function public.duel_quick(p_lang text, p_categories text[], p_owned integer) returns uuid
language plpgsql security definer set search_path = public as $$
declare
v_id uuid;
v_me uuid := auth.uid();
begin
if not public.is_named_account() then
raise exception 'named account required' using errcode = '42501';
end if;
if p_lang !~ '^[a-z]{2}$' or coalesce(cardinality(p_categories), 0) not between 1 and 60 then
raise exception 'invalid table' using errcode = '22023';
end if;

-- Deux recherches de front se croisaient : chacune trouvait la file vide et
-- ouvrait sa table. Le verrou tient la file d'une langue le temps d'une
-- transaction, et le vainqueur est celui qui lit le second.
perform pg_advisory_xact_lock(hashtext('duel_quick:' || p_lang));

-- Déjà dans la file : c'est ma table qui revient — un écran remonté, un appui
-- doublé, et non une seconde table. Une table rapide ouverte depuis plus de
-- dix minutes a perdu son hôte : on n'y rentre pas.
select t.id into v_id
from public.duel_tables t
join public.duel_seats s on s.table_id = t.id and s.player = v_me and s.left_at is null and s.kicked_at is null
where t.quick and t.status in ('lobby', 'playing') and t.created_at > now() - interval '10 minutes'
order by t.created_at desc
limit 1;
if found then
return v_id;
end if;

-- Quelqu'un attend dans ma langue : je m'assois chez lui, et la table part.
-- Passé deux minutes sans second joueur, une table en salon n'a plus d'hôte
-- qui l'attende — l'appareil a depuis longtemps assis ses joueurs maison.
select t.id into v_id
from public.duel_tables t
where t.quick and t.status = 'lobby' and t.lang = p_lang and t.host <> v_me
and t.created_at > now() - interval '2 minutes'
and public.duel_active_seats(t.id) between 1 and 2
order by t.created_at
limit 1
for update;
if found then
insert into public.duel_seats (table_id, player, owned, ready)
values (v_id, v_me, greatest(0, least(coalesce(p_owned, 0), 999)), true)
on conflict (table_id, player) do update
set left_at = null, kicked_at = null, joined_at = clock_timestamp(), ready = true, owned = excluded.owned;
update public.duel_seats s set seat = numbered.place
from (
select player, (row_number() over (order by joined_at, player) - 1)::smallint as place
from public.duel_seats where table_id = v_id and left_at is null and kicked_at is null
) numbered
where s.table_id = v_id and s.player = numbered.player;
update public.duel_tables set status = 'playing', started_at = clock_timestamp() where id = v_id;
update public.duel_invites set answered_at = now() where table_id = v_id and answered_at is null;
return v_id;
end if;

-- Personne : j'ouvre la mienne, déjà prêt — le prochain qui arrive la lance.
insert into public.duel_tables (host, lang, seed, categories, quick)
values (v_me, p_lang, floor(random() * 4294967295)::bigint, p_categories, true)
returning id into v_id;
insert into public.duel_seats (table_id, player, owned, ready)
values (v_id, v_me, greatest(0, least(coalesce(p_owned, 0), 999)), true);
return v_id;
end;
$$;

revoke execute on function public.duel_quick(text, text[], integer) from public, anon;
grant execute on function public.duel_quick(text, text[], integer) to authenticated;
