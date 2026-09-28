-- La sauvegarde cloud de ce que le profil gardait sur l'appareil seul :
-- catégories et pouvoirs choisis, offres en cours, bans, Premium
-- (`src/domain/progress.ts`). Le client fusionne sa copie avec celle-ci et
-- réécrit le tout : le serveur ne fait que garder le dernier document.
--
-- Une table à part plutôt qu'une colonne de `profiles`, lisible par tous :
-- la sauvegarde d'un joueur ne regarde que lui.

create table public.player_progress (
  id uuid primary key references public.profiles on delete cascade,
  progress jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.player_progress enable row level security;

create policy player_progress_read_own on public.player_progress for select to authenticated
  using (auth.uid() = id);

-- Au plus quelques kilo-octets : une liste de catégories et de pouvoirs.
create function public.save_progress(p_progress jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or jsonb_typeof(p_progress) <> 'object' or length(p_progress::text) > 8000 then
    return false;
  end if;
  insert into public.player_progress (id, progress, updated_at)
    values (auth.uid(), p_progress, now())
  on conflict (id) do update set progress = excluded.progress, updated_at = now();
  return true;
end;
$$;

revoke execute on function public.save_progress(jsonb) from public, anon;
grant execute on function public.save_progress(jsonb) to authenticated;

-- La fusion d'un compte anonyme dans un compte nommé (`complete_merge`)
-- n'a rien à déplacer ici : le client a déjà fusionné les deux copies et
-- réécrit la sienne. L'anonyme effacé emporte sa ligne avec lui.
