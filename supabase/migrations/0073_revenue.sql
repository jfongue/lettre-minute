-- Le tableau de bord gagne sa part « revenu » : les offres Premium ouvertes,
-- les abonnements et les abonnés, les publicités regardées et d'où elles
-- viennent. `analytics_core` (0042) et `analytics_extras` (0040) gardent leurs
-- corps ; `analytics_snapshot` les recolle aux trois, comme 0036 l'avait fait
-- de deux.
--
-- Deux sources, qui ne disent pas la même chose :
--   * les événements du client — `premium_opened` (avec son motif),
--     `premium_joined` (avec son origine : achat, restauration, prix gagné) et
--     `ad` (avec son emplacement et son résultat) — disent ce que le joueur a
--     vu et tenté ;
--   * `purchases` (0063, 0069) dit ce qui a été payé, une fois pour toutes :
--     un même achat rapporté par un autre appareil, ou hérité d'un compte
--     anonyme fusionné, n'y compte qu'une fois, et un remboursement
--     (`refused`) n'est plus un abonné.
--
-- Les mêmes exclusions que le reste du relevé : les clients de test (0040),
-- les comptes sans la moindre trace (0042), les joueurs maison (0024) et
-- l'administrateur (0031).
--
-- Les lignes du jour ne portent que les quatre compteurs qui suivent le filtre
-- de période de l'écran ; les répartitions (motif, emplacement, boutique,
-- origine) restent sur toute la fenêtre du relevé, ce que l'écran dit.
create function public.analytics_revenue(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 180);
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_from date := v_today - (v_days - 1);
  v_since timestamptz := (v_from::timestamp at time zone 'Europe/Paris');
  v_result jsonb;
begin
with
test_accounts as (
  select u.id from auth.users u
  where ((exists (select 1 from public.runs r where r.player_id = u.id and r.test)
    or exists (select 1 from public.events e where e.player_id = u.id and e.test))
    and not exists (select 1 from public.runs r where r.player_id = u.id and not r.test)
    and not exists (select 1 from public.events e where e.player_id = u.id and not e.test))
  or (u.is_anonymous
    and not exists (select 1 from public.runs r where r.player_id = u.id)
    and not exists (select 1 from public.events e where e.player_id = u.id))
),
staff as (
  select id from public.admins
),
staff_devices as (
  select distinct device from public.events where player_id in (select id from staff)
),
ev as (
  select * from public.events e
  where e.created_at >= v_since
  and not e.test
  and not exists (select 1 from staff where staff.id = e.player_id)
  and not exists (select 1 from staff_devices d where d.device = e.device)
),
offers as (
  select * from ev where kind = 'feature' and props ->> 'name' = 'premium_opened'
),
activations as (
  select * from ev where kind = 'feature' and props ->> 'name' = 'premium_joined'
),
-- Une pub sans résultat (`?`) vient d'un relevé d'avant l'événement : elle
-- compte comme ouverte, faute de savoir si elle a seulement pu se charger.
ads as (
  select * from ev where kind = 'feature' and props ->> 'name' = 'ad'
),
buys as (
  select p.* from public.purchases p
  where p.product = 'premium_lifetime' and p.state <> 'refused'
  and not exists (select 1 from staff where staff.id = p.account)
  and not exists (select 1 from public.bots b where b.id = p.account)
  and not exists (select 1 from test_accounts t where t.id = p.account)
),
days as (
  select generate_series(v_from, v_today, interval '1 day')::date as day
)
select jsonb_build_object(
  'premium', jsonb_build_object(
    'offers', (select count(*) from offers),
    'offer_devices', (select count(distinct device) from offers),
    'activations', (select count(*) from activations),
    'subscribers', (select count(distinct account) from buys),
    'refused', (
      select count(*) from public.purchases p
      where p.product = 'premium_lifetime' and p.state = 'refused'
      and not exists (select 1 from staff where staff.id = p.account)
      and not exists (select 1 from public.bots b where b.id = p.account)
      and not exists (select 1 from test_accounts t where t.id = p.account)
    ),
    'reasons', (
      select coalesce(jsonb_agg(jsonb_build_object('reason', reason, 'n', n, 'devices', devices) order by n desc, reason), '[]'::jsonb)
      from (
        select coalesce(props ->> 'reason', '?') as reason, count(*) as n, count(distinct device) as devices
        from offers group by 1
      ) r
    ),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('source', source, 'n', n, 'devices', devices) order by n desc, source), '[]'::jsonb)
      from (
        select coalesce(props ->> 'source', '?') as source, count(*) as n, count(distinct device) as devices
        from activations group by 1
      ) a
    ),
    'providers', (
      select coalesce(jsonb_agg(jsonb_build_object('provider', provider, 'n', n, 'accounts', accounts) order by n desc, provider), '[]'::jsonb)
      from (
        select provider, count(*) as n, count(distinct account) as accounts
        from buys where created_at >= v_since group by 1
      ) p
    )
  ),

  'ads', jsonb_build_object(
    'shown', (select count(*) from ads where props ->> 'result' is distinct from 'unavailable'),
    'devices', (select count(distinct device) from ads where props ->> 'result' is distinct from 'unavailable'),
    'unavailable', (select count(*) from ads where props ->> 'result' = 'unavailable'),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('source', source, 'n', n, 'devices', devices,
        'rewarded', rewarded, 'unavailable', unavailable) order by n desc, source), '[]'::jsonb)
      from (
        select coalesce(props ->> 'source', '?') as source,
        count(*) as n, count(distinct device) as devices,
        count(*) filter (where props ->> 'result' = 'rewarded') as rewarded,
        count(*) filter (where props ->> 'result' = 'unavailable') as unavailable
        from ads group by 1
      ) s
    ),
    'results', (
      select coalesce(jsonb_agg(jsonb_build_object('result', result, 'n', n) order by n desc, result), '[]'::jsonb)
      from (
        select coalesce(props ->> 'result', '?') as result, count(*) as n from ads group by 1
      ) r
    )
  ),

  -- Une ligne par jour de la fenêtre, pour que l'écran filtre sans relire le
  -- serveur : les mêmes compteurs que ses courbes.
  'daily', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'day', d.day,
      'offers', (select count(*) from offers o where (o.created_at at time zone 'Europe/Paris')::date = d.day),
      'activations', (select count(*) from activations a where (a.created_at at time zone 'Europe/Paris')::date = d.day),
      'ads', (select count(*) from ads a where a.props ->> 'result' is distinct from 'unavailable'
        and (a.created_at at time zone 'Europe/Paris')::date = d.day),
      'subscribed', (select count(*) from buys b where (b.created_at at time zone 'Europe/Paris')::date = d.day)
    ) order by d.day), '[]'::jsonb)
    from days d
  )
) into v_result;

return v_result;
end;
$$;

create or replace function public.analytics_snapshot(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.analytics_core(p_days) || public.analytics_extras(p_days) || public.analytics_revenue(p_days);
$$;

revoke execute on function public.analytics_revenue(integer), public.analytics_snapshot(integer)
  from public, anon, authenticated;