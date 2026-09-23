import { DEFAULT_AVATAR, type AvatarChoice } from './avatar'

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
 */
export const HOUSE_PLAYER: BoardRow = { name: 'Demontoon', avatar: DEFAULT_AVATAR, value: 94 }

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
