import type { AvatarChoice } from '../domain/avatar'
import type { Boards } from '../domain/boards'
import type { RunRecord } from '../domain/history'
import { completeLeaderboard, type PeriodId } from '../domain/leaderboards'
import { guestFits, guestValue, LOCAL_STATS, placeGuest, placeGuestRow } from '../domain/localBoards'
import { parisPeriodStart } from '../domain/weekly'
import { fetchLeaderboard, fetchLeaderboardRank } from '../lib/cloud'
import type { LoadLeaderboard } from './LeaderboardsPage'
import { localLoader } from './localBoards'

/** The server's periods open at Paris midnight, whatever the device's zone. */
function serverPeriodStart(period: PeriodId, now: number): number {
  return period === 'all' ? 0 : parisPeriodStart(period, now)
}

export interface Guest {
  history: readonly RunRecord[]
  avatar: AvatarChoice
  /** « Moi », in the interface's language. */
  name: string
  tag: string
}

/**
 * The leaderboards page for a player with no account: the server's board, the
 * player's own best placed on it as « Moi » — past its rows at the place the
 * server gives that value. Out of reach, the server leaves the device's own
 * runs on the measures they can rank.
 */
export function guestLoader(guest: Guest): LoadLeaderboard {
  const offline = localLoader(guest.history, guest.avatar, guest.tag)
  return async (stat, period) => {
    const board = await fetchLeaderboard(stat, period)
    if (!board) return LOCAL_STATS.includes(stat) ? offline(stat, period) : null
    const now = Date.now()
    const value = guestValue(stat, guest.history, serverPeriodStart(period, now), now)
    const rank = value > 0 && !guestFits(board, value) ? await fetchLeaderboardRank(stat, period, value) : null
    return completeLeaderboard(stat, period, placeGuest(board, { name: guest.name, avatar: guest.avatar, value }, rank))
  }
}

/** The home boards with the player's best of the day and of the week where they rank. */
export function withGuest(boards: Boards, guest: Guest): Boards {
  const now = Date.now()
  const row = (period: 'day' | 'week') => ({
    name: guest.name,
    avatar: guest.avatar,
    value: guestValue('best', guest.history, serverPeriodStart(period, now), now),
  })
  return {
    day: placeGuestRow(boards.day, row('day')),
    week: placeGuestRow(boards.week, row('week')),
    discoveries: boards.discoveries,
  }
}
