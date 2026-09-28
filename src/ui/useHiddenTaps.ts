import { useRef } from 'react'

/** Deux tapes plus éloignés que ce délai ne comptent pas pour le même geste. */
export const HIDDEN_TAP_GAP_MS = 600

/** Le nombre de tapes qui ouvrent un écran caché. */
export const HIDDEN_TAPS = 5

/**
 * Le geste caché du jeu : cinq tapes rapprochées sur un mot. Rend une fonction
 * qui répond `true` à la cinquième, une seule fois, puis remet le compte à
 * zéro — un geste oublié ne s'additionne pas avec le suivant.
 */
export function useHiddenTaps(taps = HIDDEN_TAPS, gapMs = HIDDEN_TAP_GAP_MS): () => boolean {
  const seen = useRef({ count: 0, at: 0 })
  return () => {
    const now = Date.now()
    seen.current = { count: now - seen.current.at < gapMs ? seen.current.count + 1 : 1, at: now }
    if (seen.current.count < taps) return false
    seen.current = { count: 0, at: 0 }
    return true
  }
}
