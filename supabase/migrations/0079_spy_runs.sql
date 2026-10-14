-- « Espionner l'historique » (fonctionnalité `spyHistory`) : un super
-- modérateur lit les parties d'un autre joueur, page par page, avec leur relevé
-- et leurs mots, comme `fetchRunsBefore` lit les siennes. Depuis 0057 les
-- parties d'un compte ne se lisent plus d'un autre : cette fonction est la
-- seule porte, et c'est le rôle qui la garde — la table des fonctionnalités ne
-- refuse rien côté serveur, elle ne fait que montrer le bouton.
--
-- `p_player` est un identifiant de compte (le tableau de bord en a un) ou un
-- nom (la fiche d'un joueur n'a que lui) ; « Anonyme », partagé par tous ceux
-- qui ne se sont pas nommés, ne désigne personne. Null hors super modérateur,
-- ou pour un joueur introuvable.
create function public.spy_runs(p_player text, p_before timestamptz, p_limit integer) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_target uuid;
  v_profile public.profiles;
begin
  if not public.is_super_moderator(auth.uid()) then
    return null;
  end if;

  if p_player ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_target := p_player::uuid;
  else
    select p.id into v_target
      from public.profiles p
     where lower(p.display_name) = lower(trim(p_player))
       and p.display_name <> 'Anonyme';
  end if;

  select * into v_profile from public.profiles where id = v_target;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_profile.id,
    'name', v_profile.display_name,
    'avatar', v_profile.avatar,
    'runs_count', v_profile.runs,
    'best', v_profile.best_score,
    'runs', coalesce((
      select jsonb_agg(to_jsonb(page) order by page.created_at desc)
        from (
          select r.id, r.created_at, r.score, r.best_combo, r.skips, r.record,
                 coalesce((
                   select jsonb_agg(jsonb_build_object('word', w.word, 'category_id', w.category_id, 'points', w.points))
                     from public.run_words w
                    where w.run_id = r.id
                 ), '[]'::jsonb) as run_words
            from public.runs r
           where r.player_id = v_target
             and r.created_at < coalesce(p_before, 'infinity'::timestamptz)
           order by r.created_at desc
           limit least(greatest(coalesce(p_limit, 30), 1), 100)
        ) page
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.spy_runs(text, timestamptz, integer) from public, anon;
grant execute on function public.spy_runs(text, timestamptz, integer) to authenticated;
