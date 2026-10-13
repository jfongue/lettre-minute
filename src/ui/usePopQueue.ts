import { useEffect, useState } from 'react'
import { nextPop, POP_GAP_MS, POP_ORDER, type PopId } from '../domain/popups'

/**
 * Each pop-up's due state: false, true, or a key naming which one (a challenge
 * id) — a new key closes the open pop-up and opens the next like any other.
 */
export type PopsDue = Readonly<Record<PopId, boolean | string>>

/**
 * The one pop-up the home screen shows among those due (`nextPop`), with a
 * short rest after each so the next one is seen arriving rather than swapped in.
 */
export function usePopQueue(due: PopsDue, updateKnown: boolean): PopId | null {
  const [shown, setShown] = useState<{ id: PopId; key: boolean | string } | null>(null)
  const [resting, setResting] = useState(false)
  const dueSet = new Set(POP_ORDER.filter((id) => due[id] !== false))
  const current = shown !== null && due[shown.id] === shown.key ? shown.id : null
  // Closed this render: the rest starts now, before any next pop-up can be picked.
  const closing = shown !== null && current === null
  const next = resting || closing || current !== null ? null : nextPop(dueSet, null, updateKnown)

  useEffect(() => {
    if (!closing) return
    setShown(null)
    setResting(true)
  }, [closing])
  useEffect(() => {
    if (!resting) return
    const timer = setTimeout(() => setResting(false), POP_GAP_MS)
    return () => clearTimeout(timer)
  }, [resting])
  const nextKey = next === null ? false : due[next]
  useEffect(() => {
    if (next !== null) setShown({ id: next, key: nextKey })
  }, [next, nextKey])

  return current
}
