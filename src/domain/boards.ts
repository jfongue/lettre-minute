import type { AvatarChoice } from './avatar'
import { parisPeriodStart } from './weekly'

export type BoardId = 'day' | 'week' | 'discoveries'

export interface BoardRow {
  name: string
  avatar: AvatarChoice
  /** A score on the day and week boards, a count of words on the discoveries board. */
  value: number
  /** One of the player's own runs, on a board the device draws from its own history. */
  own?: boolean
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
 * each at their real rank, topped up with the best-ranked strangers until the
 * board holds `BOARD_FOCUS_LIMIT` rows — a circle of two would otherwise leave
 * a board of five. `names` is matched without case, as account names are.
 */
export function focusedRows(rows: readonly BoardRow[], names: readonly string[]): { rows: RankedRow[]; more: boolean } {
  const ranked = rows.map((row, index) => ({ row, rank: index + 1 }))
  if (rows.length <= BOARD_FOCUS_LIMIT) return { rows: ranked, more: false }
  const circle = new Set(names.map((name) => name.toLowerCase()))
  const inCircle = ({ row, rank }: RankedRow) => rank <= PODIUM || row.own === true || circle.has(row.name.toLowerCase())
  let room = BOARD_FOCUS_LIMIT - ranked.filter(inCircle).length
  const kept = ranked.filter((entry) => inCircle(entry) || room-- > 0)
  return { rows: kept, more: kept.length < ranked.length }
}

/** The rows the server sends a board: past them, a run off the board stays off. */
export const BOARD_SERVER_ROWS = 50

const sameName = (a: string, b: string) => a.toLocaleLowerCase('fr-FR') === b.toLocaleLowerCase('fr-FR')

/**
 * One best-score board with the player's run on it: their line takes the
 * score if it beats the one they had, at the place the server would give it
 * (higher first, then the name), and a full board the score does not reach
 * stays as it was.
 */
function withRun(rows: readonly BoardRow[], me: { name: string; avatar: AvatarChoice }, score: number): BoardRow[] {
  const own = rows.find((row) => sameName(row.name, me.name))
  if (score <= 0 || (own && own.value >= score)) return [...rows]
  const others = rows.filter((row) => !sameName(row.name, me.name))
  const line: BoardRow = { name: own?.name ?? me.name, avatar: own?.avatar ?? me.avatar, value: score }
  const at = others.findIndex((row) => row.value < score || (row.value === score && row.name.localeCompare(line.name) > 0))
  const place = at === -1 ? others.length : at
  if (!own && place >= BOARD_SERVER_ROWS) return [...rows]
  return [...others.slice(0, place), line, ...others.slice(place)].slice(0, Math.max(rows.length, place + 1))
}

/**
 * The boards as a run leaves them, from the last ones read: the day's and the
 * week's best scores take the run, the discoveries wait for the server. What
 * the end of a run shows the player climbing, whether or not the server
 * answers in time — a busy one used to leave the climb unseen.
 */
export function projectBoards(boards: Boards, me: { name: string; avatar: AvatarChoice }, score: number): Boards {
  return {
    day: withRun(boards.day, me, score),
    week: withRun(boards.week, me, score),
    discoveries: boards.discoveries,
  }
}

/**
 * The boards kept from an earlier visit, for a server that does not answer:
 * a board of a day or a week since gone is emptied, never shown as today's.
 */
export function boardsStillValid(boards: Boards, readAt: number, now: number): Boards {
  const sameDay = parisPeriodStart('day', readAt) === parisPeriodStart('day', now)
  const sameWeek = parisPeriodStart('week', readAt) === parisPeriodStart('week', now)
  return {
    day: sameDay ? boards.day : [],
    week: sameWeek ? boards.week : [],
    discoveries: sameWeek ? boards.discoveries : [],
  }
}
