import { HOUSE_PLAYER, type BoardRow } from './boards'

/** What a leaderboard measures: the order is the page's. */
export const STATS = ['best', 'points', 'runs', 'words', 'discoveries', 'combo', 'added'] as const
export type StatId = (typeof STATS)[number]

export const PERIODS = ['day', 'week', 'all'] as const
export type PeriodId = (typeof PERIODS)[number]

export interface PlacedRow extends BoardRow {
  /** Shared by equal values: two players on 80 are both second. */
  place: number
  mine: boolean
}

export interface Leaderboard {
  rows: readonly PlacedRow[]
  /** The player's own line when it ranks past the rows, null otherwise. */
  me: PlacedRow | null
}

/** Places from the order of the values, as SQL's `rank()` gives them. */
function placed(rows: readonly PlacedRow[]): PlacedRow[] {
  const out: PlacedRow[] = []
  rows.forEach((row, index) => {
    const previous = out[index - 1]
    out.push({ ...row, place: previous && previous.value === row.value ? previous.place : index + 1 })
  })
  return out
}

/**
 * The house player stands on the best-run boards of the day and the week, as
 * on the home screen: never on a total, which his standing score would
 * belittle, nor on a count he never plays for.
 */
export function completeLeaderboard(stat: StatId, period: PeriodId, board: Leaderboard): Leaderboard {
  if (stat !== 'best' || period === 'all') return board
  const name = HOUSE_PLAYER.name.toLowerCase()
  if (board.rows.some((row) => row.name.toLowerCase() === name) || board.me?.name.toLowerCase() === name) return board
  const house: PlacedRow = { ...HOUSE_PLAYER, place: 0, mine: false }
  const at = board.rows.findIndex((row) => row.value < house.value)
  const rows = at === -1 ? [...board.rows, house] : [...board.rows.slice(0, at), house, ...board.rows.slice(at)]
  const me = board.me && house.value > board.me.value ? { ...board.me, place: board.me.place + 1 } : board.me
  return { rows: placed(rows), me }
}

/** The player's place on a board, whether among its rows or past them; null when absent. */
export function myPlace(board: Leaderboard): PlacedRow | null {
  return board.rows.find((row) => row.mine) ?? board.me
}
