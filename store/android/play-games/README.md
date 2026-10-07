# Succès Play Games — la Console, les icônes, et ce que les joueurs atteignent

Ce dossier porte les quinze succès publiés sur Play Games : leurs icônes
(`<id>.png`), et le ZIP que la Console importe sous
**Play Games Services › Réussites › Importer**.

```
npm run render:achievements && npx tsx scripts/play-games-achievements.ts
```

Le script relit `src/domain/achievements.ts` (le seuil client de chaque succès)
et les textes de `scripts/play-games-achievements.ts` (écrits un peu plus long
pour la fiche), puis écrit `store/android/play-games/achievements.zip`.

**La Console importe des succès nouveaux ; elle ne met jamais à jour ceux
qu'elle a.** C'est la règle qui commande tout ce fichier : un seuil déjà
publié ne se corrige plus par un import, il se corrige à la main dans la
Console — et il ne se corrige *que* là pour le texte, puisque le seuil qui
déclenche le déblocage vit dans l'app.

- Le **seuil** est dans `src/domain/achievements.ts` (`goal.at`). L'app envoie
  le succès atteint à Play au lancement et à chaque fin de partie
  (`reportAchievements`, `src/App.tsx`) ; Play ignore un doublon.
- Le **nom et la description** sont dans la Console, pour la fiche Play ; la
  fiche dans l'app vient de `src/i18n/<langue>.ts`, sous `ach.<id>`.
- L'**identifiant** et les **points** d'un succès publié ne se modifient plus
  (création seulement). Son texte, si — encore faut-il le faire à la main,
  langue par langue (`store/android/play-games/README.md` § « Ce qu'il reste
  à faire dans la Console »).

## Ce que les joueurs atteignent

Relevé du 7 octobre 2026 (`runs` + `profiles`, 40 joueurs ayant au moins une
partie, 1089 parties). Le tableau donne, pour chaque succès publié, le nombre
de joueurs qui le détiennent, et le plus haut total atteint.

| id | seuil | joueurs | plus haut |
| --- | --- | --- | --- |
| `level-4` | niveau 4 | 20 | niveau 35 |
| `level-10` | niveau 10 | 10 | — |
| `level-20` | niveau 20 | 5 | — |
| `level-35` | niveau 35 | 1 | — |
| `runs-10` | 10 parties | 20 | 190 parties |
| `runs-100` | 100 parties | 4 | — |
| `runs-400` | 400 parties | **0** | 190 |
| `words-100` | 100 mots | 17 | 1516 mots |
| `words-1000` | 1000 mots | 2 | — |
| `words-5000` | 5000 mots | **0** | 1516 |
| `combo-10` | 10 d'affilée | 13 | 23 |
| `combo-24` | 24 d'affilée | **0** | 23 |
| `score-900` | 900 points | **0** | 621 |
| `added-10` | 10 mots au dictionnaire | au moins 1 | — |
| `discoveries-15` | 15 découvertes | au moins 1 | — |

Quatre seuils n'ont donc jamais été atteints, dont deux (400 parties, 5000
mots) à plus du double du meilleur total : ce ne sont pas des sommets, ce sont
des murs. Les onze autres tiennent — le niveau 35, les 1000 mots, les 15
découvertes et les 10 mots ajoutés sont des sommets atteints.

## Les quatre murs, et ce qui les remplacerait

Mesuré sur les mêmes 40 joueurs : nombre de joueurs au-dessus du seuil
candidat.

| id | publié | plus haut | candidat | joueurs au candidat |
| --- | --- | --- | --- | --- |
| `combo-24` | 24 d'affilée | 23 | **20 d'affilée** | 2 |
| `score-900` | 900 points | 621 | **600 points** | 1 |
| `runs-400` | 400 parties | 190 | **200 parties** | 0 — le mieux placé est à 190, à dix parties |
| `words-5000` | 5000 mots | 1516 | **2000 mots** | 0 — le mieux placé est à 1516, à quelques semaines |

Les quatre gardent leur rang dans l'échelle : `combo-10 → combo-20` (13 → 2
joueurs), `runs-10 → runs-100 → runs-200` (20 → 4 → 0), `words-100 →
words-1000 → words-2000` (17 → 2 → 0), et `score-600` devient le sommet
réellement tenu, là où `score-900` restait hors de portée.

Les onze seuils atteints ne bougent pas : ils sont la mémoire des joueurs, et
un seuil qui descend redistribue les déblocages vers le bas — un succès Play
Games ne se reprend jamais.

