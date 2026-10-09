import { PLATFORM } from '../platform'
import { recordPurchase } from './cloud'
import { billingSupported, prepareRewardedAd, showRewardedAd, storeBuy, storeOwned, storePrice, type StorePurchase } from './native'

/**
 * Premium's real purchase and the rewarded ads, both phone-only. Like
 * `native.ts` and `cloud.ts`, nothing here throws: a store that fails costs the
 * offer, never a run. The game keeps no entitlement of its own — the caller
 * stores `plusSince` on a `true`/`'ok'`, and the server's copy (`my_premium`)
 * only lets another device find it again.
 */

/** The Play Console product: one non-consumable, paid once. */
export const PREMIUM_PRODUCT = 'premium_lifetime'

/** Whether this build can sell Premium: Android's shell with Play Billing answering. */
export async function billingAvailable(): Promise<boolean> {
  return PLATFORM === 'android' && (await billingSupported())
}

/** The store's own price for the player's country, e.g. « 2,99 $ »; null when it cannot say. */
export async function premiumPrice(): Promise<string | null> {
  if (PLATFORM !== 'android') return null
  return storePrice(PREMIUM_PRODUCT)
}

async function remember(purchase: StorePurchase): Promise<void> {
  // The store already took the money: a server that does not answer must not undo the purchase.
  await recordPurchase(PREMIUM_PRODUCT, purchase.token, purchase.orderId)
}

export async function buyPremium(): Promise<'ok' | 'cancel' | 'error'> {
  if (PLATFORM !== 'android') return 'error'
  const bought = await storeBuy(PREMIUM_PRODUCT)
  if (bought === 'owned') return (await restorePremium()) ? 'ok' : 'error'
  if (typeof bought === 'string') return bought
  await remember(bought)
  return 'ok'
}

/** Whether Google lists the purchase for this account; reports it to the server when it does. */
export async function restorePremium(): Promise<boolean> {
  if (PLATFORM !== 'android') return false
  const owned = await storeOwned(PREMIUM_PRODUCT)
  if (!owned?.length) return false
  await remember(owned[0])
  return true
}

/** Read-only: whether the store says this Google account owns Premium, without telling the server. */
export async function ownsPremium(): Promise<boolean> {
  if (PLATFORM !== 'android') return false
  return ((await storeOwned(PREMIUM_PRODUCT))?.length ?? 0) > 0
}

/** Rewarded ads (AdMob): phone only, `unavailable` anywhere else. */
export { prepareRewardedAd, showRewardedAd }
