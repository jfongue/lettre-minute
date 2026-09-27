import type { CSSProperties } from 'react'
import type { ShapeKind } from '../domain/avatar'
import type { PowerId } from '../domain/powers'
import { CATALOGUE } from '../domain/catalogue'

export type { ShapeKind, DetailKind } from '../domain/avatar'

// `ink` and `paper` swap in dark mode; `black` and `cream` never do, which is
// what text printed on a block of colour needs.
export type Tint = 'red' | 'blue' | 'yellow' | 'green' | 'pink' | 'ink' | 'paper' | 'black' | 'cream'

export interface Motif {
  kind: ShapeKind
  tint: Tint
}

// Shapes a letter can sit inside legibly, and the colours read against them.
const LETTER_SHAPES: readonly ShapeKind[] = ['circle', 'square', 'arch', 'quarter']
const TINTS: readonly Tint[] = ['red', 'blue', 'yellow', 'green', 'pink']

/** A stable shape and colour for the n-th item of a series, so neighbours never match. */
export function motifAt(index: number): Motif {
  return { kind: LETTER_SHAPES[index % LETTER_SHAPES.length], tint: TINTS[index % TINTS.length] }
}

/** Each category keeps the same colour everywhere it appears. */
export function categoryMotif(categoryId: string): Motif {
  return motifAt(Math.max(0, CATALOGUE.findIndex((category) => category.id === categoryId)))
}

/** The text colour that reads on a given ground. */
export function onTint(tint: Tint): Tint {
  if (tint === 'paper') return 'ink'
  if (tint === 'ink') return 'paper'
  return tint === 'yellow' || tint === 'pink' || tint === 'cream' ? 'black' : 'cream'
}

/** Each power keeps one colour everywhere: its card, its slot, its badge in a run, its effect. */
export const POWER_TINTS: Record<PowerId, Tint> = {
  permutation: 'blue',
  joker: 'red',
  dodge: 'green',
  magic: 'yellow',
  hush: 'ink',
  dyslexia: 'pink',
  divination: 'blue',
  complication: 'red',
  celerity: 'yellow',
  professor: 'green',
  chatter: 'pink',
}

/** The block of colour a power sits on, and the ink that reads on it. */
export function powerGround(id: PowerId): CSSProperties {
  const tint = POWER_TINTS[id]
  return { background: `var(--${tint})`, color: `var(--${onTint(tint)})` }
}

