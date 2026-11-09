-- La semaine du 8 novembre dure deux semaines (`WEEKLY_EXTENDED`,
-- `src/domain/weekly.ts`, à tenir aligné) : le dimanche 15 novembre n'ouvre
-- aucun défi, et la semaine en cours se ferme le 22 à 21 h, heure de Paris.
--
-- La liste des semaines prolongées ne fait que grandir : `weekly_week` garde
-- la prolongation passée du 11 octobre, et rabat toujours le dimanche qu'un
-- client plus ancien enverrait sous son propre identifiant.

create or replace function public.weekly_week(p_week_id date) returns date
language sql immutable as $$
  select coalesce(
    (select e.week_id from (values (date '2026-10-11', 2), (date '2026-11-08', 2)) e (week_id, weeks)
     where p_week_id > e.week_id and p_week_id < e.week_id + 7 * e.weeks),
    p_week_id)
$$;

revoke execute on function public.weekly_week(date) from public, anon, authenticated;
