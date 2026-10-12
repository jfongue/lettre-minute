# Réétalement des succès — proposition

Relevé fait le 5 novembre 2026 sur la base liée : 349 profils hors joueurs
maison, 888 parties réelles jouées par 35 d'entre eux, 15 mots proposés
acceptés, 13 joueurs de défis entre amis, 11 modérateurs. Rien n'est appliqué :
ce document propose, il ne change pas `RUNGS`.

## Ce que disent les relevés

Profils ayant atteint le seuil, sur 349 :

| Partie | Seuil | ≥3 | ≥5 | ≥7 | ≥10 | ≥15 | ≥25 | ≥50 | ≥100 | ≥200 | ≥400 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| profils | | 20 | 19 | 18 | 18 | 16 | 8 | 7 | 3 | 1 | 0 |

| Mots trouvés | ≥25 | ≥50 | ≥100 | ≥150 | ≥200 | ≥300 | ≥500 | ≥1000 | ≥2000 | ≥5000 |
|---|---|---|---|---|---|---|---|---|---|---|
| profils | 18 | 18 | 15 | 11 | 8 | 7 | 5 | 2 | 0 | 0 |

| Meilleur score | ≥100 | ≥200 | ≥250 | ≥300 | ≥350 | ≥400 | ≥450 | ≥550 | ≥600 | ≥666 | ≥900 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| profils | 21 | 16 | 13 | 13 | 12 | 9 | 2 | 1 | 1 | 0 | 0 |

| Meilleur combo | ≥3 | ≥5 | ≥7 | ≥9 | ≥11 | ≥14 | ≥18 | ≥22 | ≥24 | ≥30 |
|---|---|---|---|---|---|---|---|---|---|---|
| profils | 22 | 21 | 20 | 17 | 11 | 10 | 5 | 1 | 0 | 0 |

| Niveau | ≥4 | ≥6 | ≥8 | ≥10 | ≥13 | ≥16 | ≥20 | ≥25 | ≥30 | ≥35 |
|---|---|---|---|---|---|---|---|---|---|---|
| profils | 18 | 17 | 10 | 8 | 7 | 6 | 5 | 2 | 2 | 1 |

Une partie seule : score médian 120 (p90 260, p99 392), 7 mots trouvés
(p90 13, maximum 23), combo médian bas et p90 à 12, 1 passe (p90 4). Une
partie sur trois ne laisse passer aucune question (294 sur 888, par 26
joueurs). Le meilleur score de tous les temps vaut 621. Les 6 383 mots joués
vont jusqu'à 25 lettres : 113 en font 12 ou plus, 42 en font 15, 11 en font
18, 3 en font 20.

Les pistes hors barreau, sur les mêmes 349 profils :

| Mots ajoutés (acceptés) | ≥5 | ≥10 | ≥25 | ≥50 | ≥100 | ≥300 |
|---|---|---|---|---|---|---|
| profils | 10 | 8 | 7 | 5 | 2 | 0 |

| Défis entre amis joués | ≥1 | ≥5 | ≥10 | ≥20 | ≥25 |
|---|---|---|---|---|---|
| joueurs | 13 | 6 | 2 | 1 | 0 |

| Séances de modération (verdicts / 5) | ≥10 | ≥30 | ≥60 |
|---|---|---|---|
| modérateurs | 4 | 3 | 2 |

| Tentatives de défi du moment | ≥1 | ≥5 | ≥10 | ≥30 |
|---|---|---|---|---|
| joueurs | 1 | 0 | 0 | 0 |

## Pourquoi les tuiles tombent en grappes

Trois causes, dans l'ordre d'importance.

1. **Les quinze succès Play se chevauchent tous dans les dix premières
   parties.** `level-4` (niveau 4, soit 800 XP, cinq ou six parties),
   `combo-10`, `runs-10` et `words-100` (une douzaine de parties) tombent dans
   la même semaine, et les seuils sont figés : la Console a publié le texte,
   elle ne le met jamais à jour, donc « 100 mots » doit rester 100.
2. **Les barreaux de la grille se serrent dans les mêmes eaux.** Entre 3 et
   12 parties, la population ne bouge pas d'un joueur (20 · 19 · 18 · 18 · 18
   · 18) ; entre le niveau 4 et le niveau 10, elle passe de 18 à 8. Trois
   tuiles « parties » (3, 5, 7) et quatre tuiles « niveau » (4, 6, 8, 10)
   distinguent donc à peine les joueurs, et celui qui joue une semaine en
   ouvre une brassée.
