# Lettrine

Un jeu de mots en solo. Une lettre, une catégorie, quatre-vingt-quatorze
secondes : on écrit, le jeu valide à la frappe, et les mots que personne
n'écrit rapportent le plus.

- **Validation immédiate** contre un dictionnaire embarqué de ~64 000 mots
  français : Wikidata pour les entités, le Wiktionnaire pour les noms communs,
  et les formes fléchies de Lexique — « chats » et « bleue » sont acceptés, et
  comptent comme « chat » et « bleu ».
- **Catégories fermées et stables** (pays, animaux, couleurs, métiers…) : pas de
  films ni de célébrités, qu'un dictionnaire ne peut pas arbitrer.
- **Bonus de rareté** : un mot rare dans la langue rapporte plus qu'un mot
  courant, et ce bonus s'érode si le joueur le ressort à chaque partie ou si
  tout le monde l'écrit.
- **Passer** coûte cinq secondes de chrono, jamais de points.
- **Une faute d'une lettre passe** — lettres interverties, lettre oubliée, lettre
  en trop, lettre fausse : `thailnade` vaut `Thaïlande`. Mais une réponse
  corrigée est payée au tarif de base, si rare que soit le mot : le bonus
  récompense de connaître un mot, pas de l'écrire presque.
- **Niveaux et déblocages** : l'XP gagnée ouvre de nouvelles catégories.
- **Mot manquant** : le joueur le propose en un clic ; réclamé par trois joueurs
  (ou validé par un modérateur), il entre au dictionnaire et lui rapporte 150 XP.

## Commandes

```bash
npm install
npm run dev          # serveur de dev (honore $PORT)
npm test             # domaine — Vitest, doit rester vert
npm run lint         # oxlint
npm run build        # tsc -b puis vite build
npm run import:words # régénère src/data/words/ depuis Wikidata + Lexique
```

Pas de CI : lancer `npm test`, `npm run lint` et `npm run build` avant de
considérer un changement terminé.

## Le barème

| | |
| --- | --- |
| Mot valide | 100 points |
| Bonus de rareté | jusqu'à +300, selon la notoriété du mot |
| Mot juste à une lettre près | 100 points, sans bonus de rareté |
| Série de mots validés | ×1,1 par mot enchaîné, plafonné à ×2 |
| Passer | −5 secondes, série remise à zéro |

La notoriété d'un mot vaut moitié son rang dans sa propre catégorie, moitié la
mesure absolue de deux signaux : la fréquence dans le corpus Lexique (muette sur
les noms propres) et le nombre d'éditions de Wikipédia qui décrivent la chose
(muet sur les noms communs).

Une réponse rattrapée par la tolérance n'y a pas droit : elle vaut 100 points,
et le jeu affiche l'orthographe exacte pour que le joueur la retienne. Le jeu
refuse de deviner quand deux mots de la catégorie sont à une lettre de ce qui a
été tapé, et ne corrige rien en dessous de quatre lettres — un mot de trois
lettres est à une faute de trop d'autres.

Les deux moitiés sont nécessaires. Le rang seul sacre « vermillon » mot courant,
parce que la catégorie des couleurs est pleine de nuances plus obscures encore.
L'échelle absolue seule traite « libellule » et « abeille » en trouvailles
rares, parce que les livres les impriment peu. Ensemble, elles donnent le
gradient attendu : magenta courant, menthe peu commun, malachite rare.

## Architecture

- `src/domain/` — les règles, sans React, DOM ni réseau : tirage des couples
  lettre/catégorie, jugement d'une réponse, rareté, points, XP, déblocages.
  Tout y est testé.
- `src/data/words/*.txt` — les dictionnaires, une ligne
  `mot|sitelinks|fréquence|forme canonique`. Le quatrième champ n'est présent
  que sur les formes fléchies, et pointe vers le mot dont elles dérivent.
- `src/state/` — session de jeu, chrono, persistance locale.
- `src/lib/` — Supabase : profil, parties, usage global des mots, propositions.
- `src/ui/` — un composant par écran.
- `scripts/` — l'import Wikidata + Lexique.
- `supabase/` — migrations et conventions RLS ([détail](supabase/README.md)).

## Le serveur est optionnel

Sans `VITE_SUPABASE_URL` ni `VITE_SUPABASE_ANON_KEY` (voir `.env.example`), le
jeu tourne entièrement dans le navigateur : progression en `localStorage`, mots
proposés mis en file d'attente. Avec un projet Supabase migré, le joueur est
connecté anonymement, ses parties alimentent le classement et la mesure de
rareté collective, et ses propositions partent à la relecture.
