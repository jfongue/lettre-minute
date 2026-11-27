-- Les réglages du jeu, changeables par une migration sans livrer de version.
--
-- `game_config` tient une valeur par clé, lisible par tous (l'invité du portail
-- compris) ; `src/domain/tuning.ts` en est le double : chaque clé y a sa valeur
-- par défaut et sa plage, et le jeu ignore toute valeur hors plage. Une valeur
-- changée ici vaut au lancement suivant de chaque appareil.
--
--   update public.game_config set value = 45 where key = 'run.seconds.solo';
--
-- Les parties que chaque appareil rejoue ne lisent jamais l'appareil :
-- - un défi fige les réglages `run.*` à sa création (`challenges.tuning`) ;
-- - une table de duel fige les `duel.*` à son lancement (`duel_tables.tuning`),
--   seulement si tous ses joueurs ont des règles 3 ou plus — une version plus
--   ancienne rejouerait le journal sur ses propres valeurs.
-- Le classement (`ranked.*`) est réglé ici même : les fonctions de l'Elo, du
-- départ, des Maîtres et de l'inactivité lisent `game_config_value`.
-- Le défi du moment et le quotidien Reddit gardent les valeurs par défaut.

create table public.game_config (
  key text primary key check (key ~ '^[a-zA-Z]+(\.[a-zA-Z]+)+$'),
  value numeric not null,
  -- La plage que le jeu accepte, recopiée de tuning.ts : pour qui écrit la migration.
  min numeric,
  max numeric,
  note text,
  updated_at timestamptz not null default now()
);

alter table public.game_config enable row level security;
create policy game_config_read on public.game_config for select to anon, authenticated using (true);
grant select on public.game_config to anon, authenticated;

create function public.game_config_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger game_config_touch before update on public.game_config
  for each row execute function public.game_config_touch();

