import type { AvatarChoice } from './avatar'
import type { Boards } from './boards'
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
