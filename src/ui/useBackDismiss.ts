import { useEffect, useRef } from 'react'

/*
 * Android's back gesture closes one overlay at a time, newest first. An overlay
 * registers its close while it is mounted; one that may not be refused (the
 * category gift) never registers, so the gesture falls through to the screen
 * behind it rather than swallowing the press.
 *
 * A computer's Escape reads the same stack, caught on the window's capture
 * phase so that only the newest overlay closes: a drawer's own Escape listener
 * further down never sees a press that already closed a popup inside it.
 */
const dismissers: Array<() => void> = []

function escape(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented || !dismissTopOverlay()) return
  event.preventDefault()
  event.stopImmediatePropagation()
}

/** Closes the topmost overlay; false when there is none to close. */
export function dismissTopOverlay(): boolean {
  const dismiss = dismissers[dismissers.length - 1]
  if (!dismiss) return false
  dismiss()
  return true
}

/**
 * The overlay's close, on the back gesture, for as long as it is mounted —
 * `null` while it has nothing to close (a reaction bar that is folded away),
 * so the gesture reaches the screen behind. The latest handler is read at
 * press time, so an inline arrow costs no re-registration and the stack keeps
 * its mounting order.
 */
export function useBackDismiss(dismiss: (() => void) | null): void {
  const latest = useRef(dismiss)
  latest.current = dismiss
  const registered = dismiss !== null
  useEffect(() => {
    if (!registered) return
    const entry = () => latest.current?.()
    if (dismissers.length === 0) window.addEventListener('keydown', escape, true)
    dismissers.push(entry)
    return () => {
      const at = dismissers.lastIndexOf(entry)
      if (at >= 0) dismissers.splice(at, 1)
      if (dismissers.length === 0) window.removeEventListener('keydown', escape, true)
    }
  }, [registered])
}
