import {
  AdMob,
  AdmobConsentStatus,
  InterstitialAdPluginEvents,
} from '@capacitor-community/admob'
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

/** Hides the launch screen once React has painted. */
export function startNativeShell(): void {
  if (!native) return
  requestAnimationFrame(() => quietly(() => SplashScreen.hide({ fadeOutDuration: 200 })))
}

/** Keeps the status bar legible over the page: light icons on a dark theme. */
export function setStatusBarDark(dark: boolean): void {
  quietly(() => StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }))
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

// Google's sample unit: it serves test ads only, so a build without a real
// unit can never earn, nor get the account flagged for invalid traffic.
const TEST_INTERSTITIAL = 'ca-app-pub-3940256099942544/1033173712'
const interstitialId = import.meta.env.VITE_ADMOB_INTERSTITIAL_ID || TEST_INTERSTITIAL

let adsStarted: Promise<boolean> | null = null
let interstitialLoaded = false

function loadInterstitial(): void {
  interstitialLoaded = false
  quietly(async () => {
    await AdMob.prepareInterstitial({ adId: interstitialId, isTesting: interstitialId === TEST_INTERSTITIAL })
    interstitialLoaded = true
  })
}

/** Whether this build can show ads at all: the phone shell only. */
export function adsSupported(): boolean {
  return native
}

/**
 * Starts the ad SDK and asks for consent where the law requires it (the UMP
 * form, in the EU). Started when the first ad-bearing offer comes up rather
 * than at launch, so a player who never gets that far never sees the form —
 * and it still leaves the player the time of reading the offer to load one.
 */
export function prepareAds(): void {
  if (!native || adsStarted) return
  adsStarted = (async () => {
    await AdMob.initialize()
    let consent = await AdMob.requestConsentInfo()
    if (consent.status === AdmobConsentStatus.REQUIRED && consent.isConsentFormAvailable) {
      consent = await AdMob.showConsentForm()
    }
    if (!consent.canRequestAds) return false
    await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, loadInterstitial)
    await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, loadInterstitial)
    loadInterstitial()
    return true
  })().catch(() => false)
}

/**
 * Shows the loaded interstitial, if there is one. Never waits for one: an ad
 * still loading when the player taps is skipped, not shown late over whatever
 * screen came next.
 */
export function showInterstitial(): void {
  if (!interstitialLoaded) return
  interstitialLoaded = false
  quietly(() => AdMob.showInterstitial())
}

/**
 * Whether the player must be able to reopen the consent form (EU law). Asked
 * of the consent SDK, which remembers an answer given in an earlier session —
 * not of `prepareAds`, which may not have run yet in this one.
 */
export async function adPrivacyOptionsRequired(): Promise<boolean> {
  if (!native) return false
  try {
    const consent = await AdMob.requestConsentInfo()
    // The plugin declares this enum but does not export it.
    return consent.privacyOptionsRequirementStatus === 'REQUIRED'
  } catch {
    return false
  }
}

export function showAdPrivacyOptions(): void {
  quietly(() => AdMob.showPrivacyOptionsForm())
}
