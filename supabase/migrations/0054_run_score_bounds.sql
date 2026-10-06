-- Un classement falsifiable : les tableaux lisent le score d'une partie
-- (`leaderboard_board` pour le jour et la semaine, `leaderboard_values` pour la
-- page des classements), et rien n'obligeait ce score à être couvert par les
-- mots qui l'ont produit. Une partie de deux mots à 99 999 points entrait telle
-- quelle et prenait la première place.
--
-- Le serveur ne peut pas recalculer le score : les points d'un mot viennent de
-- son palier de rareté, un rang dans le dictionnaire embarqué, qu'il ne connaît
-- pas. Il peut en revanche exiger qu'une partie tienne debout, mot par mot et
-- dans son total. Les plafonds sont ceux du barème, transposés du domaine comme
-- `word_shape_ok` (0051) l'a fait pour la forme d'un mot :
--
--   points d'un mot = round((10 + 20 × rareté) × combo × boost)
--                   ≤ round(30 × 1,9 × 1,3) = 74
--     (`BASE_POINTS`, `RARITY_POINTS`, `MAX_COMBO_STEPS`, `COMPLICATION_BOOST`)
--   score = Σ points + 10 tous les trois mots sans faute
--         ≤ mots × 74 + 10 × (mots / 3)   (`FLAWLESS_POINTS`, `FLAWLESS_STREAK`)
--
-- Deux choses restent au client, faute de pouvoir les vérifier sans le
-- dictionnaire : le mot rare qu'il prétend avoir écrit (il paie alors 74), et
-- son palier de rareté. La partie reste donc déclarative — mais bornée à ce
-- qu'une vraie partie peut rendre.
--
-- Rien à voir avec les parties du serveur : un robot maison (0006) et les
-- parties de défi s'écrivent par des fonctions `security definer`, qui ne
-- passent pas par ces policies. `tests.run_at` non plus.

drop policy if exists runs_insert_own on public.runs;
create policy runs_insert_own on public.runs for insert to authenticated
  with check (auth.uid() = player_id
              and created_at between now() - interval '1 minute' and now() + interval '1 minute'
              -- Une ligne sans graine n'est pas une partie : c'est le `not null`
              -- de 0001 qui doit la refuser, pas cette policy, sinon le code
              -- d'erreur que lit l'app change.
              and (seed is null or (words between 0 and 200
                     and best_combo between 0 and words
                     and score <= words * 74 + 10 * (words / 3)))
              -- Un compte ne noie pas les tableaux sous les parties : trois
              -- cents par jour, bien au-delà de ce qu'un joueur enchaîne, et
              -- de quoi rendre inutile une boucle qui gonflerait la part des
              -- mots dans `word_popularity`.
              and (select count(*) from public.runs r
                    where r.player_id = auth.uid()
                      and r.created_at > now() - interval '1 day') < 300);

drop policy if exists run_words_insert_own on public.run_words;
create policy run_words_insert_own on public.run_words for insert to authenticated
  with check (exists (select 1 from public.runs r
                       where r.id = run_id and r.player_id = auth.uid()
                         and r.created_at > now() - interval '10 minutes')
              and points between 0 and 74);
