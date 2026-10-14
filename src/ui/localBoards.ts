import type { AvatarChoice } from '../domain/avatar'
import type { Boards } from '../domain/boards'
import type { RunRecord } from '../domain/history'
import type { PeriodId } from '../domain/leaderboards'
import { localBoards as boardsOf, localLeaderboard } from '../domain/localBoards'
import type { LoadLeaderboard } from './LeaderboardsPage'

/** The device's midnight, or the Monday midnight that opened the week; 0 for all time. */
export function periodStart(period: PeriodId, now: number): number {
  if (period === 'all') return 0
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (period === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start.getTime()
}

/** A run's line on a local board: its time today, its weekday this week, its date beyond. */
export function runLabel(tag: string, period: PeriodId): (at: number) => string {
  const format = new Intl.DateTimeFormat(
    tag,
    period === 'day'
      ? { hour: '2-digit', minute: '2-digit' }
      : period === 'week'
        ? { weekday: 'short', hour: '2-digit', minute: '2-digit' }
        : { day: 'numeric', month: 'short', year: 'numeric' },
  )
  return (at) => format.format(at)
}

/** The leaderboards page's loader on a device with no server: the player's own runs, never null. */
export function localLoader(history: readonly RunRecord[], avatar: AvatarChoice, tag: string): LoadLeaderboard {
  return async (stat, period) => {
    const now = Date.now()
    return localLeaderboard(stat, periodStart(period, now), history, now, avatar, runLabel(tag, period))
  }
}

/** The home screen's boards on a device with no server. */
export function localBoards(history: readonly RunRecord[], avatar: AvatarChoice, tag: string): Boards {
  const now = Date.now()
  return boardsOf(history, now, (period) => periodStart(period, now), avatar, (period) => runLabel(tag, period))
}
