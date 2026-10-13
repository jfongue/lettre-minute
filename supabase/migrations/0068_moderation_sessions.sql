-- Les sessions de modération passées, pour le classement qui les compte : le
-- serveur ne gardait que les votes, et dix mots jugés sont une séance, pas dix.
-- Une ligne par session terminée, datée — la période du classement la lit.
--
-- La table ne se lit ni ne s'écrit par l'API : RLS sans politique, et deux
-- fonctions seules y touchent, `report_moderation_session` pour l'appareil qui
-- vient de vider sa file, `leaderboard_values` pour le classement.

create table public.moderation_sessions (
  id bigserial primary key,
  player_id uuid not null references public.profiles(id) on delete cascade,
  at timestamptz not null default now()
);

create index moderation_sessions_player_at on public.moderation_sessions (player_id, at desc);

alter table public.moderation_sessions enable row level security;

-- Une session terminée, rapportée par l'appareil qui l'a jouée. Une minute
-- entre deux : un aller-retour sur l'écran ne fait pas monter le compte.
create function public.report_moderation_session()
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_moderator() then return; end if;
  if exists (
    select 1 from public.moderation_sessions s
    where s.player_id = auth.uid() and s.at > now() - interval '1 minute'
  ) then return; end if;
  insert into public.moderation_sessions (player_id) values (auth.uid());
end;
$$;

revoke execute on function public.report_moderation_session() from public, anon;
grant execute on function public.report_moderation_session() to authenticated;

-- `leaderboard_values` gagne la mesure des sessions (0021 pour le reste).
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
    group by r.player_id;
  end if;
end;
$$;

revoke execute on function public.leaderboard_values(text, timestamptz) from public, anon, authenticated;

-- Le classement des sessions ne se montre qu'à qui juge : la page l'ouvre au
-- modérateur, et le serveur le referme pour les autres, planche debug comprise.
create or replace function public.leaderboard_stat(p_stat text, p_period text)
returns table (place integer, display_name text, avatar jsonb, value integer, mine boolean, extra boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(p_stat not in ('best', 'points', 'runs', 'words', 'discoveries', 'combo', 'added', 'moderation')
    or p_period not in ('day', 'week', 'all'), true) then
    return;
  end if;
  if p_stat = 'moderation' and not public.is_moderator() then
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
