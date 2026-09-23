# Lettre Minute

Un jeu de mots en solo. Une lettre, une catégorie, soixante
secondes : on écrit, le jeu valide à la frappe, et les mots que personne
n'écrit rapportent le plus.

- **Cinq catégories au plus par partie**, tirées parmi celles que le joueur
  possède et annoncées avant un compte à rebours de trois secondes. Pendant
  l'annonce, toucher une catégorie l'échange contre une de la réserve.
- **Validation immédiate** contre un dictionnaire embarqué de ~64 000 mots
  français : Wikidata pour les entités, le Wiktionnaire pour les noms communs,
  et les formes fléchies de Lexique — « chats » et « bleue » sont acceptés, et
  comptent comme « chat » et « bleu ».
- **Catégories fermées et stables** (pays, animaux, couleurs, métiers…) : pas de
  films ni de célébrités, qu'un dictionnaire ne peut pas arbitrer.
- **Rien n'est révélé pendant la frappe** : le champ nomme le mot seulement
  quand il est écrit juste, dit « à une lettre près » sans nommer la
  correction, et les points comme la rareté n'apparaissent qu'à la validation.
- **Bonus de rareté** : un mot rare dans le français d'aujourd'hui rapporte plus
  qu'un mot courant, et ce bonus s'érode si le joueur le ressort à chaque partie
  ou si tout le monde l'écrit.
- **Passer** coûte cinq secondes de chrono, jamais de points.
- **Une faute d'une lettre passe** — lettres interverties, lettre oubliée, lettre
  en trop, lettre fausse : `thailnade` vaut `Thaïlande`. Mais une réponse
  corrigée est payée au tarif de base, si rare que soit le mot : le bonus
  récompense de connaître un mot, pas de l'écrire presque.
- **Niveaux et déblocages** : on commence avec trois catégories ; chaque niveau
  en propose trois nouvelles, le joueur en garde une. L'offre suivante évite
  de reproposer les mêmes tant qu'il en reste d'autres.
- **Fin de partie en deux temps** : le score, puis chaque mot trouvé, un par
  un ; ensuite l'XP qui monte, la catégorie à choisir, les nouveautés d'avatar
  et le résumé.
- **Compte et avatar** : après une partie, le joueur anonyme peut créer un
  compte (nom, adresse, mot de passe) ou se connecter, et la partie y entre
  aussitôt. L'avatar est une tuile de l'affiche — cent formes animées, trente
  couleurs, trois au départ — que les niveaux et les exploits débloquent.
- **Mot manquant** : le joueur le propose en un clic ; réclamé par trois joueurs
  (ou validé par un modérateur), il entre au dictionnaire et lui rapporte 150 XP.

## Commandes

```bash
npm install
npm run dev          # serveur de dev (honore $PORT)
npm test             # domaine — Vitest, doit rester vert
npm run lint         # oxlint
npm run build        # tsc -b puis vite build
npm run import:words # régénère src/data/words/ (Wikidata, Wiktionnaire, Lexique, wordfreq, Wikipédia)
npm run android:sync # build web puis copie dans le projet Android
npm run android:bundle # .aab signé pour le Play Store
```

L'application Android (et iOS plus tard) est le même jeu emballé par Capacitor :
voir [`docs/publication-android.md`](docs/publication-android.md).

Pas de CI : lancer `npm test`, `npm run lint` et `npm run build` avant de
considérer un changement terminé.

## Le barème

| | |
| --- | --- |
| Mot valide | 10 points |
| Bonus de rareté | jusqu'à +20, selon la notoriété du mot |
| Mot juste à une lettre près | 10 points, sans bonus de rareté |
| Série de mots validés | ×1,1 par mot enchaîné, plafonné à ×2 |
| Passer | −5 secondes, série remise à zéro |

Une petite partie tourne autour de 100 points, une partie énorme — une
trentaine de mots, souvent rares, en longue série — approche 1 000. Chaque point
rapporte un point d'XP.

La notoriété d'un mot vaut moitié son rang dans sa propre catégorie, moitié la
mesure absolue de deux signaux du français contemporain, le plus fort des deux :