## Ce qu'il reste à faire dans la Console

Si les quatre remplacements sont retenus, pour chacun des quatre :

1. dans le dépôt, `src/domain/achievements.ts` (`goal.at`), pour que l'app
   débloque au nouveau seuil ;
2. `scripts/play-games-achievements.ts` (`TEXTS`), pour que le ZIP à venir
   porte le bon texte ;
3. dans la Console, **Play Games Services › Réussites ›** le succès **›
   Modifier** : corriger la description dans les sept langues, et le nom pour
   `score-900` seul (« Neuf cents » ne décrit plus 600) ;
4. rien à faire côté app pour le déblocage : le prochain lancement ou la
   prochaine partie renvoie tous les succès atteints, et Play rattrape.

L'identifiant (`CgkI…`) et les points d'un succès publié ne se modifient pas
dans la Console : le remplacement ne touche donc que le texte. Vérifier au
moment de l'édition que le nom reste modifiable ; sinon, garder le nom publié
et ne corriger que la description.

### Textes de remplacement

Noms et descriptions, dans l'ordre `en-US`, `fr-FR`, `de-DE`, `es-ES`,
`it-IT`, `nl-NL`, `pt-BR`. Aucun champ ne peut porter de virgule : les CSV de
l'import n'ont pas de guillemets.

**`combo-20` — Inarrêtable / Unstoppable** (seule la description change)

| langue | nom | description |
| --- | --- | --- |
| en-US | Unstoppable | Chain 20 answers in a row |
| fr-FR | Inarrêtable | Enchaîne 20 réponses d’affilée |
| de-DE | Unaufhaltsam | Gib 20 Antworten in Folge |
| es-ES | Imparable | Encadena 20 respuestas seguidas |
| it-IT | Inarrestabile | Inanella 20 risposte di fila |
| nl-NL | Niet te stoppen | Geef 20 antwoorden op rij |
| pt-BR | Imparável | Emende 20 respostas seguidas |

**`score-600` — Six cents / Six hundred** (nom et description)

| langue | nom | description |
| --- | --- | --- |
| en-US | Six hundred | Score 600 points in one game |
| fr-FR | Six cents | Marque 600 points en une partie |
| de-DE | Sechshundert | Erziele 600 Punkte in einer Runde |
| es-ES | Seiscientos | Consigue 600 puntos en una partida |
| it-IT | Seicento | Fai 600 punti in una partita |
| nl-NL | Zeshonderd | Scoor 600 punten in één potje |
| pt-BR | Seiscentos | Marque 600 pontos em uma partida |

**`runs-200` — Inépuisable / Tireless** (seule la description change)

| langue | nom | description |
| --- | --- | --- |
| en-US | Tireless | Play 200 games |
| fr-FR | Inépuisable | Joue 200 parties |
| de-DE | Unermüdlich | Spiele 200 Runden |
| es-ES | Incansable | Juega 200 partidas |
| it-IT | Instancabile | Gioca 200 partite |
| nl-NL | Onvermoeibaar | Speel 200 potjes |
| pt-BR | Incansável | Jogue 200 partidas |

**`words-2000` — Dictionnaire vivant / Walking dictionary** (seule la
description change)

| langue | nom | description |
| --- | --- | --- |
| en-US | Walking dictionary | Find 2000 words |
| fr-FR | Dictionnaire vivant | Trouve 2000 mots |
| de-DE | Wandelndes Wörterbuch | Finde 2000 Wörter |
| es-ES | Diccionario andante | Encuentra 2000 palabras |
| it-IT | Dizionario vivente | Trova 2000 parole |
| nl-NL | Wandelend woordenboek | Vind 2000 woorden |
| pt-BR | Dicionário ambulante | Encontre 2000 palavras |

## Où vivent les quatorze autres succès

Le jeu en compte trente-deux : les quinze ci-dessus, et dix-sept qui ne vivent
que dans l'app — leur page, `src/ui/AchievementsScreen.tsx`, ouverte depuis le
tiroir du profil, avec une barre de progression pour les paliers et la tuile
d'avatar du défi pour les exploits. Play n'a plus de budget de points à leur
donner (`src/domain/achievements.ts` dit lesquels sont publiés), et un succès
de jeu n'a pas besoin de la Console pour exister : il se débloque au bilan et
s'annonce à l'écran.
