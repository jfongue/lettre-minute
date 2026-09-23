import { useEffect, useState } from 'react'

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Counts from `from` up to `target`, easing out, so a figure lands rather than appears. */
export function useCountUp(target: number, durationMs = 900, from = 0, delayMs = 0): number {
  const [value, setValue] = useState(() => (reducedMotion() ? target : from))

  useEffect(() => {
    if (reducedMotion()) return
    const start = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, Math.max(0, now - start - delayMs) / durationMs)
      setValue(Math.round(from + (target - from) * (1 - (1 - t) ** 3)))
      if (t < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs, from, delayMs])

  return value
}