- **la fréquence d'usage** selon [wordfreq](https://github.com/rspeer/wordfreq)
  — Wikipédia, sous-titres 2018, presse jusqu'en 2021, web, Twitter, Reddit ;
- **les visites quotidiennes de l'article** sur Wikipédia en français, tirées du
  dernier [clickstream](https://dumps.wikimedia.org/other/clickstream/) mensuel.

Le nombre d'éditions de Wikipédia qui décrivent la chose (les *sitelinks*) ne
sert plus que de repli : des robots ont écrit un article en quarante langues
pour chaque espèce d'oiseau et chaque commune, ce qui faisait passer « Aigle
martial » ou « Abrest » pour des mots courants.

Les deux signaux mentent sur les homonymes, alors l'import les filtre. La
fréquence compte tous les sens d'un mot à la fois — « Mars » le mois pour un
poisson, « ne » la négation pour un code pays. Elle n'est lue que pour un mot
que le Wiktionnaire range dans la catégorie, ou qui nomme une chose décrite
par au moins cinquante Wikipédias. Un article, lui, ne parle que d'un sens,
mais un libellé peut tomber sur celui d'un homonyme : la pomme de terre
« Salvador » sur le pays. Un élément Wikidata de moins de dix éditions que le
Wiktionnaire n'atteste pas n'hérite donc d'aucune visite. Enfin, une page
d'homonymie ne compte pas comme lecture.

Une réponse rattrapée par la tolérance n'y a pas droit : elle vaut 10 points,
et le jeu affiche l'orthographe exacte pour que le joueur la retienne. Le jeu
refuse de deviner quand deux mots de la catégorie sont à une lettre de ce qui a
été tapé, et ne corrige rien en dessous de quatre lettres — un mot de trois
lettres est à une faute de trop d'autres.

Les deux moitiés sont nécessaires. Le rang seul sacre « vermillon » mot courant,
parce que la catégorie des couleurs est pleine de nuances plus obscures encore.
L'échelle absolue seule écrase une catégorie entière dès que ses mots sont peu
cherchés, même quand certains sont bien plus connus que d'autres. Ensemble, elles donnent le
gradient attendu : magenta courant, vermillon peu commun, menthe rare,
malachite très rare.

## Architecture

- `src/domain/` — les règles, sans React, DOM ni réseau : tirage des couples
  lettre/catégorie, jugement d'une réponse, rareté, points, XP, déblocages.
  Tout y est testé.
- `src/data/words/*.json` — les dictionnaires, un tableau par mot
  `[mot, sitelinks, fréquence, forme canonique, visites]`. La forme canonique
  n'est renseignée que sur les formes fléchies (vide sinon), et pointe vers le
  mot dont elles dérivent ; elles empruntent sa notoriété et n'ont pas de
  visites. Un mot sans visites (page d'homonymie) est jugé sur ses sitelinks.
- `src/state/` — session de jeu, chrono, persistance locale.
- `src/lib/` — Supabase : profil, parties, usage global des mots, propositions,
  effacement du compte ; `native.ts` pour ce qui parle au téléphone.
- `src/ui/` — un composant par écran.
- `scripts/` — l'import : Wikidata et le Wiktionnaire pour les mots, Lexique
  pour les formes fléchies, wordfreq et Wikipédia pour la notoriété.
- `supabase/` — migrations et conventions RLS ([détail](supabase/README.md)).
- `android/` — le projet natif généré par Capacitor ; `assets/` la source de
  l'icône et de l'écran de lancement ; `store/` la fiche du Play Store.

## Le serveur est optionnel

Sans `VITE_SUPABASE_URL` ni `VITE_SUPABASE_ANON_KEY` (voir `.env.example`), le
jeu tourne entièrement dans le navigateur : progression en `localStorage`, mots
proposés mis en file d'attente. Avec un projet Supabase migré, le joueur est
connecté anonymement, ses parties alimentent le classement et la mesure de
rareté collective, et ses propositions partent à la relecture.
