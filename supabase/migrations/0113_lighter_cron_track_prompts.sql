-- Ce qui pesait encore sur la base une fois les classements et le tableau de
-- bord soulagés (pg_stat_statements, 24 novembre 2026).
--
-- 1. Le journal de pg_cron : chaque passage d'une tâche y écrit une ligne puis
--    la met à jour — 187 000 passages, près de deux heures de base, plus que
--    tous les classements. Les deux tâches de chaque minute passent à toutes
--    les deux minutes : une notification de défi ou la partie d'un joueur
--    maison arrive une minute plus tard au pire.
-- 2. `track` comptait, avant chaque lot, les événements du jour du joueur sur
--    `created_at`, qu'aucun index ne couvre avec le joueur : il les compte
--    désormais sur `at`, par l'index du joueur ou celui de l'appareil, et
--    s'arrête au plafond.
-- 3. `report_prompts` faisait une écriture par couple de la partie, chacune
--    sur des lignes que tous les joueurs mettent à jour en même temps : une
--    seule écriture, regroupée par couple, avec les mêmes totaux.

select cron.schedule('push-challenges', '*/2 * * * *', 'select public.push_tick()');
select cron.schedule('house-bots-challenges', '*/2 * * * *', 'select public.bots_play_challenges()');

-- L'index de l'appareil sert aussi les recherches par appareil seul.
create index events_device_at on public.events (device, at);
drop index public.events_device;

-- Corps de 0110 ; seul le comptage du plafond change.
create or replace function public.track(p_events jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_player uuid := auth.uid();
  v_device text;
  v_today integer;
  v_room integer;
  v_count integer;
begin
  if jsonb_typeof(p_events) <> 'array' then
    return 0;
  end if;
  if v_player is null then
    -- Un invité sans compte : un seul appareil par lot, le plafond se compte
    -- sur lui.
    v_device := left(p_events -> 0 ->> 'device', 64);
    if coalesce(v_device, '') = '' then
      return 0;
    end if;
    select count(*) into v_today from (
      select 1 from public.events
       where player_id is null and device = v_device and at > now() - interval '1 day'
       limit 5000) seen;
  else
    select count(*) into v_today from (
      select 1 from public.events
       where player_id = v_player and at > now() - interval '1 day'
       limit 5000) seen;
  end if;
  v_room := greatest(0, 5000 - v_today);
  if v_room = 0 then
    return 0;
  end if;

  insert into public.events (player_id, device, session, kind, props, lang, platform, version, at, test)
  select v_player,
         left(e ->> 'device', 64),
         left(e ->> 'session', 64),
         e ->> 'kind',
         case when jsonb_typeof(e -> 'props') = 'object' and length((e -> 'props')::text) <= 4000
              then e -> 'props' else '{}' end,
         left(e ->> 'lang', 8),
         left(e ->> 'platform', 16),
         left(e ->> 'version', 32),
         case when (e ->> 'at') ~ '^\d{4}-\d\d-\d\dT'
                   and (e ->> 'at')::timestamptz between now() - interval '30 days' and now() + interval '5 minutes'
              then (e ->> 'at')::timestamptz else now() end,
         coalesce((e ->> 'test')::boolean, false)
    from (select e from jsonb_array_elements(p_events) e limit least(200, v_room)) batch
   where jsonb_typeof(e) = 'object'
     and (e ->> 'kind') ~ '^[a-z][a-z_]{0,31}$'
     and coalesce(e ->> 'device', '') <> ''
     and coalesce(e ->> 'session', '') <> ''
     and (v_player is not null
       or (left(e ->> 'device', 64) = v_device and e ->> 'platform' = 'crazygames'))
     and e ->> 'kind' <> 'screen'
     and (e ->> 'kind' <> 'tap' or coalesce(e -> 'props' ->> 'label', '') like 'invite-%');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.report_prompts(p_seed bigint, p_lang text, p_prompts jsonb)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_seed is null or p_lang is null or p_lang !~ '^[a-z]{2}$'
     or p_prompts is null or jsonb_typeof(p_prompts) <> 'array' then
    return false;
  end if;
  -- Soixante secondes ne quittent pas trente couples.
  if jsonb_array_length(p_prompts) > 30 then
    return false;
  end if;
  if not exists (select 1 from public.runs r where r.player_id = auth.uid() and r.seed = p_seed) then
    return false;
  end if;

  insert into public.prompt_reports (player_id, seed) values (auth.uid(), p_seed)
  on conflict do nothing;
  if not found then
    return false;
  end if;

  -- Les mêmes règles qu'en 0056, en une écriture : un objet sans verdict ou
  -- un couple mal formé est écarté, une valeur douteuse ramenée dans ses
  -- bornes, et un couple tiré deux fois compte deux tirages.
  insert into public.prompt_stats (lang, category_id, letter, dealt, passed, points, words)
  select p_lang, item ->> 'category', item ->> 'letter', count(*),
         count(*) filter (where (item ->> 'passed')::boolean),
         sum(case when jsonb_typeof(item -> 'points') = 'number'
                  then least(greatest(coalesce((item ->> 'points')::numeric, 0), 0), 100000)::integer else 0 end),
         sum(case when jsonb_typeof(item -> 'words') = 'number'
                  then least(greatest(coalesce((item ->> 'words')::numeric, 0), 0), 60)::integer else 0 end)
    from jsonb_array_elements(p_prompts) item
   where jsonb_typeof(item) = 'object'
     and coalesce(jsonb_typeof(item -> 'passed'), '') = 'boolean'
     and coalesce(item ->> 'category', '') ~ '^[a-z0-9-]{1,60}$'
     and coalesce(item ->> 'letter', '') ~ '^[A-Z]$'
   group by item ->> 'category', item ->> 'letter'
  on conflict (lang, category_id, letter) do update
    set dealt = public.prompt_stats.dealt + excluded.dealt,
        passed = public.prompt_stats.passed + excluded.passed,
        points = public.prompt_stats.points + excluded.points,
        words = public.prompt_stats.words + excluded.words;
  return true;
end;
$$;

-- Les statistiques des requêtes repartent de zéro : celles d'avant mêlent
-- deux mois et les pannes, et cachent ce que coûte la base désormais.
do $$
begin
  perform pg_stat_statements_reset();
exception when others then
  raise notice 'pg_stat_statements_reset refused: %', sqlerrm;
end;
$$;
