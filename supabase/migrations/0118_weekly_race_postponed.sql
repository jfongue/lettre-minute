-- La course ne tombe plus le 29 novembre (`WEEKLY_EXCEPTIONS`, `src/domain/weekly.ts`) :
-- la version de CrazyGames en ligne, et celle qui attend sa revue, ne la
-- connaissent pas et joueraient le retard de leur boucle, dont 0117 refuserait
-- chaque résultat. Aucune semaine n'impose plus de métrique ; la course
-- reviendra ici avec sa date, une fois chaque version livrée.

create or replace function public.weekly_metric(p_week_id date) returns text
language sql immutable as $$
  select e.metric from (values (null::date, null::text)) e (week_id, metric) where e.week_id = p_week_id
$$;

revoke execute on function public.weekly_metric(date) from public, anon, authenticated;
