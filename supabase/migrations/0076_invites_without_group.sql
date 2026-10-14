-- Le mail d'invitation n'attend plus le groupe des testeurs.
--
-- La page d'invitation envoie maintenant à la fiche Play, ouverte à tout le
-- monde : l'adresse n'a plus besoin d'entrer dans le groupe Google pour que le
-- lien fonctionne, et le mail n'a plus de raison d'attendre son tour. Il part
-- dès que l'invitation est enregistrée, relevée tous les quarts d'heure par
-- `invites-retry` (0035) — `npm run group:invites` n'a plus rien à faire, et
-- `listed_at` ne reste que la trace de ce qu'il avait fait.
drop function public.claim_invites();

create function public.claim_invites() returns table (
  id uuid, email text, lang text, inviter_name text, inviter_email text, inviter_code text
)
language sql security definer set search_path = public as $$
  update public.tester_invites i set attempts = i.attempts + 1
  from public.profiles p, auth.users u
  where i.mailed_at is null and i.attempts < 3 and i.created_at > now() - interval '7 days'
  and p.id = i.invited_by and u.id = i.invited_by
  returning i.id, i.email, i.lang, p.display_name, u.email,
    (select l.code from public.invite_links l where l.inviter = i.invited_by);
$$;

revoke execute on function public.claim_invites() from public, anon, authenticated;
grant execute on function public.claim_invites() to service_role;