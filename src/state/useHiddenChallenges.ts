import { useEffect, useState } from 'react'
import { HIDDEN_CHANGED, hiddenOverrides, type HiddenOverrides } from './challenges'

/**
 * The challenges set aside in this session — what the account hid earlier
 * comes with the list itself — to re-render every screen that hides one or
 * brings one back.
 */
export function useHiddenChallenges(): HiddenOverrides {
  const [hidden, setHidden] = useState<HiddenOverrides>(hiddenOverrides)
  useEffect(() => {
    const reload = () => setHidden(hiddenOverrides())
    window.addEventListener(HIDDEN_CHANGED, reload)
    return () => window.removeEventListener(HIDDEN_CHANGED, reload)
  }, [])
  return hidden
}
