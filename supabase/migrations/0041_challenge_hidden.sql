-- Un défi écarté l'est pour son joueur, sur tous ses appareils : le masquage
-- vit donc dans sa ligne de `challenge_players`, et non dans le stockage d'un
-- appareil, où il ne suivait pas d'un téléphone à la version web.
--
-- L'empreinte dit à quoi le défi ressemblait quand il a été écarté : un invité
-- qui joue, la clôture, une revanche la font changer, et le défi revient de
-- lui-même dans la liste.

alter table public.challenge_players
  add column hidden_stamp text check (hidden_stamp is null or length(hidden_stamp) <= 120);

-- Un `p_stamp` nul remet le défi dans la liste.
create function public.mark_challenge_hidden(p_challenge uuid, p_stamp text) returns void
language sql security definer set search_path = public as $$
  update public.challenge_players
     set hidden_stamp = p_stamp
   where challenge_id = p_challenge and player_id = auth.uid();
$$;

-- Identique à 0017, `hidden_stamp` en plus : une colonne de sortie ne s'ajoute
-- qu'en recréant la fonction.
drop function public.my_challenges();
create function public.my_challenges()
returns table (
  id uuid, owner_name text, owned boolean, lang text, category_ids text[], created_at timestamptz,
  players integer, played integer, me_played boolean, my_score integer, finished boolean,
  expires_at timestamptz, seen_invite boolean, seen_recap boolean, next_id uuid, name text,
  hidden_stamp text
)
language sql stable security definer set search_path = public as $$
  select c.id,
         coalesce(o.display_name, ''),
         c.owner = auth.uid(),
         c.lang,
         c.category_ids,
         c.created_at,
         (select count(*) from public.challenge_players a where a.challenge_id = c.id)::integer,
         (select count(*) from public.challenge_players a where a.challenge_id = c.id and a.played_at is not null)::integer,
         me.played_at is not null,
         me.score,
         public.challenge_finished(c.id),
         public.challenge_expires_at(c.id),
         me.seen_invite_at is not null,
         me.seen_recap_at is not null,
         c.next_id,
         c.name,
         me.hidden_stamp
    from public.challenge_players me
    join public.challenges c on c.id = me.challenge_id
    left join public.profiles o on o.id = c.owner
   where me.player_id = auth.uid()
     and (not public.challenge_finished(c.id) or public.challenge_expires_at(c.id) > now() - interval '3 days')
   order by c.created_at desc
   limit 30;
$$;

revoke execute on function
  public.mark_challenge_hidden(uuid, text),
  public.my_challenges()
  from public, anon;
grant execute on function
  public.mark_challenge_hidden(uuid, text),
  public.my_challenges()
  to authenticated;
