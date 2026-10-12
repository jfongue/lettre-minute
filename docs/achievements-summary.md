# Succès, jalons et avatars

Chaque succès du jeu : son nom français et anglais, sa condition, son
appartenance à Google Play Games, l'avatar et la couleur qu'il ouvre, et le
nombre de joueurs qui l'ont obtenu.

- Source du catalogue : `src/domain/achievements.ts`. Comptes lus sur la base
  en ligne le 2026-10-12 : **347 profils** (les deux joueurs maison sont
  écartés), dont **40** portent au moins une partie.
- **61 succès** : 15 publiés sur Play Games,
  16 écrits dans le jeu, 30 barreaux de la grille.
- **45 barreaux** découpent la grille : 15 d'entre eux sont
  aussi des succès Play Games, 30 n'existent que dans l'app.
- **50 avatars** (les 5 premiers sont offerts) et
  **31 couleurs** (3 offertes, 12 gagnées avec un barreau,
  16 avec un défi ou une exploration).
- Un avatar se numérote comme dans l'éditeur : « Avatar *n* » est la tuile
  `n - 1` du code. Un succès qui n'ouvre pas de tuile montre pourtant une
  tuile : son **icône réemploie** celle d'un autre succès (partie 5).

Aperçu visuel : [`achievements-summary.html`](achievements-summary.html) dessine
chaque succès avec la tuile de son icône et la couleur qu'il ouvre ;
[`achievements-summary.png`](achievements-summary.png) est la même planche
entière en image.

## 1. Les 15 succès Google Play Games

Leur seuil est écrit en dur dans `src/domain/achievements.ts` et publié dans
la Play Console : les modifier demande de republier les succès.

