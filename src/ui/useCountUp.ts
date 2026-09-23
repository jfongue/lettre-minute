import { useEffect, useState } from 'react'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Counts from zero up to `target`, easing out, so a final score lands rather than appears. */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0))

  useEffect(() => {
    if (reducedMotion()) return
    const start = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / durationMs)
      setValue(Math.round(target * (1 - (1 - t) ** 3)))
      if (t < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs])

  return value
}
