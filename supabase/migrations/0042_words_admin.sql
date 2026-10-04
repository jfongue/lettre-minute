-- Le tableau des mots : cinq tapes sur « Mes catégories » l'ouvrent, comme
-- cinq tapes sur « Classements » ouvrent le tableau de bord (0030). Il dit ce
-- que le dictionnaire vivant est devenu — ce que le tirage donnait à chaque
-- couple lettre + catégorie, ce que les joueurs en ont fait, ce que la
-- modération y a ajouté ou retiré — et rien d'autre : les dictionnaires
-- embarqués, eux, ne sont pas en base, c'est l'écran qui les confronte à ces
-- compteurs.
--
-- Deux mesures manquaient au serveur : un mot écrit de travers était accepté
-- (`approximate`, payé au tarif plat) sans que rien ne le retienne, et les
-- mots retirés n'avaient pas d'historique. La colonne s'ajoute aux mots de la
-- partie, qui sont la seule trace de ce qui a été écrit.

alter table public.run_words add column approximate boolean not null default false;

-- ------------------------------------------------------------- les compteurs --

-- Le nom d'un mot et celui de sa catégorie portent leur langue dans le serveur
-- (`de:katze`, le français restant nu). Cette découpe rend le préfixe, et
-- `null` quand la valeur appartient à une autre langue.
create function public.words_unscoped(p_lang text, p_value text) returns text
language sql immutable set search_path = public as $$
  select case
    when p_lang = 'fr' then case when position(':' in p_value) = 0 then p_value end
    else case when p_value like p_lang || ':%' then substring(p_value from length(p_lang) + 2) end
  end;
$$;

