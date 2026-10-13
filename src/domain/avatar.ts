export type ShapeKind =
  | 'circle'
  | 'square'
  | 'quarter'
  | 'arch'
  | 'half'
  | 'triangle'
  | 'corner'
  | 'ring'
  | 'diamond'
  | 'bars'
  | 'sun'
  | 'cross'
  | 'lens'
  | 'moon'
  | 'pill'
  | 'hexagon'
  | 'steps'
  | 'wave'
  | 'zigzag'
  | 'chevron'
  | 'hourglass'
  | 'flower'
  | 'dots'
  | 'checker'
  | 'star'
  | 'drop'
  | 'frame'
  | 'target'
  | 'heart'
  | 'domes'
  | 'ringbroken'
  | 'comma'
  | 'bang'
  | 'eclipse'
  | 'bloom'
  | 'archway'
  | 'dial'
  | 'six'
  | 'card'
  | 'ribbon'
  // Les figures relevées sur la planche bauhaus : la grille en tire la
  // vocabulaire de ses tuiles, et garde les dernières en réserve.
  | 'stairs'
  | 'tents'
  | 'gong'
  | 'chevrons'
  | 'slats'
  | 'barcode'
  | 'stripes'
  | 'stripedDisc'
  | 'field'
  | 'grid'
  | 'checker3'
  | 'diamonds'
  | 'noise'
  | 'burst'
  | 'threeQuarter'
  | 'spark'
  | 'eye'
  | 'links'
  | 'pinwheel'
  | 'butterfly'
  | 'twoMoons'
  | 'frameDiamond'
  | 'roundedFrame'
  | 'cushion'
  | 'squareBite'
  | 'split'
  | 'spiral'
  | 'rays'
  | 'corners'
  | 'duo'
  | 'slab'
  | 'dropCut'
  | 'keyhole'
  | 'gate'
  | 'halfBars'
  | 'bands'
  | 'peaks'

/**
 * Ce que fait une tuile sur la grille : chacune a le sien, choisi pour sa
 * figure — le gong sonne, l'œil cligne, la porte bat sur ses gonds. Tous ne
 * touchent que la transformation et l'opacité, sur un seul élément : cinquante
 * tuiles qui bougent ensemble doivent rester au compositeur, jamais au layout.
 * `spin`, `turn` et `roll` font le tour de la figure : seules les formes qu'un
 * quart de tour ne change pas les prennent, sinon la case se lirait comme une
 * autre.
 */
export type Motion =
  | 'still'
  | 'turn'
  | 'pulse'
  | 'spin'
  | 'sway'
  | 'bob'
  | 'scatter'
  | 'wiggle'
  | 'stamp'
  | 'hover'
  | 'swing'
  | 'breathe'
  | 'nod'
  | 'march'
  | 'count'
  | 'roll'
  | 'tilt'
  | 'ripple'
  | 'hinge'
  | 'drift'
  | 'open'
  | 'coin'
  | 'blink'
  | 'lock'
  | 'wane'
  | 'flutter'
  | 'swirl'
  | 'chime'
  | 'scan'
  | 'press'
  | 'dart'
  | 'shiver'
  | 'climb'
  | 'seesaw'
  | 'flare'
  | 'hop'
  | 'twinkle'
  | 'tick'
  | 'coil'
  | 'flip'
  | 'squish'
  | 'bounce'
  | 'squeeze'
  | 'part'

/** One tile of the poster: a shape, turned by quarters, with an optional small accent in a corner. */
export interface AvatarDesign {
  id: number
  shape: ShapeKind
  turn: 0 | 1 | 2 | 3
  accent: ShapeKind | null
  motion: Motion
}

export interface Colour {
  id: string
  label: string
  hex: string
}

export type Stat = 'level' | 'runs' | 'bestScore' | 'wordsFound' | 'bestCombo' | 'wordsAdded'

export interface Milestone {
  stat: Stat
  at: number
}

/** What the player wears: a design and one colour per layer, by id. */
export interface AvatarChoice {
  design: number
  ground: string
  shape: string
  accent: string
}

type Look = [shape: ShapeKind, turn: AvatarDesign['turn'], accent: ShapeKind | null, motion: Motion]

