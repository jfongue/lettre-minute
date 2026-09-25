-- Inviter un ami par son adresse e-mail : tant que l'app n'est qu'en test
-- fermé sur Play, un inconnu ne peut pas l'installer. L'adresse attend ici
-- que `npm run testers:invite` (scripts/tester-invites.ts), lancé sur le
-- poste du développeur, l'inscrive à la liste de testeurs de la Play
-- Console puis envoie le mail d'invitation : Play n'offre aucune API pour
-- les listes d'adresses, seulement pour les groupes Google.

create table public.tester_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  invited_by uuid references public.profiles on delete set null,
  lang text,
  created_at timestamptz not null default now(),
  -- Inscrite à la liste de diffusion de la Play Console.
  listed_at timestamptz,
  mailed_at timestamptz
);

create index tester_invites_pending_idx on public.tester_invites (created_at) where mailed_at is null;

alter table public.tester_invites enable row level security;
-- Aucune politique : une adresse saisie par un joueur n'est jamais relue
-- par un autre, et le script la lit en propriétaire du projet.

-- `already` ne dit pas qui a invité, ni si l'adresse a un compte : répondre
-- autrement ferait de ce champ un annuaire des adresses des joueurs.
create function public.invite_tester(p_email text, p_lang text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_named_account() then
    return 'anonymous';
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    return 'invalid';
  end if;
  if exists (select 1 from public.tester_invites where email = v_email) then
    return 'already';
  end if;
  if (select count(*) from public.tester_invites
       where invited_by = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    return 'limit';
  end if;
  insert into public.tester_invites (email, invited_by, lang) values (v_email, auth.uid(), nullif(p_lang, ''));
  return 'sent';
end;
$$;

revoke execute on function public.invite_tester(text, text) from public, anon;
grant execute on function public.invite_tester(text, text) to authenticated;
