-- « Mes demandes » : un joueur retire ou corrige un mot qu'il a proposé, tant
-- qu'il attend. Un mot accepté ou refusé ne bouge plus : l'accepté a déjà payé
-- son XP, le refusé reste en archive.

create policy submissions_withdraw_own on public.word_submissions for delete to authenticated
  using (auth.uid() = player_id and status = 'pending');

-- Corriger, c'est retirer puis proposer à nouveau : l'insertion repasse par
-- `auto_accept_word`, et la faute de frappe ne compte plus pour personne.
create function public.amend_submission(p_id uuid, p_word text, p_display text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_category text;
begin
  if length(trim(p_word)) = 0 then
    return false;
  end if;

  delete from public.word_submissions
   where id = p_id and player_id = auth.uid() and status = 'pending'
  returning category_id into v_category;

  if v_category is null then
    return false;
  end if;

  insert into public.word_submissions (player_id, category_id, word, display)
  values (auth.uid(), v_category, p_word, p_display)
  on conflict (player_id, category_id, word) do nothing;

  return true;
end;
$$;

revoke execute on function public.amend_submission(uuid, text, text) from public, anon;
grant execute on function public.amend_submission(uuid, text, text) to authenticated;