insert into public.game_config (key, value, min, max, note) values
  ('run.seconds.solo', 60, 20, 300, 'Durée d’une partie solo (s)'),
  ('run.seconds.delayed', 60, 20, 300, 'Durée du mode retard (s)'),
  ('run.seconds.endurance', 30, 10, 120, 'Réserve de départ de l’endurance (s)'),
  ('run.seconds.reversed', 60, 20, 300, 'Durée du mode renversé (s)'),
  ('run.seconds.race', 180, 60, 600, 'Plafond de la course (s)'),
  ('run.raceWords', 10, 3, 50, 'Mots justes qui arrêtent la course'),
  ('run.endurance.courant', 2, 0, 10, 'Endurance : secondes rendues par un mot courant'),
  ('run.endurance.peuCommun', 2.5, 0, 10, 'Endurance : mot peu commun (s)'),
  ('run.endurance.rare', 3, 0, 10, 'Endurance : mot rare (s)'),
  ('run.endurance.tresRare', 4, 0, 10, 'Endurance : mot très rare (s)'),
  ('run.recallSeconds', 3, 0, 15, 'Retard : coût pour revoir la question (s)'),
  ('run.skipPenalty', 5, 0, 20, 'Coût d’un passe en partie (s)'),
  ('run.dodgePenalty', 3, 0, 20, 'Coût d’un passe sous Esquive (s)'),
  ('run.hushSeconds', 10, 0, 30, 'Silence : temps tenu au plus (s)'),
  ('run.latecomerThreshold', 10, 0, 60, 'Retardataire : se déclenche sous ce temps restant (s)'),
  ('run.latecomerSeconds', 1, 0, 10, 'Retardataire : secondes rendues par mot'),
  ('run.latecomerCap', 5, 0, 30, 'Retardataire : plafond rendu (s)'),
  ('run.flawlessStreak', 6, 2, 30, 'Sans-faute : série qui paie le bonus'),
  ('run.flawlessPoints', 30, 0, 200, 'Sans-faute : points du bonus'),
  ('run.basePoints', 10, 1, 100, 'Points de base d’un mot'),
  ('run.rarityPoints', 20, 0, 200, 'Points de rareté au plus d’un mot'),
  ('run.comboStep', 0.1, 0, 1, 'Multiplicateur ajouté par mot enchaîné'),
  ('run.comboMax', 9, 0, 50, 'Mots enchaînés comptés au plus'),
  ('duel.reserve', 30, 10, 120, 'Duel : réserve de départ (s)'),
  ('duel.passPenalty', 5, 0, 20, 'Duel : coût d’un passe (s)'),
  ('duel.floor', 1.5, 0.5, 10, 'Duel : temps minimum quand la main arrive (s)'),
  ('duel.grace', 1, 0, 5, 'Duel : marge réseau après zéro (s)'),
  ('duel.deathBonus', 1.5, 0, 10, 'Duel : temps rendu aux survivants à chaque mort (s)'),
  ('duel.bonus.courant', 0, 0, 10, 'Duel : temps rendu par un mot courant (s)'),
  ('duel.bonus.peuCommun', 1, 0, 10, 'Duel : mot peu commun (s)'),
  ('duel.bonus.rare', 1.5, 0, 10, 'Duel : mot rare (s)'),
  ('duel.bonus.tresRare', 2, 0, 10, 'Duel : mot très rare (s)'),
  ('duel.echoFirst', 1, 0, 5, 'Duel : bonus du premier mot trouvé pendant le tour d’un autre (s)'),
  ('duel.echoNext', 0.5, 0, 5, 'Duel : bonus des mots suivants (s)'),
  ('duel.echoMax', 3, 0, 10, 'Duel : mots bonus par joueur et par tour'),
  ('duel.longSeconds', 180, 30, 1800, 'Duel : durée avant l’usure des bonus (s)'),
  ('duel.fadeSeconds', 180, 10, 1800, 'Duel : durée de l’usure jusqu’à zéro (s)'),
  ('duel.pickSeconds', 10, 3, 60, 'Duel : temps pour choisir une catégorie (s)'),
  ('duel.xpBonus', 100, 0, 1000, 'Duel : XP de forfait d’un duel joué jusqu’au bout'),
  ('xp.perPoint', 1, 0, 10, 'XP gagnée par point'),
  ('xp.recordBonus', 100, 0, 1000, 'XP bonus d’un record battu'),
  ('xp.recordBonusBelow', 250, 0, 5000, 'Le bonus de record ne vaut que sous ce score'),
  ('xp.challengeBonus', 0.25, 0, 5, 'Bonus d’XP d’un défi (0,25 = +25 %)'),
  ('powers.firstLevel', 3, 1, 50, 'Niveau du premier pouvoir'),
  ('powers.levelStep', 2, 1, 20, 'Niveaux entre deux pouvoirs'),
  ('powers.offerSize', 2, 1, 6, 'Pouvoirs proposés à chaque offre'),
  ('bonus.fromLevel', 7, 1, 100, 'Niveau du premier bonus de niveau'),
  ('bonus.everyLevels', 3, 1, 50, 'Niveaux entre deux bonus'),
  ('bonus.offerSize', 2, 1, 6, 'Bonus proposés à chaque offre'),
  ('reveals.base', 2, 0, 50, 'Mots cachés révélés gratuitement par jour'),
  ('reveals.perAd', 3, 0, 50, 'Mots révélés par pub regardée'),
  ('reveals.bonusMax', 3, 0, 50, 'Révélations en plus gagnées par bonus, au plus'),
  ('bans.freeMax', 3, 0, 20, 'Catégories filtrables sans Premium, au plus'),
  ('bans.plus', 6, 0, 20, 'Catégories filtrables avec Premium'),
  ('bans.minPlayable', 6, 3, 30, 'Catégories jouables au minimum'),
  ('ads.first', 3, 1, 100, 'Interstitiel : première pause après la partie n°'),
  ('ads.gap', 4, 1, 100, 'Interstitiel : parties entre deux pauses au départ'),
  ('ads.growth', 2, 0, 50, 'Interstitiel : allongement de l’écart à chaque pause'),
  ('asks.feedbackFirst', 10, 1, 1000, 'Question d’avis : après la partie n°'),
  ('asks.feedbackEvery', 30, 1, 1000, 'Question d’avis : puis toutes les N parties'),
  ('asks.ratingFirst', 10, 1, 1000, 'Demande de note : après la partie n°'),
  ('asks.ratingEvery', 20, 1, 1000, 'Demande de note : puis toutes les N parties'),
  ('asks.shareNewsRuns', 15, 0, 1000, 'Pop-up de partage : après N parties'),
  ('weekly.freeAttempts', 1, 0, 5, 'Défi du moment : tentatives gratuites'),
  ('weekly.adAttempts', 2, 0, 5, 'Défi du moment : tentatives contre une pub'),
  ('weekly.plusAttempts', 3, 1, 5, 'Défi du moment : tentatives Premium'),
  ('weekly.minLevel', 4, 1, 100, 'Défi du moment : niveau minimum'),
  ('ranked.offerSeconds', 20, 5, 120, 'Classé : secondes pour accepter un adversaire'),
  ('ranked.botGrace', 10, 0, 300, 'Classé : secondes après l’attente estimée avant le bot'),
  ('ranked.botDefaultWait', 20, 0, 600, 'Classé : attente supposée sans estimation (s)'),
  ('ranked.botMaxWait', 180, 10, 1800, 'Classé : le bot arrive au plus tard après (s)'),
  ('ranked.botAnswerMin', 0.55, 0, 1, 'Bot de niveau : taux de réponse au bas du Bronze'),
  ('ranked.botAnswerMax', 0.95, 0, 1, 'Bot de niveau : taux de réponse au Diamant'),
  ('ranked.kEarly', 60, 1, 200, 'Elo : pas des premières parties'),
  ('ranked.kMid', 40, 1, 200, 'Elo : pas intermédiaire'),
  ('ranked.kLate', 20, 1, 200, 'Elo : pas ordinaire'),
  ('ranked.kEarlyGames', 10, 0, 1000, 'Elo : parties au pas des débuts'),
  ('ranked.kMidGames', 20, 0, 1000, 'Elo : parties avant le pas ordinaire'),
  ('ranked.boost', 2, 1, 5, 'Elo : multiplicateur du pas avant les Maîtres'),
  ('ranked.startEarly', 950, 100, 3000, 'Elo de départ tant que l’Or est peu peuplé'),
  ('ranked.startLate', 800, 100, 3000, 'Elo de départ ensuite'),
  ('ranked.bronzeStartGold', 50, 0, 100000, 'Joueurs Or à partir desquels on part du Bronze'),
  ('ranked.mastersFromDiamonds', 10, 0, 100000, 'Joueurs Diamant qui ouvrent les Maîtres'),
  ('ranked.botStake', 0.5, 0, 2, 'Part du pas en jeu contre le bot (0,5 = moitié)'),
  ('ranked.decayGraceDays', 7, 0, 365, 'Inactivité : jours sans perte'),
  ('ranked.decayPerDay', 5, 0, 200, 'Inactivité : Elo perdu par jour'),
  ('ranked.decayCap', 150, 0, 3000, 'Inactivité : perte au plus'),
  ('ranked.decayFloor', 950, 100, 3000, 'Inactivité : plancher');

