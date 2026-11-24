-- Les parties jouées pendant les pannes des 23 et 24 novembre ne sont jamais
-- arrivées : l'app les envoyait une fois, et la base ne répondait plus. Elle
-- les garde désormais sur l'appareil jusqu'à ce qu'elles passent, et les
-- renvoie datées de l'heure où elles ont été jouées — ce que la règle
-- d'insertion de 0054 refusait (une minute d'écart au plus). Une partie peut
-- donc arriver jusqu'à quatorze jours après avoir été jouée — le temps qu'une version qui les renvoie passe les revues des stores ; ce qui se compte à
-- l'envoi — trois cents par jour, et les mots qu'on n'ajoute qu'à une partie
-- qu'on vient d'envoyer — se lit sur `sent_at`, que le serveur pose lui-même.
-- Les lignes d'avant n'en ont pas : leur `created_at` en tient lieu.

alter table public.runs add column sent_at timestamptz;
alter table public.runs alter column sent_at set default now();

create function public.runs_stamp_sent() returns trigger
language plpgsql as $$
begin
  new.sent_at := now();
  return new;
end;
$$;

create trigger runs_stamp_sent before insert on public.runs
  for each row execute function public.runs_stamp_sent();

drop policy if exists runs_insert_own on public.runs;
create policy runs_insert_own on public.runs for insert to authenticated
  with check (auth.uid() = player_id
              and created_at between now() - interval '14 days' and now() + interval '1 minute'
              -- Une ligne sans graine n'est pas une partie : c'est le `not null`
              -- de 0001 qui doit la refuser, pas cette policy, sinon le code
              -- d'erreur que lit l'app change.
              and (seed is null or (words between 0 and 200
                     and best_combo between 0 and words
                     and score <= words * 74 + 10 * (words / 3)))
              -- Trois cents envois par jour et par compte (0054), comptés à
              -- l'heure d'envoi : une file qui se vide n'en joue pas davantage.
              and (select count(*) from public.runs r
                    where r.player_id = auth.uid()
                      and coalesce(r.sent_at, r.created_at) > now() - interval '1 day') < 300);

drop policy if exists run_words_insert_own on public.run_words;
create policy run_words_insert_own on public.run_words for insert to authenticated
  with check (exists (select 1 from public.runs r
                       where r.id = run_id and r.player_id = auth.uid()
                         and coalesce(r.sent_at, r.created_at) > now() - interval '10 minutes')
              and points between 0 and 74);
