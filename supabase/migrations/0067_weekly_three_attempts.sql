-- Le défi du moment tient en trois tentatives : la gratuite, la seconde qu'une
-- pub ouvre, et la troisième que Premium joue sans pub. Le client demande donc
-- un quota de 1, 2 ou 3 (`attemptsAllowed`, `src/domain/weekly.ts`), et le
-- plafond dur du serveur s'aligne dessus.
--
-- Les tentatives déjà jouées gardent leur ligne et leur numéro : la contrainte
-- neuve ne vérifie que les insertions à venir (`not valid`), et `weekly_start`
-- n'insère jamais au-delà du plafond. Un joueur qui a déjà épuisé plus de trois
-- tentatives aujourd'hui sous l'ancien plafond est simplement à court pour la
-- journée, sans perdre son résultat.

create or replace function public.weekly_max_attempts() returns integer
language sql immutable as $$ select 3 $$;

alter table public.weekly_attempts drop constraint if exists weekly_attempts_n_check;
alter table public.weekly_attempts
  add constraint weekly_attempts_n_check check (n between 1 and 3) not valid;
