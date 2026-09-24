import { useRef, type TouchEvent } from 'react'

/** Long enough not to fire on a tap, short enough for a flick of the thumb. */
const MIN_DISTANCE = 60

/**
 * A horizontal flick of the finger. A gesture that starts inside a horizontal
 * scroller or a slider (anything under `[data-no-swipe]`) belongs to it, and a
 * mostly vertical one is a scroll.
 */
export function useSwipe(direction: 'left' | 'right', onSwipe: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onTouchStart(event: TouchEvent) {
      const touch = event.touches[0]
      const owned = event.target instanceof Element && event.target.closest('[data-no-swipe], input')
      start.current = touch && event.touches.length === 1 && !owned ? { x: touch.clientX, y: touch.clientY } : null
    },
    onTouchEnd(event: TouchEvent) {
      const from = start.current
      const touch = event.changedTouches[0]
      start.current = null
      if (!from || !touch) return
      const dx = (touch.clientX - from.x) * (direction === 'right' ? 1 : -1)
      const dy = Math.abs(touch.clientY - from.y)
      if (dx >= MIN_DISTANCE && dy < dx / 2) onSwipe()
    },
  }
}
