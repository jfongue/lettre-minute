-- Les gagnants du défi du moment : celui de chaque semaine close, la plus
-- récente d'abord. `weekly_board` classe la semaine en cours ; ici, une ligne
-- par semaine passée, avec la métrique de cette semaine-là — d'une semaine à
-- l'autre elle change (points, secondes), donc chaque ligne porte son unité.
--
-- Le gagnant est la meilleure tentative terminée de la semaine, départagée par
-- l'heure du rendu la plus tôt, puis par le joueur pour rester déterministe.
-- Les anonymes et les joueurs maison sont écartés comme sur `weekly_board` :
-- par leur compte, jamais par leur nom.
--
-- Appliquée avec la 1.7.14 (versionCode 38).

create function public.weekly_winners(p_lang text, p_lim integer default 50)
returns table (week_id date, player_id uuid, display_name text, avatar jsonb, metric text, value numeric)
language sql stable security definer set search_path = public as $$
with closed as (
  select a.week_id, a.player_id, a.metric, a.value, a.finished_at
  from public.weekly_attempts a
  join auth.users u on u.id = a.player_id and not u.is_anonymous
  where a.lang = p_lang and a.finished_at is not null and a.value is not null
    and a.week_id < (select week_id from public.weekly_window())
    and not exists (select 1 from public.bots b where b.id = a.player_id)
),
winner as (
  select distinct on (c.week_id) c.week_id, c.player_id, c.metric, c.value
  from closed c
  order by c.week_id desc, c.value desc, c.finished_at, c.player_id
)
select w.week_id, w.player_id, p.display_name, p.avatar, w.metric, w.value
from winner w
join public.profiles p on p.id = w.player_id
order by w.week_id desc
limit greatest(1, least(coalesce(p_lim, 50), 100))
$$;

-- La lecture des gagnants n'est pas plus privée que celle d'un classement :
-- les mêmes grants que les autres fonctions du défi (0062).
revoke execute on function public.weekly_winners(text, integer) from public, anon;
grant execute on function public.weekly_winners(text, integer) to authenticated;
