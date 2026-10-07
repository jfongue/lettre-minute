-- Le duel prévient ses invités comme le défi : une notification quand on vous
-- assoit à une table, retirée dès que la table n'attend plus personne — fermée,
-- lancée, ou votre invitation répondue.
--
-- `push_outbox` ne connaissait que les défis, son `challenge_id` pendant à
-- `challenges` : la colonne devient facultative, la table gagne `table_id`, et
-- les deux genres du duel entrent dans le même filet. Une ligne ne vise qu'une
-- chose, jamais les deux.
--
-- Le retrait n'existe pas dans FCM : on ne reprend pas un message affiché. La
-- fonction Edge envoie donc, pour un `duel_cancel`, un message muet qui porte
-- le même `tag` — le service Android de l'app le traduit en annulation
-- (`DuelMessagingService`), et l'app retire de même, à son réveil, ce qu'aucun
-- message n'a pu rattraper.
alter table public.push_outbox alter column challenge_id drop not null;
alter table public.push_outbox add column table_id uuid references public.duel_tables on delete cascade;
alter table public.push_outbox drop constraint push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check
check (kind in ('invite', 'recap', 'duel', 'duel_cancel'));
alter table public.push_outbox add constraint push_outbox_target_check
check ((challenge_id is null) <> (table_id is null));

-- Ce qu'une invitation est devenue : `queued_at` dit qu'une notification a pu
-- partir — donc qu'il peut y avoir quelque chose à retirer —, `cancelled_at`
-- que le retrait est déjà dans la file.
alter table public.duel_invites add column queued_at timestamptz;
alter table public.duel_invites add column cancelled_at timestamptz;

-- Une invitation posée, ou reposée après un refus : sa notification part. Le
-- second cas vient de `duel_invite`, qui rouvre la ligne existante plutôt que
-- d'en écrire une seconde.
create function public.queue_duel_invite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
if new.answered_at is null and (tg_op = 'INSERT' or old.answered_at is not null) then
update public.duel_invites set queued_at = now(), cancelled_at = null
where table_id = new.table_id and invitee = new.invitee;
insert into public.push_outbox (player_id, kind, table_id)
values (new.invitee, 'duel', new.table_id);
end if;
return null;
end;
$$;

create trigger duel_invites_push
after insert or update on public.duel_invites
for each row execute function public.queue_duel_invite();

-- Les invitations que plus personne n'attend : réponse donnée, table sortie du
-- salon — lancée, fermée, ou vieille d'un quart d'heure. La notification est
-- retirée une fois, et l'invitation marquée pour ne pas la retirer deux fois.
create function public.queue_duel_cancels() returns void
language plpgsql security definer set search_path = public as $$
begin
with stale as (
select i.table_id, i.invitee
from public.duel_invites i
join public.duel_tables t on t.id = i.table_id
where i.queued_at is not null and i.cancelled_at is null
and (i.answered_at is not null or not public.duel_lobby_open(t))
for update of i skip locked
), marked as (
update public.duel_invites i set cancelled_at = now()
from stale s
where i.table_id = s.table_id and i.invitee = s.invitee
returning i.table_id, i.invitee
)
insert into public.push_outbox (player_id, kind, table_id)
select invitee, 'duel_cancel', table_id from marked;
end;
$$;

-- L'hôte retire une invitation en suspens : la ligne s'en va, donc le balayage
-- ne la verra jamais — son retrait part d'ici, avant la suppression.
create or replace function public.duel_kick(p_table uuid, p_player uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
v_table public.duel_tables;
begin
select * into v_table from public.duel_tables where id = p_table for update;
if not found or v_table.host <> auth.uid() or p_player = auth.uid() then
return 'forbidden';
end if;
if v_table.status <> 'lobby' then
return 'closed';
end if;
update public.duel_seats set kicked_at = now(), ready = false
where table_id = p_table and player = p_player and kicked_at is null;
insert into public.push_outbox (player_id, kind, table_id)
select i.invitee, 'duel_cancel', i.table_id
from public.duel_invites i
where i.table_id = p_table and i.invitee = p_player and i.queued_at is not null and i.cancelled_at is null;
delete from public.duel_invites where table_id = p_table and invitee = p_player;
-- Ceux qui restent se redéclarent prêts : la table a changé sous eux.
update public.duel_seats set ready = false
where table_id = p_table and not is_bot and left_at is null and kicked_at is null;
return 'kicked';
end;
$$;

-- La passe de secours : bilans échus par l'horloge, invitations de duel
-- éteintes, réveils perdus.
create or replace function public.push_tick() returns void
language plpgsql security definer set search_path = public as $$
begin
perform public.queue_recaps();
perform public.queue_duel_cancels();
perform public.kick_push();
end;
$$;

-- Ce que la fonction Edge envoie : une ligne par message et par appareil. Une
-- ligne de duel tire son texte de l'hôte de la table, une ligne de défi du
-- chef du défi ; `table_id` dit à la fonction Edge lequel des deux elle tient.
drop function public.claim_push_batch(integer);
create function public.claim_push_batch(p_limit integer default 200)
returns table (id bigint, kind text, challenge_id uuid, table_id uuid, token text, lang text, owner_name text, players integer)
language plpgsql security definer set search_path = public as $$
begin
return query
with claimed as (
update public.push_outbox o
set claimed_at = now(), attempts = o.attempts + 1
where o.id in (
select q.id from public.push_outbox q
where q.sent_at is null
and q.attempts < 5
and (q.claimed_at is null or q.claimed_at < now() - interval '2 minutes')
order by q.id
limit p_limit
for update skip locked
)
returning o.id, o.kind, o.challenge_id, o.table_id, o.player_id
)
select c.id, c.kind, c.challenge_id, c.table_id, t.token, coalesce(t.lang, 'fr'),
coalesce(host.display_name, owner.display_name, ''),
case when c.table_id is null
then (select count(*) from public.challenge_players a where a.challenge_id = c.challenge_id)::integer
else public.duel_active_seats(c.table_id)
end
from claimed c
left join public.challenges ch on ch.id = c.challenge_id
left join public.profiles owner on owner.id = ch.owner
left join public.duel_tables dt on dt.id = c.table_id
left join public.profiles host on host.id = dt.host
left join public.push_tokens t on t.player_id = c.player_id;
end;
$$;

revoke execute on function
public.queue_duel_invite(),
public.queue_duel_cancels()
from public, anon, authenticated;
grant execute on function public.claim_push_batch(integer) to service_role;
