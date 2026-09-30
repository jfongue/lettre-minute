import { useLayoutEffect, useRef, type RefObject } from 'react'
import { reducedMotion } from './useCountUp'

const EASE_OUT = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

/**
 * Slides the children of `list` from where they stood to where a reorder put
 * them, instead of letting them jump: each child is found again by its
 * `data-flip` key and played back from its old place on the compositor.
 * Places are read from the layout (`offsetLeft`), which a slide in progress
 * does not move. Nothing slides on the first render.
 */
export function useFlip(list: RefObject<HTMLElement | null>, order: string, durationMs = 320) {
  const places = useRef(new Map<string, { x: number; y: number }>())

  useLayoutEffect(() => {
    const element = list.current
    if (!element) return
    const next = new Map<string, { x: number; y: number }>()
    for (const child of element.querySelectorAll<HTMLElement>(':scope > [data-flip]')) {
      const key = child.dataset.flip!
      const place = { x: child.offsetLeft, y: child.offsetTop }
      next.set(key, place)
      const before = places.current.get(key)
      if (!before || reducedMotion()) continue
      const dx = before.x - place.x
      const dy = before.y - place.y
      if (dx === 0 && dy === 0) continue
      child.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: durationMs,
        easing: EASE_OUT,
      })
    }
    places.current = next
  }, [list, order, durationMs])
}
