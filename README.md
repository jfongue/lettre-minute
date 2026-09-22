# Lettrine

Un jeu de mots en solo. Une lettre, une catégorie, quatre-vingt-quatorze
secondes : on écrit, le jeu valide à la frappe, et les mots que personne
n'écrit rapportent le plus.

- **Validation immédiate** contre un dictionnaire embarqué de ~48 000 mots
  français, importés de Wikidata et pondérés par la fréquence du corpus Lexique.
- **Catégories fermées et stables** (pays, animaux, couleurs, métiers…) : pas de
  films ni de célébrités, qu'un dictionnaire ne peut pas arbitrer.
- **Bonus de rareté** : un mot rare dans la langue rapporte plus qu'un mot
  courant, et ce bonus s'érode si le joueur le ressort à chaque partie ou si
  tout le monde l'écrit.
- **Passer** coûte cinq secondes de chrono, jamais de points.
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
| Série de mots validés | ×1,1 par mot enchaîné, plafonné à ×2 |
| Passer | −5 secondes, série remise à zéro |

La notoriété d'un mot combine deux signaux, parce qu'aucun ne couvre tout le
dictionnaire : la fréquence dans le corpus Lexique (muette sur les noms propres)
et le nombre d'éditions de Wikipédia qui décrivent la chose (muet sur les noms
communs). Le plus connu des deux l'emporte : un mot n'est rare que si les deux
sources sont d'accord.

## Architecture

- `src/domain/` — les règles, sans React, DOM ni réseau : tirage des couples
  lettre/catégorie, jugement d'une réponse, rareté, points, XP, déblocages.
  Tout y est testé.
- `src/data/words/*.txt` — les dictionnaires, une ligne `mot|sitelinks|fréquence`.
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