-- Une valeur, ou celle par défaut si la clé manque ou sort de sa plage.
create function public.game_config_value(p_key text, p_default numeric) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select value from public.game_config
      where key = p_key and (min is null or value >= min) and (max is null or value <= max)),
    p_default
  )
$$;

-- Les réglages d'une famille (`run.`, `duel.`) en un objet, pour un instantané.
create function public.game_config_group(p_prefix text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
    from public.game_config
   where key like p_prefix || '%' and (min is null or value >= min) and (max is null or value <= max)
$$;

revoke execute on function public.game_config_value(text, numeric) from public, anon;
grant execute on function public.game_config_value(text, numeric) to authenticated;
revoke execute on function public.game_config_group(text) from public, anon, authenticated;

-- ------------------------------------------------------------ instantanés --

alter table public.challenges add column tuning jsonb;
alter table public.duel_tables add column tuning jsonb;

create function public.challenge_tuning() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.tuning := public.game_config_group('run.');
  return new;
end;
$$;
create trigger challenges_tuning before insert on public.challenges
  for each row execute function public.challenge_tuning();

-- Au lancement, et seulement si chaque joueur humain lit les réglages (règles 3).
create function public.duel_table_tuning() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'playing' and old.status is distinct from 'playing' then
    new.tuning := case when coalesce(new.rules, 1) >= 3 then public.game_config_group('duel.') end;
  end if;
  return new;
end;
$$;
create trigger duel_tables_tuning before update on public.duel_tables
  for each row execute function public.duel_table_tuning();

create or replace function public.challenge_detail(p_challenge uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_open boolean;
begin
  if not exists (
    select 1 from public.challenge_players where challenge_id = p_challenge and player_id = auth.uid()
  ) then
    return null;
  end if;
  v_open := public.challenge_finished(p_challenge) or exists (
    select 1 from public.challenge_players
     where challenge_id = p_challenge and player_id = auth.uid() and played_at is not null
  );

  return (
    select jsonb_build_object(
      'id', c.id,
      'owner_name', coalesce(o.display_name, ''),
      'owned', c.owner = auth.uid(),
      'lang', c.lang,
      'seed', c.seed,
      'category_ids', to_jsonb(c.category_ids),
      'created_at', c.created_at,
      'expires_at', public.challenge_expires_at(c.id),
      'finished', public.challenge_finished(c.id),
      'next_id', c.next_id,
      'powers_allowed', c.powers_allowed,
      'tuning', c.tuning,
      'name', c.name,
      'players', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'id', p.id,
                 'name', p.display_name,
                 'avatar', p.avatar,
                 'me', p.id = auth.uid(),
                 'bot', exists (select 1 from public.bots b where b.id = p.id),
                 'played_at', cp.played_at,
                 'score', cp.score,
                 'skips', cp.skips,
                 'best_combo', cp.best_combo,
                 'words', case
                   when cp.words is null then '[]'::jsonb
                   when v_open or p.id = auth.uid() then cp.words
                   else (select coalesce(jsonb_agg(jsonb_build_object('at', w -> 'at', 'points', w -> 'points')), '[]'::jsonb)
                           from jsonb_array_elements(cp.words) w)
                 end
               ) order by cp.played_at nulls last, cp.invited_at), '[]'::jsonb)
          from public.challenge_players cp
          join public.profiles p on p.id = cp.player_id
         where cp.challenge_id = c.id
      )
    )
    from public.challenges c
    left join public.profiles o on o.id = c.owner
   where c.id = p_challenge
  );
