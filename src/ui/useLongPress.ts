import { useCallback, useRef, type MouseEvent } from 'react'

/** Long enough that a tap on a word is not taken for a long press. */
const LONG_PRESS_MS = 550

interface PressHandlers {
  onTouchStart(): void
  onTouchMove(): void
  onTouchEnd(): void
  onContextMenu(event: MouseEvent): void
}

/**
 * Opens something with a long press, on the touch screens the game is played
 * on. On the web the browser raises its own menu instead, which is answered the
 * same way — and a right click, which is that menu.
 */
export function useLongPress<T>(open: (item: T) => void): (item: T) => PressHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cancel = useCallback(() => clearTimeout(timer.current), [])

  return useCallback(
    (item: T) => ({
      onTouchStart: () => {
        cancel()
        timer.current = setTimeout(() => open(item), LONG_PRESS_MS)
      },
      onTouchMove: cancel,
      onTouchEnd: cancel,
      onContextMenu: (event) => {
        // The long press already answered: no browser menu on top of it.
        event.preventDefault()
        cancel()
        open(item)
      },
    }),
    [cancel, open],
  )
}
