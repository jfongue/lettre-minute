import { useEffect, useState } from 'react'
import { HIDDEN_CHANGED, loadHiddenChallenges } from './challenges'

/** The challenges hidden on this device, kept in step with every screen that hides or brings one back. */
export function useHiddenChallenges(): Record<string, string> {
  const [hidden, setHidden] = useState(loadHiddenChallenges)
  useEffect(() => {
    const reload = () => setHidden(loadHiddenChallenges())
    window.addEventListener(HIDDEN_CHANGED, reload)
    return () => window.removeEventListener(HIDDEN_CHANGED, reload)
  }, [])
  return hidden
}
