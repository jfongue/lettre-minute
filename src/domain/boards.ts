import type { AvatarChoice } from './avatar'

export type BoardId = 'day' | 'week' | 'discoveries'

export interface BoardRow {
  name: string
  avatar: AvatarChoice
  /** A score on the day and week boards, a count of words on the discoveries board. */
  value: number
}

export type Boards = Readonly<Record<BoardId, readonly BoardRow[]>>

/**
 * The house player: a score to beat on a quiet day, so the board is never
 * empty. A real run by that account replaces it.
 *
 * His tile is the one the account wears, written out here because a day he has
 * not played yet has no row to read it from: the starting tile would put a
 * stranger's face on the board every quiet morning.
 */
export const HOUSE_PLAYER: BoardRow = {
  name: 'Demontoon',
  avatar: { design: 30, ground: 'jaune', shape: 'violet', accent: 'brique' },
  value: 94,
}

/** The house player's standing score, placed where it ranks unless the account already has one. */
export function withHousePlayer(rows: readonly BoardRow[], house: BoardRow = HOUSE_PLAYER): BoardRow[] {
  const name = house.name.toLowerCase()
  if (rows.some((row) => row.name.toLowerCase() === name)) return [...rows]
  const at = rows.findIndex((row) => row.value < house.value)
  return at === -1 ? [...rows, house] : [...rows.slice(0, at), house, ...rows.slice(at)]
}

/** The score boards carry the house player; the discoveries board counts only what was really found. */
export function completeBoards(boards: Boards): Boards {
  return {
    day: withHousePlayer(boards.day),
    week: withHousePlayer(boards.week),
    discoveries: boards.discoveries,
  }
}

/** Past this many rows, a board opens on the podium and the player's own circle. */
export const BOARD_FOCUS_LIMIT = 10
const PODIUM = 3

export interface RankedRow {
  row: BoardRow
  rank: number
}

/**
 * The rows a long board shows first: the podium, the player and their friends,
 * each at their real rank. `names` is matched without case, as account names are.
 */
export function focusedRows(rows: readonly BoardRow[], names: readonly string[]): { rows: RankedRow[]; more: boolean } {
  const ranked = rows.map((row, index) => ({ row, rank: index + 1 }))
  if (rows.length <= BOARD_FOCUS_LIMIT) return { rows: ranked, more: false }
  const circle = new Set(names.map((name) => name.toLowerCase()))
  const kept = ranked.filter(({ row, rank }) => rank <= PODIUM || circle.has(row.name.toLowerCase()))
  return { rows: kept, more: kept.length < ranked.length }
}
