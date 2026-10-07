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
  langue par langue.

## Ce que les joueurs atteignent

Relevé du 7 octobre 2026 (`runs` + `profiles`, 40 joueurs ayant au moins une
partie, 1089 parties), sur les seuils tels qu'ils étaient publiés. Le tableau
donne, pour chaque succès, le nombre de joueurs qui le détiennent et le plus
haut total atteint.

| id | seuil mesuré | joueurs | plus haut |
| --- | --- | --- | --- |
| `level-4` | niveau 4 | 20 | niveau 35 |
| `level-10` | niveau 10 | 10 | — |
| `level-20` | niveau 20 | 5 | — |
| `level-35` | niveau 35 | 1 | — |
| `runs-10` | 10 parties | 20 | 190 parties |
| `runs-100` | 100 parties | 4 | — |
| `runs-400` | 400 parties | 0 | 190 |
| `words-100` | 100 mots | 17 | 1516 mots |
| `words-1000` | 1000 mots | 2 | — |
| `words-5000` | 5000 mots | 0 | 1516 |
| `combo-10` | 10 d'affilée | 13 | 23 |
| `combo-24` | 24 d'affilée | 0 | 23 |
| `score-900` | 900 points | 0 | 621 |
| `added-10` | 10 mots au dictionnaire | au moins 1 | — |
| `discoveries-15` | 15 découvertes | au moins 1 | — |

Trois seuils n'ont jamais été atteints. Deux tiennent comme sommets : le combo
à 24 est à **une réponse** du meilleur (23), et les 400 parties sont un sommet
long que le jeu garde. Le troisième, 900 points, est à une fois et demie le
meilleur score de toutes les parties jamais jouées : ce n'est pas un sommet,
c'est un mur. Les 5000 mots le sont aussi, à plus du triple des 1516 du mieux
placé.

## Les deux murs, remplacés

Mesuré sur les mêmes 40 joueurs : nombre de joueurs au-dessus du seuil
candidat.

| id publié | seuil publié | plus haut | seuil client retenu | joueurs au seuil |
| --- | --- | --- | --- | --- |
| `score-900` | 900 points | 621 | **`score-666` : 666 points** | 0 — à 45 points du meilleur score |
| `words-5000` | 5000 mots | 1516 | **`words-2000` : 2000 mots** | 0 — le mieux placé est à 1516 |

666 n'est pas un sommet atteint, c'est un sommet **à portée** : le record
absolu est à 621, et une seule bonne partie le dépasse. Les 2000 mots
demandent au mieux placé un tiers de mots en plus, quelques semaines de jeu.

Le seuil client est déjà au nouveau chiffre (`src/domain/achievements.ts`,
`src/lib/playGames.ts`), et **la Console a reçu les deux textes le 7 octobre
2026** — sept langues chacun, relus après publication. Les treize autres
succès ne
bougent pas : ils sont la mémoire des joueurs, et un seuil qui descend
redistribue les déblocages vers le bas — un succès Play Games ne se reprend
jamais.

## Ce que la Console a reçu

Le 7 octobre 2026, les deux succès publiés ont été corrigés à la main :
**Play Games Services › Réussites ›** le succès **› Modifier**, la langue une à
une, puis « Enregistrer comme brouillon » et « Publier les modifications » —
avec les textes ci-dessous, dans les sept langues. Relus après publication,
tous justes.

Le déblocage n'a rien demandé : le prochain lancement ou la prochaine partie
renvoie tous les succès atteints, et Play rattrape. Le nouveau seuil est déjà
dans l'app.

L'identifiant (`CgkI…`) et les points d'un succès publié ne se modifient pas
dans la Console : le remplacement ne touche donc que le texte. Vérifier au
moment de l'édition que le nom reste modifiable ; sinon, garder le nom publié
et ne corriger que la description.

### Textes de remplacement

Noms et descriptions, dans l'ordre `en-US`, `fr-FR`, `de-DE`, `es-ES`,
`it-IT`, `nl-NL`, `pt-BR`. Aucun champ ne peut porter de virgule : les CSV de
l'import n'ont pas de guillemets.

**`score-666` — 666 points** (nom et description)

| langue | nom | description |
| --- | --- | --- |
| en-US | Three sixes | Score 666 points in one game |
| fr-FR | Trois six | Marque 666 points en une partie |
| de-DE | Drei Sechsen | Erziele 666 Punkte in einer Runde |
| es-ES | Tres seises | Consigue 666 puntos en una partida |
| it-IT | Tre sei | Fai 666 punti in una partita |
| nl-NL | Drie zessen | Scoor 666 punten in één potje |
| pt-BR | Três seis | Marque 666 pontos em uma partida |

**`words-2000` — 2000 mots** (seule la description change)

| langue | nom | description |
| --- | --- | --- |
| en-US | Walking dictionary | Find 2000 words |
| fr-FR | Dictionnaire vivant | Trouve 2000 mots |
| de-DE | Wandelndes Wörterbuch | Finde 2000 Wörter |
| es-ES | Diccionario andante | Encuentra 2000 palabras |
| it-IT | Dizionario vivente | Trova 2000 parole |
| nl-NL | Wandelend woordenboek | Vind 2000 woorden |
| pt-BR | Dicionário ambulante | Encontre 2000 palavras |

Les mêmes textes vivent dans `scripts/play-games-achievements.ts` (`TEXTS`) et
dans `src/i18n/<langue>.ts` (`ach.<id>`) : les trois doivent dire la même
chose, et le ZIP à venir les relira.

## Où vivent les seize autres succès

Le jeu en compte trente et un : les quinze ci-dessus, et seize qui ne vivent
que dans l'app — leur page, `src/ui/AchievementsScreen.tsx`, ouverte depuis le
tiroir du profil, avec une barre de progression pour les paliers et la tuile
d'avatar du défi pour les exploits. Play n'a plus de budget de points à leur
donner (`src/domain/achievements.ts` dit lesquels sont publiés), et un succès
de jeu n'a pas besoin de la Console pour exister : il se débloque au bilan et
s'annonce à l'écran.
