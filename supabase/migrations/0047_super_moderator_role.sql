-- Super modérateur devient un rôle donné, plus un rang gagné : jusqu'ici,
-- cinq mots validés sans contestation suffisaient (0007), et huit modérateurs
-- l'étaient devenus — or la voix d'un super modérateur fait entrer un mot
-- seule, retire un mot d'office (0044) et règle les fonctionnalités de tout le
-- monde (0045). Un tel pouvoir ne se gagne plus en jouant.
--
-- `is_super_moderator` lit désormais la colonne, et toutes les fonctions qui
-- l'appellent suivent sans être réécrites. Au passage, seul l'administrateur
-- (`admins`, 0028) garde le rôle : les autres redeviennent modérateurs.

alter table public.moderators add column super boolean not null default false;

update public.moderators set super = exists (select 1 from public.admins a where a.id = moderators.id);

create or replace function public.is_super_moderator(p_moderator uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.moderators where id = p_moderator and super);
$$;

revoke execute on function public.is_super_moderator(uuid) from public, anon, authenticated;
