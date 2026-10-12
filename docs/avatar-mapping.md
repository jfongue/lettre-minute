# Proposition de grille d'avatars, tirée de la planche bauhaus

Ta planche (66 cases, une quarantaine de figures distinctes) remplace mes
propositions de départ : c'est elle qui donne son vocabulaire à la grille.
Rien n'est encore appliqué — `LOOKS` est intact, les tuiles montrent toujours
leurs dessins actuels. Ce document est la proposition à valider.

![Les 53 tuiles redessinées, puis les cinq figures gardées en réserve](avatar-mapping.png)

![Les 33 figures relevées sur la planche et dessinées dans `src/ui/paths.tsx`](avatar-shapes.png)

## Ce que la planche a changé dans le code

Rien qu'on puisse voir en jeu : j'ai dessiné les figures qui manquaient, sans
les poser sur aucune tuile.

- Une quinzaine étaient déjà au catalogue : cercle, carré, anneau, cible,
  fleur (les quatre disques), points, damier, sablier, losange, croix,
  lentille, rayons (notre soleil), marches, chevrons, éventail.
- **33 figures ont été dessinées** (`src/ui/paths.tsx`, les mêmes noms que
  dans le tableau ci-dessous) : `stairs` `tents` `gong` `chevrons` `slats`
  `barcode` `stripes` `stripedDisc` `field` `grid` `checker3` `diamonds`
  `noise` `burst` `threeQuarter` `spark` `eye` `links` `pinwheel` `butterfly`
  `twoMoons` `frameDiamond` `roundedFrame` `cushion` `squareBite` `split`
  `spiral` `rays` `corners` `duo` `slab` `dropCut` `keyhole`.
- Elles se lisent à 40 px comme à 120 px (planche ci-dessus, chaque figure
  aux deux tailles).

## La règle de la proposition

Chaque piste a sa famille de figures, et la famille monte avec le seuil :
c'est ce qui fait qu'une tuile dit encore ce qu'elle a coûté.

| Piste | Famille | Ce que ça raconte |
|---|---|---|
| Niveau | ce qui s'empile : marches, tentes, arches, dôme, gong, chevrons, escalier, rayons, étoile | la montée |
| Parties | ce qui s'aligne : barre, barres, lattes, rayures, code-barres, disque rayé | le tally |
| Mots trouvés | ce qui se compte : points, damier, fleur, champ, grille, damier 3×3, bruit | l'abondance |
| Score | ce qui se marque : anneau, disque étoilé, disque entamé, œil, soleil, cible | le coup |
| Série | ce qui s'enchaîne : zigzag, vague, deux lunes, moulin, papillon, fleur | la chaîne |
| Mots ajoutés | ce qui enferme : trait, cadre, cadre losangé, cadre arrondi, coussin, carré mordu, disque plein | le dictionnaire se remplit |
| Exploits | trois figures à part : spirale (« Trois six »), partage (« Juste arbitre »), méandre (« Marathon ») | l'exploit |

## Le tableau, tuile par tuile

« Avatar *n* » est la case `n - 1` du code, comme dans le récapitulatif des
succès.

| Avatar | Ce qu'elle ouvre | Figure |
|---:|---|---|
| 1 à 5 | offertes | `circle` `square` `quarter` `arch` `half` (inchangées) |
| 6 | Niveau 4 | `steps` |
| 7 | 3 parties | `slab` |
| 8 | 100 mots trouvés | `dots` |
| 9 | Score 400 | `ring` |
| 10 | Série 10 | `zigzag` |
| 11 | Niveau 6 | `tents` |
| 12 | 5 parties | `bars` |
| 13 | 250 mots trouvés | `checker` |
| 14 | Score 500 | `burst` |
| 15 | Série 13 | `wave` |
| 16 | Niveau 8 | `arch` + accent |
| 17 | 7 parties | `slats` |
| 18 | 500 mots trouvés | `flower` |
| 19 | Score 600 | `threeQuarter` |
| 20 | Série 16 | `twoMoons` |
| 21 | Niveau 10 | `domes` |
| 22 | 10 parties | `stripes` |
| 23 | 1 000 mots trouvés | `field` |
| 24 | Score 700 | `eye` |
| 25 | Série 20 | `pinwheel` |
| 26 | Niveau 13 | `gong` |
| 27 | 25 parties | `barcode` |
| 28 | 2 000 mots trouvés | `grid` |
| 29 | Score 800 | `sun` |
| 30 | Série 24 | `butterfly` |
| 31 | Niveau 16 | `archway` |
| 32 | 50 parties | `stripedDisc` |
| 33 | 3 500 mots trouvés | `checker3` |
| 34 | Score 900 | `target` |
| 35 | Série 28 | `bloom` |
| 36 | Niveau 20 | `chevrons` |
| 37 | 100 parties | `bars` + accent |
| 38 | 5 000 mots trouvés | `noise` |
| 39 | Niveau 25 | `stairs` |
| 40 | 200 parties | `slats` + accent |
| 41 | Niveau 30 | `rays` |
| 42 | 400 parties | `stripes` + accent |
| 43 | Niveau 35 | `spark` |
| 44 | 1 mot ajouté | `bang` (le trait, avec son point) |
| 45 | 15 mots ajoutés | `frame` |
| 46 | 50 mots ajoutés | `frameDiamond` |
| 47 | 100 mots ajoutés | `roundedFrame` |
| 48 | 300 mots ajoutés | `cushion` |
| 49 | 500 mots ajoutés | `squareBite` |
| 50 | 1 000 mots ajoutés | `dial` |
| 51 | Trois six (score 666) | `spiral` |
| 52 | Juste arbitre (10 verdicts) | `split` |
| 53 | Marathon (20 manches de duel) | `links` |

## Les cinq gardées en réserve

Dessinées, dans le code, et ouvertes par aucun succès — de quoi habiller le
prochain barreau ou le prochain exploit sans rien redessiner :

`corners`, `duo`, `dropCut`, `diamonds`, `keyhole`.

## Ce que la proposition abandonne

La grille ne montrerait plus dix-huit figures du catalogue actuel : `six`,
`card`, `ribbon` (mes trois tuiles d'exploit, remplacées par la spirale, le
partage et le méandre), `star`, `heart`, `moon`, `hourglass`, `lens`, `cross`,
`corner`, `drop`, `pill`, `hexagon`, `triangle`, `chevron`, `ringbroken`,
`comma`, `eclipse`. Elles restent dessinées, mais plus aucune tuile ne les
porte : dis-moi si tu en gardes une, c'est le seul endroit où je peux me
tromper.

Aucun identifiant de tuile ne bouge : 53 cases, 5 offertes, 45 barreaux,
3 exploits, les mêmes seuils, les mêmes succès. Un joueur qui porte la case 38
garde la case 38 — c'est son dessin qui change. Les icônes Play Games, elles,
ne changent pas du tout : la Console n'en met jamais une à jour.
