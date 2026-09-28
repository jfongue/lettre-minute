-- La boîte à idées se lit dans l'app : cinq tapes sur son titre ouvrent la
-- liste, que seul un administrateur reçoit. Il y archive ce qui est traité,
-- ou efface ce qui n'avait rien à faire là. Le mail quotidien (0015) ne
-- change pas.
--
-- Un administrateur se nomme par son compte, jamais par son nom d'affichage,
-- qu'un autre joueur peut prendre le jour où celui-ci en change.

create table public.admins (
  id uuid primary key references public.profiles on delete cascade
);

alter table public.admins enable row level security;
-- Aucune politique : seul `is_admin()` la lit.

insert into public.admins (id)
  select u.id from auth.users u join public.profiles p on p.id = u.id
   where u.email = 'fongue.jeremy@gmail.com'
on conflict do nothing;

alter table public.ideas add column archived_at timestamptz;
-- D'où vient l'idée : la boîte de « Mes demandes », ou la question posée au
-- retour d'une partie (toutes les trente).
alter table public.ideas add column source text not null default 'box' check (source in ('box', 'prompt'));

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;

-- Même garde-fous que `submit_idea`, avec la provenance en plus.
create function public.submit_idea(p_body text, p_lang text, p_source text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_body text := trim(coalesce(p_body, ''));
begin
  if auth.uid() is null or char_length(v_body) < 3 or char_length(v_body) > 2000 then
    return false;
  end if;
  if (select count(*) from public.ideas
       where player_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    return false;
  end if;
  insert into public.ideas (player_id, lang, body, source)
    values (auth.uid(), nullif(p_lang, ''), v_body, case when p_source = 'prompt' then 'prompt' else 'box' end);
  return true;
end;
$$;

-- Rien pour qui n'est pas administrateur : une liste vide, pas une erreur.
create function public.admin_ideas()
returns table (
  id uuid, body text, lang text, source text, author text,
  author_runs integer, created_at timestamptz, archived_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select i.id, i.body, i.lang, i.source, coalesce(p.display_name, 'Anonyme'),
         coalesce(p.runs, 0)::integer, i.created_at, i.archived_at
    from public.ideas i
    left join public.profiles p on p.id = i.player_id
   where public.is_admin()
   order by i.created_at desc
   limit 500;
$$;

create function public.archive_idea(p_id uuid, p_archived boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    return false;
  end if;
  update public.ideas set archived_at = case when p_archived then now() else null end where id = p_id;
  return found;
end;
$$;

create function public.delete_idea(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    return false;
  end if;
  delete from public.ideas where id = p_id;
  return found;
end;
$$;

revoke execute on function public.is_admin(), public.admin_ideas(), public.archive_idea(uuid, boolean),
  public.delete_idea(uuid), public.submit_idea(text, text, text) from public, anon;
grant execute on function public.is_admin(), public.admin_ideas(), public.archive_idea(uuid, boolean),
  public.delete_idea(uuid), public.submit_idea(text, text, text) to authenticated;
