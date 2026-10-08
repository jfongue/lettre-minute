import { useEffect, useRef } from 'react'
import { happytime, ON_CRAZYGAMES, setGameplay } from '../lib/crazygames'

/**
 * Tells the CrazyGames portal when the player is in a run (the countdown, the
 * clock, the first lesson) and when they are not, and celebrates a run that
 * beats a record the player already had. Does nothing on any other build.
 */
export function usePlatformGameplay(phase: string, score: number | null, bestScore: number, lesson: boolean): void {
  const inRun = phase === 'countdown' || phase === 'playing' || lesson
  const bestAtStart = useRef(0)
  useEffect(() => {
    if (!ON_CRAZYGAMES) return
    if (phase === 'countdown') bestAtStart.current = bestScore
    setGameplay(inRun)
    // A first run has no record to beat: the celebration would mean nothing.
    if (phase === 'over' && score !== null && bestAtStart.current > 0 && score > bestAtStart.current) happytime()
    // Only a change of screen speaks; the score is read as it stands then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, inRun])
}
