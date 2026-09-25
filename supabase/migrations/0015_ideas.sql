-- La boîte à idées : un texte libre par joueur, qu'un modérateur ne lit
-- jamais dans l'app — une fois par jour, ce qui est neuf part par mail à
-- fongue.jeremy@gmail.com. Même mécanique que le push (0009/0010) : la base
-- ne parle pas au monde extérieur elle-même, elle réveille la fonction Edge
-- `ideas` par pg_net, avec le secret qu'elle a tiré elle-même dans le Vault.

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.profiles on delete cascade,
  lang text,
  body text not null check (char_length(body) between 3 and 2000),
  created_at timestamptz not null default now(),
  mailed_at timestamptz
);

create index ideas_unmailed_idx on public.ideas (created_at) where mailed_at is null;

alter table public.ideas enable row level security;
-- Aucune politique : tout passe par les fonctions ci-dessous.

-- Anonyme compris : la boîte à idées n'exige pas de compte nommé.
create function public.submit_idea(p_body text, p_lang text) returns boolean
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
  insert into public.ideas (player_id, lang, body) values (auth.uid(), nullif(p_lang, ''), v_body);
  return true;
end;
$$;

-- Ce que la fonction Edge envoie : les idées neuves, avec de quoi les
-- signer, la plus ancienne d'abord.
create function public.claim_ideas() returns table (id uuid, body text, lang text, author text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.body, i.lang, coalesce(p.display_name, 'Anonyme'), i.created_at
    from public.ideas i
    left join public.profiles p on p.id = i.player_id
   where i.mailed_at is null
   order by i.created_at
   limit 200;
$$;

create function public.finish_ideas(p_ids uuid[]) returns void
language sql security definer set search_path = public as $$
  update public.ideas set mailed_at = now() where id = any(p_ids);
$$;

revoke execute on function public.claim_ideas(), public.finish_ideas(uuid[]) from public, anon, authenticated;
grant execute on function public.claim_ideas(), public.finish_ideas(uuid[]) to service_role;

revoke execute on function public.submit_idea(text, text) from public, anon;
grant execute on function public.submit_idea(text, text) to authenticated;

-- ------------------------------------------------------- réveil quotidien --

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'ideas_secret') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'ideas_secret');
  end if;
end;
$$;

-- Même geste que `push_config` (0010) : la fonction Edge inscrit sa propre
-- adresse à chaque appel, personne n'a de secret à recopier dans le Vault.
create function public.ideas_config(p_url text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'ideas_url';
  if v_id is null then
    perform vault.create_secret(p_url, 'ideas_url');
  elsif (select decrypted_secret from vault.decrypted_secrets where id = v_id) is distinct from p_url then
    perform vault.update_secret(v_id, p_url);
  end if;
  return (select decrypted_secret from vault.decrypted_secrets where name = 'ideas_secret');
end;
$$;

revoke execute on function public.ideas_config(text) from public, anon, authenticated;
grant execute on function public.ideas_config(text) to service_role;

-- Sans secrets ni fonction déployée, la passe ne fait rien : les idées
-- attendent, comme la file du push.
create function public.kick_ideas() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'ideas_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'ideas_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ideas-secret', v_secret),
    body := '{}'::jsonb
  );
exception when others then
  null;
end;
$$;

revoke execute on function public.kick_ideas() from public, anon, authenticated;
grant execute on function public.kick_ideas() to service_role;

select cron.schedule('ideas-digest', '0 7 * * *', 'select public.kick_ideas()');
