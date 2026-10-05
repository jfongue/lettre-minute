-- Les fonctionnalités paramétrables : pour chaque fonctionnalité du jeu, ce que
-- disent quatre publics — tout le monde, les modérateurs, les joueurs Premium,
-- les super modérateurs. Chaque case vaut `on` (dispo), `off` (bloqué) ou
-- `neutral` (ne se prononce pas). Le client décide : une seule case `on` parmi
-- les publics d'un joueur suffit, sinon une case `off` ferme, et une ligne toute
-- neutre retombe sur les valeurs du code (`src/domain/features.ts`).
--
-- Une ligne absente n'est pas une erreur : le code porte ses propres valeurs.
-- Le client lit la table au démarrage et ne l'applique qu'au suivant, pour
-- qu'un réglage ne fasse jamais changer un écran sous les doigts d'un joueur.
-- Le serveur ne connaît pas Premium (il vit sur l'appareil) : la table ne sert
-- donc qu'à l'interface, jamais à refuser une fonction côté serveur.

create table public.feature_flags (
  feature text primary key check (feature ~ '^[a-zA-Z][a-zA-Z0-9]{1,40}$'),
  everyone text not null default 'neutral' check (everyone in ('on', 'off', 'neutral')),
  moderator text not null default 'neutral' check (moderator in ('on', 'off', 'neutral')),
  premium text not null default 'neutral' check (premium in ('on', 'off', 'neutral')),
  super_moderator text not null default 'neutral' check (super_moderator in ('on', 'off', 'neutral')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles on delete set null
);

alter table public.feature_flags enable row level security;

-- Tout le monde lit, même un appareil sans compte : c'est ce qui décide des
-- écrans au démarrage. Personne n'écrit hors de `set_feature_flag`.
create policy feature_flags_read on public.feature_flags for select to anon, authenticated using (true);

-- Une case d'une fonctionnalité, réglée par un super modérateur. Répond par un
-- code que le client traduit : 'saved', 'forbidden' (pas super modérateur) ou
-- 'invalid' (public ou valeur inconnus).
create function public.set_feature_flag(p_feature text, p_audience text, p_value text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_moderator(auth.uid()) then
    return 'forbidden';
  end if;
  if p_feature is null or p_feature !~ '^[a-zA-Z][a-zA-Z0-9]{1,40}$'
     or p_audience not in ('everyone', 'moderator', 'premium', 'super_moderator')
     or p_value not in ('on', 'off', 'neutral') then
    return 'invalid';
  end if;

  insert into public.feature_flags (feature, updated_by) values (p_feature, auth.uid())
  on conflict (feature) do nothing;
  execute format('update public.feature_flags set %I = $1, updated_at = now(), updated_by = $2 where feature = $3', p_audience)
    using p_value, auth.uid(), p_feature;
  return 'saved';
end;
$$;

revoke execute on function public.set_feature_flag(text, text, text) from public, anon;
grant execute on function public.set_feature_flag(text, text, text) to authenticated;
