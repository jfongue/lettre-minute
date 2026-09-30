-- Le tableau de bord s'ouvre sur le détail : toucher une barre d'activité
-- nomme les joueurs qu'elle compte (`admin_slot`), et le relevé gagne les
-- invitations — envoyées, partagées, converties, et leurs meilleurs
-- inviteurs — et les couples lettre + catégorie que l'on passe le plus.
--
-- Un lien partagé ne laissait aucune trace de qui il amenait : l'amitié
-- qu'il crée ressemble à toutes les autres. `invite_accepts` le retient
-- désormais, à partir de cette migration seulement.

create table public.invite_accepts (
  invitee uuid primary key references public.profiles on delete cascade,
  inviter uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

alter table public.invite_accepts enable row level security;
-- Aucune politique : seul le relevé de l'administrateur la lit.

create or replace function public.accept_invite(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_inviter uuid;
begin
  if not public.is_named_account() then
    return null;
  end if;
  select inviter into v_inviter from public.invite_links where code = p_code;
  if v_inviter is null or v_inviter = auth.uid() then
    return null;
  end if;
  if exists (
    select 1 from public.blocks
     where (blocker = v_inviter and blocked = auth.uid()) or (blocker = auth.uid() and blocked = v_inviter)
  ) then
    return null;
  end if;
  delete from public.friendships where requester = auth.uid() and addressee = v_inviter;
  insert into public.friendships (requester, addressee, status)
  values (v_inviter, auth.uid(), 'accepted')
  on conflict (requester, addressee) do update set status = 'accepted';
  insert into public.invite_accepts (invitee, inviter) values (auth.uid(), v_inviter)
  on conflict do nothing;
  return (select display_name from public.profiles where id = v_inviter);
end;
$$;

-- ------------------------------------------------------------ le relevé --

-- Le relevé de 0031 garde son corps sous un autre nom ; `analytics_snapshot`
-- y ajoute les sections de cette migration, pour que l'app et
-- `npm run analytics` lisent toujours un seul document.
alter function public.analytics_snapshot(integer) rename to analytics_core;

create function public.analytics_extras(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 180);
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_from date := v_today - (v_days - 1);
  v_since timestamptz := (v_from::timestamp at time zone 'Europe/Paris');
  v_result jsonb;
begin
  with
  staff as (
    select id from public.admins
  ),
  staff_devices as (
    select distinct device from public.events where player_id in (select id from staff)
  ),
  -- Une adresse qui jouait déjà reçoit une demande d'ami, pas un mail : elle
  -- se reconnaît à `joined_at`, posé dans la même transaction que la ligne.
  mails as (
    select i.*, i.joined_by is not null and i.joined_at = i.created_at as known
      from public.tester_invites i
     where i.invited_by is not null and not exists (select 1 from staff where staff.id = i.invited_by)
  ),
  mail_joins as (
    select invited_by as inviter, joined_by as invitee, joined_at as at
      from mails where joined_by is not null and not known
  ),
  link_joins as (
    select inviter, invitee, created_at as at
      from public.invite_accepts a
     where a.inviter is not null and not exists (select 1 from staff where staff.id = a.inviter)
  ),
  joins as (
    select 'mail' as via, * from mail_joins
    union all
    select 'link', * from link_joins
  ),
  shares as (
    select e.player_id, e.device, e.created_at
      from public.events e
     where e.kind = 'tap' and e.props ->> 'label' like 'invite-%'
       and not exists (select 1 from staff where staff.id = e.player_id)
       and not exists (select 1 from staff_devices d where d.device = e.device)
  ),
  days as (
    select generate_series(v_from, v_today, interval '1 day')::date as day
  ),
  pairs as (
    select s.*, sum(s.dealt) over (partition by s.lang) as lang_dealt
      from public.prompt_stats s where s.dealt > 0
  )
  select jsonb_build_object(
    'invites', jsonb_build_object(
      'mails', (select count(*) from mails where created_at >= v_since and not known),
      'mails_to_players', (select count(*) from mails where created_at >= v_since and known),
      'mail_joins', (select count(*) from mails where created_at >= v_since and not known and joined_by is not null),
      'shares', (select count(*) from shares where created_at >= v_since),
      'sharers', (select count(distinct device) from shares where created_at >= v_since),
      'link_joins', (select count(*) from link_joins where at >= v_since),
      'played', (select count(*) from joins j join public.profiles p on p.id = j.invitee where j.at >= v_since and p.runs > 0),
      'links_since', (select min(created_at) from public.invite_accepts),
      'daily', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'day', d.day,
          'mails', (select count(*) from mails m where not m.known and (m.created_at at time zone 'Europe/Paris')::date = d.day),
          'shares', (select count(*) from shares s where (s.created_at at time zone 'Europe/Paris')::date = d.day),
          'joins', (select count(*) from joins j where (j.at at time zone 'Europe/Paris')::date = d.day)
        ) order by d.day), '[]'::jsonb)
        from days d
      ),
      -- Depuis toujours : sur une période, trop peu d'inviteurs pour un classement.
      'top', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', name, 'anonymous', anonymous, 'mails', mails, 'shares', shares,
          'joins', joins, 'played', played) order by joins desc, played desc, mails + shares desc), '[]'::jsonb)
          from (
            select * from (
              select coalesce(nullif(p.display_name, 'Anonyme'), 'Anonyme ' || left(p.id::text, 4)) as name,
                     u.is_anonymous as anonymous,
                     (select count(*) from mails m where m.invited_by = p.id and not m.known) as mails,
                     (select count(*) from shares s where s.player_id = p.id) as shares,
                     (select count(*) from joins j where j.inviter = p.id) as joins,
                     (select count(*) from joins j join public.profiles q on q.id = j.invitee where j.inviter = p.id and q.runs > 0) as played
                from public.profiles p
                join auth.users u on u.id = p.id
               where not exists (select 1 from staff where staff.id = p.id)
                 and not exists (select 1 from public.bots b where b.id = p.id)
                 and (exists (select 1 from mails m where m.invited_by = p.id)
                      or exists (select 1 from shares s where s.player_id = p.id)
                      or exists (select 1 from joins j where j.inviter = p.id))
            ) i
            order by joins desc, played desc, mails + shares desc
            limit 20
          ) t
      )
    ),

    -- Les compteurs du tirage (0022) : depuis toujours, toutes parties seules
    -- confondues, administrateur compris — ils ne savent pas qui a joué.
    'prompts', jsonb_build_object(
      'langs', (
        select coalesce(jsonb_agg(jsonb_build_object('lang', lang, 'dealt', dealt, 'passed', passed, 'pairs', pairs) order by dealt desc), '[]'::jsonb)
          from (select lang, sum(dealt) as dealt, sum(passed) as passed, count(*) as pairs from pairs group by lang) l
      ),
      'most_passed', (
        select coalesce(jsonb_agg(row order by passed desc, dealt desc), '[]'::jsonb)
          from (
            select jsonb_build_object('lang', lang, 'category', category_id, 'letter', letter, 'dealt', dealt,
                     'passed', passed, 'words', words, 'points', points, 'lang_dealt', lang_dealt) as row, passed, dealt
              from pairs order by passed desc, dealt desc limit 60
          ) m
      ),
      -- Au moins dix tirages : en dessous, un taux de passe ne dit rien.
      'worst_rate', (
        select coalesce(jsonb_agg(row order by rate desc, dealt desc), '[]'::jsonb)
          from (
            select jsonb_build_object('lang', lang, 'category', category_id, 'letter', letter, 'dealt', dealt,
                     'passed', passed, 'words', words, 'points', points, 'lang_dealt', lang_dealt) as row,
                   passed::numeric / dealt as rate, dealt
              from pairs where dealt >= 10 order by 2 desc, dealt desc limit 60
          ) w
      )
    )
  ) into v_result;
  return v_result;
