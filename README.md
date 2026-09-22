# Lettrine

Un jeu de lettres pour une table : une lettre, trois catégories, quatre-vingt-quatorze
secondes. Chacun écrit un mot par catégorie sur sa feuille ; un mot que personne
d'autre n'a trouvé vaut le double.

L'appareil ne remplace pas les feuilles : il tient la carte, le chrono, et il
compte les points au dépouillement.

## Commandes

```bash
npm install
npm run dev     # serveur de dev (honore $PORT)
npm test        # domaine — Vitest, doit rester vert
npm run lint    # oxlint
npm run build   # tsc -b puis vite build
```

Pas de CI : lancer les trois avant de considérer un changement terminé.

## La boucle

1. **Carte** — la lettre et les trois catégories de la manche.
2. **Chrono** — tout le monde écrit ; on peut mettre en pause ou arrêter le temps.
3. **Dépouillement** — une catégorie à la fois, chacun dicte son mot.
4. **Manche** — les points, mot par mot, puis le total de la partie.

### Les points

| | |
| --- | --- |
| Mot valide que personne d'autre n'a trouvé | 2 |
| Mot valide écrit par plusieurs joueurs | 1 |
| Mot qui ne commence pas par la lettre, ou case vide | 0 |
| Les trois catégories remplies (carton plein) | +1 |

Accents, majuscules, traits d'union et apostrophes ne comptent pas : « Éclair »,
« eclair » et « ECLAIR » sont le même mot, pour les doublons comme pour la lettre.

## Architecture

- `src/domain/` — les règles, sans React ni DOM : tirage des cartes, comparaison
  des réponses, points, déroulé de la partie. Tout y est testé.
- `src/state/` — le réducteur de session (les phases de la boucle) et le chrono.
- `src/ui/` — un composant par écran, sans logique de règles.
- `src/styles.css` — les jetons de style et toutes les règles d'affichage.

Le domaine est déterministe : une partie se rejoue à l'identique depuis sa
graine, ce qui rend les tirages testables et laisserait deux appareils distribuer
les mêmes cartes si le jeu passait un jour en réseau.
