-- Le tableau de bord se lit aussi dans l'app : cinq tapes sur « Classements »
-- l'ouvrent, et seul un administrateur (0028, `admins`) y reçoit des
-- chiffres. `analytics_snapshot` reste fermée à l'app : cette porte-ci
-- vérifie le compte avant de la lire, et ne rend rien à un autre.

create function public.admin_analytics(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then public.analytics_snapshot(p_days) end;
$$;

revoke execute on function public.admin_analytics(integer) from public, anon;
grant execute on function public.admin_analytics(integer) to authenticated;
