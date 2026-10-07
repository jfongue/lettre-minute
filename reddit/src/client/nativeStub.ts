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
