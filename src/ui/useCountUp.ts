import { useEffect, useState } from 'react'

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function useEased(target: number, durationMs: number, from: number, delayMs: number, round: boolean): number {
  const [value, setValue] = useState(() => (reducedMotion() ? target : from))

  useEffect(() => {
    if (reducedMotion()) return
    const start = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, Math.max(0, now - start - delayMs) / durationMs)
      const eased = from + (target - from) * (1 - (1 - t) ** 3)
      // Rounded, an unchanged figure skips its render.
      setValue(round ? Math.round(eased) : eased)
      if (t < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs, from, delayMs, round])

  return value
}

/** Counts from `from` up to `target`, easing out, so a figure lands rather than appears. */
export function useCountUp(target: number, durationMs = 900, from = 0, delayMs = 0): number {
  return useEased(target, durationMs, from, delayMs, true)
}

/**
 * The same ease, unrounded, for what is drawn rather than read: a bar driven
 * by the rounded count moves in steps of one point, visibly on a small gain.
 */
export function useTween(target: number, durationMs = 900, from = 0, delayMs = 0): number {
  return useEased(target, durationMs, from, delayMs, false)
}
