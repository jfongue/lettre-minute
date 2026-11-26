-- La course : le défi du 29 novembre se gagne en trouvant dix mots le plus vite
-- possible (`WEEKLY_EXCEPTIONS`, `src/domain/weekly.ts`, à tenir aligné).
--
-- Sa valeur est l'avance de l'arrivée sur le plafond de la partie — trois
-- minutes moins le temps mis, zéro sans arrivée —, pour que chaque fonction
-- du défi garde son seul ordre de tri, du plus grand au plus petit : le
-- classement, le récap, les gagnants et les trophées n'ont pas à changer.
--
-- Un client plus ancien ne connaît pas la course : il jouerait ce dimanche-là
-- le mode de sa boucle et rendrait des points dans le même classement.
-- `weekly_metric` dit la métrique qu'une semaine impose, et `weekly_finish`
-- refuse tout autre résultat pour cette semaine-là.

alter table public.weekly_attempts drop constraint weekly_attempts_metric_check;
alter table public.weekly_attempts add constraint weekly_attempts_metric_check
  check (metric in ('score', 'survival', 'race'));

-- La métrique qu'une semaine impose, null quand le client choisit entre points et secondes.
create function public.weekly_metric(p_week_id date) returns text
language sql immutable as $$
  select e.metric from (values (date '2026-11-29', 'race')) e (week_id, metric) where e.week_id = p_week_id
$$;

revoke execute on function public.weekly_metric(date) from public, anon, authenticated;

create or replace function public.weekly_finish(p_attempt uuid, p_value numeric, p_words jsonb, p_metric text default 'score', p_combo integer default 0)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_metric not in ('score', 'survival', 'race') or p_value is null or p_value < 0 or p_value > 10000 then
    raise exception 'invalid result' using errcode = '22023';
  end if;
  if p_words is not null and (jsonb_typeof(p_words) <> 'array' or jsonb_array_length(p_words) > 200) then
    raise exception 'invalid result' using errcode = '22023';
  end if;

  update public.weekly_attempts
     set finished_at = now(), metric = p_metric, value = round(p_value, 1), words = p_words,
         best_combo = greatest(0, least(coalesce(p_combo, 0), 1000))
   where id = p_attempt
     and player_id = auth.uid()
     and finished_at is null
     and started_at > now() - interval '30 minutes'
     -- Une course ne se rend qu'en course, et la course que dans sa semaine.
     and p_metric is not distinct from coalesce(public.weekly_metric(week_id), nullif(p_metric, 'race'));
  return found;
end;
$$;
