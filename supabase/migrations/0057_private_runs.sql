-- L'historique de tout le monde était ouvert à n'importe quel compte connecté :
-- `runs.record` porte chaque mot écrit, son orthographe et son chrono, et
-- `runs.seed` la graine de la partie. Rien de tout cela n'a besoin d'être public
-- — un compte ne relit que les siennes (la page des statistiques filtre déjà sur
-- son identifiant) —, et les tableaux comme le face-à-face passent par des
-- fonctions `security definer` (`leaderboard_board`, `challenge_detail`) qui ne
-- rendent qu'un score.
--
-- La part d'un mot dans `word_popularity` se compte, elle, sur les parties de
-- tout le monde : elle remonte donc dans une fonction `security definer` — même
-- motif que `submission_tally_rows` (0053) —, que la vue invoker ne fait que
-- publier. La vue reste invoker : la RLS ne s'ouvre pas d'un cran pour un
-- décompte.

drop policy runs_read on public.runs;
create policy runs_read on public.runs for select to authenticated
using (auth.uid() = player_id);

drop policy run_words_read on public.run_words;
create policy run_words_read on public.run_words for select to authenticated
using (exists (select 1 from public.runs r where r.id = run_id and r.player_id = auth.uid()));

create function public.word_popularity_rows() returns table (word text, share double precision, uses integer)
language sql stable security definer set search_path = public as $$
  select w.word,
         count(distinct w.run_id)::real / greatest((select count(*) from public.runs), 1) as share,
         count(*)::integer as uses
    from public.run_words w
   group by w.word
  having count(*) >= 3;
$$;

revoke execute on function public.word_popularity_rows() from public, anon;
grant execute on function public.word_popularity_rows() to authenticated;

create or replace view public.word_popularity
with (security_invoker = true) as
select * from public.word_popularity_rows();
