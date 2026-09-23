import { App as NativeApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'

/**
 * The bridge to the phone when the game runs inside the Android or iOS shell.
 * In a browser every call is a no-op, and like `cloud.ts` nothing here may
 * throw into the run loop: a missing plugin costs a vibration, not a run.
 */
const native = Capacitor.isNativePlatform()

function quietly(work: () => Promise<unknown>): void {
  if (!native) return
  work().catch(() => {})
}

/** Hides the launch screen once React has painted, and keeps the status bar legible. */
export function startNativeShell(): void {
  if (!native) return
  const dark = window.matchMedia('(prefers-color-scheme: dark)')
  // Style.Dark means light icons, for a dark background.
  const syncStatusBar = () => quietly(() => StatusBar.setStyle({ style: dark.matches ? Style.Dark : Style.Light }))
  syncStatusBar()
  dark.addEventListener('change', syncStatusBar)
  requestAnimationFrame(() => quietly(() => SplashScreen.hide({ fadeOutDuration: 200 })))
}

/**
 * Android's back gesture: `onBack` answers whether it handled it; if not, the
 * app closes, as on any home screen.
 */
export function onBackButton(onBack: () => boolean): () => void {
  if (!native) return () => {}
  const listener = NativeApp.addListener('backButton', () => {
    if (!onBack()) quietly(() => NativeApp.exitApp())
  })
  return () => {
    listener.then((handle) => handle.remove()).catch(() => {})
  }
}

export function tapFeedback(strength: 'light' | 'medium' = 'light'): void {
  quietly(() => Haptics.impact({ style: strength === 'light' ? ImpactStyle.Light : ImpactStyle.Medium }))
}