end;
$$;

create or replace function public.duel_sync(p_table uuid, p_after integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_table public.duel_tables;
begin
  select * into v_table from public.duel_tables where id = p_table;
  if not found or not exists (select 1 from public.duel_seats where table_id = p_table and player = auth.uid()) then
    return null;
  end if;
  update public.duel_seats set last_seen = now()
   where table_id = p_table and player = auth.uid() and left_at is null and kicked_at is null
     and last_seen < clock_timestamp() - interval '2 seconds';
  if v_table.ranked and v_table.settled_at is null and v_table.status in ('over', 'closed') then
    perform public.duel_settle(p_table);
    select * into v_table from public.duel_tables where id = p_table;
  end if;

  return jsonb_build_object(
    'now', extract(epoch from clock_timestamp()),
    'table', jsonb_build_object(
      'id', v_table.id,
      'host', v_table.host,
      'lang', v_table.lang,
      'seed', v_table.seed,
      'categories', to_jsonb(v_table.categories),
      'status', case when v_table.status = 'lobby' and not public.duel_lobby_open(v_table) then 'closed' else v_table.status end,
      'started_at', extract(epoch from v_table.started_at),
      'rematch', v_table.rematch,
      'public', v_table.listed,
      'ranked', v_table.ranked,
      'rules', v_table.rules,
      'tuning', v_table.tuning,
      'settled', v_table.settled_at is not null,
      'voided', v_table.voided,
      'ratings', coalesce((
        select jsonb_agg(jsonb_build_object('player', c.player, 'place', c.place, 'before', c.before, 'after', c.after) order by c.place)
          from public.duel_rating_changes c where c.table_id = p_table
      ), '[]'::jsonb)
    ),
    'seats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player', s.player,
        'name', p.display_name,
        'avatar', p.avatar,
        'bot', s.is_bot,
        'owned', s.owned,
        'ready', s.ready,
        'seat', s.seat,
        'left', s.left_at is not null,
        'kicked', s.kicked_at is not null,
        'seen', extract(epoch from s.last_seen),
        'rating', (select public.duel_effective_rating(r.rating, r.last_played_at) from public.duel_ratings r where r.player = s.player),
        'games', (select r.games from public.duel_ratings r where r.player = s.player),
        'rank', (select (public.duel_rating_json(s.player) ->> 'rank')::int where s.player is not null and not s.is_bot),
        'masters', public.duel_masters_open()
      ) order by s.joined_at, s.player)
      from public.duel_seats s left join public.profiles p on p.id = s.player
      where s.table_id = p_table
    ), '[]'::jsonb),
    'invites', case when v_table.host = auth.uid() then coalesce((
      select jsonb_agg(jsonb_build_object('player', i.invitee, 'name', p.display_name, 'avatar', p.avatar) order by i.created_at)
      from public.duel_invites i join public.profiles p on p.id = i.invitee
      where i.table_id = p_table and i.answered_at is null
    ), '[]'::jsonb) else '[]'::jsonb end,
    'moves', coalesce((
      select jsonb_agg(jsonb_build_object(
        'seq', m.seq, 'seat', m.seat, 'kind', m.kind, 'payload', m.payload, 'at', extract(epoch from m.at)
      ) order by m.seq)
      from public.duel_moves m where m.table_id = p_table and m.seq > coalesce(p_after, 0)
    ), '[]'::jsonb)
  );
