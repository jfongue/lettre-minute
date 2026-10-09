-- Deux manques comblés.
--
-- 1. La carte de modérateur gagnée en bonus de niveau (`src/domain/bonus.ts`)
--    passait par la raison 'level', que `moderator_offer_due` refuse à qui n'a
--    pas les XP vus par le serveur (0055) — ou qui avait déjà décliné l'offre de
--    niveau. Le bonus est un cadeau que le profil local seul connaît : le
--    serveur ne peut pas le vérifier, il exige donc ce qu'il peut voir — les XP
--    gagnés comme en 0055, au moins ceux du niveau où un bonus peut sortir
--    (`xpForLevel(BONUS_FROM_LEVEL + BONUS_EVERY_LEVELS)` = 3950) —, sans quoi
--    'bonus' rouvrirait la porte que 0055 a fermée. Elle ne fait que cela — modérer,
--    sans parrain — et ne touche pas à `moderator_offers` : décliner ne ferme
--    rien, et la raison ne pèse pas sur les offres de niveau, de mots ou d'ami.
--
-- 2. Le récap du défi du moment ne rendait que le rang final. `ranks` donne mon
--    rang à la fin de chaque jour de Paris où j'ai rendu une partie, sur la
--    meilleure tentative cumulée de chacun jusqu'à ce jour.

create or replace function public.answer_moderator_offer(p_reason text, p_accept boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_invited_by uuid;
begin
  if p_reason = 'bonus' then
    if exists (select 1 from public.moderators m where m.id = auth.uid()) then
      return false;
    end if;
    if p_accept then
      if not public.is_named_account() then
        return false;
      end if;
      if (select coalesce((select sum(r.score) from public.runs r where r.player_id = auth.uid()), 0)
                + 150 * (select count(*) from public.word_submissions s
                          where s.player_id = auth.uid() and s.status = 'accepted')) < 3950 then
        return false;
      end if;
      insert into public.moderators (id, invited_by) values (auth.uid(), null)
      on conflict do nothing;
    end if;
    return true;
  end if;

  if not exists (select 1 from public.moderator_offer_due() d where d.reason = p_reason) then
    return false;
  end if;
  if p_accept and not public.is_named_account() then
    return false;
  end if;

  select o.invited_by into v_invited_by from public.moderator_offers o
   where o.player_id = auth.uid() and o.reason = p_reason;

  insert into public.moderator_offers (player_id, reason, invited_by, answered)
  values (auth.uid(), p_reason, v_invited_by, true)
  on conflict (player_id, reason) do update set answered = true;

  if p_accept then
    insert into public.moderators (id, invited_by) values (auth.uid(), v_invited_by)
    on conflict do nothing;
  end if;
  return true;
end;
$$;

create or replace function public.weekly_recap(p_week_id date, p_lang text) returns jsonb
language sql stable security definer set search_path = public as $$
  with mine as (
    select a.n, a.day, a.value, a.metric, a.finished_at is not null as finished, a.started_at
      from public.weekly_attempts a
     where a.player_id = auth.uid() and a.week_id = p_week_id and a.lang = p_lang
  ),
  fin as (
    select a.player_id, a.day, a.value
      from public.weekly_attempts a
      join auth.users u on u.id = a.player_id and not u.is_anonymous
     where a.week_id = p_week_id and a.lang = p_lang and a.finished_at is not null
       and not exists (select 1 from public.bots b where b.id = a.player_id)
  ),
  best as (
    select f.player_id, max(f.value) as value from fin f group by f.player_id
  ),
  me as (select value from best where player_id = auth.uid()),
  -- À la fin de chacun de mes jours joués : la meilleure tentative de chaque
  -- joueur qui avait rendu une partie ce jour-là ou avant.
  upto as (
    select d.day, f.player_id, max(f.value) as value
      from (select distinct day from fin where player_id = auth.uid()) d
      join fin f on f.day <= d.day
     group by d.day, f.player_id
  ),
  ranks as (
    select u.day,
           (1 + count(*) filter (where u.value > (select m.value from upto m where m.day = u.day and m.player_id = auth.uid())))::integer as rank,
           count(*)::integer as players
      from upto u
     group by u.day
  )
  select jsonb_build_object(
    'attempts', coalesce((select jsonb_agg(jsonb_build_object(
      'n', m.n, 'day', m.day, 'value', m.value, 'metric', m.metric, 'finished', m.finished) order by m.started_at) from mine m), '[]'::jsonb),
    'best', (select value from me),
    'rank', (select 1 + count(*) from best b where b.value > (select value from me)),
    'players', (select count(*) from best),
    'ranks', coalesce((select jsonb_agg(jsonb_build_object('day', r.day, 'rank', r.rank, 'players', r.players) order by r.day) from ranks r), '[]'::jsonb)
  )
$$;
