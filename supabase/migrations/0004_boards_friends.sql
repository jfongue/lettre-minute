-- Classements par période, classement des découvertes, et amis.
--
-- Le classement ne montre plus que des comptes nommés : un anonyme n'a ni nom
-- à afficher ni moyen d'être retrouvé, il encombrait le haut du tableau sous
-- le même « Anonyme » répété.

create index runs_created_idx on public.runs (created_at);

-- Les journées et les semaines se comptent à l'heure de Paris : un classement
-- du jour qui bascule à 2 heures du matin surprendrait tout le monde.
create function public.period_start(p_period text) returns timestamptz
language sql stable set search_path = public as $$
  select date_trunc(case when p_period = 'week' then 'week' else 'day' end, now() at time zone 'Europe/Paris')
         at time zone 'Europe/Paris';
$$;

-- Trois tableaux : meilleure partie du jour, meilleure partie de la semaine,
-- et mots découverts cette semaine. Un mot est une découverte quand personne
-- ne l'a écrit dans la catégorie pendant les sept jours qui précèdent la
-- partie — jamais écrit, ou oublié depuis une semaine.
create function public.leaderboard_board(p_board text)
returns table (display_name text, avatar jsonb, value integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_board = 'discoveries' then
    return query
      select p.display_name, p.avatar, count(*)::integer
        from public.run_words w
        join public.runs r on r.id = w.run_id
        join public.profiles p on p.id = r.player_id
        join auth.users u on u.id = p.id and not u.is_anonymous
       where r.created_at >= public.period_start('week')
         and not exists (
           select 1
             from public.run_words w2
             join public.runs r2 on r2.id = w2.run_id
            where w2.word = w.word
              and w2.category_id = w.category_id
              and r2.created_at < r.created_at
              and r2.created_at >= r.created_at - interval '7 days'
         )
       group by p.id
       order by 3 desc, p.display_name
       limit 50;
  else
    return query
      select p.display_name, p.avatar, max(r.score)::integer
        from public.runs r
        join public.profiles p on p.id = r.player_id
        join auth.users u on u.id = p.id and not u.is_anonymous
       where r.created_at >= public.period_start(case when p_board = 'week' then 'week' else 'day' end)
       group by p.id
       order by 3 desc, p.display_name
       limit 50;
  end if;
end;
$$;

revoke execute on function public.leaderboard_board(text) from public, anon;
grant execute on function public.leaderboard_board(text) to authenticated;

create or replace view public.leaderboard
with (security_invoker = off) as
  select p.id, p.display_name, p.best_score, p.xp, p.runs, p.avatar
  from public.profiles p
  join auth.users u on u.id = p.id and not u.is_anonymous
  where p.runs > 0
  order by p.best_score desc
  limit 200;

-- ------------------------------------------------------------------ amis --

-- Une ligne par demande : `requester` l'a envoyée, `addressee` l'accepte ou la
-- refuse. Accepter ne crée pas de seconde ligne ; l'amitié se lit dans les
-- deux sens.
create table public.friendships (
  requester uuid not null references public.profiles on delete cascade,
  addressee uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

create index friendships_addressee_idx on public.friendships (addressee);

alter table public.friendships enable row level security;

-- Lecture seule côté client : toute écriture passe par les fonctions
-- ci-dessous, qui vérifient qu'un compte anonyme n'envoie rien et qu'une
-- demande ne s'accepte que par son destinataire.
create policy friendships_read_own on public.friendships for select to authenticated
  using (auth.uid() in (requester, addressee));

create function public.is_named_account() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth.users where id = auth.uid() and not is_anonymous);
$$;

-- Répond par un code que le client traduit : 'sent', 'accepted' (l'autre
-- avait déjà demandé), 'already', 'self', 'unknown', 'anonymous'.
create function public.request_friend(p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_target uuid;
begin
  if not public.is_named_account() then
    return 'anonymous';
  end if;

  select p.id into v_target
    from public.profiles p
    join auth.users u on u.id = p.id and not u.is_anonymous
   where lower(p.display_name) = lower(trim(p_name));

  if v_target is null then
    return 'unknown';
  end if;
  if v_target = auth.uid() then
    return 'self';
  end if;
  if exists (
    select 1 from public.friendships
     where (requester = auth.uid() and addressee = v_target)
        or (requester = v_target and addressee = auth.uid() and status = 'accepted')
  ) then
    return 'already';
  end if;

  -- Deux joueurs qui se demandent l'un l'autre sont amis : faire attendre le
  -- second d'une acceptation qu'il vient lui-même de donner n'aurait pas de sens.
  update public.friendships set status = 'accepted'
   where requester = v_target and addressee = auth.uid();
  if found then
    return 'accepted';
  end if;

  insert into public.friendships (requester, addressee) values (auth.uid(), v_target);
  return 'sent';
end;
$$;

create function public.respond_friend(p_from uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_accept then
    update public.friendships set status = 'accepted'
     where requester = p_from and addressee = auth.uid() and status = 'pending';
  else
    delete from public.friendships
     where requester = p_from and addressee = auth.uid() and status = 'pending';
  end if;
end;
$$;

-- Retire un ami, annule une demande envoyée : les deux effacent la ligne.
create function public.remove_friend(p_other uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.friendships
   where (requester = auth.uid() and addressee = p_other)
      or (requester = p_other and addressee = auth.uid());
end;
$$;

-- Amis et demandes en cours, avec de quoi se comparer : niveau (depuis l'XP),
-- record, et meilleure partie de la semaine.
create function public.my_friends()
returns table (id uuid, display_name text, avatar jsonb, xp integer, best_score integer, week_best integer, relation text)
language sql stable security definer set search_path = public as $$
  select p.id,
         p.display_name,
         p.avatar,
         p.xp,
         p.best_score,
         coalesce((
           select max(r.score) from public.runs r
            where r.player_id = p.id and r.created_at >= public.period_start('week')
         ), 0)::integer,
         case
           when f.status = 'accepted' then 'friend'
           when f.requester = auth.uid() then 'outgoing'
           else 'incoming'
         end
    from public.friendships f
    join public.profiles p
      on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
   where auth.uid() in (f.requester, f.addressee)
   order by p.display_name;
$$;

revoke execute on function
  public.request_friend(text),
  public.respond_friend(uuid, boolean),
  public.remove_friend(uuid),
  public.my_friends()
  from public, anon;
grant execute on function
  public.request_friend(text),
  public.respond_friend(uuid, boolean),
  public.remove_friend(uuid),
  public.my_friends()
  to authenticated;