3. **Le haut de l'échelle est vide, l'autre bout saturé.** Quatre des six
   barreaux de score (700, 800, 900, et `score-666` de Play) ne sont atteints
   par personne — le record est 621 —, de même que `combo-24`, `combo-28`,
   `runs-400`, `words-2000`, `words-3500`, `words-5000`, `added-300` et
   `added-1000`. À l'inverse `duel-four` est impossible : le duel n'a que
   trois places (`duel_seats`, 21 tables), et `duelRounds4` n'a jamais
   compté une manche. `day-first` demande la règle du jour de Reddit, que
   l'Android ne joue pas : sa couleur y est inatteignable.

## La règle de la nouvelle échelle

Un barreau par décile de population utile : aucun seuil ne doit tomber sur le
même groupe de joueurs que son voisin, et le haut de chaque piste doit rester
à portée de celui qui joue des années. Score et combo gardent leur plafond
demandé — 900 et 30 —, les quatre autres pistes montent bien plus haut
(niveau 50, 1 200 parties, 8 000 mots, 500 mots ajoutés). Les quinze succès
Play gardent identifiant, points, seuil et icône ; les barreaux de la grille
n'en gardent que leur dessin, un seuil par tuile se réécrivant dans `RUNGS`.

Les 45 tuiles de barreau sont redistribuées entre huit pistes, dans cet ordre :
niveau 8, parties 7, mots 6, score 6, combo 5, mots ajoutés 5, et huit
barreaux neufs. Les cinq tuiles offertes et les trois tuiles d'exploit (50,
51, 52) gardent leur dessin : celle de « Marathon » (52) change de main,
personne n'ayant jamais joué la table de quatre qu'elle demandait.

## Les huit pistes, réétalées

★ = succès Play, seuil figé. « joueurs » = profils au-dessus du seuil proposé.

**Niveau** — 8 barreaux, plafond 35 → 50

| proposé | joueurs | avant | |
|---|---|---|---|
| 4 ★ | 18 | 4 | inchangé |
| 7 | ~11 | 6 | monte |
| 10 ★ | 8 | 10 | inchangé |
| 14 | ~6 | 13, 16 | deux tuiles fondues en une |
| 20 ★ | 5 | 20 | inchangé |
| 27 | 2 | 25, 30 | resserré |
| 35 ★ | 1 | 35 | inchangé |
| 50 | 0 | — | nouveau plafond |

**Parties** — 7 barreaux, plafond 400 → 1 200

| proposé | joueurs | avant | |
|---|---|---|---|
| 3 | 20 | 3 | inchangé |
| 10 ★ | 18 | 10 | inchangé |
| 30 | 7 | 5, 7, 25 | trois tuiles fondues en une |
| 100 ★ | 3 | 100 | inchangé |
| 250 | 1 | 200 | monte |
| 400 ★ | 0 | 400 | figé, graal |
| 1 200 | 0 | — | nouveau plafond |

**Mots trouvés** — 6 barreaux, plafond 5 000 → 8 000

| proposé | joueurs | avant | |
|---|---|---|---|
| 100 ★ | 15 | 100 | inchangé |
| 300 | 7 | 250 | monte |
| 600 | 3 | 500 | monte |
| 1 000 ★ | 2 | 1 000 | inchangé |
| 2 000 ★ | 0 | 2 000 | figé |
| 8 000 | 0 | 3 500, 5 000 | plafond relevé |

**Meilleur score** — 6 barreaux, plafond 900 (inchangé)

| proposé | joueurs | avant | |
|---|---|---|---|
| 350 | 12 | 400 | descend d'un cran |
| 450 | 2 | 500 | resserré |
| 550 | 1 | 600 | resserré |
| 666 ★ | 0 | 666 | figé, la tuile du six |
| 750 | 0 | 700, 800 | fondues |
| 900 | 0 | 900 | plafond, graal assumé |

C'est la seule piste qu'il fallait *descendre* : personne ne passe 666, donc
les quatre barreaux du haut ne sont ouverts à personne. Le plafond à 900 reste
là où il est, c'est le but à atteindre quand les dictionnaires et les joueurs
auront grandi.

**Meilleur combo** — 5 barreaux, plafond 30 (inchangé)

| proposé | joueurs | avant | |
|---|---|---|---|
| 10 ★ | 17 | 10 | inchangé |
| 15 | 5 | 13, 16 | fondues |
| 20 | 2 | 20 | inchangé |
| 24 ★ | 0 | 24 | figé, graal (record 23) |
| 30 | 0 | 28 | plafond demandé |

**Mots ajoutés** — 5 barreaux, plafond 1 000 → 500

| proposé | joueurs | avant | |
|---|---|---|---|
| 5 | 10 | 1 | le basique remonte |
| 10 ★ | 8 | 10 | inchangé |
| 40 | ~6 | 15 | monte |
| 150 | 2 | 50, 100 | resserré |
| 500 | 0 | 300, 500, 1 000 | plafond ramené au réel |

