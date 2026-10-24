-- L'invité de CrazyGames joue le défi du moment sur son appareil : le serveur
-- ne classe que les comptes nommés, et son récap n'a donc aucune ligne au
-- classement. `weekly_recap` (0085) lui rendait pourtant le rang 1 — faute de
-- valeur à comparer, `count(*) filter (where b.value > (select value from me))`
-- comptait zéro — si bien que l'écran annonçait « 1er sur 9 » avec son record
-- local de 5 s, et le bandeau « Classement de la semaine » l'envoyait vers une
-- liste où il n'apparaissait pas.
--
-- Le rang ne se rend plus que sur une valeur classée : sans ligne à comparer,
-- il est nul et l'écran montre « — ». `players` reste le nombre de joueurs
-- classés, et `ranks` (la courbe des jours) ne bouge pas : elle ne parcourt que
-- les jours du joueur.

create or replace function public.weekly_recap(p_week_id date, p_lang text) returns jsonb
language sql stable security definer set search_path = public as $$
with mine as (
select a.n, a.day, a.value, a.metric, a.finished_at is not null as finished, a.started_at
from public.weekly_attempts a
where a.player_id = auth.uid() and a.week_id = public.weekly_week(p_week_id)
),
fin as (
select a.player_id, a.day, a.value
from public.weekly_attempts a
join auth.users u on u.id = a.player_id and not u.is_anonymous
where a.week_id = public.weekly_week(p_week_id) and a.finished_at is not null
and not exists (select 1 from public.bots b where b.id = a.player_id)
),
best as (
select f.player_id, max(f.value) as value from fin f group by f.player_id
),
me as (select value from best where player_id = auth.uid()),
-- À la fin de chacun de mes jours joués : la meilleure tentative de chaque
-- joueur qui avait rendu une partie ce jour-là ou avant.
upto as (
select d.day, f.player_id, max(f.value) as value
from (select distinct day from fin where player_id = auth.uid()) d
join fin f on f.day <= d.day
group by d.day, f.player_id
),
ranks as (
select u.day,
(1 + count(*) filter (where u.value > (select m.value from upto m where m.day = u.day and m.player_id = auth.uid())))::integer as rank,
count(*)::integer as players
from upto u
group by u.day
)
select jsonb_build_object(
'attempts', coalesce((select jsonb_agg(jsonb_build_object(
'n', m.n, 'day', m.day, 'value', m.value, 'metric', m.metric, 'finished', m.finished) order by m.started_at) from mine m), '[]'::jsonb),
'best', (select value from me),
'rank', case
when (select value from me) is null then null
else (select 1 + count(*) from best b where b.value > (select value from me))
end,
'players', (select count(*) from best),
'ranks', coalesce((select jsonb_agg(jsonb_build_object('day', r.day, 'rank', r.rank, 'players', r.players) order by r.day) from ranks r), '[]'::jsonb)
)
$$;