end;
$$;

-- --------------------------------------------------------------- classement --

create or replace function public.duel_offer_seconds() returns integer
language sql stable as $$ select public.game_config_value('ranked.offerSeconds', 20)::int $$;

create or replace function public.duel_k_factor(p_games integer) returns integer
language sql stable as $$
  select case
    when coalesce(p_games, 0) < public.game_config_value('ranked.kEarlyGames', 10) then public.game_config_value('ranked.kEarly', 60)
    when coalesce(p_games, 0) < public.game_config_value('ranked.kMidGames', 20) then public.game_config_value('ranked.kMid', 40)
    else public.game_config_value('ranked.kLate', 20)
  end::int
$$;

create or replace function public.duel_effective_rating(p_rating integer, p_last timestamptz) returns integer
language sql stable as $$
  select greatest(
    p_rating - least(
      public.game_config_value('ranked.decayCap', 150),
      public.game_config_value('ranked.decayPerDay', 5)
        * greatest(0, floor(extract(epoch from now() - coalesce(p_last, now())) / 86400)::int - public.game_config_value('ranked.decayGraceDays', 7))
    ),
    least(p_rating, public.game_config_value('ranked.decayFloor', 950))
  )::int
$$;

create or replace function public.duel_start_rating() returns integer
language sql stable security definer set search_path = public as $$
  select case when gold >= public.game_config_value('ranked.bronzeStartGold', 50)
              then public.game_config_value('ranked.startLate', 800)
              else public.game_config_value('ranked.startEarly', 950) end::int
    from public.duel_population()
$$;

create or replace function public.duel_masters_open() returns boolean
language sql stable security definer set search_path = public as $$
  select diamond >= public.game_config_value('ranked.mastersFromDiamonds', 10) from public.duel_population()
$$;

create or replace function public.duel_k_boost() returns integer
language sql stable security definer set search_path = public as $$
  select case when diamond < public.game_config_value('ranked.mastersFromDiamonds', 10)
              then public.game_config_value('ranked.boost', 2) else 1 end::int
    from public.duel_population()
$$;

create or replace function public.duel_report_bot(p_won boolean) returns jsonb
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
  v_delta := round(public.duel_k_factor(v_row.games) * public.duel_k_boost() * public.game_config_value('ranked.botStake', 0.5));
  v_after := public.duel_settled_rating(v_before + case when coalesce(p_won, false) then v_delta else -v_delta end, v_row.games + 1);
  update public.duel_ratings
     set rating = v_after, games = games + 1, wins = wins + case when coalesce(p_won, false) then 1 else 0 end,
         peak = greatest(peak, v_after), last_played_at = now(), updated_at = now()
   where player = auth.uid();
  return jsonb_build_object('status', 'settled', 'before', v_before, 'after', v_after) || public.duel_rating_json(auth.uid());
end;
$$;
