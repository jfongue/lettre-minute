-- Le tableau de bord s'ouvre à tous : https://jfongue.github.io/lettre-minute/dashboard
-- le lit sans compte, sous le rôle `anon`. Le relevé ne porte que des comptes
-- et les noms que les classements montrent déjà ; `admin_slot`, qui nomme les
-- joueurs d'une heure, et l'historique d'un joueur restent à l'administrateur.
-- La période est bornée : un appel sur dix ans ferait lire toutes les tables
-- à qui veut.

create or replace function public.admin_analytics(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.analytics_snapshot(least(greatest(coalesce(p_days, 30), 1), 90));
$$;

grant execute on function public.admin_analytics(integer) to anon, authenticated;
