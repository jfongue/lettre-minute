import { useEffect, useState } from 'react'
import { reducedMotion } from './useCountUp'

/**
 * Keeps a closed layer on screen for `ms` more, so it can play its way out
 * rather than vanish: `shown` is the value it was opened with, and `leaving`
 * says it is on its way out. Opened again meanwhile, it simply stays.
 */
export function useLeaving<T>(value: T | null, ms: number): { shown: T | null; leaving: boolean } {
  const [last, setLast] = useState(value)
  // Adjusted during render, so the layer never shows a frame without its value.
  if (value !== null && value !== last) setLast(value)

  useEffect(() => {
    if (value !== null || last === null) return
    const timer = setTimeout(() => setLast(null), reducedMotion() ? 0 : ms)
    return () => clearTimeout(timer)
  }, [value, last, ms])

  return { shown: value ?? last, leaving: value === null && last !== null }
}
