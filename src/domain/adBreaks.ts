/**
 * Whether a host's break (CrazyGames' midgame ad) falls after a session's
 * `finishedRuns`-th finished run: the 2nd, then every gap one longer than the
 * last — 5th, 9th, 14th, 20th… Those are the triangular numbers minus one, so
 * the first run is never interrupted and a player who keeps playing is asked
 * less and less often.
 */
export function midgameDue(finishedRuns: number): boolean {
  if (!Number.isInteger(finishedRuns) || finishedRuns < 2) return false
  const root = Math.round(Math.sqrt(8 * (finishedRuns + 1) + 1))
  return root * root === 8 * (finishedRuns + 1) + 1
}
