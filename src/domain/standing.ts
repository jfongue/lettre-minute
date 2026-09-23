import type { BoardRow } from './boards'

export interface StandingMove {
  /** 1-based; null when the player was not on the board before the run. */
  from: number | null
  to: number
  /** The players the run overtook, in their order on the board after it. */
  passed: readonly BoardRow[]
}

// Display names are unique without regard to case, as the house player's lookup assumes.
const same = (a: string, b: string) => a.toLocaleLowerCase('fr-FR') === b.toLocaleLowerCase('fr-FR')

/**
 * Where the player stood before the run and where they stand after it. Null
 * when the run left them off the board: there is no place to show.
 */
export function standingMove(before: readonly BoardRow[], after: readonly BoardRow[], name: string): StandingMove | null {
  const to = after.findIndex((row) => same(row.name, name))
  if (to === -1) return null
  const at = before.findIndex((row) => same(row.name, name))
  const above = new Set((at === -1 ? before : before.slice(0, at)).map((row) => row.name.toLocaleLowerCase('fr-FR')))
  return {
    from: at === -1 ? null : at + 1,
    to: to + 1,
    passed: after.slice(to + 1).filter((row) => above.has(row.name.toLocaleLowerCase('fr-FR'))),
  }
}

/** « 1er », « 2e », « 17e » : a place on the board, as a French poster prints it. */
export function ordinal(rank: number): string {
  return rank === 1 ? '1er' : `${rank}e`
}
