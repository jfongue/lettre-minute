-- Comptes : nom, adresse, mot de passe — et l'avatar qui va avec.
--
-- Un joueur naît anonyme. S'enregistrer transforme ce compte en compte
-- permanent (auth.updateUser), sans rien déplacer : la partie qu'il vient de
-- finir y est déjà. Se connecter à un compte existant, en revanche, change
-- d'utilisateur : ce que le compte anonyme a joué doit alors y être versé.

-- Le nom affiché devient un nom de compte : unique, sans tenir compte de la
-- casse. « Anonyme » reste partagé par tous ceux qui ne se sont pas enregistrés.
create unique index profiles_display_name_key
  on public.profiles (lower(display_name))
  where display_name <> 'Anonyme';

alter table public.profiles add column avatar jsonb;

create or replace view public.leaderboard
with (security_invoker = off) as
  select id, display_name, best_score, xp, runs, avatar
  from public.profiles
  where runs > 0
  order by best_score desc
  limit 200;

-- ------------------------------------------------------ fusion à la connexion --

-- Le jeton prouve que celui qui se connecte tenait le compte anonyme juste
-- avant : un identifiant seul ne suffit pas, le classement les expose.
create table public.account_merges (
  token uuid primary key default gen_random_uuid(),
  anon_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.account_merges enable row level security;

create function public.prepare_merge() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_token uuid;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false then
    return null;
  end if;
  insert into public.account_merges (anon_id) values (auth.uid()) returning token into v_token;
  return v_token;
end;
$$;

create function public.complete_merge(p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_from uuid;
begin
  if auth.uid() is null then
    return;
  end if;

  delete from public.account_merges
   where token = p_token and created_at > now() - interval '1 hour'
  returning anon_id into v_from;

  if v_from is null or v_from = auth.uid() then
    return;
  end if;
  if not exists (select 1 from auth.users where id = v_from and is_anonymous) then
    return;
  end if;

  update public.runs set player_id = auth.uid() where player_id = v_from;

  delete from public.word_submissions s
   where s.player_id = v_from
     and exists (
       select 1 from public.word_submissions t
        where t.player_id = auth.uid() and t.category_id = s.category_id and t.word = s.word
     );
  update public.word_submissions set player_id = auth.uid() where player_id = v_from;

  update public.profiles p
     set xp = p.xp + a.xp,
         runs = p.runs + a.runs,
         best_score = greatest(p.best_score, a.best_score),
         words_found = p.words_found + a.words_found,
         best_combo = greatest(p.best_combo, a.best_combo),
         updated_at = now()
    from public.profiles a
   where p.id = auth.uid() and a.id = v_from;

  delete from auth.users where id = v_from;
end;
$$;

revoke execute on function public.prepare_merge(), public.complete_merge(uuid) from public, anon;
grant execute on function public.prepare_merge(), public.complete_merge(uuid) to authenticated;