end;
$$;

create function public.analytics_snapshot(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.analytics_core(p_days) || public.analytics_extras(p_days);
$$;

-- --------------------------------------------------- le détail d'une barre --

-- Qui une barre d'activité compte : les joueurs d'un jour, ou d'une heure
-- (heure de Paris), avec leur profil et ce qu'ils y ont fait. Mêmes
-- exclusions que le relevé ; un appareil sans compte se nomme par l'appareil.
create function public.analytics_slot(p_day date, p_hour integer default null) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_start timestamptz := (case when p_hour is null then p_day::timestamp
                               else p_day::timestamp + make_interval(hours => p_hour) end) at time zone 'Europe/Paris';
  v_end timestamptz := v_start + case when p_hour is null then interval '1 day' else interval '1 hour' end;
  v_result jsonb;
begin
  with
  staff as (
    select id from public.admins
  ),
  staff_devices as (
    select distinct device from public.events where player_id in (select id from staff)
  ),
  -- Une session commencée la veille compte le jour où elle commence, comme
  -- dans le relevé : ses événements se lisent donc un jour plus tôt.
  ev as (
    select * from public.events e
     where e.created_at >= v_start - interval '1 day' and e.created_at < v_end
       and not exists (select 1 from staff where staff.id = e.player_id)
       and not exists (select 1 from staff_devices d where d.device = e.device)
  ),
  sessions as (
    select session,
           (array_agg(player_id) filter (where player_id is not null))[1] as player_id,
           min(device) as device,
           min(created_at) as started,
           bool_or(kind = 'run_start') as played
      from ev group by session
  ),
  slot_sessions as (
    select * from sessions where started >= v_start and started < v_end
  ),
  slot_runs as (
    select r.player_id, count(*) as n, max(r.score) as best, sum(r.words) as words
      from public.runs r
     where r.created_at >= v_start and r.created_at < v_end
       and not exists (select 1 from public.bots b where b.id = r.player_id)
       and not exists (select 1 from staff where staff.id = r.player_id)
     group by r.player_id
  ),
  slot_mails as (
    select invited_by as player_id, count(*) as n from public.tester_invites
     where created_at >= v_start and created_at < v_end and invited_by is not null
       and not (joined_by is not null and joined_at = created_at)
     group by 1
  ),
  slot_shares as (
    select player_id, count(*) as n from ev
     where kind = 'tap' and props ->> 'label' like 'invite-%' and player_id is not null
       and created_at >= v_start
     group by 1
  ),
  slot_invited as (
    select joined_by as player_id, invited_by as inviter from public.tester_invites
     where joined_at >= v_start and joined_at < v_end and joined_at <> created_at
    union
    select invitee, inviter from public.invite_accepts where created_at >= v_start and created_at < v_end
  ),
  ids as (
    select player_id as id from slot_runs
    union select player_id from ev where player_id is not null and created_at >= v_start
    union select player_id from slot_sessions where player_id is not null
    union select u.id from auth.users u where u.created_at >= v_start and u.created_at < v_end
    union select u.id from auth.users u
           where not u.is_anonymous and coalesce(u.email_confirmed_at, u.created_at) >= v_start
             and coalesce(u.email_confirmed_at, u.created_at) < v_end
    union select player_id from slot_mails
    union select player_id from slot_shares
    union select player_id from slot_invited
  ),
  last_seen as (
    select distinct on (player_id) player_id, lang, platform, version
      from public.events where player_id in (select id from ids) and kind = 'open'
     order by player_id, created_at desc
  ),
  people as (
    select jsonb_build_object(
             'key', u.id,
             'name', coalesce(nullif(p.display_name, 'Anonyme'), 'Anonyme ' || left(u.id::text, 4)),
             'anonymous', u.is_anonymous,
             'avatar', p.avatar,
             'xp', coalesce(p.xp, 0),
             'total_runs', coalesce(p.runs, 0),
             'total_best', coalesce(p.best_score, 0),
             'words_found', coalesce(p.words_found, 0),
             'created_at', u.created_at,
             'named_at', case when not u.is_anonymous then coalesce(u.email_confirmed_at, u.created_at) end,
             'moderator', exists (select 1 from public.moderators m where m.id = u.id),
             'friends', (select count(*) from public.friendships f
                          where f.status = 'accepted' and (f.requester = u.id or f.addressee = u.id)),
             'lang', ls.lang, 'platform', ls.platform, 'version', ls.version,
             'runs', coalesce(sr.n, 0), 'best', sr.best, 'words', coalesce(sr.words, 0),
             'active', sr.n is not null or exists (select 1 from ev e where e.player_id = u.id and e.created_at >= v_start),
             'arrived', u.created_at >= v_start and u.created_at < v_end,
             'signed', not u.is_anonymous and coalesce(u.email_confirmed_at, u.created_at) >= v_start
                       and coalesce(u.email_confirmed_at, u.created_at) < v_end,
             'sessions_with_run', (select count(*) from slot_sessions s where s.player_id = u.id and s.played),
             'sessions_without_run', (select count(*) from slot_sessions s where s.player_id = u.id and not s.played),
             'mails', coalesce(sm.n, 0), 'shares', coalesce(ss.n, 0),
             'invited_by', (select coalesce(nullif(q.display_name, 'Anonyme'), 'Anonyme ' || left(q.id::text, 4))
                              from slot_invited i join public.profiles q on q.id = i.inviter
                             where i.player_id = u.id limit 1)
           ) as row,
           coalesce(sr.n, 0) as sort
      from ids
      join auth.users u on u.id = ids.id
      left join public.profiles p on p.id = u.id
      left join slot_runs sr on sr.player_id = u.id
      left join slot_mails sm on sm.player_id = u.id
      left join slot_shares ss on ss.player_id = u.id
      left join last_seen ls on ls.player_id = u.id
     where not exists (select 1 from public.bots b where b.id = u.id)
       and not exists (select 1 from staff where staff.id = u.id)
  ),
  devices as (
    select jsonb_build_object(
             'key', 'device:' || device,
             'name', 'Appareil ' || left(device, 4),
             'device', true,
             'sessions_with_run', count(*) filter (where played),
             'sessions_without_run', count(*) filter (where not played)
           ) as row
      from slot_sessions where player_id is null group by device
  )
  select coalesce(jsonb_agg(row order by sort desc, row ->> 'name'), '[]'::jsonb)
         || (select coalesce(jsonb_agg(row), '[]'::jsonb) from devices)
    into v_result
    from people;
  return v_result;
end;
$$;

create function public.admin_slot(p_day date, p_hour integer default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then public.analytics_slot(p_day, p_hour) end;
$$;

revoke execute on function public.analytics_core(integer), public.analytics_extras(integer),
  public.analytics_snapshot(integer), public.analytics_slot(date, integer) from public, anon, authenticated;
revoke execute on function public.admin_slot(date, integer) from public, anon;
grant execute on function public.admin_slot(date, integer) to authenticated;
