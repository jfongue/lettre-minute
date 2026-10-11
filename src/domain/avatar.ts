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

// Written out rather than crossed from lists: a circle, a ring or a sun looks
// the same at any turn, and a small accent is too faint to tell two tiles apart
// on its own, so a generated grid showed the same tile over and over. Here no
// shape comes back merely turned — the turned quarters and arches read as one
// tile shown four times — only once with an accent that makes a picture of it.
// Shapes whose look rests on their turn never get the turning motions, which
// would cycle them through their siblings. Ids stay put: a player wears one.
const LOOKS: readonly Look[] = [
  ['circle', 0, null, 'pulse'],
  ['square', 0, null, 'turn'],
  ['quarter', 0, null, 'still'],
  ['arch', 0, null, 'bob'],
  ['half', 0, null, 'sway'],
  ['triangle', 0, null, 'pulse'],
  ['corner', 0, null, 'still'],
  ['ring', 0, null, 'pulse'],
  ['diamond', 0, null, 'turn'],
  ['bars', 0, null, 'sway'],
  ['sun', 0, null, 'spin'],
  ['cross', 0, null, 'spin'],
  ['lens', 0, null, 'sway'],
  ['moon', 0, null, 'bob'],
  ['pill', 0, null, 'pulse'],
  ['hexagon', 0, null, 'sway'],
  ['steps', 0, null, 'still'],
  ['wave', 0, null, 'sway'],
  ['zigzag', 0, null, 'bob'],
  ['chevron', 0, null, 'bob'],
  ['hourglass', 0, null, 'still'],
  ['flower', 0, null, 'spin'],
  ['dots', 0, null, 'pulse'],
  ['checker', 0, null, 'still'],
  ['star', 0, null, 'pulse'],
  ['drop', 0, null, 'sway'],
  ['frame', 0, null, 'turn'],
  ['square', 0, 'circle', 'still'],
  ['diamond', 0, 'circle', 'pulse'],
  ['ring', 0, 'square', 'spin'],
  ['half', 0, 'circle', 'bob'],
  ['bars', 0, 'triangle', 'still'],
  ['quarter', 0, 'circle', 'sway'],
  ['sun', 0, 'square', 'pulse'],
  ['arch', 0, 'square', 'still'],
  ['triangle', 0, 'circle', 'bob'],
  ['corner', 0, 'square', 'pulse'],
  ['half', 2, 'sun', 'sway'],
  ['triangle', 0, 'sun', 'still'],
  ['circle', 0, 'sun', 'spin'],
  ['target', 0, null, 'pulse'],
  ['heart', 0, null, 'pulse'],
  ['domes', 0, null, 'bob'],
  // Les sept tuiles des mots ajoutés, dans l'ordre de leurs jalons : chacune a
  // son mouvement propre, et aucune n'est un simple quart de tour d'une autre.
  ['ringbroken', 0, null, 'scatter'],
  ['comma', 0, null, 'wiggle'],
  ['bang', 0, null, 'stamp'],
  ['eclipse', 0, null, 'hover'],
  ['bloom', 0, null, 'breathe'],
  ['archway', 0, null, 'spin'],
  ['dial', 0, null, 'nod'],
]

/**
 * A detail drawn from the accent layer rather than the shape's own colour: the
 * dot of the exclamation mark, the hand of the dial. Not a `ShapeKind` — it is
 * never a tile of its own — and never turned with the shape, or the hand would
 * lie about the hour.
 */
export type DetailKind = 'bangDot' | 'dialHand'

export const TINTED: Partial<Record<ShapeKind, DetailKind>> = {
  bang: 'bangDot',
  dial: 'dialHand',
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