// Écrites une par une plutôt que croisées depuis des listes : un cercle, un
// anneau ou un soleil se ressemblent à tout quart de tour, et un petit accent
// de coin ne suffisait pas à distinguer deux cases — une grille engendrée
// montrait la même tuile en boucle. Ici chaque case a sa figure, toutes
// d'aplomb (retourner une figure teintée désalignerait sa part), et l'accent ne
// pose plus un motif de coin : il colorie une part de la figure (`TINTED`), ce
// qui tient deux cases distinctes là où l'ancien accent les confondait. Les
// mouvements sont choisis un par un pour leur figure : le gong sonne, l'œil
// cligne, la porte bat sur ses gonds. Les identifiants sont ceux du catalogue :
// un joueur en porte un, et aucune case ne bouge de place.
const LOOKS: readonly Look[] = [
  ['circle', 0, null, 'pulse'],
  ['square', 0, null, 'turn'],
  ['quarter', 0, null, 'still'],
  ['arch', 0, null, 'hover'],
  ['half', 0, null, 'sway'],
  ['steps', 0, null, 'march'],
  ['slab', 0, null, 'squeeze'],
  ['dots', 0, null, 'count'],
  ['ring', 0, null, 'roll'],
  ['zigzag', 0, null, 'wiggle'],
  ['tents', 0, null, 'tilt'],
  // La croix qui tourne reste à cet identifiant : le joueur « Nanou » la porte
// depuis avant le redessin, et une figure ne change pas sous les pieds de qui
// la porte.
['cross', 0, null, 'spin'],
  ['checker', 0, null, 'nod'],
  ['burst', 0, null, 'scatter'],
  ['wave', 0, null, 'ripple'],
  ['gate', 0, null, 'hinge'],
  ['slats', 0, null, 'drift'],
  ['flower', 0, null, 'open'],
  ['threeQuarter', 0, null, 'coin'],
  ['twoMoons', 0, null, 'wane'],
  ['domes', 0, null, 'hover'],
  ['stripes', 0, null, 'wiggle'],
  ['field', 0, null, 'pulse'],
  ['eye', 0, null, 'blink'],
  ['pinwheel', 0, null, 'spin'],
  ['gong', 0, null, 'chime'],
  ['barcode', 0, null, 'scan'],
  ['grid', 0, null, 'drift'],
  ['sun', 0, null, 'spin'],
  ['butterfly', 0, null, 'flutter'],
  // La tuile du niveau 16, gardée telle quelle : la seule qui porte encore un
  // motif en coin, celui que Jérémy ne voulait pas perdre.
  ['half', 0, 'circle', 'bounce'],
  ['stripedDisc', 0, null, 'roll'],
  ['checker3', 0, null, 'breathe'],
  ['target', 0, null, 'lock'],
  ['bloom', 0, null, 'swirl'],
  ['chevrons', 0, null, 'dart'],
  ['halfBars', 0, null, 'press'],
  ['noise', 0, null, 'shiver'],
  ['stairs', 0, null, 'climb'],
  ['bands', 0, null, 'seesaw'],
  ['rays', 0, null, 'flare'],
  ['peaks', 0, null, 'hop'],
  ['spark', 0, null, 'twinkle'],
  // Les sept tuiles des mots ajoutés, dans l'ordre de leurs jalons : le trait
  // qui tape, le cadre qui tourne, le losange qui se balance, le cadre arrondi
  // qui presse, le coussin qui tremble, le carré mordu qui se retourne, et le
  // disque dont l'aiguille avance d'un cran.
  ['bang', 0, null, 'stamp'],
  ['frame', 0, null, 'turn'],
  ['frameDiamond', 0, null, 'swing'],
  ['roundedFrame', 0, null, 'press'],
  ['cushion', 0, null, 'squish'],
  ['squareBite', 0, null, 'flip'],
  ['dial', 0, null, 'tick'],
  // Les tuiles que la grille ouvre par un exploit plutôt que par un barreau, à
  // la fin pour ne déplacer aucune case déjà portée par un joueur.
  ['spiral', 0, null, 'coil'],
  ['split', 0, null, 'part'],
  ['links', 0, null, 'swing'],
  // La tuile du mot du Professeur : une étoile, comme un mot retenu.
  ['star', 0, null, 'bob'],
]