## Les neuf succès neufs

Sept idées, neuf succès : huit barreaux et l'exploit « Marathon ».

| Barreau | Compteur | Seuil | Aujourd'hui | Récompense |
|---|---|---|---|---|
| Le défi du moment | `weeklyAttempts` | 5 | 1 joueur, 3 tentatives | tuile |
| Trente défis du moment | `weeklyAttempts` | 30 | 0 (six semaines pleines) | tuile + couleur *citron* |
| Premier défi d'ami rendu | `challengesFinished` | 5 | 6 joueurs | tuile |
| Vingt-cinq défis d'ami | `challengesFinished` | 25 | 0 (record 21) | tuile + couleur *bordeaux* |
| Modérateur assidu | `moderationSessions` | 10 | 4 modérateurs | tuile |
| Trente séances de modération | `moderationSessions` | 30 | 3 modérateurs | tuile + couleur *gris* |
| Soixante séances de modération | `moderationSessions` | 60 | 2 modérateurs | tuile |
| Dix mots courts d'affilée | `shortStreak` | 10 | compté à partir de maintenant | tuile |

Et « Marathon » : **cinquante mots d'affilée sans passer une question**,
comptés d'une partie à l'autre, avec la couleur *menthe* et la tuile 52 —
l'exploit que `duel-round-20` n'a jamais pu ouvrir. Une partie sur trois ne
laisse passer aucune question, et il en faut environ sept de suite : c'est le
vrai graal de la piste, pas un seuil de plus.

Trois compteurs neufs se recopient depuis le serveur au premier lancement, donc
un joueur qui les mérite déjà les garde : `weeklyAttempts` (`weekly_attempts`),
`challengesFinished` (`challenge_players` où `played_at` est renseigné) et
`moderationSessions` (les verdicts de `moderation_votes`, cinq par séance, la
taille de la file). Les deux séries, elles, ne se recopient pas : l'ordre des
mots d'une partie n'est pas en base (`run_words` n'a pas de position) — elles
partent de zéro pour tout le monde et se comptent désormais côté client, comme
`cleanRuns` ou `longestWord`, dans le profil sauvegardé sur le compte.

Une seule idée bute sur les chiffres :

- **« Le mot le plus long d'une catégorie »** : le plus long mot embarqué
  d'« Animaux » compte 28 caractères (*Acanthize de Nouvelle-Guinée*, un
  binôme latin), et les autres catégories ont les mêmes monstres. Les joueurs
  tapent pourtant déjà long — 11 mots de 18 lettres, 3 de 20, un record à 25
  — donc l'idée tient si elle ne demande pas le superlatif exact. Je propose
  **un mot de 20 lettres** sur `longestWord`, qui existe déjà : les deux
  barreaux deviennent 12 et 20 lettres. Pour la version littérale, il faudrait
  choisir la catégorie et vérifier que son plus long mot reste tapable en une
  minute.

« Dix mots courts à la suite » ne bute sur rien : 248 parties ont trouvé dix
mots ou plus, 36 en ont trouvé quinze, et les catégories du jeu rendent le mot
de moins de cinq lettres courant.

## Ce qui part

| Retiré | Pourquoi | Ce que ça libère |
|---|---|---|
| `runs-3`, `runs-5`, `runs-7` (3 tuiles) | 20, 19 et 18 profils : la même semaine | 3 tuiles, une seule reste sur la piste |
| `level-6`, `level-8`, `level-13`, `level-16`, `level-25`, `level-30` | deux paires indiscernables | 2 tuiles |
| `words-250`, `words-500`, `words-3500`, `words-5000` | seuils refaits | 1 tuile |
| `combo-13`, `combo-16`, `combo-28` | seuils refaits | 1 tuile |
| `added-1` | un mot ajouté n'est pas un exploit | 1 tuile |
| `added-15`, `added-100`, `added-300`, `added-1000` | refaits ou hors d'atteinte | (avec `added-1`, deux tuiles) |
| `score-700`, `score-800` | inatteignables, refondus | — |
| `clean-run` | une partie sur trois est déjà propre | couleur *menthe* |
| `duel-four` | aucune table de quatre n'existe | couleur *bordeaux* |
| `duel-round-20` | `duelRounds4` n'a jamais compté | couleur *gris*, tuile 52 |
| `day-first` | Reddit seul la joue | couleur *citron* |
| `word-long-10`, `word-long-15` | refaits à 12 et 20 lettres | couleur *canard* conservée |

Les quatre couleurs libérées (bordeaux, citron, menthe, gris) vont aux quatre
nouveaux défis nommés ; les onze autres couleurs de barreau restent attachées
à un seuil, refait. Le compte ne bouge pas : 53 tuiles, 31 couleurs.

