-- La page des classements : sept mesures, chacune du jour, de la semaine ou
-- de toujours. `leaderboard_board` reste pour les trois tableaux de l'accueil.
--
-- Les parties de défi n'y entrent pas plus qu'ailleurs : elles ne sont pas
-- dans `runs`. Les joueurs maison figurent aux mesures de parties, jamais aux
-- découvertes (leurs parties n'ont pas de mots) ni aux mots ajoutés (ils
-- proposent la réserve de modération, qu'ils n'ont pas trouvée).

-- Une valeur par joueur, sans nom ni rang : `leaderboard_stat` les pose.
create function public.leaderboard_values(p_stat text, p_since timestamptz)
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
       group by r.player_id;
  end if;
end;
$$;

revoke execute on function public.leaderboard_values(text, timestamptz) from public, anon, authenticated;

-- Les cinquante premiers, et le joueur lui-même s'il est plus loin (`extra`) :
-- sa place se lit même quand elle ne tient pas sur la page. Les ex æquo
-- partagent leur rang.
create function public.leaderboard_stat(p_stat text, p_period text)
returns table (place integer, display_name text, avatar jsonb, value integer, mine boolean, extra boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(p_stat not in ('best', 'points', 'runs', 'words', 'discoveries', 'combo', 'added')
              or p_period not in ('day', 'week', 'all'), true) then
    return;
  end if;
  return query
    with ranked as (
      select p.id,
             p.display_name,
             p.avatar,
             x.value,
             rank() over (order by x.value desc)::integer as place,
             row_number() over (order by x.value desc, p.display_name) as n
        from public.leaderboard_values(
               p_stat,
               case when p_period = 'all' then '-infinity'::timestamptz else public.period_start(p_period) end
             ) x
        join public.profiles p on p.id = x.player_id
        join auth.users u on u.id = p.id and not u.is_anonymous
       where x.value > 0
    )
    select ranked.place, ranked.display_name, ranked.avatar, ranked.value,
           ranked.id = auth.uid(), ranked.n > 50
      from ranked
     where ranked.n <= 50 or ranked.id = auth.uid()
     order by ranked.n;
end;
$$;

revoke execute on function public.leaderboard_stat(text, text) from public, anon;
grant execute on function public.leaderboard_stat(text, text) to authenticated;
