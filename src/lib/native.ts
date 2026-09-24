import {
  AdMob,
  AdmobConsentStatus,
  InterstitialAdPluginEvents,
} from '@capacitor-community/admob'
import { App as NativeApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Preferences } from '@capacitor/preferences'
import { PushNotifications } from '@capacitor/push-notifications'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SocialLogin } from '@capgo/capacitor-social-login'

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

/** Whether the game runs inside the phone shell rather than a browser. */
export function isNativeApp(): boolean {
  return native
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

const IMPACT = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy }

export function tapFeedback(strength: keyof typeof IMPACT = 'light'): void {
  quietly(() => Haptics.impact({ style: IMPACT[strength] }))
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

/**
 * Push needs Firebase in the build (`android/app/google-services.json`): without
 * it, `register()` crashes the app natively instead of failing. The build says
 * it has one with `VITE_PUSH_ENABLED=true`.
 */
const pushReady = native && import.meta.env.VITE_PUSH_ENABLED === 'true'

export function pushSupported(): boolean {
  return pushReady
}

/**
 * Asks once for the right to notify (Android 13 and later), then registers:
 * `onToken` gets the device's token now and whenever it changes. A refusal is
 * final — the system does not ask twice, and neither does the game.
 */
export function enablePush(channelName: string, onToken: (token: string) => void): () => void {
  if (!pushReady) return () => {}
  const listener = PushNotifications.addListener('registration', (token) => onToken(token.value))
  quietly(async () => {
    let status = await PushNotifications.checkPermissions()
    if (status.receive === 'prompt' || status.receive === 'prompt-with-rationale') {
      status = await PushNotifications.requestPermissions()
    }
    if (status.receive !== 'granted') return
    // The channel the server's messages name: its label is what Android's settings show.
    await PushNotifications.createChannel({ id: 'challenges', name: channelName, importance: 4, visibility: 1 })
    await PushNotifications.register()
  })
  return () => {
    listener.then((handle) => handle.remove()).catch(() => {})
  }
}

/** What a push carries: the challenge, and whether it invites or announces a recap. */
export interface PushData {
  kind: 'invite' | 'recap'
  challenge: string
}

function pushData(data: unknown): PushData | null {
  const row = (data ?? {}) as Record<string, unknown>
  if ((row.kind !== 'invite' && row.kind !== 'recap') || typeof row.challenge !== 'string') return null
  return { kind: row.kind, challenge: row.challenge }
}

/**
 * `onOpen`: a notification was tapped, the app opening or coming back for it.
 * Capacitor keeps the tap that launched the app until this listener is added.
 * `onReceived`: one arrived while the game was open, where Android shows nothing.
 */
export function onPush(onOpen: (data: PushData) => void, onReceived: (data: PushData) => void): () => void {
  if (!pushReady) return () => {}
  const opened = PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = pushData(action.notification.data)
    if (data) onOpen(data)
  })
  const received = PushNotifications.addListener('pushNotificationReceived', (notification) => {
    const data = pushData(notification.data)
    if (data) onReceived(data)
  })
  return () => {
    for (const handle of [opened, received]) handle.then((listener) => listener.remove()).catch(() => {})
  }
}

/**
 * Where the sign-in session lives on the phone. A WebView's localStorage is a
 * cache the system may reclaim, and losing it silently turns a player back
 * into a fresh anonymous one; the app's own preferences are kept until
 * uninstall. In a browser, undefined leaves Supabase on localStorage.
 */
export function authStorage(): {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
} | undefined {
  if (!native) return undefined
  const legacy = {
    get: (key: string) => {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    drop: (key: string) => {
      try {
        localStorage.removeItem(key)
      } catch {
        /* nothing to drop */
      }
    },
  }
  return {
    async getItem(key) {
      try {
        const { value } = await Preferences.get({ key })
        if (value !== null) return value
        // Builds before 1.3 kept the session in localStorage: carried over once.
        const old = legacy.get(key)
        if (old !== null) await Preferences.set({ key, value: old })
        return old
      } catch {
        return legacy.get(key)
      }
    },
    async setItem(key, value) {
      try {
        await Preferences.set({ key, value })
      } catch {
        /* the session stays in memory until the next launch */
      }
    },
    // The legacy copy goes too: otherwise it would bring a signed-out session back.
    async removeItem(key) {
      legacy.drop(key)
      try {
        await Preferences.remove({ key })
      } catch {
        /* nothing stored, nothing to remove */
      }
    },
  }
}

const googleClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID
let googleStarted: Promise<void> | null = null

/**
 * Google refuses its sign-in page inside a WebView: the phone asks the system
 * account picker instead. In a browser there is none, so no button.
 */
export function googleSignInSupported(): boolean {
  return native && Boolean(googleClientId)
}

/**
 * The ID token of the Google account the player picks, bound to `nonce` (the
 * hash Supabase will check against the raw nonce). Null when they close the
 * picker, have no account on the phone, or the plugin fails.
 */
export async function googleIdToken(nonce: string): Promise<string | null> {
  if (!googleSignInSupported()) return null
  try {
    googleStarted ??= SocialLogin.initialize({ google: { webClientId: googleClientId, mode: 'online' } }).catch(
      (error: unknown) => {
        googleStarted = null
        throw error
      },
    )
    await googleStarted
    const { result } = await SocialLogin.login({ provider: 'google', options: { nonce, scopes: ['email', 'profile'] } })
    return 'idToken' in result ? result.idToken : null
  } catch {
    return null
  }
}
