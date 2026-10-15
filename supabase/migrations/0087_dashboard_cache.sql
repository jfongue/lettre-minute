-- Le relevé met plus de trois secondes à se calculer, la limite du rôle `anon` :
-- la page publique (0086) n'en recevait qu'une erreur. Relever cette limite
-- laisserait n'importe qui faire travailler la base à volonté ; le relevé de
-- trente jours se calcule donc toutes les dix minutes, et qui n'est pas
-- administrateur lit cette copie. L'administrateur garde le calcul en direct.

create table public.dashboard_cache (
  days integer primary key,
  snapshot jsonb not null,
  built_at timestamptz not null default now()
);

alter table public.dashboard_cache enable row level security;

create function public.refresh_dashboard() returns void
language sql security definer set search_path = public as $$
  insert into public.dashboard_cache (days, snapshot, built_at)
  values (30, public.analytics_snapshot(30), now())
  on conflict (days) do update set snapshot = excluded.snapshot, built_at = excluded.built_at;
$$;

revoke execute on function public.refresh_dashboard() from public, anon, authenticated;

create or replace function public.admin_analytics(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select case
    when public.is_admin() then public.analytics_snapshot(least(greatest(coalesce(p_days, 30), 1), 90))
    else (select snapshot from public.dashboard_cache where days = 30)
  end;
$$;

-- Minute 3, 13, 23… plutôt que la dizaine pile, où tombent les tâches de tout le monde.
select cron.schedule('dashboard-cache', '3-59/10 * * * *', 'select public.refresh_dashboard()');

select public.refresh_dashboard();
