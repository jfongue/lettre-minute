-- 0073 : la part « revenu » du tableau de bord — les offres Premium ouvertes
-- et leur motif, les abonnements et les abonnés, les publicités et leur
-- provenance.
--
-- Les événements sont posés directement : `track` (0029) n'écrit que sous le
-- compte connecté, et ce qu'on éprouve ici est la lecture, pas l'envoi.

select tests.new_user('ra');
select tests.new_user('rb');
select tests.new_user('rc');

insert into public.events (player_id, device, session, kind, props, at)
values
  (tests.uid('ra'), 'dev-a', 's1', 'feature', '{"name":"premium_opened","reason":"filter"}', now()),
  (tests.uid('ra'), 'dev-a', 's1', 'feature', '{"name":"premium_opened","reason":"filter"}', now()),
  (tests.uid('ra'), 'dev-a', 's1', 'feature', '{"name":"ad","source":"reveal","result":"rewarded"}', now()),
  (tests.uid('rb'), 'dev-b', 's2', 'feature', '{"name":"ad","source":"attempt","result":"unavailable"}', now()),
  (tests.uid('rb'), 'dev-b', 's2', 'feature', '{"name":"premium_joined","source":"buy"}', now());

insert into public.purchases (account, product, token, state)
values (tests.uid('ra'), 'premium_lifetime', 'token-ra-0001', 'verified'),
  (tests.uid('rb'), 'premium_lifetime', 'token-rb-0002', 'refused');

select tests.is((public.analytics_revenue(30) #>> '{premium,offers}')::integer, 2, 'two Premium offers opened are counted');
select tests.is((public.analytics_revenue(30) #>> '{premium,offer_devices}')::integer, 1, 'from one device');
select tests.is(public.analytics_revenue(30) #>> '{premium,reasons,0,reason}', 'filter', 'the reason that opened the offer is kept');
select tests.is((public.analytics_revenue(30) #>> '{premium,activations}')::integer, 1, 'a Premium activation is counted');
select tests.is(public.analytics_revenue(30) #>> '{premium,sources,0,source}', 'buy', 'and keeps its origin');
select tests.is((public.analytics_revenue(30) #>> '{premium,subscribers}')::integer, 1, 'a verified purchase is a subscriber');
select tests.is((public.analytics_revenue(30) #>> '{premium,refused}')::integer, 1, 'a refused one is reported as refused');
select tests.is(public.analytics_revenue(30) #>> '{premium,providers,0,provider}', 'play', 'and a subscriber names the store');

select tests.is((public.analytics_revenue(30) #>> '{ads,shown}')::integer, 1, 'an ad watched to the end is an opening');
select tests.is((public.analytics_revenue(30) #>> '{ads,unavailable}')::integer, 1, 'an ad with none ready is not');
select tests.is(public.analytics_revenue(30) #>> '{ads,sources,0,source}', 'attempt', 'the placement that could not run leads at equal counts');
select tests.is(public.analytics_revenue(30) #>> '{ads,sources,1,source}', 'reveal', 'then the one that played');
select tests.is((public.analytics_revenue(30) #>> '{ads,sources,1,rewarded}')::integer, 1, 'with what it earned');

-- Le client de test (0040) et le compte sans la moindre trace (0042) sont
-- écartés comme partout ailleurs.
insert into public.events (player_id, device, session, kind, props, at, test)
values (tests.uid('rc'), 'dev-c', 's3', 'feature', '{"name":"premium_opened","reason":"menu"}', now(), true);

select tests.is((public.analytics_revenue(30) #>> '{premium,offers}')::integer, 2, 'a test client opens no offer');

-- La fenêtre : un événement d'il y a deux mois sort du relevé de trente jours
-- et revient dans un de quatre-vingt-dix.
insert into public.events (player_id, device, session, kind, props, at, created_at)
values (tests.uid('ra'), 'dev-a', 's1', 'feature', '{"name":"premium_opened","reason":"menu"}',
  now() - interval '60 days', now() - interval '60 days');

select tests.is((public.analytics_revenue(30) #>> '{premium,offers}')::integer, 2, 'an offer older than the window is out');
select tests.is((public.analytics_revenue(90) #>> '{premium,offers}')::integer, 3, 'and comes back in a wider one');

-- Les lignes du jour se recoupent avec les totaux, un jour par jour de fenêtre.
select tests.is(
  (select sum((row ->> 'offers')::integer) from jsonb_array_elements(public.analytics_revenue(30) -> 'daily') row)::integer,
  2, 'the daily offers add up to the total');
select tests.is(
  (select count(*) from jsonb_array_elements(public.analytics_revenue(30) -> 'daily'))::integer,
  30, 'and the window has one row per day');
