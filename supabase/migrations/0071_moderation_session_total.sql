-- La stat des sessions de modération vivait sur l'appareil : une déconnexion la
-- remettait à zéro, et elle ignorait les sessions jugées depuis un autre. Le
-- serveur, lui, garde chaque session (`moderation_sessions`, 0068) : son compte
-- accompagne le reste du statut, pour que « Mes demandes » n'ait qu'un appel et
-- affiche l'historique complet du modérateur.

create or replace function public.moderation_status(p_lang text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
v_moderator boolean := public.is_moderator();
v_reason text;
v_invited_by text;
begin
if public.pending_reviews(p_lang) >= 5 then
select d.reason, d.invited_by into v_reason, v_invited_by from public.moderator_offer_due() d;
end if;
return jsonb_build_object(
'moderator', v_moderator,
'super', v_moderator and public.is_super_moderator(auth.uid()),
'validated', case when v_moderator then public.validated_count(auth.uid()) else 0 end,
'queue', case when v_moderator then (select count(*) from public.moderation_queue(p_lang, 20)) else 0 end,
'sessions', case when v_moderator then (select count(*) from public.moderation_sessions
where player_id = auth.uid()) else 0 end,
'offer', v_reason,
'invited_by', v_invited_by,
'news', (select count(*) from public.word_submissions
where player_id = auth.uid() and status = 'accepted' and seen_at is null)
);
end;
$$;
