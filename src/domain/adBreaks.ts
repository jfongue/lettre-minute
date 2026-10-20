/**
 * When a host breaks between two runs for an ad: the `first` finished run of
 * the session, then after a gap of `gap` runs, each gap `growth` longer than
 * the last. The first run is never interrupted, and a player who keeps
 * playing is asked less and less often.
 */
export interface BreakSchedule {
  first: number
  gap: number
  growth: number
}

/** CrazyGames' midgame ad: the 2nd, 5th, 9th, 14th, 20th… run (gaps 3, 4, 5, 6…). */
export const MIDGAME_BREAKS: BreakSchedule = { first: 2, gap: 3, growth: 1 }

/** The phone's interstitial: the 3rd, 7th, 13th, 21st, 31st… run (gaps 4, 6, 8, 10…). */
export const INTERSTITIAL_BREAKS: BreakSchedule = { first: 3, gap: 4, growth: 2 }

/** The first run past `finishedRuns` the schedule breaks after. */
export function nextBreak(finishedRuns: number, schedule: BreakSchedule): number {
  let due = schedule.first
  let gap = schedule.gap
  while (due <= finishedRuns) {
    due += gap
    gap += schedule.growth
  }
  return due
}

/** Whether the schedule breaks after a session's `finishedRuns`-th finished run. */
export function breakDue(finishedRuns: number, schedule: BreakSchedule): boolean {
  if (!Number.isInteger(finishedRuns) || finishedRuns < schedule.first) return false
  return nextBreak(finishedRuns - 1, schedule) === finishedRuns
}
