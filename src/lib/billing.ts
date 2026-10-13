import { PLATFORM } from '../platform'
import { fetchMyPremium, openWebCheckout, recordPurchase, webCheckoutReady } from './cloud'
import { billingSupported, prepareRewardedAd, showRewardedAd, storeBuy, storeOwned, storePrice, type StorePurchase } from './native'

/**
 * Premium's real purchase and the rewarded ads. The phone buys through Play
 * Billing; the web page, which has no store, opens the merchant's own checkout
 * and lets its webhook credit the account (0069, `docs/premium-web.md`). Like
 * `native.ts` and `cloud.ts`, nothing here throws: a store that fails costs the
 * offer, never a run. The game keeps no entitlement of its own — the caller
 * stores `plusSince` on a `true`/`'ok'`, and the server's copy (`my_premium`)
 * only lets another device find it again.
 */

/** The product both stores sell: one non-consumable, paid once. */
export const PREMIUM_PRODUCT = 'premium_lifetime'

/** A purchase's outcome; `redirect` leaves for the merchant's page and shows nothing here. */
export type PurchaseOutcome = 'ok' | 'cancel' | 'error' | 'redirect'

/** Whether this build can sell Premium: the phone's shell with Billing answering, or the web's merchant holding its keys. */
export async function billingAvailable(): Promise<boolean> {
  if (PLATFORM === 'android') return billingSupported()
  if (PLATFORM === 'web') return webCheckoutReady()
  return false
}

/** The store's own price for the player's country, e.g. « 2,99 $ »; null when it cannot say, and the sheet then shows its own. */
export async function premiumPrice(): Promise<string | null> {
  if (PLATFORM !== 'android') return null
  return storePrice(PREMIUM_PRODUCT)
}

async function remember(purchase: StorePurchase): Promise<void> {
  // The store already took the money: a server that does not answer must not undo the purchase.
  await recordPurchase(PREMIUM_PRODUCT, purchase.token, purchase.orderId)
}

export async function buyPremium(): Promise<PurchaseOutcome> {
  if (PLATFORM === 'web') {
    const url = await openWebCheckout(PREMIUM_PRODUCT)
    if (!url) return 'error'
    // The merchant's page takes over: the entitlement is written by its
    // webhook, never here, so nothing is granted before it answers.
    location.assign(url)
    return 'redirect'
  }
  if (PLATFORM !== 'android') return 'error'
  const bought = await storeBuy(PREMIUM_PRODUCT)
  if (bought === 'owned') return (await restorePremium()) ? 'ok' : 'error'
  if (typeof bought === 'string') return bought
  await remember(bought)
  return 'ok'
}

/**
 * Whether the account owns Premium anywhere, and reports it to the server: the
 * Google account, or the merchant's order the server already holds. Coming back
 * from the merchant's page, the webhook may still be on its way — the server
 * is asked again for a few seconds before giving up.
 */
export async function premiumOwned(): Promise<boolean> {
  if (PLATFORM === 'android' && (await ownsPremium())) return true
  if (PLATFORM !== 'android' && PLATFORM !== 'web') return false
  const returning = PLATFORM === 'web' && new URLSearchParams(location.search).has('premium')
  for (let attempt = 0; attempt < (returning ? 6 : 1); attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 2500))
    if (await fetchMyPremium()) return true
  }
  return false
}

/** Whether Google lists the purchase for this account; reports it to the server when it does. */
export async function restorePremium(): Promise<boolean> {
  if (PLATFORM === 'android') {
    const owned = await storeOwned(PREMIUM_PRODUCT)
    if (!owned?.length) return false
    await remember(owned[0])
    return true
  }
  // The web has no store to ask: the purchase, if any, is the server's copy.
  if (PLATFORM === 'web') return fetchMyPremium()
  return false
}

/** Read-only: whether the store says this Google account owns Premium, without telling the server. */
export async function ownsPremium(): Promise<boolean> {
  if (PLATFORM !== 'android') return false
  return ((await storeOwned(PREMIUM_PRODUCT))?.length ?? 0) > 0
}

/** Rewarded ads (AdMob): phone only, `unavailable` anywhere else. */
export { prepareRewardedAd, showRewardedAd }
