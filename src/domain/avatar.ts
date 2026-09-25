import { levelFor, type Profile } from './progression'

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

export type Motion = 'still' | 'turn' | 'pulse' | 'spin' | 'sway' | 'bob'

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

export type Stat = 'level' | 'runs' | 'bestScore' | 'wordsFound' | 'bestCombo'

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
]

export const AVATARS: readonly AvatarDesign[] = LOOKS.map(([shape, turn, accent, motion], id) => ({
  id,
  shape,
  turn,
  accent,
  motion,
}))

/** Designs every player owns from the first run. */
const FREE_DESIGNS = 5

// One goal per track in turn, so the grid mixes levels with feats instead of
// hiding every feat behind the last level. Every first goal lies past what a
// first run can reach — a run nears 1 000 points only when it is enormous —
// so a tile is earned, not handed out with the tutorial.
const TRACKS: readonly Milestone[][] = [
  [4, 6, 8, 10, 13, 16, 20, 25, 30, 35].map((at) => ({ stat: 'level' as const, at })),
  // Runs 3 to 10 are where a new player drifts off: a tile at each of the first few keeps them coming.
  [3, 5, 7, 10, 25, 50, 100, 200, 400].map((at) => ({ stat: 'runs' as const, at })),
  [100, 250, 500, 1000, 2000, 3500, 5000].map((at) => ({ stat: 'wordsFound' as const, at })),
  [400, 500, 600, 700, 800, 900].map((at) => ({ stat: 'bestScore' as const, at })),
  [10, 13, 16, 20, 24, 28].map((at) => ({ stat: 'bestCombo' as const, at })),
]

function interleave<T>(tracks: readonly T[][]): T[] {
  const out: T[] = []
  for (let i = 0; tracks.some((track) => i < track.length); i++) {
    for (const track of tracks) if (i < track.length) out.push(track[i])
  }
  return out
}

const DESIGN_GOALS = interleave(TRACKS)

export function designUnlock(id: number): Milestone | null {
  return id < FREE_DESIGNS ? null : DESIGN_GOALS[id - FREE_DESIGNS]
}

// A palette printed from the same inks as the game — primaries first, then
// earths, greens and blues that still sit beside them on a poster.
const COLOURS: readonly [id: string, label: string, hex: string, unlock: Milestone | null][] = [
  ['rouge', 'Rouge', '#e0402a', null],
  ['bleu', 'Bleu', '#1f48c7', null],
  ['jaune', 'Jaune', '#f4b41a', null],
  ['noir', 'Noir', '#151515', { stat: 'runs', at: 3 }],
  ['creme', 'Crème', '#f2ecdf', { stat: 'level', at: 4 }],
  ['vert', 'Vert', '#17614c', { stat: 'wordsFound', at: 50 }],
  ['rose', 'Rose', '#f1a3b3', { stat: 'runs', at: 10 }],
  ['orange', 'Orange', '#ee7a22', { stat: 'level', at: 6 }],
  ['ciel', 'Ciel', '#8fc1e3', { stat: 'bestCombo', at: 10 }],
  ['brique', 'Brique', '#a83a2a', { stat: 'level', at: 8 }],
  ['citron', 'Citron', '#efd64a', { stat: 'bestScore', at: 450 }],
  ['marine', 'Marine', '#172a4f', { stat: 'runs', at: 25 }],
  ['corail', 'Corail', '#f07a63', { stat: 'wordsFound', at: 250 }],
  ['sauge', 'Sauge', '#9bb08f', { stat: 'level', at: 10 }],
  ['moutarde', 'Moutarde', '#c99a17', { stat: 'bestCombo', at: 14 }],
  ['violet', 'Violet', '#5b3a8c', { stat: 'level', at: 12 }],
  ['turquoise', 'Turquoise', '#3aa6b0', { stat: 'wordsFound', at: 600 }],
  ['ocre', 'Ocre', '#b8782b', { stat: 'runs', at: 60 }],
  ['lavande', 'Lavande', '#b3a6d9', { stat: 'bestScore', at: 650 }],
  ['olive', 'Olive', '#6f7a2e', { stat: 'level', at: 15 }],
  ['saumon', 'Saumon', '#f4b49a', { stat: 'bestCombo', at: 18 }],
  ['canard', 'Canard', '#16606e', { stat: 'wordsFound', at: 1200 }],
  ['menthe', 'Menthe', '#7fc8a9', { stat: 'level', at: 18 }],
  ['bordeaux', 'Bordeaux', '#6e1f2a', { stat: 'runs', at: 150 }],
  ['sable', 'Sable', '#e3cf9f', { stat: 'bestScore', at: 800 }],
  ['outremer', 'Outremer', '#2d2f9a', { stat: 'level', at: 22 }],
  ['emeraude', 'Émeraude', '#1f8a5b', { stat: 'wordsFound', at: 3000 }],
  ['prune', 'Prune', '#7a2f5a', { stat: 'bestCombo', at: 24 }],
  ['gris', 'Gris', '#8a8478', { stat: 'runs', at: 300 }],
  ['anthracite', 'Anthracite', '#3a3834', { stat: 'level', at: 30 }],
]

export const PALETTE: readonly Colour[] = COLOURS.map(([id, label, hex]) => ({ id, label, hex }))

export function colourUnlock(id: string): Milestone | null {
  return COLOURS.find((colour) => colour[0] === id)?.[3] ?? null
}

export const DEFAULT_AVATAR: AvatarChoice = { design: 0, ground: 'bleu', shape: 'jaune', accent: 'rouge' }

function statOf(profile: Profile, stat: Stat): number {
  return stat === 'level' ? levelFor(profile.xp) : profile[stat]
}

export function reached(profile: Profile, milestone: Milestone | null): boolean {
  return milestone === null || statOf(profile, milestone.stat) >= milestone.at
}

export function ownedDesigns(profile: Profile): AvatarDesign[] {
  return AVATARS.filter((design) => reached(profile, designUnlock(design.id)))
}

export function ownedColours(profile: Profile): Colour[] {
  return PALETTE.filter((colour) => reached(profile, colourUnlock(colour.id)))
}

/** What a run earned — the end screen shows it next to the level. */
export function newlyEarned(before: Profile, after: Profile): { designs: AvatarDesign[]; colours: Colour[] } {
  const had = new Set(ownedDesigns(before).map((design) => design.id))
  const hadColours = new Set(ownedColours(before).map((colour) => colour.id))
  return {
    designs: ownedDesigns(after).filter((design) => !had.has(design.id)),
    colours: ownedColours(after).filter((colour) => !hadColours.has(colour.id)),
  }
}

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
