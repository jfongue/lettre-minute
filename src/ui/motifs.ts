import { CATALOGUE } from '../domain/catalogue'

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
