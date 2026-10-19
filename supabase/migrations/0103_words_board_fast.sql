-- L'écran des mots ne finissait jamais de charger : `admin_words` (0043)
-- comptait, pour chaque mot ajouté ou retiré (plus de 500 aujourd'hui), les
-- parties de la langue qui le suivent ou le précèdent par une sous-requête
-- qui relisait toutes les parties et, pour chacune, tous les mots écrits
-- (`run_words` n'a pas d'index sur `run_id`). Plus de 18 secondes sur le
-- serveur de production, pour une limite de 8 s côté `authenticated` : la
-- requête était coupée, `fetchAdminWords` répondait son repli `null`, et
-- l'écran n'avait rien à montrer.
--
-- Les parties de la langue se comptent désormais une fois, en un tableau de
-- dates ; chaque mot n'a plus qu'à y compter celles d'avant ou d'après son
-- vote. Le relevé rendu est le même, champ pour champ, plus `amended` : les
-- corrections d'orthographe de 0102, en attente du prochain import.

create or replace function public.admin_words(p_lang text, p_category text default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_lang text := lower(trim(coalesce(p_lang, 'fr')));
  v_category text := nullif(trim(coalesce(p_category, '')), '');
  v_runs integer;
  v_lang_runs integer;
  v_dealt integer;
  v_times timestamptz[];
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
  -- Leurs dates, une fois pour toutes : c'est ce que « depuis » et « avant »
  -- comptent, pour chaque mot ajouté ou retiré.
  select coalesce(array_agg(ru.created_at), '{}'::timestamptz[])
    into v_times
    from public.runs ru
   where ru.id in (select w.run_id from public.run_words w
                    where public.words_unscoped(v_lang, w.category_id) is not null);
  v_lang_runs := cardinality(v_times);

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
        'parties_since', (select count(*)::integer from unnest(v_times) t where t >= r.decided_at),
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
        'parties_before', (select count(*)::integer from unnest(v_times) t where t < r.decided_at),
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

    'amended', coalesce((
      select jsonb_agg(jsonb_build_object(
        'word', a.word,
        'category', public.words_unscoped(v_lang, a.category_id),
        'display', a.display,
        'old_display', a.old_display,
        'at', a.created_at)
        order by a.created_at desc)
        from public.word_amendments a
       where public.words_unscoped(v_lang, a.category_id) is not null
         and (v_category is null or public.words_unscoped(v_lang, a.category_id) = v_category)
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

revoke execute on function public.admin_words(text, text) from public, anon;
grant execute on function public.admin_words(text, text) to authenticated;
