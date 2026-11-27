-- Le duel classé sans placements : tout le monde commence au Bronze III (800)
-- et y monte vite — K 60 sur les dix premières parties, 40 jusqu'à la
-- vingtième, puis 20 — au lieu de trois placements recadrés entre Bronze et
-- Or. Un joueur entre au classement dès sa première partie classée.
-- `src/domain/ranked.ts` en est toujours le double (`kFactor`, `RATING_START`).

alter table public.duel_ratings alter column rating set default 800;
alter table public.duel_ratings alter column peak set default 800;
alter table public.duel_queue alter column rating set default 800;

-- Les lignes créées sans partie jouée partent du nouveau départ.
update public.duel_ratings set rating = 800, peak = 800 where games = 0;

create or replace function public.duel_k_factor(p_games integer) returns integer
language sql immutable as $$ select case when coalesce(p_games, 0) < 10 then 60 when coalesce(p_games, 0) < 20 then 40 else 20 end $$;

-- Plus de recadrage : seulement le plancher.
create or replace function public.duel_settled_rating(p_rating integer, p_games_after integer) returns integer
language sql immutable as $$ select greatest(100, p_rating) $$;

create or replace function public.duel_rating_json(p_player uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'rating', coalesce(public.duel_effective_rating(r.rating, r.last_played_at), 800),
    'games', coalesce(r.games, 0),
    'wins', coalesce(r.wins, 0),
    'peak', coalesce(r.peak, 800),
    'rank', case when coalesce(r.games, 0) >= 1 then (
      select count(*) + 1 from public.duel_ratings o
       where o.games >= 1
         and public.duel_effective_rating(o.rating, o.last_played_at) > public.duel_effective_rating(r.rating, r.last_played_at)
    ) end
  )
  from (select p_player as player) me
  left join public.duel_ratings r on r.player = me.player;
$$;

create or replace function public.duel_ladder(p_limit integer) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(row order by (row ->> 'rank')::int, row ->> 'name')
        from (
          select jsonb_build_object(
            'player', r.player, 'name', p.display_name, 'avatar', p.avatar,
            'rating', e.rating, 'games', r.games, 'wins', r.wins,
            'rank', rank() over (order by e.rating desc)
          ) as row
            from public.duel_ratings r join public.profiles p on p.id = r.player
            cross join lateral (select public.duel_effective_rating(r.rating, r.last_played_at) as rating) e
           where r.games >= 1 and not exists (select 1 from public.bots b where b.id = r.player)
           order by e.rating desc
           limit greatest(1, least(coalesce(p_limit, 50), 100))
        ) top
    ), '[]'::jsonb),
    'me', case when auth.uid() is not null then public.duel_rating_json(auth.uid()) end
  );
$$;

create or replace function public.duel_placed() returns table (player uuid, name text, avatar jsonb, rating integer, games integer, wins integer, rk bigint)
language sql stable security definer set search_path = public as $$
  select r.player, p.display_name, to_jsonb(p.avatar), e.rating, r.games, r.wins,
         rank() over (order by e.rating desc)
    from public.duel_ratings r join public.profiles p on p.id = r.player
    cross join lateral (select public.duel_effective_rating(r.rating, r.last_played_at) as rating) e
   where r.games >= 1 and not exists (select 1 from public.bots b where b.id = r.player)
$$;