/**
 * A detail drawn from the accent layer rather than the shape's own colour: the
 * dot of the exclamation mark, the hand of the dial. Not a `ShapeKind` — it is
 * never a tile of its own — and never turned with the shape, or the hand would
 * lie about the hour.
 */
export type DetailKind =
| 'bangDot'
| 'dialHand'
| 'gongDisc'
| 'tentsSmall'
| 'stepsMiddle'
| 'gateCrown'
| 'domesLower'
| 'chevronsFirst'
| 'stairsMiddle'
| 'raysCardinal'
| 'fieldRow'
| 'dotsRow'
| 'checkerOne'
| 'checker3Centre'
| 'gridMid'
| 'noiseSecond'
| 'flowerPetal'
| 'burstSpark'
| 'eyeIris'
| 'sunDisc'
| 'targetCore'
| 'ringHalf'
| 'zigzagFirst'
| 'moonLeft'
| 'pinwheelBlade'
| 'butterflyWing'
| 'bloomDisc'
| 'barsMiddle'
| 'slatsTop'
| 'stripesMiddle'
| 'barcodeWidest'
| 'stripedDiscMid'
| 'framePanel'
| 'frameDiamondInner'
| 'roundedFrameInner'
| 'squareBiteBite'
| 'splitBand'
| 'linksLoop'
| 'spiralTail'
| 'halfBarsBand'
| 'bandsTop'
| 'peaksRow'

/**
 * La part de chaque figure que l'accent colorie : le rond du gong, la ligne du
 * bas du champ de points, la première flèche des chevrons, le carré du milieu
 * de l'escalier. Une forme absente d'ici n'a rien à teinter — un carré, une
 * arche, un coussin sont d'un seul tenant — et une figure teintée garde son
 * quart de tour à zéro dans `LOOKS` : la part est dessinée à part, droite, donc
 * la tourner avec la forme la ferait mentir.
 */
export const TINTED: Partial<Record<ShapeKind, DetailKind>> = {
  bang: 'bangDot',
  dial: 'dialHand',
  // Les barreaux de niveau, la piste qui monte.
  steps: 'stepsMiddle',
  tents: 'tentsSmall',
  gate: 'gateCrown',
  domes: 'domesLower',
  gong: 'gongDisc',
  chevrons: 'chevronsFirst',
  stairs: 'stairsMiddle',
  rays: 'raysCardinal',
  // Les parties jouées, ce qui s'aligne et se compte.
  bars: 'barsMiddle',
  slats: 'slatsTop',
  stripes: 'stripesMiddle',
  barcode: 'barcodeWidest',
  stripedDisc: 'stripedDiscMid',
  halfBars: 'halfBarsBand',
  bands: 'bandsTop',
  peaks: 'peaksRow',
  // Les mots trouvés, l'abondance.
  dots: 'dotsRow',
  checker: 'checkerOne',
  flower: 'flowerPetal',
  field: 'fieldRow',
  grid: 'gridMid',
  checker3: 'checker3Centre',
  noise: 'noiseSecond',
  // Le score, le coup marqué.
  ring: 'ringHalf',
  burst: 'burstSpark',
  eye: 'eyeIris',
  sun: 'sunDisc',
  target: 'targetCore',
  // La série, la chaîne.
  zigzag: 'zigzagFirst',
  twoMoons: 'moonLeft',
  pinwheel: 'pinwheelBlade',
  butterfly: 'butterflyWing',
  bloom: 'bloomDisc',
  // Les mots ajoutés, le dictionnaire qui se remplit.
  frame: 'framePanel',
  frameDiamond: 'frameDiamondInner',
  roundedFrame: 'roundedFrameInner',
  squareBite: 'squareBiteBite',
  // Les trois exploits.
  spiral: 'spiralTail',
  split: 'splitBand',
  links: 'linksLoop',
}

export const AVATARS: readonly AvatarDesign[] = LOOKS.map(([shape, turn, accent, motion], id) => ({
  id,
  shape,
  turn,
  accent,
  motion,
}))

