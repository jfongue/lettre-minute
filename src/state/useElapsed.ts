import { useEffect, useState } from 'react'

const TICK_MS = 100

/**
 * Seconds since `startedAt`, read from the wall clock on every frame rather
 * than accumulated: a backgrounded tab suspends requestAnimationFrame but not
 * the clock, so a run cannot be paused by switching away from it. Only a
 * host's ad holds it (`heldSince`): the reading stops there, and the caller
 * moves `startedAt` forward by the ad's length once it is gone.
 */
export function useElapsed(startedAt: number | null, heldSince: number | null = null): number {
  // Tagged with the start it was measured from: on a replay, the previous run's
  // last reading must not leak into the first render of the next one.
  const [reading, setReading] = useState({ from: startedAt, elapsed: 0 })

  useEffect(() => {
    if (startedAt === null) return
    if (heldSince !== null) {
      setReading({ from: startedAt, elapsed: (Math.floor((heldSince - startedAt) / TICK_MS) * TICK_MS) / 1000 })
      return
    }

    let frame = 0
    let shown = -1
    const tick = () => {
      // A tenth of a second is finer than anything the run shows (whole
      // seconds, a disc that turns 0.6° in that time): re-rendering the whole
      // app on every frame cost old phones their frame rate while typing.
      const step = Math.floor((Date.now() - startedAt) / TICK_MS)
      if (step !== shown) {
        shown = step
        setReading({ from: startedAt, elapsed: (step * TICK_MS) / 1000 })
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [startedAt, heldSince])

  // Derived rather than reset in the effect: between two runs the hook answers
  // zero without a render pass of its own.
  return startedAt === null || reading.from !== startedAt ? 0 : reading.elapsed
}
