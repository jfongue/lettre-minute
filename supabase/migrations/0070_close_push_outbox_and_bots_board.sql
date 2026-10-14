-- Deux portes que des réécritures avaient rouvertes.
--
-- 0060 a supprimé puis recréé `claim_push_batch` : une fonction neuve reprend
-- les droits par défaut, et n'importe qui, clé anonyme comprise, pouvait lire
-- la file des notifications — les jetons des téléphones — et la marquer prise,
-- ce qui retardait chaque envoi de deux minutes. Seule la fonction Edge, avec
-- la clé de service, la réclame.
--
-- 0068 a réécrit `leaderboard_values` pour les sessions de modération et y a
-- perdu le filtre des joueurs ordinateur sur les parties (0024) : Maxitoon et
-- Terretciel revenaient sur la meilleure partie, les points, les parties, les
-- mots et le combo. Le corps est celui de 0068, filtre rendu.

revoke execute on function public.claim_push_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_push_batch(integer) to service_role;

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
  elsif p_stat = 'moderation' then
    -- Les sessions terminées de la période : elles ne viennent que de
    -- modérateurs, `report_moderation_session` n'en accepte pas d'autres.
    return query
    select s.player_id, count(*)::integer
    from public.moderation_sessions s
    where s.at >= p_since
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
