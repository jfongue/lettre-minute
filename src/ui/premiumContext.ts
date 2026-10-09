import { createContext, useContext } from 'react'
import type { PremiumReason } from './PremiumSheet'

/**
 * What a screen needs to reach Premium: one door to the sheet, and whether
 * this build sells anything. Without a provider (debug board, duel page)
 * nothing is for sale and the door does nothing.
 */
export interface PremiumDoor {
  /** The store is open: Android alone. Elsewhere no offer, no buy button, only the Premium that already exists. */
  storeOpen: boolean
  /** Rewarded ads can be watched: Android alone. */
  adsOpen: boolean
  open(reason: PremiumReason): void
}

export const PremiumContext = createContext<PremiumDoor>({ storeOpen: false, adsOpen: false, open: () => {} })

export function usePremium(): PremiumDoor {
  return useContext(PremiumContext)
}
