-- Les trois vues exposées à PostgREST étaient créées en « security definer » :
-- Postgres les exécutait alors avec les droits de leur propriétaire, et le
-- linter Supabase les signalait à juste titre. Elles passent en « security
-- invoker », où c'est la RLS de l'appelant qui décide — mais deux d'entre elles
-- lisent ou comptent ce qu'un joueur n'a pas le droit de lire lui-même
-- (`auth.users` pour écarter les comptes anonymes, les propositions des autres
-- joueurs). Ce qui doit rester hors de sa portée passe donc par une fonction
-- `security definer` qui ne rend qu'un booléen ou un décompte, jamais une ligne
-- d'`auth.users` : la vue ne la référence plus, et le linter « Exposed Auth
-- Users » ne la voit plus.

-- Le classement des records : un compte nommé, et pas un joueur maison (0024),
-- sans laisser `auth.users` ni `bots` à la portée de la vue.
create function public.is_listed_player(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth.users u where u.id = p_id and not u.is_anonymous)
     and not exists (select 1 from public.bots b where b.id = p_id);
$$;

revoke execute on function public.is_listed_player(uuid) from public, anon;
grant execute on function public.is_listed_player(uuid) to authenticated;

create or replace view public.leaderboard
with (security_invoker = true) as
select p.id, p.display_name, p.best_score, p.xp, p.runs, p.avatar
from public.profiles p
where p.runs > 0
and public.is_listed_player(p.id)
order by p.best_score desc
limit 200;

-- Part des parties récentes où un mot est apparu : elle ne lit que `runs` et
-- `run_words`, ouverts en lecture à tout compte connecté. Rien à lui cacher,
-- donc rien à mettre derrière une fonction.
alter view public.word_popularity set (security_invoker = true);

-- Le décompte des propositions par mot porte sur les lignes de tout le monde,
-- que la RLS de `word_submissions` réserve à leur auteur et aux modérateurs :
-- la fonction est ce qui traverse cette RLS, la vue ne fait que publier son
-- résultat sous le nom que les tests connaissent.
create function public.submission_tally_rows()
returns table (category_id text, word text, display text, proposals integer, accepted boolean)
language sql stable security definer set search_path = public as $$
  select s.category_id, s.word, min(s.display), count(*)::integer, bool_or(s.status = 'accepted')
  from public.word_submissions s
  group by s.category_id, s.word;
$$;

revoke execute on function public.submission_tally_rows() from public, anon;
grant execute on function public.submission_tally_rows() to authenticated;

create or replace view public.submission_tally
with (security_invoker = true) as
select * from public.submission_tally_rows();
