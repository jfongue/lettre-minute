# Proposition de grille d'avatars, tirée de la planche bauhaus

Ta planche (66 cases, une quarantaine de figures distinctes) remplace mes
propositions de départ : c'est elle qui donne son vocabulaire à la grille.
Rien n'est encore appliqué — `LOOKS` est intact, les tuiles montrent toujours
leurs dessins actuels. Ce document est la proposition à valider.

![Les 53 tuiles redessinées, puis les cinq figures gardées en réserve](avatar-mapping.png)

## L'accent colore une part de la figure

C'est le fond de la nouvelle proposition : l'accent ne pose plus un petit motif
dans un coin, il **colorie une part de la figure elle-même** — le rond du gong,
la ligne du bas du champ de points, la première flèche des chevrons, le carré
du milieu de l'escalier. Une figure peut porter une part dessinée à part
(`DetailKind`), rendue par-dessus dans la couleur d'accent du joueur : si le
joueur choisit la même couleur pour sa forme et son accent, la part s'efface,
exactement comme aujourd'hui pour le point du « ! ».

**42 tuiles sur 53** ont ainsi une part colorable. Les dix autres sont d'un
seul tenant : les cinq offertes, `slab`, `wave`, `threeQuarter`, `spark` et
`cushion` — l'accent n'y a rien à colorer, elles restent pleines.

Tes quatre points, un par un :

- **le point du « ! »** (Avatar 44) : `bang` garde son trait et son point
  (`bangDot`), le point dans la couleur d'accent — il fait partie de la figure,
  la grille le montre sous le trait.
- **l'ancien Niveau 16** (Avatar 31) : il revient tel quel, `half` et son rond
  en coin. C'est la seule tuile de la proposition qui garde un motif en coin,
  parce que c'est celle-là que tu aimes.
- **les Avatars 37, 40 et 42** (100, 200 et 400 parties) : leur accent de coin
  s'en va, chacune prend une figure que rien d'autre ne porte — `halfBars` (un
  registre), `bands` (quatre chevrons empilés), `peaks` (un semis de pointes).
  Trois figures nouvelles, dessinées d'après la planche ; **aucune réserve
  n'est entamée**.
- **un maximum de parts en accent** : le tableau ci-dessous dit, tuile par
  tuile, ce que l'accent colore.

## Ce que la planche a changé dans le code

Rien qu'on puisse voir en jeu : j'ai dessiné les figures et les parts qui
manquaient, sans les poser sur aucune tuile.

- Une vingtaine de figures étaient déjà au catalogue : cercle, carré, anneau,
  cible, fleur (les quatre disques), points, damier, sablier, losange, croix,
  lentille, rayons (notre soleil), marches, chevrons, éventail.
- **37 figures ont été dessinées** (`src/ui/paths.tsx`, les mêmes noms que dans
  le tableau ci-dessous) : les 33 de la planche — `stairs` `tents` `gong`
  `chevrons` `slats` `barcode` `stripes` `stripedDisc` `field` `grid` `checker3`
  `diamonds` `noise` `burst` `threeQuarter` `spark` `eye` `links` `pinwheel`
  `butterfly` `twoMoons` `frameDiamond` `roundedFrame` `cushion` `squareBite`
  `split` `spiral` `rays` `corners` `duo` `slab` `dropCut` `keyhole` — plus
  `gate`, `halfBars`, `bands` et `peaks`.
- **42 parts** ont été dessinées à côté de leur figure (`DetailKind` dans
  `src/domain/avatar.ts`) : l'accent les relira le jour où tu valides.

## La règle de la proposition

Chaque piste a sa famille de figures, et la famille monte avec le seuil :
c'est ce qui fait qu'une tuile dit encore ce qu'elle a coûté.

| Piste | Famille | Ce que ça raconte |
|---|---|---|
| Niveau | ce qui s'empile : marches, tentes, porte, dôme, gong, chevrons, escalier, rayons, étoile | la montée |
| Parties | ce qui s'aligne : barre, barres, lattes, rayures, code-barres, disque rayé, registre, bandes, pointes | le tally |
| Mots trouvés | ce qui se compte : points, damier, fleur, champ, grille, damier 3×3, bruit | l'abondance |
| Score | ce qui se marque : anneau, disque étoilé, disque entamé, œil, soleil, cible | le coup |
| Série | ce qui s'enchaîne : zigzag, vague, deux lunes, moulin, papillon, fleur | la chaîne |
| Mots ajoutés | ce qui enferme : trait, cadre, cadre losangé, cadre arrondi, coussin, carré mordu, disque plein | le dictionnaire se remplit |
| Exploits | trois figures à part : spirale (« Trois six »), partage (« Juste arbitre »), méandre (« Marathon ») | l'exploit |

## Le tableau, tuile par tuile

