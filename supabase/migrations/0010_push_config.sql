-- La configuration du push sans étape à la main : la base tire elle-même le
-- secret partagé, et la fonction Edge `push` inscrit sa propre adresse à
-- chaque appel (`push_config`). Personne n'a donc de secret à recopier dans
-- le Vault, ni dans les secrets de la fonction.

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'push_secret') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'push_secret');
  end if;
end;
$$;

-- Appelée par la fonction Edge avant tout contrôle : l'adresse qu'elle donne
-- est la sienne (tirée de SUPABASE_URL), l'inscrire n'ouvre rien. Elle reçoit
-- en retour le secret qu'elle exige ensuite de son appelant.
create function public.push_config(p_url text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'push_url';
  if v_id is null then
    perform vault.create_secret(p_url, 'push_url');
  elsif (select decrypted_secret from vault.decrypted_secrets where id = v_id) is distinct from p_url then
    perform vault.update_secret(v_id, p_url);
  end if;
  return (select decrypted_secret from vault.decrypted_secrets where name = 'push_secret');
end;
$$;

revoke execute on function public.push_config(text) from public, anon, authenticated;
grant execute on function public.push_config(text) to service_role;
