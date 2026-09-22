import { useEffect, useState } from 'react'

/**
 * Seconds since `startedAt`, read from the wall clock on every frame rather
 * than accumulated: a backgrounded tab suspends requestAnimationFrame but not
 * the clock, so a run cannot be paused by switching away from it.
 */
export function useElapsed(startedAt: number | null): number {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (startedAt === null) return

    let frame = 0
    const tick = () => {
      setElapsed((Date.now() - startedAt) / 1000)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [startedAt])

  // Derived rather than reset in the effect: between two runs the hook answers
  // zero without a render pass of its own.
  return startedAt === null ? 0 : elapsed
}
