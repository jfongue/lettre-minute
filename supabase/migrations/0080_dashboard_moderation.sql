-- Le tableau de bord gagne sa part « modération », langue par langue : la
-- réserve qui reste à verser, les juges de chaque langue (actifs, super
-- modérateurs, et si la langue est encore courte au sens de 0078), les
-- sessions menées au bout, les votes, les mots qui attendent, ceux qui sont
-- entrés — de la réserve ou d'un joueur —, ceux qui sont sortis et ceux qui
-- ont été refusés. `analytics_snapshot` recolle les cinq parties, comme 0077
-- l'avait fait de quatre.
--
-- La langue d'une revue, d'un mot de la réserve, est celle de sa catégorie
-- (`category_lang`, 0019) ; celle d'un modérateur, la file qu'il a ouverte en
-- dernier (`moderators.lang`, 0078). Une session ne disait pas sa langue :
-- elle la prend désormais du modérateur qui la rapporte, et une session plus
-- ancienne se range sous la langue actuelle de son modérateur.
--
-- Toutes les langues du jeu y figurent, même sans juge ni réserve : une langue
-- vide est justement ce que l'écran doit montrer.

alter table public.moderation_sessions add column lang text check (lang ~ '^[a-z]{2}$');

create function public.moderation_session_lang() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.lang is null then
    new.lang := (select m.lang from public.moderators m where m.id = new.player_id);
  end if;
  return new;
end;
$$;

create trigger moderation_sessions_lang before insert on public.moderation_sessions
  for each row execute function public.moderation_session_lang();

create function public.analytics_moderation(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  with
  window_start as (
    select (((now() at time zone 'Europe/Paris')::date - (least(greatest(coalesce(p_days, 30), 1), 180) - 1))::timestamp
             at time zone 'Europe/Paris') as since
  ),
  langs(lang) as (
    select unnest(array['fr', 'en', 'es', 'de', 'it', 'nl', 'pt'])
    union select public.category_lang(category_id) from public.word_reviews
    union select public.category_lang(category_id) from public.moderation_reserve
    union select lang from public.moderators
  ),
  judges as (
    select m.lang,
           count(*) as moderators,
           count(*) filter (where m.super) as supers,
           count(*) filter (where exists (
             select 1 from public.moderation_votes v
              where v.moderator_id = m.id and v.created_at >= (select since from window_start))) as active
      from public.moderators m
     group by m.lang
  ),
  reserve as (
    select public.category_lang(category_id) as lang,
           count(*) filter (where released_at is null) as left_,
           count(*) filter (where released_at >= (select since from window_start)) as released
      from public.moderation_reserve
     group by 1
  ),
  reviews as (
    select public.category_lang(r.category_id) as lang,
           count(*) filter (where r.status = 'pending' and r.kind = 'add') as pending_add,
           count(*) filter (where r.status = 'pending' and r.kind = 'ban') as pending_ban,
           count(*) filter (where r.status = 'accepted' and r.kind = 'add') as added_total,
           count(*) filter (where r.status = 'accepted' and r.kind = 'add' and r.decided_at >= w.since) as added,
           count(*) filter (where r.status = 'accepted' and r.kind = 'add' and r.decided_at >= w.since
                              and exists (select 1 from public.moderation_reserve s
                                           where s.category_id = r.category_id and s.word = r.word)) as added_reserve,
           count(*) filter (where r.status = 'accepted' and r.kind = 'ban') as removed_total,
           count(*) filter (where r.status = 'accepted' and r.kind = 'ban' and r.decided_at >= w.since) as removed,
           count(*) filter (where r.status = 'rejected' and r.decided_at >= w.since) as rejected
      from public.word_reviews r
     cross join window_start w
     group by 1
  ),
  votes as (
    select public.category_lang(r.category_id) as lang, count(*) as votes
      from public.moderation_votes v
      join public.word_reviews r on r.id = v.review_id
     where v.created_at >= (select since from window_start)
     group by 1
  ),
  sessions as (
    select coalesce(s.lang, m.lang, 'fr') as lang,
           count(*) as total,
           count(*) filter (where s.at >= (select since from window_start)) as recent
      from public.moderation_sessions s
      left join public.moderators m on m.id = s.player_id
     group by 1
  )
  select jsonb_build_object('moderation_by_lang', jsonb_build_object(
    'days', least(greatest(coalesce(p_days, 30), 1), 180),
    'langs', coalesce(jsonb_agg(jsonb_build_object(
      'lang', l.lang,
      'moderators', coalesce(j.moderators, 0),
      'supers', coalesce(j.supers, 0),
      'active', coalesce(j.active, 0),
      -- Le seuil de 0078 : sous dix juges, deux « correct » font entrer un mot.
      'thin', coalesce(j.moderators, 0) < 10,
      'reserve_left', coalesce(rs.left_, 0),
      'reserve_released', coalesce(rs.released, 0),
      'pending_add', coalesce(rv.pending_add, 0),
      'pending_ban', coalesce(rv.pending_ban, 0),
      'sessions', coalesce(se.recent, 0),
      'sessions_total', coalesce(se.total, 0),
      'votes', coalesce(vo.votes, 0),
      'added', coalesce(rv.added, 0),
      'added_reserve', coalesce(rv.added_reserve, 0),
      'added_total', coalesce(rv.added_total, 0),
      'removed', coalesce(rv.removed, 0),
      'removed_total', coalesce(rv.removed_total, 0),
      'rejected', coalesce(rv.rejected, 0)
    ) order by coalesce(j.moderators, 0) desc, l.lang), '[]'::jsonb)
  ))
    from langs l
    left join judges j on j.lang = l.lang
    left join reserve rs on rs.lang = l.lang
    left join reviews rv on rv.lang = l.lang
    left join votes vo on vo.lang = l.lang
    left join sessions se on se.lang = l.lang;
$$;

create or replace function public.analytics_snapshot(p_days integer default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.analytics_core(p_days) || public.analytics_extras(p_days)
    || public.analytics_platforms(p_days) || public.analytics_revenue(p_days)
    || public.analytics_moderation(p_days);
$$;

revoke execute on function public.analytics_moderation(integer), public.analytics_snapshot(integer)
  from public, anon, authenticated;
revoke execute on function public.moderation_session_lang() from public, anon, authenticated;
