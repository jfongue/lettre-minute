-- L'administrateur aussi lit la copie de 0087 : son calcul en direct prend
-- neuf secondes, au-delà des huit que la base laisse à un compte connecté, et
-- il ne recevait plus que « Réservé à l'administrateur ». La copie a dix
-- minutes au plus, ce que le relevé dit déjà sous son titre.

create or replace function public.admin_analytics(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select snapshot from public.dashboard_cache where days = 30;
$$;
