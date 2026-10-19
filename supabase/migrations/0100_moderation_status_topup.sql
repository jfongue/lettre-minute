-- « Mes demandes » dit à un modérateur qu'il y a de quoi modérer même quand sa
-- file est vide : `moderation_status` rend `topup`, vrai quand sa file est sous
-- une session (`MODERATION_MIN_QUEUE`), que la porte horaire du versement
-- (`moderation_topup`, 0023) est ouverte et que la réserve de sa langue garde
-- des mots à verser — c'est exactement ce que `top_up_moderation` (0083) ferait
-- à l'ouverture de la page. Le reste de la fonction est celui de 0082.

create or replace function public.moderation_status(p_lang text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_moderator boolean := public.is_moderator();
  v_reason text;
  v_invited_by text;
  v_waiting integer;
  v_queue integer := 0;
  v_topup boolean := false;
  v_last timestamptz;
begin
  v_waiting := public.pending_reviews(p_lang)
    + (select count(*)::integer from public.moderation_reserve r
        where r.released_at is null and public.category_lang(r.category_id) = p_lang);
  if v_waiting >= 5 then
    select d.reason, d.invited_by into v_reason, v_invited_by from public.moderator_offer_due() d;
  end if;
  if v_moderator then
    v_queue := (select count(*) from public.moderation_queue(p_lang, 20));
    select released_at into v_last from public.moderation_topup;
    v_topup := v_queue < 5
      and (v_last is null or now() - v_last >= interval '1 hour')
      and exists (select 1 from public.bots)
      and exists (select 1 from public.moderation_reserve r
                   where r.released_at is null and public.category_lang(r.category_id) = p_lang);
  end if;
  return jsonb_build_object(
    'moderator', v_moderator,
    'super', v_moderator and public.is_super_moderator(auth.uid()),
    'validated', case when v_moderator then public.validated_count(auth.uid()) else 0 end,
    'queue', v_queue,
    'sessions', case when v_moderator then (select count(*) from public.moderation_sessions
                                            where player_id = auth.uid()) else 0 end,
    'offer', v_reason,
    'invited_by', v_invited_by,
    'topup', v_topup,
    'news', (select count(*) from public.word_submissions
              where player_id = auth.uid() and status = 'accepted' and seen_at is null)
  );
end;
$$;