-- La même découpe, mais pour un mot : un signalement de retrait nomme le mot
-- sous sa forme nue (`banned-words.ts` l'attend ainsi) là où une catégorie
-- porte toujours son préfixe.
create function public.words_bare(p_lang text, p_value text) returns text
language sql immutable set search_path = public as $$
  select case
    when p_lang = 'fr' then p_value
    when p_value like p_lang || ':%' then substring(p_value from length(p_lang) + 2)
    else p_value
  end;
$$;

-- Tout ce que l'écran des mots affiche pour une langue, et pour une catégorie
-- quand il en choisit une : les couples du tirage, l'usage de chaque mot, ce
-- que la modération a ajouté, retiré, ou garde sous le coude.
create function public.admin_words(p_lang text, p_category text default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_lang text := lower(trim(coalesce(p_lang, 'fr')));
  v_category text := nullif(trim(coalesce(p_category, '')), '');
  v_runs integer;
  v_lang_runs integer;
  v_dealt integer;
begin
  if not public.is_admin() then
    return null;
  end if;
  if v_lang !~ '^[a-z]{2}$' or length(v_lang) <> 2 then
    return null;
  end if;

  select count(*)::integer into v_runs from public.runs;

  -- Les parties de cette langue : celles où au moins un mot a été écrit. Une
  -- partie sans mot ne se range sous aucune langue, `runs` n'en portant pas.
  select count(distinct w.run_id)::integer into v_lang_runs
    from public.run_words w
   where public.words_unscoped(v_lang, w.category_id) is not null;

  -- Tous les tirages de la langue, filtre ou pas : c'est à eux que se compare
  -- l'apparition d'un couple.
  select coalesce(sum(s.dealt), 0)::integer into v_dealt
    from public.prompt_stats s
   where s.lang = v_lang;

  return jsonb_build_object(
    'generated_at', now(),
    'lang', v_lang,
    'category', v_category,
    'runs', v_runs,
    'lang_runs', v_lang_runs,
    'dealt', v_dealt,

    'pairs', coalesce((
      select jsonb_agg(jsonb_build_object(
        -- `prompt_stats` est la seule table qui garde sa catégorie nue : sa
        -- langue est dans une colonne à elle, et son motif refuse le préfixe.
        'category', s.category_id,
        'letter', s.letter,
        'dealt', s.dealt,
        'passed', s.passed,
        'words', s.words,
        'points', s.points)
        order by s.category_id, s.letter)
        from public.prompt_stats s
       where s.lang = v_lang
         and s.dealt > 0
         and (v_category is null or s.category_id = v_category)
    ), '[]'::jsonb),

    'words', coalesce((
      select jsonb_agg(jsonb_build_object(
        'word', t.word, 'category', t.category,
        'uses', t.uses, 'approx', t.approx, 'last', t.last)
        order by t.uses desc, t.word)
        from (
          select public.words_bare(v_lang, w.word) as word,
                 public.words_unscoped(v_lang, w.category_id) as category,
                 count(*)::integer as uses,
                 count(*) filter (where w.approximate)::integer as approx,
                 max(r.created_at) as last
            from public.run_words w
            join public.runs r on r.id = w.run_id
           where public.words_unscoped(v_lang, w.category_id) is not null
             and (v_category is null or public.words_unscoped(v_lang, w.category_id) = v_category)
           group by 1, 2
        ) t
    ), '[]'::jsonb),

    'added', coalesce((
      select jsonb_agg(jsonb_build_object(
        'word', public.words_bare(v_lang, r.word),
        'category', public.words_unscoped(v_lang, r.category_id),
        'display', r.display,
        'at', r.decided_at,
        'uses', (select count(*)::integer from public.run_words w
                  where w.word = r.word and w.category_id = r.category_id),
        'approx', (select count(*)::integer from public.run_words w
                    where w.word = r.word and w.category_id = r.category_id and w.approximate),
        'uses_since', (select count(*)::integer from public.run_words w
                        join public.runs ru on ru.id = w.run_id
                       where w.word = r.word and w.category_id = r.category_id
                         and ru.created_at >= r.decided_at),
        'approx_since', (select count(*)::integer from public.run_words w
                          join public.runs ru on ru.id = w.run_id
                         where w.word = r.word and w.category_id = r.category_id
                           and w.approximate and ru.created_at >= r.decided_at),
        'parties_since', (select count(distinct ru.id)::integer from public.runs ru
                           where ru.created_at >= r.decided_at
                             and exists (select 1 from public.run_words w
                                          where w.run_id = ru.id
                                            and public.words_unscoped(v_lang, w.category_id) is not null)),
        'requesters', (select coalesce(jsonb_agg(jsonb_build_object('name', p.display_name, 'at', s.created_at) order by s.created_at), '[]'::jsonb)
                        from public.word_submissions s
                        join public.profiles p on p.id = s.player_id
                       where s.category_id = r.category_id and s.word = r.word),
        'moderators', (select coalesce(jsonb_agg(jsonb_build_object('name', p.display_name, 'verdict', mv.verdict, 'note', mv.note, 'at', mv.created_at) order by mv.created_at), '[]'::jsonb)
                        from public.moderation_votes mv
                        join public.profiles p on p.id = mv.moderator_id
                       where mv.review_id = r.id and mv.verdict in ('correct', 'special')))
        order by r.decided_at desc)
        from public.word_reviews r
       where r.kind = 'add'
         and r.status = 'accepted'
         and public.words_unscoped(v_lang, r.category_id) is not null
         and (v_category is null or public.words_unscoped(v_lang, r.category_id) = v_category)
    ), '[]'::jsonb),

    'removed', coalesce((
      select jsonb_agg(jsonb_build_object(
        'word', public.words_bare(v_lang, r.word),
        'category', public.words_unscoped(v_lang, r.category_id),
        'display', r.display,
        'at', r.decided_at,
        'uses_before', (select count(*)::integer from public.run_words w
                         join public.runs ru on ru.id = w.run_id
                        where w.word = r.word and w.category_id = r.category_id
                          and ru.created_at < r.decided_at),
        'approx_before', (select count(*)::integer from public.run_words w
                           join public.runs ru on ru.id = w.run_id
                          where w.word = r.word and w.category_id = r.category_id
                            and w.approximate and ru.created_at < r.decided_at),
        'parties_before', (select count(distinct ru.id)::integer from public.runs ru
                            where ru.created_at < r.decided_at
                              and exists (select 1 from public.run_words w
                                           where w.run_id = ru.id
                                             and public.words_unscoped(v_lang, w.category_id) is not null)),
        'moderators', (select coalesce(jsonb_agg(jsonb_build_object('name', p.display_name, 'verdict', mv.verdict, 'note', mv.note, 'at', mv.created_at) order by mv.created_at), '[]'::jsonb)
                        from public.moderation_votes mv
                        join public.profiles p on p.id = mv.moderator_id
                       where mv.review_id = r.id and mv.verdict <> 'incorrect'))
        order by r.decided_at desc)
        from public.word_reviews r
       where r.kind = 'ban'
         and r.status = 'accepted'
         and public.words_unscoped(v_lang, r.category_id) is not null
         and (v_category is null or public.words_unscoped(v_lang, r.category_id) = v_category)
    ), '[]'::jsonb),

    'pending', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'word', public.words_bare(v_lang, r.word),
        'category', public.words_unscoped(v_lang, r.category_id),
        'display', r.display,
        'kind', r.kind,
        'at', r.created_at,
        'respelled', r.respelled,
        'special', r.special,
        'proposals', (select count(*)::integer from public.word_submissions s
                       where s.category_id = r.category_id and s.word = r.word),
        'proposers', (select coalesce(jsonb_agg(jsonb_build_object('name', p.display_name, 'at', s.created_at) order by s.created_at), '[]'::jsonb)
                       from public.word_submissions s
                       join public.profiles p on p.id = s.player_id
                      where s.category_id = r.category_id and s.word = r.word),
        'votes', (select coalesce(jsonb_agg(jsonb_build_object('name', p.display_name, 'verdict', mv.verdict, 'note', mv.note, 'at', mv.created_at) order by mv.created_at), '[]'::jsonb)
                   from public.moderation_votes mv
                   join public.profiles p on p.id = mv.moderator_id
                  where mv.review_id = r.id))
        order by r.created_at)
        from public.word_reviews r
       where r.status = 'pending'
         and public.words_unscoped(v_lang, r.category_id) is not null
         and (v_category is null or public.words_unscoped(v_lang, r.category_id) = v_category)
    ), '[]'::jsonb)
  );
end;
$$;

-- Réservé à l'administrateur, comme `admin_analytics` (0030) : la porte se
-- ferme aussi côté serveur, pas seulement dans l'interface.
revoke execute on function public.admin_words(text, text) from public, anon;
grant execute on function public.admin_words(text, text) to authenticated;
