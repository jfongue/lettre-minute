-- Une proposition laissée passer par les deux joueurs : le premier qui relit la
-- file la referme pour tout le monde. Jusqu'ici, il effaçait aussi la ligne de
-- l'autre silencieux, que sa lecture suivante remettait en file comme un
-- nouveau venu — sans jamais lui dire qu'il avait manqué la partie. Sa ligne
-- reste désormais accrochée à la table fermée, et c'est lui qui la lit.

create or replace function public.duel_queue_poll(p_lang text, p_categories text[], p_owned integer, p_busy boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me public.duel_queue;
  v_other public.duel_queue;
  v_table public.duel_tables;
  v_id uuid;
  v_cooldown timestamptz;
  v_rating public.duel_ratings;
  v_mine boolean;
  v_owned smallint := greatest(0, least(coalesce(p_owned, 0), 999));
  v_log bigint;
  v_has_table boolean;
  v_away boolean;
begin
  if not public.is_named_account() then
    raise exception 'named account required' using errcode = '42501';
  end if;
  if p_lang !~ '^[a-z]{2}$' or coalesce(cardinality(p_categories), 0) not between 1 and 60 then
    raise exception 'invalid queue entry' using errcode = '22023';
  end if;

  perform public.duel_close_abandoned();
  -- Les absents quittent la file, et leur passage se clôt.
  with gone as (
    delete from public.duel_queue
     where (table_id is null and seen_at < now() - public.duel_queue_patience() and coalesce(away_until, now()) <= now())
        or (table_id is not null and seen_at < now() - interval '2 minutes')
    returning log_id
  )
  update public.duel_queue_log l set outcome = 'expired', ended_at = now()
    from gone where l.id = gone.log_id and l.outcome is null;
  -- Mes parties classées finies et pas encore réglées : celles d'un adversaire parti.
  perform public.duel_settle(t.id)
     from public.duel_tables t join public.duel_seats s on s.table_id = t.id
    where s.player = auth.uid() and t.ranked and t.settled_at is null and t.status in ('over', 'closed')
    limit 3;

  select * into v_me from public.duel_queue where player = auth.uid() for update;

  -- Une proposition en cours, ou qui vient d'aboutir.
  if found and v_me.table_id is not null then
    select * into v_table from public.duel_tables where id = v_me.table_id for update;
    v_has_table := found;
    if v_has_table and v_table.status = 'playing' then
      delete from public.duel_queue where player = auth.uid();
      return jsonb_build_object('status', 'matched', 'table', v_table.id);
    end if;
    -- Une proposition d'une version livrée n'a pas d'heure : elle part d'ici.
    if v_me.offered_at is null then
      update public.duel_queue set offered_at = now() where player = auth.uid() returning * into v_me;
    end if;
    if v_has_table and v_table.status = 'lobby' and public.duel_lobby_open(v_table)
       and now() < v_me.offered_at + make_interval(secs => v_me.offer_window)
       and exists (
         select 1 from public.duel_seats where table_id = v_table.id and player = auth.uid() and left_at is null and kicked_at is null
       ) then
      update public.duel_queue set seen_at = now() where player = auth.uid();
      return public.duel_offer_json(v_table.id, auth.uid(), v_me.offered_at, v_me.offer_window);
    end if;

    -- La proposition a échoué : la table se ferme ; qui avait accepté reprend
    -- sa place dans la file, qui n'a pas répondu en sort.
    -- Une table disparue n'est la faute de personne : la place se garde.
    v_mine := not v_has_table or coalesce((select ready from public.duel_seats where table_id = v_me.table_id and player = auth.uid()), false);
    if v_has_table then
      perform public.duel_offer_unnotify(v_table.id);
    end if;
    if v_has_table and v_table.status = 'lobby' then
      update public.duel_tables set status = 'closed' where id = v_table.id;
      -- Qui n'a pas répondu garde sa ligne, accrochée à la table fermée : sa
      -- lecture suivante lui dit « manqué » au lieu de le remettre en file
      -- sans un mot (0124). L'oubli compte dès maintenant pour la pause.
      update public.duel_queue_log l set outcome = 'missed', ended_at = now()
        from public.duel_queue q join public.duel_seats s on s.table_id = q.table_id and s.player = q.player
       where q.table_id = v_table.id and q.player <> auth.uid() and not s.ready and l.id = q.log_id;
      update public.duel_queue q set table_id = null, offered_at = null, seen_at = now()
        from public.duel_seats s
       where q.table_id = v_table.id and q.player <> auth.uid() and s.table_id = q.table_id and s.player = q.player and s.ready;
    end if;
    if not v_mine then
      update public.duel_queue_log set outcome = 'missed', ended_at = coalesce(ended_at, now()) where id = v_me.log_id;
      delete from public.duel_queue where player = auth.uid();
      return jsonb_build_object('status', 'missed');
    end if;
    update public.duel_queue set table_id = null, offered_at = null, offer_window = 20, seen_at = now()
     where player = auth.uid() returning * into v_me;
  end if;

  v_cooldown := public.duel_cooldown_until(auth.uid());
  if v_cooldown is not null then
    if v_me.player is not null then
      update public.duel_queue_log set outcome = 'cancelled', ended_at = now() where id = v_me.log_id and outcome is null;
      delete from public.duel_queue where player = auth.uid();
    end if;
    return jsonb_build_object('status', 'cooldown', 'until', extract(epoch from v_cooldown), 'now', extract(epoch from clock_timestamp()));
  end if;

  v_rating := public.duel_rating_of(auth.uid());
  v_rating.rating := public.duel_effective_rating(v_rating.rating, v_rating.last_played_at);
  if v_me.player is null then
    insert into public.duel_queue_log (player, lang, rating) values (auth.uid(), p_lang, v_rating.rating) returning id into v_log;
    insert into public.duel_queue (player, lang, owned, categories, log_id, rating, busy)
    values (auth.uid(), p_lang, v_owned, p_categories, v_log, v_rating.rating, coalesce(p_busy, false))
    returning * into v_me;
  else
    update public.duel_queue
       set lang = p_lang, owned = v_owned, categories = p_categories, seen_at = now(),
           rating = v_rating.rating, busy = coalesce(p_busy, false), away_until = null
     where player = auth.uid() returning * into v_me;
  end if;
  if v_me.busy then
    return public.duel_queue_json(auth.uid(), p_lang, 'waiting');
  end if;

  -- Le plus ancien qui cherche, dans l'écart d'Elo que l'attente de l'un ou
  -- de l'autre autorise — jamais un joueur occupé ni un blocage.
  select * into v_other from public.duel_queue q
   where q.table_id is null and q.player <> auth.uid() and q.lang = p_lang and not q.busy
     and (q.seen_at > now() - public.duel_queue_patience() or q.away_until > now())
     and abs(q.rating - v_me.rating) <= greatest(
       public.duel_rating_window(extract(epoch from now() - v_me.joined_at)),
       public.duel_rating_window(extract(epoch from now() - q.joined_at))
     )
     and not exists (
       select 1 from public.blocks b
        where (b.blocker = auth.uid() and b.blocked = q.player) or (b.blocker = q.player and b.blocked = auth.uid())
     )
   order by q.joined_at
   limit 1
   for update skip locked;
  if not found then
    return public.duel_queue_json(auth.uid(), p_lang, 'waiting');
  end if;

  -- L'hôte est celui qui attendait ; les deux sont assis, pas prêts, et ont
  -- vingt secondes pour accepter.
  insert into public.duel_tables (host, lang, seed, categories, ranked)
  values (v_other.player, v_other.lang, floor(random() * 4294967295)::bigint, v_other.categories, true)
  returning id into v_id;
  insert into public.duel_seats (table_id, player, owned, joined_at)
  values (v_id, v_other.player, v_other.owned, clock_timestamp()),
         (v_id, auth.uid(), v_owned, clock_timestamp() + interval '1 millisecond');
  -- Un adversaire en arrière-plan est appelé d'une notification, et la
  -- proposition lui laisse le temps de revenir.
  v_away := coalesce(v_other.away_until > now(), false);
  update public.duel_queue
     set table_id = v_id, offered_at = now(), seen_at = now(),
         offer_window = case when v_away then 60 else public.duel_offer_seconds() end,
         notified = (player = v_other.player and v_away)
   where player in (v_other.player, auth.uid());
  if v_away then
    insert into public.push_outbox (player_id, kind, table_id) values (v_other.player, 'match', v_id);
  end if;
  update public.duel_queue_log set outcome = 'matched', ended_at = now()
   where id in (v_other.log_id, v_me.log_id) and outcome is null;
  return public.duel_offer_json(v_id, auth.uid(), now(), case when v_away then 60 else public.duel_offer_seconds() end);
end;
$$;