| Succès (FR) | Nom (EN) | Condition (FR) | Condition (EN) | Play Games | Avatar ouvert | Couleur ouverte | Obtenus |
|---|---|---|---|---|---|---|---|
| Premiers pas | First steps | niveau 4 | level 4 | Oui, 15 pts | **Avatar 6** — triangle (pulse) | Crème (#f2ecdf) | **18** / 347 (5,2 %) |
| Dix minutes | Ten minutes | 10 parties jouées | 10 games played | Oui, 20 pts | **Avatar 22** — flower (spin) | Rose (#f1a3b3) | **18** / 347 (5,2 %) |
| Cent mots | A hundred words | 100 mots trouvés | 100 words found | Oui, 20 pts | **Avatar 8** — ring (pulse) | — | **15** / 347 (4,3 %) |
| En série | On a roll | 10 réponses d’affilée | 10 answers in a row | Oui, 30 pts | **Avatar 10** — bars (sway) | Ciel (#8fc1e3) | **13** / 347 (3,7 %) |
| Explorateur | Explorer | 15 mots jamais écrits avant | 15 words never written before | Oui, 40 pts | — *(icône : Avatar 25 — star (pulse))* | Lavande (#b3a6d9) | **14** / 347 (4,0 %) |
| Au dictionnaire | In the dictionary | 10 mots au dictionnaire | 10 words in the dictionary | Oui, 50 pts | — *(icône : Avatar 45 — comma (wiggle))* | Olive (#6f7a2e) | **6** / 347 (1,7 %) |
| Habitué | Regular | niveau 10 | level 10 | Oui, 50 pts | **Avatar 21** — hourglass (still) | Sauge (#9bb08f) | **8** / 347 (2,3 %) |
| Cent parties | A hundred games | 100 parties jouées | 100 games played | Oui, 60 pts | **Avatar 37** — corner + square (pulse) | — | **3** / 347 (0,9 %) |
| Mille mots | A thousand words | 1 000 mots trouvés | 1,000 words found | Oui, 70 pts | **Avatar 23** — dots (pulse) | — | **2** / 347 (0,6 %) |
| Vieux routier | Old hand | niveau 20 | level 20 | Oui, 80 pts | **Avatar 36** — triangle + circle (bob) | — | **5** / 347 (1,4 %) |
| Inarrêtable | Unstoppable | 24 réponses d’affilée | 24 answers in a row | Oui, 90 pts | **Avatar 30** — ring + square (spin) | Prune (#7a2f5a) | **0** / 347 (0,0 %) |
| Trois six | Three sixes | 666 points en une partie | 666 points in one game | Oui, 100 pts | — *(icône : Avatar 34 — sun + square (pulse))* | Moutarde (#c99a17) | **0** / 347 (0,0 %) |
| Inépuisable | Tireless | 400 parties jouées | 400 games played | Oui, 110 pts | **Avatar 42** — heart (pulse) | — | **0** / 347 (0,0 %) |
| Dictionnaire vivant | Walking dictionary | 2 000 mots trouvés | 2,000 words found | Oui, 120 pts | **Avatar 28** — square + circle (still) | — | **0** / 347 (0,0 %) |
| Maître de la minute | Master of the minute | niveau 35 | level 35 | Oui, 145 pts | **Avatar 43** — domes (bob) | — | **1** / 347 (0,3 %) |

## 2. Les 16 succès écrits dans le jeu (défis et exploration)

Trois d'entre eux (25 parties, 250 mots, 400 points) sont aussi des barreaux
de la grille ; les autres n'ont pas de case à eux et ne donnent qu'une couleur.

| Succès (FR) | Nom (EN) | Condition (FR) | Condition (EN) | Play Games | Avatar ouvert | Couleur ouverte | Obtenus |
|---|---|---|---|---|---|---|---|
| Bonne habitude | A good habit | 25 parties jouées | 25 games played | — | **Avatar 27** — frame (turn) | Marine (#172a4f) | **8** / 347 (2,3 %) |
| Du vocabulaire | A wider vocabulary | 250 mots trouvés | 250 words found | — | **Avatar 13** — lens (sway) | Corail (#f07a63) | **7** / 347 (2,0 %) |
| Belle partie | A fine game | 400 points en une partie | 400 points in one game | — | **Avatar 9** — diamond (turn) | — | **9** / 347 (2,6 %) |
| Mot fleuve | River word | un mot de 10 lettres | a word of 10 letters | — | — *(icône : Avatar 15 — pill (pulse))* | Vert (#17614c) | **11** / 347 (3,2 %) § |
| Mot interminable | Endless word | un mot de 15 lettres | a word of 15 letters | — | — *(icône : Avatar 46 — bang (stamp))* | Canard (#16606e) | **7** / 347 (2,0 %) § |
| Réflexe vif | Quick reflex | un mot à 2,5 lettres par seconde | a word at 2.5 letters a second | — | — *(icône : Avatar 20 — chevron (bob))* | Ocre (#b8782b) | **11** / 347 (3,2 %) § |
| Réflexe éclair | Lightning reflex | un mot à 3,5 lettres par seconde | a word at 3.5 letters a second | — | — *(icône : Avatar 50 — dial (nod))* | Saumon (#f4b49a) | **6** / 347 (1,7 %) § |
| Bricoleur | Tinkerer | 7 pouvoirs différents | 7 different powers | — | — *(icône : Avatar 41 — target (pulse))* | Violet (#5b3a8c) | **1** / 347 (0,3 %) |
| Tous les pouvoirs | Every power | 14 pouvoirs différents | 14 different powers | — | — *(icône : Avatar 48 — bloom (breathe))* | Fuchsia (#c2447e) | **0** / 347 (0,0 %) |
| Sans faute | Flawless | 1 partie sans passer | 1 game without skipping | — | — *(icône : Avatar 17 — steps (still))* | Menthe (#7fc8a9) | **8** / 347 (2,3 %) § |
| Impeccable | Spotless | 10 parties sans passer | 10 games without skipping | — | — *(icône : Avatar 11 — sun (spin))* | Émeraude (#1f8a5b) | **2** / 347 (0,6 %) § |
| Quatre à table | Four at the table | 1 manche à quatre | 1 round at a four-player table | — | — *(icône : Avatar 44 — ringbroken (scatter))* | Bordeaux (#6e1f2a) | **0** / 347 (0,0 %) ‡ |
| Marathon | Marathon | 20 manches à quatre | 20 rounds at a four-player table | — | — *(icône : Avatar 39 — triangle + sun (still))* | Gris (#8a8478) | **0** / 347 (0,0 %) ‡ |
| Roi du jour | King of the day | la première place du jour | first place of the day | — | — *(icône : Avatar 47 — eclipse (hover))* | Citron (#efd64a) | **0** / 347 (0,0 %) ‡ |
| Grand voyageur | Globetrotter | un mot dans 12 catégories | a word in 12 categories | — | — *(icône : Avatar 24 — checker (still))* | Turquoise (#3aa6b0) | **5** / 347 (1,4 %) |
| Juste arbitre | Fair judge | 10 verdicts rendus | 10 moderation verdicts | — | — *(icône : Avatar 32 — bars + triangle (still))* | Outremer (#2d2f9a) | **8** / 347 (2,3 %) |

## 3. Les 30 barreaux de la grille sans nom propre

Le nom de ces succès est leur jalon, tel que l'éditeur l'affiche ; chacun ouvre
la tuile de sa ligne. Les quinze autres barreaux de la grille sont ouverts par
les succès de la partie 1 : avatars 6, 8, 10, 21, 22, 23, 28, 30, 36, 37, 42, 43.

| Avatar | Nom (FR) | Nom (EN) | Condition (FR) | Condition (EN) | Play Games | Avatar ouvert | Couleur ouverte | Obtenus |
|---|---|---|---|---|---|---|---|---|
| Avatar 7 | 3 parties | 3 games | 3 parties jouées | 3 games played | — | **Avatar 7** — corner (still) | Noir (#151515) | **20** / 347 (5,8 %) |
| Avatar 11 | Niveau 6 | Level 6 | niveau 6 | level 6 | — | **Avatar 11** — sun (spin) | Orange (#ee7a22) | **17** / 347 (4,9 %) |
| Avatar 12 | 5 parties | 5 games | 5 parties jouées | 5 games played | — | **Avatar 12** — cross (spin) | — | **19** / 347 (5,5 %) |
| Avatar 14 | Score de 500 | A score of 500 | 500 points en une partie | 500 points in one game | — | **Avatar 14** — moon (bob) | — | **2** / 347 (0,6 %) |
| Avatar 15 | Série de 13 | A streak of 13 | 13 réponses d’affilée | 13 answers in a row | — | **Avatar 15** — pill (pulse) | — | **10** / 347 (2,9 %) |
| Avatar 16 | Niveau 8 | Level 8 | niveau 8 | level 8 | — | **Avatar 16** — hexagon (sway) | Brique (#a83a2a) | **10** / 347 (2,9 %) |
| Avatar 17 | 7 parties | 7 games | 7 parties jouées | 7 games played | — | **Avatar 17** — steps (still) | — | **18** / 347 (5,2 %) |
| Avatar 18 | 500 mots trouvés | 500 words found | 500 mots trouvés | 500 words found | — | **Avatar 18** — wave (sway) | — | **5** / 347 (1,4 %) |
| Avatar 19 | Score de 600 | A score of 600 | 600 points en une partie | 600 points in one game | — | **Avatar 19** — zigzag (bob) | — | **1** / 347 (0,3 %) |
| Avatar 20 | Série de 16 | A streak of 16 | 16 réponses d’affilée | 16 answers in a row | — | **Avatar 20** — chevron (bob) | — | **8** / 347 (2,3 %) |
| Avatar 24 | Score de 700 | A score of 700 | 700 points en une partie | 700 points in one game | — | **Avatar 24** — checker (still) | — | **0** / 347 (0,0 %) |
| Avatar 25 | Série de 20 | A streak of 20 | 20 réponses d’affilée | 20 answers in a row | — | **Avatar 25** — star (pulse) | — | **2** / 347 (0,6 %) |
| Avatar 26 | Niveau 13 | Level 13 | niveau 13 | level 13 | — | **Avatar 26** — drop (sway) | — | **7** / 347 (2,0 %) |
| Avatar 29 | Score de 800 | A score of 800 | 800 points en une partie | 800 points in one game | — | **Avatar 29** — diamond + circle (pulse) | Sable (#e3cf9f) | **0** / 347 (0,0 %) |
| Avatar 31 | Niveau 16 | Level 16 | niveau 16 | level 16 | — | **Avatar 31** — half + circle (bob) | — | **6** / 347 (1,7 %) |
| Avatar 32 | 50 parties | 50 games | 50 parties jouées | 50 games played | — | **Avatar 32** — bars + triangle (still) | — | **7** / 347 (2,0 %) |
| Avatar 33 | 3500 mots trouvés | 3500 words found | 3 500 mots trouvés | 3,500 words found | — | **Avatar 33** — quarter + circle (sway) | — | **0** / 347 (0,0 %) |
| Avatar 34 | Score de 900 | A score of 900 | 900 points en une partie | 900 points in one game | — | **Avatar 34** — sun + square (pulse) | — | **0** / 347 (0,0 %) |
| Avatar 35 | Série de 28 | A streak of 28 | 28 réponses d’affilée | 28 answers in a row | — | **Avatar 35** — arch + square (still) | — | **0** / 347 (0,0 %) |
| Avatar 38 | 5000 mots trouvés | 5000 words found | 5 000 mots trouvés | 5,000 words found | — | **Avatar 38** — half + sun (sway) | — | **0** / 347 (0,0 %) |
| Avatar 39 | Niveau 25 | Level 25 | niveau 25 | level 25 | — | **Avatar 39** — triangle + sun (still) | — | **2** / 347 (0,6 %) |
| Avatar 40 | 200 parties | 200 games | 200 parties jouées | 200 games played | — | **Avatar 40** — circle + sun (spin) | — | **1** / 347 (0,3 %) |
| Avatar 41 | Niveau 30 | Level 30 | niveau 30 | level 30 | — | **Avatar 41** — target (pulse) | Anthracite (#3a3834) | **2** / 347 (0,6 %) |
| Avatar 44 | 1 mot ajouté | 1 word added | 1 mot au dictionnaire | 1 word in the dictionary | — | **Avatar 44** — ringbroken (scatter) | — | **12** / 347 (3,5 %) |
| Avatar 45 | 15 mots ajoutés | 15 words added | 15 mots au dictionnaire | 15 words in the dictionary | — | **Avatar 45** — comma (wiggle) | — | **6** / 347 (1,7 %) |
| Avatar 46 | 50 mots ajoutés | 50 words added | 50 mots au dictionnaire | 50 words in the dictionary | — | **Avatar 46** — bang (stamp) | — | **3** / 347 (0,9 %) |
| Avatar 47 | 100 mots ajoutés | 100 words added | 100 mots au dictionnaire | 100 words in the dictionary | — | **Avatar 47** — eclipse (hover) | — | **1** / 347 (0,3 %) |
| Avatar 48 | 300 mots ajoutés | 300 words added | 300 mots au dictionnaire | 300 words in the dictionary | — | **Avatar 48** — bloom (breathe) | — | **0** / 347 (0,0 %) |
| Avatar 49 | 500 mots ajoutés | 500 words added | 500 mots au dictionnaire | 500 words in the dictionary | — | **Avatar 49** — archway (spin) | — | **0** / 347 (0,0 %) |
| Avatar 50 | 1000 mots ajoutés | 1000 words added | 1 000 mots au dictionnaire | 1,000 words in the dictionary | — | **Avatar 50** — dial (nod) | — | **0** / 347 (0,0 %) |

## 4. D'où vient chaque compte

| Compteur | Source | Couverture |
|---|---|---|
| `level` | profil (`profiles.xp`) | tous les profils |
| `runs` | profil (`profiles.runs`) | tous les profils |
| `bestScore` | profil (`profiles.best_score`) | tous les profils |
| `wordsFound` | profil (`profiles.words_found`) | tous les profils |
| `bestCombo` | profil (`profiles.best_combo`) | tous les profils |
| `wordsAdded` | mots acceptés (`word_submissions`) | tous les profils |
| `discoveries` | classement des découvertes (0021) | tous les profils |
| `longestWord` | relevé des parties (`runs.record`) § | les 290 parties relevées (42 joueurs) + les sauvegardes |
| `bestSpeed` | relevé des parties (`runs.record`) § | les 290 parties relevées (42 joueurs) + les sauvegardes |
| `cleanRuns` | relevé des parties (`runs.record`) § | les 290 parties relevées (42 joueurs) + les sauvegardes |
| `powersUsed` | pouvoirs emportés (`runs.powers`) | borne haute : compte les pouvoirs emportés, pas seulement ceux qui ont servi |
| `playedCategories` | catégories des mots trouvés (`run_words`) | tous les profils |
| `wordsReviewed` | verdicts rendus (`moderation_votes`) | tous les profils |
| `duelRounds4` | sauvegardes synchronisées ‡ | les 16 sauvegardes synchronisées |
| `dailyFirst` | sauvegardes synchronisées ‡ | les 16 sauvegardes synchronisées |

§ Ces trois compteurs se recalculent depuis le relevé de partie
(`runs.record`), écrit par l'appareil : une partie plus ancienne que ce relevé
n'y compte pas, et le compte est donc un minimum.

‡ Ces deux compteurs ne vivent que dans la sauvegarde du joueur
(`player_progress`) : seuls les 16 comptes synchronisés les portent.
« Marathon » et « Quatre à table » valent 0 de toute façon : aucune table de
duel n'a jamais réuni quatre joueurs (trois places au maximum, `duel_seats`).

## 5. Les 16 succès dont l'icône réemploie une tuile

Ces succès n'ouvrent aucune tuile : leur icône est celle d'un autre succès.
C'est voulu — une icône doit montrer quelque chose de dessiné —, mais deux
succès portent alors le même visuel, et un seul des deux le débloque.

| Succès | Icône affichée | Tuile ouverte par |
|---|---|---|
| Explorateur (15 mots jamais écrits avant) | Avatar 25 — star (pulse) | Série de 20 (20 réponses d’affilée) |
| Au dictionnaire (10 mots au dictionnaire) | Avatar 45 — comma (wiggle) | 15 mots ajoutés (15 mots au dictionnaire) |
| Trois six (666 points en une partie) | Avatar 34 — sun + square (pulse) | Score de 900 (900 points en une partie) |
| Mot fleuve (un mot de 10 lettres) | Avatar 15 — pill (pulse) | Série de 13 (13 réponses d’affilée) |
| Mot interminable (un mot de 15 lettres) | Avatar 46 — bang (stamp) | 50 mots ajoutés (50 mots au dictionnaire) |
| Réflexe vif (un mot à 2,5 lettres par seconde) | Avatar 20 — chevron (bob) | Série de 16 (16 réponses d’affilée) |
| Réflexe éclair (un mot à 3,5 lettres par seconde) | Avatar 50 — dial (nod) | 1000 mots ajoutés (1 000 mots au dictionnaire) |
| Bricoleur (7 pouvoirs différents) | Avatar 41 — target (pulse) | Niveau 30 (niveau 30) |
| Tous les pouvoirs (14 pouvoirs différents) | Avatar 48 — bloom (breathe) | 300 mots ajoutés (300 mots au dictionnaire) |
| Sans faute (1 partie sans passer) | Avatar 17 — steps (still) | 7 parties (7 parties jouées) |
| Impeccable (10 parties sans passer) | Avatar 11 — sun (spin) | Niveau 6 (niveau 6) |
| Quatre à table (1 manche à quatre) | Avatar 44 — ringbroken (scatter) | 1 mot ajouté (1 mot au dictionnaire) |
| Marathon (20 manches à quatre) | Avatar 39 — triangle + sun (still) | Niveau 25 (niveau 25) |
| Roi du jour (la première place du jour) | Avatar 47 — eclipse (hover) | 100 mots ajoutés (100 mots au dictionnaire) |
| Grand voyageur (un mot dans 12 catégories) | Avatar 24 — checker (still) | Score de 700 (700 points en une partie) |
| Juste arbitre (10 verdicts rendus) | Avatar 32 — bars + triangle (still) | 50 parties (50 parties jouées) |

## 6. Points ouverts

- **Avatar 34 — « Score de 900 »** (tuile 33) : le barreau est resté à 900
  points alors que le succès Play correspondant est descendu à 666 (`7cea7e2`) ;
  `score-666` garde la même tuile pour icône. Personne ne l'a obtenu
  (record de tous les temps : 621 points).
- **Avatar 38 — « 5000 mots trouvés »** (tuile 37) : le barreau est resté à
  5 000 mots alors que le succès Play est descendu à 2 000. Personne ne l'a
  obtenu (maximum : 1 920 mots).
- **Avatar 39 — « Niveau 25 »** (tuile 38) : barreau ordinaire, jamais
  retouché. 2 joueurs l'ont.
