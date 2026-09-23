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

const SHAPES: readonly ShapeKind[] = [
  'circle',
  'square',
  'quarter',
  'arch',
  'half',
  'triangle',
  'corner',
  'ring',
  'diamond',
  'bars',
  'sun',
]

// Row r turns by r % 4 and carries ACCENTS[r]: each (turn, accent) pair comes
// up once, so even a circle, which no turn changes, reads differently per row.
const ACCENTS: readonly (ShapeKind | null)[] = [
  null,
  'circle',
  'square',
  'triangle',
  'circle',
  'square',
  'triangle',
  'circle',
  'square',
]

const MOTIONS: readonly Motion[] = ['turn', 'pulse', 'still', 'spin', 'sway', 'bob']

export const AVATARS: readonly AvatarDesign[] = [
  ...ACCENTS.flatMap((accent, row) =>
    SHAPES.map((shape, column) => ({
      id: row * SHAPES.length + column,
      shape,
      turn: (row % 4) as AvatarDesign['turn'],
      accent,
      motion: MOTIONS[(row + column) % MOTIONS.length],
    })),
  ),
  { id: ACCENTS.length * SHAPES.length, shape: 'circle', turn: 0, accent: 'sun', motion: 'spin' },
]

/** Designs every player owns from the first run. */
const FREE_DESIGNS = 6

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

// One goal per track in turn, so the grid mixes levels with feats instead of
// hiding every feat behind the last level.
const TRACKS: readonly Milestone[][] = [
  range(2, 25).flatMap((at) => [
    { stat: 'level' as const, at },
    { stat: 'level' as const, at },
  ]),
  [3, 5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200].map((at) => ({ stat: 'runs' as const, at })),
  [10, 25, 50, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 3000].map((at) => ({
    stat: 'wordsFound' as const,
    at,
  })),
  [100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 1000].map((at) => ({ stat: 'bestScore' as const, at })),
  [3, 5, 8, 10, 12, 15, 20, 25, 30].map((at) => ({ stat: 'bestCombo' as const, at })),
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
  ['noir', 'Noir', '#151515', { stat: 'runs', at: 1 }],
  ['creme', 'Crème', '#f2ecdf', { stat: 'level', at: 2 }],
  ['vert', 'Vert', '#17614c', { stat: 'level', at: 3 }],
  ['rose', 'Rose', '#f1a3b3', { stat: 'runs', at: 5 }],
  ['orange', 'Orange', '#ee7a22', { stat: 'level', at: 4 }],
  ['ciel', 'Ciel', '#8fc1e3', { stat: 'wordsFound', at: 25 }],
  ['brique', 'Brique', '#a83a2a', { stat: 'level', at: 5 }],
  ['citron', 'Citron', '#efd64a', { stat: 'bestCombo', at: 5 }],
  ['marine', 'Marine', '#172a4f', { stat: 'level', at: 6 }],
  ['corail', 'Corail', '#f07a63', { stat: 'runs', at: 10 }],
  ['sauge', 'Sauge', '#9bb08f', { stat: 'level', at: 7 }],
  ['moutarde', 'Moutarde', '#c99a17', { stat: 'bestScore', at: 200 }],
  ['violet', 'Violet', '#5b3a8c', { stat: 'level', at: 8 }],
  ['turquoise', 'Turquoise', '#3aa6b0', { stat: 'wordsFound', at: 100 }],
  ['ocre', 'Ocre', '#b8782b', { stat: 'level', at: 9 }],
  ['lavande', 'Lavande', '#b3a6d9', { stat: 'runs', at: 25 }],
  ['olive', 'Olive', '#6f7a2e', { stat: 'level', at: 10 }],
  ['saumon', 'Saumon', '#f4b49a', { stat: 'bestCombo', at: 10 }],
  ['canard', 'Canard', '#16606e', { stat: 'level', at: 11 }],
  ['menthe', 'Menthe', '#7fc8a9', { stat: 'bestScore', at: 400 }],
  ['bordeaux', 'Bordeaux', '#6e1f2a', { stat: 'level', at: 12 }],
  ['sable', 'Sable', '#e3cf9f', { stat: 'wordsFound', at: 250 }],
  ['outremer', 'Outremer', '#2d2f9a', { stat: 'level', at: 13 }],
  ['emeraude', 'Émeraude', '#1f8a5b', { stat: 'runs', at: 50 }],
  ['prune', 'Prune', '#7a2f5a', { stat: 'level', at: 14 }],
  ['gris', 'Gris', '#8a8478', { stat: 'bestScore', at: 600 }],
  ['anthracite', 'Anthracite', '#3a3834', { stat: 'level', at: 15 }],
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

export function describeMilestone(milestone: Milestone): string {
  switch (milestone.stat) {
    case 'level':
      return `niveau ${milestone.at}`
    case 'runs':
      return milestone.at > 1 ? `${milestone.at} parties` : '1 partie'
    case 'bestScore':
      return `score de ${milestone.at}`
    case 'wordsFound':
      return `${milestone.at} mots trouvés`
    case 'bestCombo':
      return `série de ${milestone.at}`
  }
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
