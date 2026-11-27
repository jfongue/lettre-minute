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

-- Le temps des tests : une partie contre le bot de niveau, que la file lance
-- faute d'adversaire, compte au classement. Elle se joue sur l'appareil, le
-- serveur n'en connaît que l'issue que le client rapporte — de quoi tricher,
-- donc une porte provisoire : la fonctionnalité `rankedBots` fermée pour tout
-- le monde (`feature_flags`) la referme aussi ici, sans nouvelle version. Le
-- bot a l'Elo du joueur : une victoire rend la moitié du pas, une défaite la
-- coûte. Une partie par minute au plus, contre les envois répétés.
-- 'settled' avec l'avant et l'après, 'closed' (porte fermée), 'too_soon' ou 'forbidden'.
create function public.duel_report_bot(p_won boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_row public.duel_ratings;
  v_before integer;
  v_after integer;
  v_delta integer;
begin
  if not public.is_named_account() then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if exists (select 1 from public.feature_flags where feature = 'rankedBots' and everyone = 'off') then
    return jsonb_build_object('status', 'closed');
  end if;
  v_row := public.duel_rating_of(auth.uid());
  if v_row.last_played_at > now() - interval '1 minute' then
    return jsonb_build_object('status', 'too_soon');
  end if;
  perform 1 from public.duel_ratings where player = auth.uid() for update;
  v_before := public.duel_effective_rating(v_row.rating, v_row.last_played_at);
  v_delta := round(public.duel_k_factor(v_row.games) * 0.5);
  v_after := public.duel_settled_rating(v_before + case when coalesce(p_won, false) then v_delta else -v_delta end, v_row.games + 1);
  update public.duel_ratings
     set rating = v_after, games = games + 1, wins = wins + case when coalesce(p_won, false) then 1 else 0 end,
         peak = greatest(peak, v_after), last_played_at = now(), updated_at = now()
   where player = auth.uid();
  return jsonb_build_object('status', 'settled', 'before', v_before, 'after', v_after) || public.duel_rating_json(auth.uid());
end;
$$;

revoke execute on function public.duel_report_bot(boolean) from public, anon;
grant execute on function public.duel_report_bot(boolean) to authenticated;
