/**
 * Stands in for `src/lib/native.ts` in the Reddit build (see `vite.config.ts`):
 * the game's Capacitor shell has nothing to do in Reddit's webview, and its
 * plugins would only weigh on the bundle. Only what the shared screens call
 * at runtime is here, as the no-ops the browser already gets.
 */
export function isNativeApp(): boolean {
  return false
}

export function onAppActive(onChange: (active: boolean) => void): void {
  void onChange
}

export function setStatusBarDark(dark: boolean): void {
  void dark
}

export function tapFeedback(strength: 'light' | 'medium' | 'heavy' = 'light'): void {
  void strength
}

// Premium and rewarded ads are Android's alone (`premiumStoreOpen`, `rewardedAdsOpen`): Reddit never offers them.
export interface StorePurchase {
  token: string
  orderId: string
}

export function prepareRewardedAd(): void {}

export async function showRewardedAd(): Promise<'rewarded' | 'skipped' | 'unavailable'> {
  return 'unavailable'
}

export async function billingSupported(): Promise<boolean> {
  return false
}

export async function storePrice(productId: string): Promise<string | null> {
  void productId
  return null
}

export async function storeBuy(productId: string): Promise<StorePurchase | 'cancel' | 'owned' | 'error'> {
  void productId
  return 'error'
}

export async function storeOwned(productId: string): Promise<StorePurchase[] | null> {
  void productId
  return null
}
