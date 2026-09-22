import { useEffect, useRef, useState } from 'react'

export interface Countdown {
  /** Seconds left, never below zero. */
  remaining: number
  /** 0 at the start of the round, 1 when time is up. */
  elapsedRatio: number
  paused: boolean
  toggle(): void
}

/**
 * The countdown is read from the wall clock on every frame rather than
 * accumulated per frame: a backgrounded tab suspends requestAnimationFrame but
 * not the clock, so the round is over when the table says it is.
 */
export function useCountdown(seconds: number, onDone: () => void): Countdown {
  const [remaining, setRemaining] = useState(seconds)
  const [paused, setPaused] = useState(false)
  const deadline = useRef<number | null>(null)
  const fired = useRef(false)
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onDoneRef.current = onDone
  })

  useEffect(() => {
    if (paused) return
    if (deadline.current === null) deadline.current = Date.now() + seconds * 1000

    let frame = 0
    const tick = () => {
      const left = Math.max(0, ((deadline.current ?? 0) - Date.now()) / 1000)
      setRemaining(left)
      if (left > 0) {
        frame = requestAnimationFrame(tick)
        return
      }
      if (fired.current) return
      fired.current = true
      onDoneRef.current()
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [paused, seconds])

  return {
    remaining,
    elapsedRatio: seconds > 0 ? Math.min(1, (seconds - remaining) / seconds) : 1,
    paused,
    toggle() {
      setPaused((wasPaused) => {
        // Pausing freezes the deadline where it is; resuming pushes it back by
        // however long the table talked.
        if (wasPaused) deadline.current = Date.now() + remaining * 1000
        return !wasPaused
      })
    },
  }
}
