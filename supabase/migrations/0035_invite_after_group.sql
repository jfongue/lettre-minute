-- Le mail d'invitation après le groupe des testeurs.
--
-- Un invité qui passe par Google Groups depuis le mail n'y revient pas : le
-- bouton retour le rend à sa messagerie, pas à la page d'invitation. Le mail
-- attend donc que `npm run group:invites` ait mis l'adresse dans le groupe
-- (`listed_at`, qui relance l'envoi), et sa page saute l'étape du groupe.
-- Poste du développeur éteint, il part au bout d'une heure avec les trois
-- étapes.
create or replace function public.invite_tester(p_email text, p_lang text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_owner uuid;
begin
  if not public.is_named_account() then
    return 'anonymous';
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then
    return 'invalid';
  end if;
  if exists (select 1 from public.tester_invites where email = v_email) then
    return 'already';
  end if;
  if (select count(*) from public.tester_invites
       where invited_by = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    return 'limit';
  end if;

  select u.id into v_owner from auth.users u
    join public.profiles p on p.id = u.id
   where lower(u.email) = v_email and not u.is_anonymous;

  if v_owner = auth.uid() then
    return 'invalid';
  end if;

  if v_owner is not null then
    -- Marquée envoyée : la fonction Edge ne la verra jamais.
    insert into public.tester_invites (email, invited_by, lang, mailed_at, joined_by, joined_at)
    values (v_email, auth.uid(), nullif(p_lang, ''), now(), v_owner, now());
    if not exists (
      select 1 from public.blocks
       where (blocker = v_owner and blocked = auth.uid()) or (blocker = auth.uid() and blocked = v_owner)
    ) and not exists (
      select 1 from public.friendships
       where (requester = auth.uid() and addressee = v_owner) or (requester = v_owner and addressee = auth.uid())
    ) then
      insert into public.friendships (requester, addressee) values (auth.uid(), v_owner);
    end if;
    return 'sent';
  end if;

  insert into public.tester_invites (email, invited_by, lang) values (v_email, auth.uid(), nullif(p_lang, ''));
  -- Le bouton du mail porte aussi le code : l'invité qui s'inscrit sous une
  -- autre adresse retrouve quand même l'inviteur. Le mail, lui, attend que
  -- l'adresse soit dans le groupe des testeurs (claim_invites).
  perform public.my_invite_code();
  return 'sent';
end;
$$;

drop function public.claim_invites();

create function public.claim_invites() returns table (
  id uuid, email text, lang text, inviter_name text, inviter_email text, inviter_code text, listed boolean
)
language sql security definer set search_path = public as $$
  update public.tester_invites i set attempts = i.attempts + 1
    from public.profiles p, auth.users u
   where i.mailed_at is null and i.attempts < 3 and i.created_at > now() - interval '7 days'
     and (i.listed_at is not null or i.created_at < now() - interval '1 hour')
     and p.id = i.invited_by and u.id = i.invited_by
  returning i.id, i.email, i.lang, p.display_name, u.email,
    (select l.code from public.invite_links l where l.inviter = i.invited_by),
    i.listed_at is not null;
$$;

revoke execute on function public.claim_invites() from public, anon, authenticated;
grant execute on function public.claim_invites() to service_role;

-- Tous les quarts d'heure plutôt qu'à chaque heure : c'est lui qui envoie le
-- mail d'une adresse que le groupe n'a pas prise.
select cron.unschedule('invites-retry');
select cron.schedule('invites-retry', '*/15 * * * *', 'select public.kick_invites()');
