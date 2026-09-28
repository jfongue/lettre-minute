-- Maxitoon et Terretciel sortent des classements, où 0006 les avait mis pour
-- qu'un tableau ne soit jamais vide. Ils jouent toujours : la liste d'amis,
-- les défis et leur propre avancement ne changent pas. Le tableau du jour et
-- celui de la semaine gardent leur score à battre, Demontoon, ajouté côté
-- client aux seules meilleures parties.
--
-- Le masquage se fait par le compte (`bots`), jamais par le nom : un vrai
-- joueur qui s'appellerait Maxitoon garde sa place.
--
-- Leurs parties n'ont pas de mots (0006), donc les découvertes ne peuvent pas
-- les voir, et les mots ajoutés les écartent déjà depuis 0021. Restent les
-- mesures de parties et les deux tableaux de score, plus la vue `leaderboard`
-- que les tests lisent encore.

create or replace function public.leaderboard_board(p_board text)
returns table (display_name text, avatar jsonb, value integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_board = 'discoveries' then
    return query
      select p.display_name, p.avatar, count(*)::integer
        from public.run_words w
        join public.runs r on r.id = w.run_id
        join public.profiles p on p.id = r.player_id
        join auth.users u on u.id = p.id and not u.is_anonymous
       where r.created_at >= public.period_start('week')
         and not exists (
           select 1
             from public.run_words w2
             join public.runs r2 on r2.id = w2.run_id
            where w2.word = w.word
              and w2.category_id = w.category_id
              and r2.created_at < r.created_at
              and r2.created_at >= r.created_at - interval '7 days'
         )
       group by p.id
       order by 3 desc, p.display_name
       limit 50;
  else
    return query
      select p.display_name, p.avatar, max(r.score)::integer
        from public.runs r
        join public.profiles p on p.id = r.player_id
        join auth.users u on u.id = p.id and not u.is_anonymous
       where r.created_at >= public.period_start(case when p_board = 'week' then 'week' else 'day' end)
         and not exists (select 1 from public.bots b where b.id = p.id)
       group by p.id
       order by 3 desc, p.display_name
       limit 50;
  end if;
end;
$$;

revoke execute on function public.leaderboard_board(text) from public, anon;
grant execute on function public.leaderboard_board(text) to authenticated;

create or replace view public.leaderboard
with (security_invoker = off) as
  select p.id, p.display_name, p.best_score, p.xp, p.runs, p.avatar
  from public.profiles p
  join auth.users u on u.id = p.id and not u.is_anonymous
  where p.runs > 0
    and not exists (select 1 from public.bots b where b.id = p.id)
  order by p.best_score desc
  limit 200;

create or replace function public.leaderboard_values(p_stat text, p_since timestamptz)
returns table (player_id uuid, value integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_stat = 'discoveries' then
    -- Même règle que l'accueil : personne ne l'avait écrit dans la catégorie
    -- pendant les sept jours qui précèdent la partie.
    return query
      select r.player_id, count(*)::integer
        from public.run_words w
        join public.runs r on r.id = w.run_id
       where r.created_at >= p_since
         and not exists (
           select 1
             from public.run_words w2
             join public.runs r2 on r2.id = w2.run_id
            where w2.word = w.word
              and w2.category_id = w.category_id
              and r2.created_at < r.created_at
              and r2.created_at >= r.created_at - interval '7 days'
         )
       group by r.player_id;
  elsif p_stat = 'added' then
    -- Un mot compte le jour où les modérateurs l'ont fait entrer ; ceux
    -- d'avant la modération (0007) n'ont pas de jugement, leur date est
    -- celle de la proposition.
    return query
      select s.player_id, count(*)::integer
        from public.word_submissions s
        left join public.word_reviews v on v.category_id = s.category_id and v.word = s.word
       where s.status = 'accepted'
         and coalesce(v.decided_at, s.created_at) >= p_since
         and not exists (select 1 from public.bots b where b.id = s.player_id)
       group by s.player_id;
  else
    return query
      select r.player_id,
             (case p_stat
                when 'best' then max(r.score)
                when 'points' then sum(r.score)
                when 'runs' then count(*)
                when 'words' then sum(r.words)
                when 'combo' then max(r.best_combo)
              end)::integer
        from public.runs r
       where r.created_at >= p_since
         and not exists (select 1 from public.bots b where b.id = r.player_id)
       group by r.player_id;
  end if;
end;
$$;

revoke execute on function public.leaderboard_values(text, timestamptz) from public, anon, authenticated;
