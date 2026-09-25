-- Les joueurs maison entrent dans les défis : invités, ils acceptent d'office
-- et jouent entre une et cinq minutes plus tard, de jour comme de nuit.
--
-- Le serveur ne fait que les marquer « joué » à l'heure dite : il n'a pas les
-- dictionnaires. Leurs mots, chaque client les rejoue depuis la graine du défi
-- et l'identifiant du robot (`playBot`, src/domain/bot.ts), comme il rejoue
-- déjà le tirage : tous voient la même partie, sans qu'un client puisse en
-- écrire une à leur place.

create or replace function public.challengeable(p_friend uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_friend <> auth.uid()
     and exists (
       select 1 from public.friendships
        where status = 'accepted'
          and ((requester = auth.uid() and addressee = p_friend)
            or (requester = p_friend and addressee = auth.uid()))
     )
     and exists (select 1 from auth.users where id = p_friend and not is_anonymous);
$$;

alter table public.challenge_players add column bot_play_at timestamptz;

-- Par un déclencheur plutôt que dans `open_challenge` : l'invitation en cours
-- de défi et la revanche y passent aussi. Vu d'office, le robot ne reçoit pas
-- de push d'invitation (`queue_invite`).
create function public.bots_accept_challenge() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.bots where id = new.player_id) then
    new.seen_invite_at := now();
    new.bot_play_at := now() + interval '1 minute' + random() * interval '4 minutes';
  end if;
  return new;
end;
$$;

create trigger challenge_players_bots_accept
  before insert on public.challenge_players
  for each row execute function public.bots_accept_challenge();

-- Sans score ni mots : ce sont ceux que les clients rejouent. Le dernier à
-- jouer clôt le défi, et son bilan part (`queue_recap_on_play`).
create function public.bots_play_challenges() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.challenge_players cp
     set played_at = now()
   where cp.played_at is null
     and cp.bot_play_at <= now()
     and not public.challenge_finished(cp.challenge_id);
end;
$$;

revoke execute on function public.bots_accept_challenge() from public, anon, authenticated;
revoke execute on function public.bots_play_challenges() from public, anon, authenticated;

select cron.schedule('house-bots-challenges', '* * * * *', 'select public.bots_play_challenges()');

-- Le client doit savoir qui rejouer. Identique à 0008, `bot` en plus.
create or replace function public.challenge_detail(p_challenge uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_open boolean;
begin
  if not exists (
    select 1 from public.challenge_players where challenge_id = p_challenge and player_id = auth.uid()
  ) then
    return null;
  end if;
  v_open := public.challenge_finished(p_challenge) or exists (
    select 1 from public.challenge_players
     where challenge_id = p_challenge and player_id = auth.uid() and played_at is not null
  );

  return (
    select jsonb_build_object(
      'id', c.id,
      'owner_name', coalesce(o.display_name, ''),
      'owned', c.owner = auth.uid(),
      'lang', c.lang,
      'seed', c.seed,
      'category_ids', to_jsonb(c.category_ids),
      'created_at', c.created_at,
      'expires_at', public.challenge_expires_at(c.id),
      'finished', public.challenge_finished(c.id),
      'next_id', c.next_id,
      'players', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'id', p.id,
                 'name', p.display_name,
                 'avatar', p.avatar,
                 'me', p.id = auth.uid(),
                 'bot', exists (select 1 from public.bots b where b.id = p.id),
                 'played_at', cp.played_at,
                 'score', cp.score,
                 'skips', cp.skips,
                 'best_combo', cp.best_combo,
                 'words', case
                   when cp.words is null then '[]'::jsonb
                   when v_open or p.id = auth.uid() then cp.words
                   else (select coalesce(jsonb_agg(jsonb_build_object('at', w -> 'at', 'points', w -> 'points')), '[]'::jsonb)
                           from jsonb_array_elements(cp.words) w)
                 end
               ) order by cp.played_at nulls last, cp.invited_at), '[]'::jsonb)
          from public.challenge_players cp
          join public.profiles p on p.id = cp.player_id
         where cp.challenge_id = c.id
      )
    )
    from public.challenges c
    left join public.profiles o on o.id = c.owner
   where c.id = p_challenge
  );
end;
$$;
