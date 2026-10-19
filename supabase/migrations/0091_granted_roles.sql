-- Ce qu'un super modérateur donne ou reprend depuis la page d'espionnage d'un
-- joueur : Premium offert, et le rôle de modérateur. Jamais le rôle de super
-- modérateur, qui reste donné à la main (0047).
--
-- ------------------------------------------------------------ Premium offert
--
-- Un Premium offert n'est pas un achat : il vit dans sa propre table plutôt
-- que dans `purchases` (0063), que lisent le revenu du tableau de bord (0077)
-- et la vérification de Google (`premium-verify`) — un cadeau y passerait pour
-- un abonné payant. `my_premium` ne change pas non plus : un client qui le lit
-- inscrit `plusSince`, que rien ne reprend ensuite et que la sauvegarde cloud
-- (0032) recopie sur chaque appareil. Le client récent lit plutôt
-- `my_premium_origin`, qui dit d'où vient le Premium du compte, et garde un
-- Premium offert à part (`plusOffered`) : c'est ce qui permet de le reprendre
-- sans toucher à un achat. Un client plus ancien ne voit pas le cadeau.

create table public.premium_grants (
  account uuid primary key references public.profiles on delete cascade,
  granted_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

alter table public.premium_grants enable row level security;
-- Aucune politique : tout passe par les fonctions ci-dessous.

-- 'purchase' quand un achat compte (il l'emporte sur un cadeau), 'grant' pour
-- un Premium offert seul, null sinon.
create function public.my_premium_origin() returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.purchases
                  where account = auth.uid() and product = 'premium_lifetime' and state <> 'refused') then 'purchase'
    when exists (select 1 from public.premium_grants where account = auth.uid()) then 'grant'
  end;
$$;

-- Offrir ou reprendre. Reprendre ne touche jamais un achat : le joueur qui a
-- payé garde son Premium, et la page grise le bouton dans ce cas.
create function public.grant_premium(p_player uuid, p_on boolean) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_moderator(auth.uid()) then
    return 'forbidden';
  end if;
  if p_player is null or p_on is null or not exists (select 1 from public.profiles where id = p_player) then
    return 'missing';
  end if;
  if p_on then
    insert into public.premium_grants (account, granted_by) values (p_player, auth.uid())
    on conflict (account) do nothing;
  else
    delete from public.premium_grants where account = p_player;
  end if;
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------- modérateur
--
-- Nommer un modérateur l'inscrit comme l'aurait fait une offre acceptée, son
-- nommeur à la place de l'ami qui l'invite. Un compte anonyme ne modère pas :
-- `answer_moderator_offer` le refuse aussi.
--
-- Retirer un modérateur ne retire que la ligne : ses votes restent. Ils
-- référencent son profil, pas `moderators` (0007), et une revue déjà réglée
-- ne se rejoue pas ; sur une revue encore en attente, sa voix a été donnée
-- quand il modérait et compte toujours — l'effacer changerait après coup le
-- seuil que les autres ont vu, et pourrait rouvrir un mot que sa voix avait
-- réglé. Ses offres de modérer sont closes en même temps, comme refusées : sans
-- quoi `moderator_offer_due` (0082) lui reproposerait le rôle à la lecture
-- suivante. Un super modérateur ne se retire pas d'ici.

create function public.set_moderator(p_player uuid, p_on boolean) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_moderator(auth.uid()) then
    return 'forbidden';
  end if;
  if p_player is null or p_on is null or not exists (select 1 from public.profiles where id = p_player) then
    return 'missing';
  end if;
  if p_on then
    if exists (select 1 from auth.users u where u.id = p_player and u.is_anonymous) then
      return 'anonymous';
    end if;
    insert into public.moderators (id, invited_by) values (p_player, auth.uid())
    on conflict (id) do nothing;
    update public.moderator_offers set answered = true where player_id = p_player;
  else
    if public.is_super_moderator(p_player) then
      return 'super';
    end if;
    delete from public.moderators where id = p_player;
    insert into public.moderator_offers (player_id, reason, answered)
    select p_player, reason, true from unnest(array['level', 'words', 'friend']) as reason
    on conflict (player_id, reason) do update set answered = true;
  end if;
  return 'ok';
end;
$$;

revoke execute on function public.my_premium_origin(), public.grant_premium(uuid, boolean), public.set_moderator(uuid, boolean)
  from public, anon;
grant execute on function public.my_premium_origin(), public.grant_premium(uuid, boolean), public.set_moderator(uuid, boolean)
  to authenticated;
