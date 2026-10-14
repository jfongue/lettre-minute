import type { AvatarChoice } from './avatar'
import type { BoardRow, Boards } from './boards'
import type { RunRecord } from './history'
import { placed, type Leaderboard, type PeriodId, type PlacedRow, type StatId } from './leaderboards'

/**
 * A device with no server ranks the player's own runs, so only the measures a
 * single run carries make a board: totals and counts would be one line.
 */
export const LOCAL_STATS: readonly StatId[] = ['best', 'combo', 'words']

/** Runs a local board lists. */
export const LOCAL_BOARD_SIZE = 10

function valueOf(stat: StatId, run: RunRecord): number {
  if (stat === 'combo') return run.bestCombo
  if (stat === 'words') return run.words.length
  return run.score
}

/**
 * The player's best runs since `since` (a moment the interface reads off the
 * device's calendar: the domain has no clock), best first, each under the name
 * `label` gives its moment.
 */
export function localLeaderboard(
  stat: StatId,
  since: number,
  history: readonly RunRecord[],
  now: number,
  avatar: AvatarChoice,
  label: (at: number) => string,
): Leaderboard {
  const rows: PlacedRow[] = history
    .filter((run) => run.at >= since && run.at <= now && valueOf(stat, run) > 0)
    .map((run) => ({ name: label(run.at), avatar, value: valueOf(stat, run), own: true, place: 0, mine: true }))
    .sort((a, b) => b.value - a.value)
    .slice(0, LOCAL_BOARD_SIZE)
  return { rows: placed(rows), me: null }
}

/** The home screen's two boards, from the same runs; discoveries need a server and stay empty. */
export function localBoards(
  history: readonly RunRecord[],
  now: number,
  since: (period: PeriodId) => number,
  avatar: AvatarChoice,
  label: (period: PeriodId) => (at: number) => string,
): Boards {
  const rows = (period: PeriodId) =>
    localLeaderboard('best', since(period), history, now, avatar, label(period)).rows.map(({ name, avatar, value, own }) => ({ name, avatar, value, own }))
  return { day: rows('day'), week: rows('week'), discoveries: [] }
}

/** The rows a server board lists before the player's own line (`leaderboard_stat`). */
export const SERVER_BOARD_SIZE = 50

/**
 * A guest's value on a server board, from the device's runs since `since`,
 * counted as `leaderboard_values` counts a player's: 0 on a measure the
 * device cannot count (discoveries, added words, moderation).
 */
export function guestValue(stat: StatId, history: readonly RunRecord[], since: number, now: number): number {
  const runs = history.filter((run) => run.at >= since && run.at <= now)
  switch (stat) {
    case 'best':
      return Math.max(0, ...runs.map((run) => run.score))
    case 'combo':
      return Math.max(0, ...runs.map((run) => run.bestCombo))
    case 'points':
      return runs.reduce((sum, run) => sum + run.score, 0)
    case 'words':
      return runs.reduce((sum, run) => sum + run.words.length, 0)
    case 'runs':
      return runs.length
    default:
      return 0
  }
}

/** Where a guest's value goes among rows best first: after every row at least as good. */
function slotOf(rows: readonly { value: number }[], value: number): number {
  const at = rows.findIndex((row) => row.value < value)
  return at === -1 ? rows.length : at
}

/** The guest's value falls among the board's rows, so no server rank is needed to place it. */
export function guestFits(board: Leaderboard, value: number): boolean {
  return value > 0 && (board.rows.length < SERVER_BOARD_SIZE || slotOf(board.rows, value) < board.rows.length)
}

/**
 * A server board with the guest's line on it: among its rows when it fits,
 * past them at `rank` (the server's `leaderboard_rank`) otherwise, and left as
 * it is with no value or no rank.
 */
export function placeGuest(board: Leaderboard, guest: BoardRow, rank: number | null): Leaderboard {
  if (guestFits(board, guest.value)) {
    const at = slotOf(board.rows, guest.value)
    const line: PlacedRow = { ...guest, own: true, place: 0, mine: true }
    return { rows: placed([...board.rows.slice(0, at), line, ...board.rows.slice(at)]), me: null }
  }
  if (guest.value <= 0 || rank === null) return board
  return { rows: board.rows, me: { ...guest, own: true, place: rank, mine: true } }
}

/** A home board with the guest's best on it, where it ranks among the rows the server sent. */
export function placeGuestRow(rows: readonly BoardRow[], guest: BoardRow): BoardRow[] {
  if (guest.value <= 0) return [...rows]
  const at = slotOf(rows, guest.value)
  if (at >= SERVER_BOARD_SIZE) return [...rows]
  return [...rows.slice(0, at), { ...guest, own: true }, ...rows.slice(at)]
}