« Avatar *n* » est la case `n - 1` du code, comme dans le récapitulatif des
succès. La dernière colonne dit ce que l'accent colore, quand il y a de quoi.

| Avatar | Ce qu'elle ouvre | Figure | Part en accent |
|---:|---|---|---|
| 1 à 5 | offertes | `circle` `square` `quarter` `arch` `half` (inchangées) | — |
| 6 | Niveau 4 | `steps` | la marche du milieu |
| 7 | 3 parties | `slab` | — |
| 8 | 100 mots trouvés | `dots` | la ligne du bas |
| 9 | Score 400 | `ring` | la moitié gauche |
| 10 | Série 10 | `zigzag` | le premier pli |
| 11 | Niveau 6 | `tents` | la petite tente |
| 12 | 5 parties | `bars` | la barre du milieu |
| 13 | 250 mots trouvés | `checker` | un des deux carrés |
| 14 | Score 500 | `burst` | l'étoile du milieu |
| 15 | Série 13 | `wave` | — |
| 16 | Niveau 8 | `gate` | le cintre |
| 17 | 7 parties | `slats` | la latte du haut |
| 18 | 500 mots trouvés | `flower` | un pétale |
| 19 | Score 600 | `threeQuarter` | — |
| 20 | Série 16 | `twoMoons` | la lune de gauche |
| 21 | Niveau 10 | `domes` | le dôme du bas |
| 22 | 10 parties | `stripes` | une bande |
| 23 | 1 000 mots trouvés | `field` | la ligne du bas |
| 24 | Score 700 | `eye` | l'iris |
| 25 | Série 20 | `pinwheel` | une pale |
| 26 | Niveau 13 | `gong` | le disque |
| 27 | 25 parties | `barcode` | la barre la plus large |
| 28 | 2 000 mots trouvés | `grid` | la ligne du milieu |
| 29 | Score 800 | `sun` | le disque |
| 30 | Série 24 | `butterfly` | l'aile gauche |
| 31 | Niveau 16 | `half` + son rond en coin (sa tuile d'avant) | le rond, en coin |
| 32 | 50 parties | `stripedDisc` | la bande du milieu |
| 33 | 3 500 mots trouvés | `checker3` | le carré du centre |
| 34 | Score 900 | `target` | le centre |
| 35 | Série 28 | `bloom` | un pétale |
| 36 | Niveau 20 | `chevrons` | la flèche de gauche |
| 37 | 100 parties | `halfBars` | la bande du bas |
| 38 | 5 000 mots trouvés | `noise` | le second semis, intercalé |
| 39 | Niveau 25 | `stairs` | le carré du milieu |
| 40 | 200 parties | `bands` | la bande du haut |
| 41 | Niveau 30 | `rays` | les quatre rayons droits |
| 42 | 400 parties | `peaks` | la rangée du bas |
| 43 | Niveau 35 | `spark` | — |
| 44 | 1 mot ajouté | `bang` | le point, sous le trait |
| 45 | 15 mots ajoutés | `frame` | le panneau |
| 46 | 50 mots ajoutés | `frameDiamond` | le losange |
| 47 | 100 mots ajoutés | `roundedFrame` | le carré arrondi |
| 48 | 300 mots ajoutés | `cushion` | — |
| 49 | 500 mots ajoutés | `squareBite` | la bouchée |
| 50 | 1 000 mots ajoutés | `dial` | l'aiguille |
| 51 | Trois six (score 666) | `spiral` | le tour intérieur |
| 52 | Juste arbitre (10 verdicts) | `split` | la bande |
| 53 | Marathon (20 manches de duel) | `links` | la boucle |

## Les cinq gardées en réserve

Dessinées, dans le code, et ouvertes par aucun succès — de quoi habiller le
prochain barreau ou le prochain exploit sans rien redessiner :

`corners`, `duo`, `dropCut`, `diamonds`, `keyhole`.

## Ce que la proposition abandonne

La grille ne montrerait plus vingt figures du catalogue actuel : `six`, `card`,
`ribbon` (mes trois tuiles d'exploit, remplacées par la spirale, le partage et
le méandre), `archway` (l'ancien Niveau 16, rendu à `half`), `star`, `heart`,
`moon`, `hourglass`, `lens`, `cross`, `corner`, `drop`, `pill`, `hexagon`,
`triangle`, `chevron`, `diamond`, `ringbroken`, `comma`, `eclipse`. Elles
restent dessinées, mais plus aucune tuile ne les porte : dis-moi si tu en gardes
une, c'est le seul endroit où je peux me tromper.

Aucun identifiant de tuile ne bouge : 53 cases, 5 offertes, 45 barreaux,
3 exploits, les mêmes seuils, les mêmes succès. Un joueur qui porte la case 38
garde la case 38 — c'est son dessin qui change. Les icônes Play Games, elles,
ne changent pas du tout : la Console n'en met jamais une à jour.
