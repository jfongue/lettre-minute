# Prompts d'images — dix nouveaux avatars

Dix succès à redessiner. Chaque bloc se colle **tel quel** dans un LLM d'images
(Midjourney, GPT Image, Gemini, Ideogram…). Il demande **trois images de
référence** du même dessin, en trois prises — A, B, C.

Ce que je fais des images : je les redessine en un seul chemin SVG dans
`src/ui/paths.tsx` et je pose la tuile dans `LOOKS` (`src/domain/avatar.ts`).
D'où les contraintes du prompt : une figure pleine, d'une seule couleur, sans
dégradé, sans contour, sans texte — le fond reste visible dans les vides.
Le **mouvement** de la tuile (pulse, spin, sway…) et l'accent en haut à droite
se choisissent après, à la main : ils n'intéressent pas le modèle d'image.

Les couleurs conseillées ne sont **pas** celles de la tuile : dans le jeu, le
joueur choisit son fond, sa forme et son accent dans la palette. Elles servent
seulement à montrer au modèle un contraste lisible.

| Succès | Avatar de l'éditeur | Tuile du code | La tuile sert aussi à |
|---|---|---|---|
| Inarrêtable (24 réponses d'affilée) | Avatar 30 | 29 | — |
| Trois six (666 points) | Avatar 34 | 33 | le barreau « Score de 900 » |
| Marathon (20 manches de duel) | Avatar 39 | 38 | le barreau « Niveau 25 » |
| Juste arbitre (10 verdicts) | Avatar 32 | 31 | le barreau « 50 parties » |
| Score de 800 | Avatar 29 | 28 | — |
| 50 parties | Avatar 32 | 31 | l'icône « Juste arbitre » |
| Score de 900 | Avatar 34 | 33 | l'icône « Trois six » |
| 5000 mots trouvés | Avatar 38 | 37 | — |
| Niveau 25 | Avatar 39 | 38 | l'icône « Marathon » |
| 200 parties | Avatar 41 | 40 | — |

Trois tuiles portent deux succès chacune (31, 33, 38) : les blocs 2 et 7, 3 et
9, 4 et 6 visent donc aujourd'hui la même tuile. Si tu veux **dix dessins
distincts**, il faut trois tuiles de plus (le catalogue passe de 50 à 53) —
dis-le moi et je les ajoute, avec le succès qui ouvre chacune.

---

## 1. Inarrêtable — une croix de lignes diagonales

Une grande croix de Saint-André : deux barres diagonales épaisses qui courent
d'un coin à l'autre et sortent de la tuile. La variante C pose en plus un petit
carré plein en haut à droite (l'accent de la tuile).

```
Flat vector avatar for a Bauhaus-style board-game poster, printed like a
two-colour screen print. One bold geometric figure in a single flat colour on a
solid flat square of a second colour. No gradient, no shadow, no glow, no 3D,
no perspective, no texture, no grain, no paper, no outline, no stroke around
the figure, no mockup, no frame, no caption, no signature. Allowed colours:
red #e0402a, blue #1f48c7, yellow #f4b41a, black #151515, cream #f2ecdf, green
#17614c, pink #f1a3b3, orange #ee7a22, sky #8fc1e3, brick #a83a2a, lemon
#efd64a, navy #172a4f, coral #f07a63, sage #9bb08f, mustard #c99a17, violet
#5b3a8c, turquoise #3aa6b0, ochre #b8782b, lavender #b3a6d9, olive #6f7a2e,
salmon #f4b49a, teal #16606e, mint #7fc8a9, burgundy #6e1f2a, sand #e3cf9f,
ultramarine #2d2f9a, emerald #1f8a5b, plum #7a2f5a, grey #8a8478, charcoal
#3a3834, fuchsia #c2447e. Square 1:1 image, 1024x1024, the figure centred, and
it must still read as a shape at 40 pixels wide.

FIGURE: a large X, two thick straight diagonal bars of equal width running corner
to corner, cut off by the edges of the square so the cross bleeds off the tile.
The ground shows through the four corner triangles. Solid colour, no outline.
Charcoal #3a3834 ground, yellow #f4b41a bars.

Give me three separate images of this figure, same style, three takes:
A. both bars the same width, crossing exactly at the centre;
B. one bar clearly thicker than the other, so the crossing sits off centre, and
   the four corner triangles are of different sizes;
C. the bars stopped short of the corners, crossing behind a small solid square
   in a third colour (charcoal #3a3834), and a second small square of the same
   colour in the top-right corner of the tile.
```

## 2. Trois six — un 6 stylisé bauhaus

Un six découpé en formes pleines : un anneau épais dont le haut se relève en
barre. Pas de typographie — le chiffre est un dessin.

```
Flat vector avatar for a Bauhaus-style board-game poster, printed like a
two-colour screen print. One bold geometric figure in a single flat colour on a
solid flat square of a second colour. No gradient, no shadow, no glow, no 3D,
no perspective, no texture, no grain, no paper, no outline, no stroke around
the figure, no mockup, no frame, no caption, no signature. No lettering and no
typography: the figure is a numeral built from solid geometric shapes, not a
glyph from a font. Allowed colours: red #e0402a, blue #1f48c7, yellow #f4b41a,
black #151515, cream #f2ecdf, green #17614c, pink #f1a3b3, orange #ee7a22, sky
#8fc1e3, brick #a83a2a, lemon #efd64a, navy #172a4f, coral #f07a63, sage
#9bb08f, mustard #c99a17, violet #5b3a8c, turquoise #3aa6b0, ochre #b8782b,
lavender #b3a6d9, olive #6f7a2e, salmon #f4b49a, teal #16606e, mint #7fc8a9,
burgundy #6e1f2a, sand #e3cf9f, ultramarine #2d2f9a, emerald #1f8a5b, plum
#7a2f5a, grey #8a8478, charcoal #3a3834, fuchsia #c2447e. Square 1:1 image,
1024x1024, the figure centred, and it must still read as a 6 at 40 pixels wide.

FIGURE: a bold geometric numeral 6 cut like a woodblock print: a thick open ring
closed on the left, whose upper right end rises into a straight thick stem going
up. One single colour, one continuous silhouette, ends cut square.
Cream #f2ecdf ground, black #151515 numeral.

Give me three separate images of this figure, same style, three takes:
A. the ring and the stem as one solid silhouette, the stem cut square at the top;
B. a solid disc with a rectangular notch cut out of its top right (stencil
   negative space), so the 6 is read from the hole;
C. the 6 drawn as one thick stroke that starts straight at the top, curves down
   and closes into the ring, in the spirit of the classic Bauhaus poster curve.
```

## 3. Marathon — des lignes qui plient ensemble

Le poster de référence : cinq lignes parallèles de même épaisseur qui courent
ensemble et tournent d'un bloc. Les vides entre les lignes laissent voir le fond.

```
Flat vector avatar for a Bauhaus-style board-game poster, printed like a
two-colour screen print. One bold geometric figure in a single flat colour on a
solid flat square of a second colour. No gradient, no shadow, no glow, no 3D,
no perspective, no texture, no grain, no paper, no outline, no stroke around the
figure, no mockup, no frame, no caption, no signature. Allowed colours: red
#e0402a, blue #1f48c7, yellow #f4b41a, black #151515, cream #f2ecdf, green
#17614c, pink #f1a3b3, orange #ee7a22, sky #8fc1e3, brick #a83a2a, lemon
#efd64a, navy #172a4f, coral #f07a63, sage #9bb08f, mustard #c99a17, violet
#5b3a8c, turquoise #3aa6b0, ochre #b8782b, lavender #b3a6d9, olive #6f7a2e,
salmon #f4b49a, teal #16606e, mint #7fc8a9, burgundy #6e1f2a, sand #e3cf9f,
ultramarine #2d2f9a, emerald #1f8a5b, plum #7a2f5a, grey #8a8478, charcoal
#3a3834, fuchsia #c2447e. Square 1:1 image, 1024x1024, the figure centred and
bleeding off the edges, and it must still read as a shape at 40 pixels wide.

FIGURE: a bundle of five parallel thick lines, all the same width, evenly spaced,
that run straight across the tile and bend together through a turn, like a
ribbon of stripes folding back on itself. Flat single colour, ends cut square,
the ground showing in the four gaps between the lines.
Cream #f2ecdf ground, brick #a83a2a lines.

Give me three separate images of this figure, same style, three takes:
A. the bundle runs in along the left edge, turns half a turn around a wide curve
   at the right, and runs back out along the left edge: a hairpin;
B. the bundle falls from the top right, sweeps a quarter turn and exits left as
   a horizontal run: a clean elbow;
C. three lines only, drawn as a long S: down at the left, half a turn at the
   bottom, up the middle, half a turn at the top, out to the right.
```

## 4. Juste arbitre — une carte rectangulaire, de biais

Un rectangle posé sur la pointe, penché d'une vingtaine de degrés, nu : ni
bordure, ni lignes, ni texte dedans.

```
Flat vector avatar for a Bauhaus-style board-game poster, printed like a
two-colour screen print. One bold geometric figure in a single flat colour on a
solid flat square of a second colour. No gradient, no shadow, no glow, no 3D,
no perspective, no texture, no grain, no paper, no outline, no stroke around
the figure, no mockup, no frame, no caption, no signature. Allowed colours: red
#e0402a, blue #1f48c7, yellow #f4b41a, black #151515, cream #f2ecdf, green
#17614c, pink #f1a3b3, orange #ee7a22, sky #8fc1e3, brick #a83a2a, lemon
#efd64a, navy #172a4f, coral #f07a63, sage #9bb08f, mustard #c99a17, violet
#5b3a8c, turquoise #3aa6b0, ochre #b8782b, lavender #b3a6d9, olive #6f7a2e,
salmon #f4b49a, teal #16606e, mint #7fc8a9, burgundy #6e1f2a, sand #e3cf9f,
ultramarine #2d2f9a, emerald #1f8a5b, plum #7a2f5a, grey #8a8478, charcoal
#3a3834, fuchsia #c2447e. Square 1:1 image, 1024x1024, the figure centred with a
small margin, and it must still read as a card at 40 pixels wide.

FIGURE: one plain rectangle standing on its corner, tilted about twenty degrees
off the vertical, corners square, edges straight, empty inside: no border, no
lines, no text, no markings.
Navy #172a4f ground, cream #f2ecdf card.

Give me three separate images of this figure, same style, three takes:
A. the single tilted rectangle alone, centred, with a margin all round;
B. two rectangles, the back one rotated a few degrees further, so they read as a
   hand of cards seen edge on: the front one cream #f2ecdf, the back one
   salmon #f4b49a;
C. the tilted rectangle with a small solid circle in a third colour overlapping
   its lower edge, like a wax seal: card cream #f2ecdf, seal red #e0402a.
```

## 5. Score de 800 — un 8

Deux anneaux pleins empilés qui se touchent.

```
Flat vector avatar for a Bauhaus-style board-game poster, printed like a
two-colour screen print. One bold geometric figure in a single flat colour on a
solid flat square of a second colour. No gradient, no shadow, no glow, no 3D,
no perspective, no texture, no grain, no paper, no outline, no stroke around
the figure, no mockup, no frame, no caption, no signature. No lettering and no
typography: the figure is a numeral built from solid geometric shapes, not a
glyph from a font. Allowed colours: red #e0402a, blue #1f48c7, yellow #f4b41a,
black #151515, cream #f2ecdf, green #17614c, pink #f1a3b3, orange #ee7a22, sky
#8fc1e3, brick #a83a2a, lemon #efd64a, navy #172a4f, coral #f07a63, sage
#9bb08f, mustard #c99a17, violet #5b3a8c, turquoise #3aa6b0, ochre #b8782b,
lavender #b3a6d9, olive #6f7a2e, salmon #f4b49a, teal #16606e, mint #7fc8a9,
burgundy #6e1f2a, sand #e3cf9f, ultramarine #2d2f9a, emerald #1f8a5b, plum
#7a2f5a, grey #8a8478, charcoal #3a3834, fuchsia #c2447e. Square 1:1 image,
1024x1024, the figure centred, and it must still read as an 8 at 40 pixels wide.

FIGURE: a bold geometric numeral 8 built from two thick rings stacked vertically
and touching, the lower one the same size as the upper, one flat colour, one
silhouette, cut like a woodblock print.
Blue #1f48c7 ground, yellow #f4b41a numeral.

Give me three separate images of this figure, same style, three takes:
A. two equal rings stacked and touching at one point;
B. two stacked solid squares, each with a square window punched out of its
   middle: a stencil 8;
C. one thick rounded rectangle pinched in the middle, its two round holes cut
   out as negative space.
```

## 6. 50 parties — un tallage

Cinq bâtons verticaux qui montent comme un escalier.

```
Flat vector avatar for a Bauhaus-style board-game poster, printed like a
two-colour screen print. One bold geometric figure in a single flat colour on a
solid flat square of a second colour. No gradient, no shadow, no glow, no 3D,
no perspective, no texture, no grain, no paper, no outline, no stroke around
the figure, no mockup, no frame, no caption, no signature. Allowed colours: red
#e0402a, blue #1f48c7, yellow #f4b41a, black #151515, cream #f2ecdf, green
#17614c, pink #f1a3b3, orange #ee7a22, sky #8fc1e3, brick #a83a2a, lemon
#efd64a, navy #172a4f, coral #f07a63, sage #9bb08f, mustard #c99a17, violet
#5b3a8c, turquoise #3aa6b0, ochre #b8782b, lavender #b3a6d9, olive #6f7a2e,
salmon #f4b49a, teal #16606e, mint #7fc8a9, burgundy #6e1f2a, sand #e3cf9f,
ultramarine #2d2f9a, emerald #1f8a5b, plum #7a2f5a, grey #8a8478, charcoal
#3a3834, fuchsia #c2447e. Square 1:1 image, 1024x1024, the figure centred, and
it must still read as five bars at 40 pixels wide.

FIGURE: a tally of five thick vertical bars standing side by side with equal
gaps, rising in height from left to right like a staircase, all one flat colour,
ends cut square, the bars standing on the bottom edge of the tile.
Cream #f2ecdf ground, brick #a83a2a bars.

Give me three separate images of this figure, same style, three takes:
A. the five bars rising evenly, each shorter than the next;
B. the five bars arranged in a fan, standing on one corner and turning like the
   spokes of a quarter circle;
C. four bars standing plus one bar laid across them diagonally, the way a tally
   of five is written.
```

## 7. Score de 900 — un 9, le miroir du 6

Le même six retourné : un anneau dont le bas part en barre vers le bas.

```
Flat vector avatar for a Bauhaus-style board-game poster, printed like a
two-colour screen print. One bold geometric figure in a single flat colour on a
solid flat square of a second colour. No gradient, no shadow, no glow, no 3D,
no perspective, no texture, no grain, no paper, no outline, no stroke around
the figure, no mockup, no frame, no caption, no signature. No lettering and no
typography: the figure is a numeral built from solid geometric shapes, not a
glyph from a font. Allowed colours: red #e0402a, blue #1f48c7, yellow #f4b41a,
black #151515, cream #f2ecdf, green #17614c, pink #f1a3b3, orange #ee7a22, sky
#8fc1e3, brick #a83a2a, lemon #efd64a, navy #172a4f, coral #f07a63, sage
#9bb08f, mustard #c99a17, violet #5b3a8c, turquoise #3aa6b0, ochre #b8782b,
lavender #b3a6d9, olive #6f7a2e, salmon #f4b49a, teal #16606e, mint #7fc8a9,
burgundy #6e1f2a, sand #e3cf9f, ultramarine #2d2f9a, emerald #1f8a5b, plum
#7a2f5a, grey #8a8478, charcoal #3a3834, fuchsia #c2447e. Square 1:1 image,
1024x1024, the figure centred, and it must still read as a 9 at 40 pixels wide.

FIGURE: a bold geometric numeral 9 cut like a woodblock print: a thick open ring
closed on the right, whose lower left end falls into a straight thick stem going
down to the bottom edge. One single colour, one continuous silhouette, ends cut
square. It is the exact 180-degree mirror of the numeral 6.
Cream #f2ecdf ground, ultramarine #2d2f9a numeral.

Give me three separate images of this figure, same style, three takes:
A. the ring and the stem as one solid silhouette, the stem cut square at the
   bottom;
B. a solid disc with a rectangular notch cut out of its bottom left, so the 9 is
   read from the hole;
C. the 9 drawn as one thick stroke that starts at the bottom, curves up into the
   ring and closes it, in the spirit of the classic Bauhaus poster curve.
```

## 8. 5000 mots trouvés — un mur de mots

Sept lignes pleines empilées, comme un paragraphe vu de loin.

```
Flat vector avatar for a Bauhaus-style board-game poster, printed like a
two-colour screen print. One bold geometric figure in a single flat colour on a
solid flat square of a second colour. No gradient, no shadow, no glow, no 3D,
no perspective, no texture, no grain, no paper, no outline, no stroke around
the figure, no mockup, no frame, no caption, no signature. No actual letters and
no words anywhere: the figure is an abstract block of lines standing for a
written page. Allowed colours: red #e0402a, blue #1f48c7, yellow #f4b41a, black
#151515, cream #f2ecdf, green #17614c, pink #f1a3b3, orange #ee7a22, sky
#8fc1e3, brick #a83a2a, lemon #efd64a, navy #172a4f, coral #f07a63, sage
#9bb08f, mustard #c99a17, violet #5b3a8c, turquoise #3aa6b0, ochre #b8782b,
lavender #b3a6d9, olive #6f7a2e, salmon #f4b49a, teal #16606e, mint #7fc8a9,
burgundy #6e1f2a, sand #e3cf9f, ultramarine #2d2f9a, emerald #1f8a5b, plum
#7a2f5a, grey #8a8478, charcoal #3a3834, fuchsia #c2447e. Square 1:1 image,
1024x1024, the figure filling the tile, and it must still read as a block of
lines at 40 pixels wide.

FIGURE: seven thick horizontal lines stacked with equal gaps, running from edge
to edge, of slightly uneven lengths like a paragraph of text seen from far away.
One flat colour, ends cut square, the ground showing in the six gaps.
Ultramarine #2d2f9a ground, cream #f2ecdf lines.

Give me three separate images of this figure, same style, three takes:
A. seven lines, their right ends ragged, the shortest line last;
B. seven lines cut out as negative space inside a solid rectangle, so the block
   is one shape with slots;
C. seven lines whose gaps widen towards the bottom, the block dissolving like a
   page fading out.
```

## 9. Niveau 25 — l'ascension

Cinq chevrons empilés qui montent, comme les barreaux d'une échelle.

```
Flat vector avatar for a Bauhaus-style board-game poster, printed like a
two-colour screen print. One bold geometric figure in a single flat colour on a
solid flat square of a second colour. No gradient, no shadow, no glow, no 3D,
no perspective, no texture, no grain, no paper, no outline, no stroke around
the figure, no mockup, no frame, no caption, no signature. Allowed colours: red
#e0402a, blue #1f48c7, yellow #f4b41a, black #151515, cream #f2ecdf, green
#17614c, pink #f1a3b3, orange #ee7a22, sky #8fc1e3, brick #a83a2a, lemon
#efd64a, navy #172a4f, coral #f07a63, sage #9bb08f, mustard #c99a17, violet
#5b3a8c, turquoise #3aa6b0, ochre #b8782b, lavender #b3a6d9, olive #6f7a2e,
salmon #f4b49a, teal #16606e, mint #7fc8a9, burgundy #6e1f2a, sand #e3cf9f,
ultramarine #2d2f9a, emerald #1f8a5b, plum #7a2f5a, grey #8a8478, charcoal
#3a3834, fuchsia #c2447e. Square 1:1 image, 1024x1024, the figure centred, and
it must still read as stacked chevrons at 40 pixels wide.

FIGURE: five thick V shapes pointing upwards, stacked one above the other with
equal gaps, each wider than the one above it, so the stack rises like a ladder
of levels. One flat colour, ends cut square.
Green #17614c ground, yellow #f4b41a chevrons.

Give me three separate images of this figure, same style, three takes:
A. the five chevrons stacked, all the same thickness;
B. a staircase of five solid steps climbing from the bottom left corner to the
   top right corner;
C. five nested arches, one inside the other, like a colonnade seen from the
   front.
```

## 10. 200 parties — une piste

Des anneaux concentriques ouverts en haut : une piste vue de dessus, sans fin.

```
Flat vector avatar for a Bauhaus-style board-game poster, printed like a
two-colour screen print. One bold geometric figure in a single flat colour on a
solid flat square of a second colour. No gradient, no shadow, no glow, no 3D,
no perspective, no texture, no grain, no paper, no outline, no stroke around the
figure, no mockup, no frame, no caption, no signature. Allowed colours: red
#e0402a, blue #1f48c7, yellow #f4b41a, black #151515, cream #f2ecdf, green
#17614c, pink #f1a3b3, orange #ee7a22, sky #8fc1e3, brick #a83a2a, lemon
#efd64a, navy #172a4f, coral #f07a63, sage #9bb08f, mustard #c99a17, violet
#5b3a8c, turquoise #3aa6b0, ochre #b8782b, lavender #b3a6d9, olive #6f7a2e,
salmon #f4b49a, teal #16606e, mint #7fc8a9, burgundy #6e1f2a, sand #e3cf9f,
ultramarine #2d2f9a, emerald #1f8a5b, plum #7a2f5a, grey #8a8478, charcoal
#3a3834, fuchsia #c2447e. Square 1:1 image, 1024x1024, the figure centred, and
it must still read as concentric rings at 40 pixels wide.

FIGURE: two thick concentric rings, a running track seen from above, open at the
top so the two ends face each other across a gap. One flat colour, ends cut
square, the ground showing between the rings.
Plum #7a2f5a ground, mint #7fc8a9 rings.

Give me three separate images of this figure, same style, three takes:
A. two thick concentric rings open at the top, like a horseshoe;
B. two concentric rounded squares open at the top;
C. one thick spiral of two and a half turns, tighter at the centre.
```
