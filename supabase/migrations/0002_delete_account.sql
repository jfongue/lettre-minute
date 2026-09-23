-- Effacer son compte depuis l'application : le Play Store et l'App Store
-- l'exigent dès qu'un compte est créé, même anonyme et sans formulaire.
--
-- Supprimer l'utilisateur d'auth suffit : profil, parties, mots joués et
-- propositions partent en cascade. Un mot déjà entré au dictionnaire reste, il
-- n'appartient plus au joueur qui l'a proposé.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return;
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
