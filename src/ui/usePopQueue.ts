import { useEffect, useState } from 'react'
import { nextPop, POP_GAP_MS, POP_ORDER, type PopId } from '../domain/popups'

/**
 * The one pop-up the home screen shows among those due (`nextPop`), with a
 * short rest after each so the next one is seen arriving rather than swapped in.
 */
export function usePopQueue(due: Readonly<Record<PopId, boolean>>, updateKnown: boolean): PopId | null {
  const [shown, setShown] = useState<PopId | null>(null)
  const [resting, setResting] = useState(false)
  const dueSet = new Set(POP_ORDER.filter((id) => due[id]))
  const current = shown !== null && dueSet.has(shown) ? shown : null
  const next = resting || current !== null ? null : nextPop(dueSet, null, updateKnown)

  useEffect(() => {
    if (shown === null || current !== null) return
    setShown(null)
    setResting(true)
  }, [shown, current])
  useEffect(() => {
    if (!resting) return
    const timer = setTimeout(() => setResting(false), POP_GAP_MS)
    return () => clearTimeout(timer)
  }, [resting])
  useEffect(() => {
    if (next !== null) setShown(next)
  }, [next])

  return current
}
