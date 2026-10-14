-- 0077 recollait la part « revenu » à plat dans `analytics_snapshot` : sa
-- série `daily` (offres, publicités, abonnements) écrasait celle de
-- `analytics_core` (parties, joueurs, ouvertures), dont tout l'historique du
-- tableau de bord se lit, et l'écran, qui attend `revenue`, ne trouvait pas
-- la section. `||` ne fusionne que le premier niveau : la dernière clé gagne.
-- La part revenu se range désormais sous sa clé ; son corps ne change pas.

create or replace function public.analytics_snapshot(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.analytics_core(p_days) || public.analytics_extras(p_days)
    || public.analytics_platforms(p_days)
    || jsonb_build_object('revenue', public.analytics_revenue(p_days))
    || public.analytics_moderation(p_days);
$$;

revoke execute on function public.analytics_snapshot(integer) from public, anon, authenticated;
