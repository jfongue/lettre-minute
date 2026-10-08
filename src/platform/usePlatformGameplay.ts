import { useEffect, useRef } from 'react'
import { host } from '.'

/**
 * Tells the host when the player is in a run (the countdown, the clock, the
 * first lesson) and when they are not, celebrates a run that beats a record
 * the player already had, and hands the host every finished run's points for
 * its own board (`submitScore`). Only the CrazyGames portal listens.
 */
export function usePlatformGameplay(phase: string, score: number | null, bestScore: number, lesson: boolean): void {
  const inRun = phase === 'countdown' || phase === 'playing' || lesson
  const bestAtStart = useRef(0)
  useEffect(() => {
    if (phase === 'countdown') bestAtStart.current = bestScore
    host.setGameplay(inRun)
    if (phase === 'over' && score !== null) {
      // A first run has no record to beat: the celebration would mean nothing.
      if (bestAtStart.current > 0 && score > bestAtStart.current) host.celebrate()
      // The host's own board keeps every run, record or not (`submitScore`).
      host.submitScore(score)
    }
    // Only a change of screen speaks; the score is read as it stands then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, inRun])
}