/**
 * Les cinq tuiles que le joueur porte dès la première partie. Les autres se
 * gagnent case par case par les succès : c'est `achievements.ts` qui tient la
 * grille des jalons, pas ce catalogue.
 */
export const FREE_DESIGNS = 5

// A palette printed from the same inks as the game — primaries first, then
// earths, greens and blues that still sit beside them on a poster.
const COLOURS: readonly [id: string, label: string, hex: string][] = [
  ['rouge', 'Rouge', '#e0402a'],
  ['bleu', 'Bleu', '#1f48c7'],
  ['jaune', 'Jaune', '#f4b41a'],
  ['noir', 'Noir', '#151515'],
  ['creme', 'Crème', '#f2ecdf'],
  ['vert', 'Vert', '#17614c'],
  ['rose', 'Rose', '#f1a3b3'],
  ['orange', 'Orange', '#ee7a22'],
  ['ciel', 'Ciel', '#8fc1e3'],
  ['brique', 'Brique', '#a83a2a'],
  ['citron', 'Citron', '#efd64a'],
  ['marine', 'Marine', '#172a4f'],
  ['corail', 'Corail', '#f07a63'],
  ['sauge', 'Sauge', '#9bb08f'],
  ['moutarde', 'Moutarde', '#c99a17'],
  ['violet', 'Violet', '#5b3a8c'],
  ['turquoise', 'Turquoise', '#3aa6b0'],
  ['ocre', 'Ocre', '#b8782b'],
  ['lavande', 'Lavande', '#b3a6d9'],
  ['olive', 'Olive', '#6f7a2e'],
  ['saumon', 'Saumon', '#f4b49a'],
  ['canard', 'Canard', '#16606e'],
  ['menthe', 'Menthe', '#7fc8a9'],
  ['bordeaux', 'Bordeaux', '#6e1f2a'],
  ['sable', 'Sable', '#e3cf9f'],
  ['outremer', 'Outremer', '#2d2f9a'],
  ['emeraude', 'Émeraude', '#1f8a5b'],
  ['prune', 'Prune', '#7a2f5a'],
  ['gris', 'Gris', '#8a8478'],
  ['anthracite', 'Anthracite', '#3a3834'],
  ['fuchsia', 'Fuchsia', '#c2447e'],
]

/** Les trois couleurs de départ : les primaires, que l'avatar d'origine porte. */
export const FREE_COLOURS = 3

export const PALETTE: readonly Colour[] = COLOURS.map(([id, label, hex]) => ({ id, label, hex }))

export const DEFAULT_AVATAR: AvatarChoice = { design: 0, ground: 'bleu', shape: 'jaune', accent: 'rouge' }

export function colourHex(id: string): string {
  return (PALETTE.find((colour) => colour.id === id) ?? PALETTE[0]).hex
}

/** Reads an avatar from storage or the server, where anything may have been written. */
export function parseAvatar(raw: unknown): AvatarChoice {
  if (!raw || typeof raw !== 'object') return DEFAULT_AVATAR
  const value = raw as Partial<Record<keyof AvatarChoice, unknown>>
  const colour = (candidate: unknown, fallback: string) =>
    typeof candidate === 'string' && PALETTE.some((entry) => entry.id === candidate) ? candidate : fallback
  const design =
    typeof value.design === 'number' && AVATARS.some((entry) => entry.id === value.design)
      ? value.design
      : DEFAULT_AVATAR.design
  return {
    design,
    ground: colour(value.ground, DEFAULT_AVATAR.ground),
    shape: colour(value.shape, DEFAULT_AVATAR.shape),
    accent: colour(value.accent, DEFAULT_AVATAR.accent),
  }
}

/** The same tile worn twice, field by field. */
export function sameAvatar(one: AvatarChoice, other: AvatarChoice): boolean {
  return one.design === other.design && one.ground === other.ground && one.shape === other.shape && one.accent === other.accent
}

/**
 * The tile every player starts on. Wearing it says nothing was ever chosen —
 * a device that signs in without one leaves the account on it.
 */
export function isDefaultAvatar(avatar: AvatarChoice): boolean {
  return sameAvatar(avatar, DEFAULT_AVATAR)
}
