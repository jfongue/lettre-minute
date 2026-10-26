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

/**
 * CrazyGames' midgame comes on « Play again », once this many runs have
 * finished since the last one: never before the session's second run, then
 * one run in two. Play from the home screen never asks, as the portal refuses
 * an ad on a navigational button.
 */
export const REPLAY_BREAK_RUNS = 2

/** Whether « Play again » breaks after `runsSinceBreak` finished runs. */
export function replayBreakDue(runsSinceBreak: number): boolean {
  return Number.isInteger(runsSinceBreak) && runsSinceBreak >= REPLAY_BREAK_RUNS
}