## Ce que les joueurs déjà en jeu perdent

Aucun profil ne perd la totalité de sa grille, et les 310 profils qui n'ont
jamais fini une partie n'y perdent rien. Le prix se paie chez les actifs :

- **~18 profils** (ceux qui ont joué 8 parties ou plus) perdent deux tuiles de
  la piste « parties » (`runs-7` et `runs-25`), et **~12** perdent `runs-5` ;
- **~6 profils** de niveau 6 perdent la tuile, **4** de niveau 8-13, **6** de
  niveau 16, **2** de niveau 30 ;
- **~4 profils** perdent `clean-run`, **1** perd `duel-four` ; `day-first` ne
  perd personne sur Android, où la règle du jour n'existe pas — sa couleur
  part au défi du moment, qui y est fermé aussi : sur Reddit, la retirer
  laisserait *citron* sans gagnant, c'est le seul point à trancher pour cette
  version ;
- personne ne perd de tuile de score, de combo ni de mots : ces pistes ne font
  que *descendre* leurs seuils, donc elles en donnent.

Compensation : les huit barreaux neufs et les seuils descendus (score, combo,
mots ajoutés) rouvrent huit tuiles et quatre couleurs que la grille actuelle
ne donne à personne.

## Les deux décisions qui te reviennent

1. **Les seuils des quinze succès Play.** Le vrai paquet du début, c'est eux :
   `level-4` (5 parties), `combo-10`, `runs-10`, `words-100` tombent tous dans
   les dix premières parties. Le jeu seul décide quand ils tombent, donc rien
   n'empêche de les relever — mais la Console resterait sur « 100 mots » et
   « 10 parties » pour toujours, et un joueur qui lit la fiche Play y verrait
   un mensonge. **Ma recommandation : ne pas y toucher**, et accepter ces
   quatre tuiles comme la récompense d'entrée ; tout le reste de la grille,
   lui, s'étale. Si tu préfères les relever quand même, dis-le et je les
   traite comme les autres barreaux.
2. **« Le mot le plus long d'une catégorie »** : vingt lettres, ou la version
   littérale (et alors il faut choisir la catégorie, et son plus long mot
   restera intapable) ?

## Ce que ça coûte à écrire

- `RUNGS` et `RUNG_COLOURS` réécrits (45 lignes), `EXPLOIT_TILES` retouché
  pour la tuile 52 ; aucun dessin ne bouge, `LOOKS` reste tel quel.
- Cinq compteurs neufs au profil (`weeklyAttempts`, `challengesFinished`,
  `moderationSessions`, `shortStreak`, `noPassStreak`) : ils entrent dans la
  sauvegarde du compte (`progress.ts`, `HIGHEST`) et se calculent à la fin
  d'une partie ou à la sortie d'un écran.
- Trois recopies depuis le serveur (`cloud.ts` : `weekly_attempts`,
  `challenge_players`, `moderation_votes`), une seule fois, au premier
  lancement, pour ne pas punir ceux qui les méritent déjà.
- Cinq phrases de jalon dans les sept langues (`t.avatar.milestone`), pour les
  cinq compteurs neufs, plus le nom et la description des défis nommés
  (`fr.ts` en référence).
- Les tests : l'invariant « une tuile, un seul jalon » tient ; l'inventaire des
  quinze Play ne bouge pas ; `ownedDesigns(vétéran)` et les seuils des tests
  d'exploits se réécrivent.

## Livré en 1.7.16 (versionCode 40)

Livré comme ci-dessus, sauf deux points :

- La modération se compte en **verdicts**, sur le compteur qui existe depuis
  toujours (`wordsReviewed`), pas en séances : 50, 150 et 300 verdicts — une
  séance en vaut cinq à dix. Rien à recopier pour elle, donc, et le seuil se
  cale sur les 300 verdicts du plus actif.
- La **recopie depuis le serveur** est écrite avec la livraison : la migration
  `0066_achievement_counters.sql` — **écrite, pas encore poussée** — ouvre
  `my_achievement_counters`, qui rend les tentatives du défi du moment
  (`weekly_attempts`) et les défis entre amis joués
  (`challenge_players.played_at`). `fetchProgress` la lit avec la sauvegarde du
  compte, et `withProgress` garde le plus haut des deux : un joueur qui avait
  joué ses défis entre amis avant la piste ne repart pas de zéro, et rien ne
  redescend jamais. Tant que la migration n'est pas poussée, la requête échoue
  et la sauvegarde reste telle quelle. Les deux séries (`shortStreak`,
  `noPassStreak`), elles, ne se recopient pas par construction : l'ordre des
  mots d'une partie n'est pas en base.
