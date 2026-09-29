import {
  AdMob,
  AdmobConsentStatus,
  InterstitialAdPluginEvents,
} from '@capacitor-community/admob'
import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update'
import { App as NativeApp } from '@capacitor/app'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Preferences } from '@capacitor/preferences'
import { PushNotifications } from '@capacitor/push-notifications'
import { Share } from '@capacitor/share'
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

/**
 * Whether the game has the screen: Android and iOS say when the app leaves
 * the foreground, which the WebView does not always pass on as a hidden page,
 * and an interstitial covers it without hiding it at all.
 */
export function onAppActive(onChange: (active: boolean) => void): void {
  if (!native) return
  quietly(() =>
    NativeApp.addListener("appStateChange", ({ isActive }) => onChange(isActive))
  )
  quietly(() =>
    AdMob.addListener(InterstitialAdPluginEvents.Showed, () => onChange(false))
  )
  quietly(() =>
    AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => onChange(true))
  )
  quietly(() =>
    AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => onChange(true))
  )
}

/** Each return of the app to the foreground, until the returned cleanup runs. */
export function onAppResume(onResume: () => void): () => void {
  if (!native) return () => {}
  const handle = NativeApp.addListener('appStateChange', ({ isActive }) => isActive && onResume())
  return () => {
    handle.then((listener) => listener.remove()).catch(() => {})
  }
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

/** Our own plugin (`NotificationSettingsPlugin.java`), Android only. */
const NotificationSettings = registerPlugin<{
  enabled(): Promise<{ enabled: boolean }>
  open(): Promise<void>
}>('NotificationSettings')

let pushChannel: string | null = null

/** Registers if the phone lets the game notify; never asks. */
async function registerIfAllowed(): Promise<void> {
  if (pushChannel === null || (await PushNotifications.checkPermissions()).receive !== 'granted') return
  // The channel the server's messages name: its label is what Android's settings show.
  await PushNotifications.createChannel({ id: 'challenges', name: pushChannel, importance: 4, visibility: 1 })
  await PushNotifications.register()
}

/**
 * Registers when the phone already lets the game notify: `onToken` gets the
 * device's token now and whenever it changes. It never asks — the question
 * comes after a new friendship (`askPush`), with the game's own word first.
 * A refusal is final for the system, and only the phone's settings bring it
 * back, so each return to the game checks again.
 */
export function enablePush(channelName: string, onToken: (token: string) => void): () => void {
  if (!pushReady) return () => {}
  pushChannel = channelName
  const listener = PushNotifications.addListener('registration', (token) => onToken(token.value))
  const stopResume = onAppResume(() => quietly(registerIfAllowed))
  quietly(registerIfAllowed)
  return () => {
    pushChannel = null
    stopResume()
    listener.then((handle) => handle.remove()).catch(() => {})
  }
}

/**
 * `ask`: the system has not asked yet. `off`: refused, or silenced in the
 * phone's settings — which the push plugin misses before Android 13.
 */
export type PushState = 'on' | 'off' | 'ask'

export async function pushState(): Promise<PushState> {
  if (!pushReady) return 'off'
  try {
    const status = await PushNotifications.checkPermissions()
    if (status.receive === 'prompt' || status.receive === 'prompt-with-rationale') return 'ask'
    if (status.receive !== 'granted') return 'off'
    return (await NotificationSettings.enabled().catch(() => ({ enabled: true }))).enabled ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

export async function askPush(): Promise<PushState> {
  if (!pushReady) return 'off'
  try {
    await PushNotifications.requestPermissions()
    await registerIfAllowed()
  } catch {
    // The state read below says what came of it.
  }
  return pushState()
}

/** The game's page in the phone's notification settings. */
export function openPushSettings(): void {
  quietly(() => NotificationSettings.open())
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
 * account picker. A browser opens Google's page in a popup that comes back to
 * `google.html` rather than to Supabase, whose project domain Google would
 * otherwise name on its consent screen. Both need the web client id, and its
 * redirect URIs must list that page for every origin the game is served from.
 */
export function googleSignInSupported(): boolean {
  return Boolean(googleClientId)
}

/**
 * The ID token of the Google account the player picks, bound to `nonce` (the
 * hash Supabase will check against the raw nonce). Null when they close the
 * picker, have no account on the phone, or the plugin fails.
 */
export async function googleIdToken(nonce: string, quiet = false): Promise<string | null> {
  if (!googleSignInSupported()) return null
  try {
    googleStarted ??= SocialLogin.initialize({
      google: {
        webClientId: googleClientId,
        mode: 'online',
        ...(native ? {} : { redirectUrl: new URL('google.html', location.origin + import.meta.env.BASE_URL).href }),
      },
    }).catch(
      (error: unknown) => {
        googleStarted = null
        throw error
      },
    )
    await googleStarted
    // No `scopes`: email and profile are already the defaults, and on Android
    // any scope at all is refused before the picker opens unless MainActivity
    // is rewritten for the plugin.
    // Quiet: the system's small sheet, which picks the phone's only account by itself.
    const options = quiet ? { nonce, style: 'bottom' as const, autoSelectEnabled: true } : { nonce }
    const { result } = await SocialLogin.login({ provider: 'google', options })
    return 'idToken' in result ? result.idToken : null
  } catch {
    return null
  }
}

export type ShareOutcome = 'shared' | 'copied' | 'failed'

/**
 * The phone's share sheet. A browser without the Web Share API gets the text
 * on its clipboard instead; a sheet closed without choosing counts as shared,
 * since nothing is left to tell the player.
 */
export async function shareText(text: string): Promise<ShareOutcome> {
  try {
    if (native) {
      await Share.share({ text }).catch(() => {})
      return 'shared'
    }
    if (navigator.share) {
      await navigator.share({ text }).catch(() => {})
      return 'shared'
    }
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}

export const DONATION_URL = 'https://buymeacoffee.com/demontoon'

/**
 * The form Buy Me a Coffee's own widget frames, framed here without its script:
 * the widget pins a bubble over the mute button and the running game. Only a
 * browser frames it: the phone shell keeps opening the full page in the
 * system browser, where the player's wallet and saved cards are.
 */
export function donationFrameUrl(description: string): string | null {
  if (native) return null
  const query = new URLSearchParams({ description, color: '#e0402a' })
  return `https://buymeacoffee.com/widget/page/demontoon?${query}`
}

/**
 * Where to rate the game, opened out of the app like any full address. The
 * Play page also serves the web version; the iPhone app has no store page
 * yet, so no link rather than one to the wrong store.
 */
export function storeUrl(): string | null {
  if (Capacitor.getPlatform() === 'ios') return null
  return 'https://play.google.com/store/apps/details?id=fr.lettreminute.app'
}

/**
 * Whether the Play Store has a newer build than the one running. Both checks
 * matter: `updateAvailability` can lag `availableVersionCode` right after a
 * release, before the store has finished flagging installs as outdated.
 */
export async function storeUpdateAvailable(): Promise<boolean> {
  if (!native) return false
  try {
    const info = await AppUpdate.getAppUpdateInfo()
    if (info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE) return true
    if (!info.availableVersionCode) return false
    return Number(info.availableVersionCode) > Number(info.currentVersionCode)
  } catch {
    return false
  }
}

/** Sends the player to the Play Store listing to install the pending update. */
export function openStoreUpdate(): Promise<void> {
  if (!native) return Promise.resolve()
  return AppUpdate.openAppStore().catch(() => {})
}

/**
 * Our own plugin (`PlayGamesPlugin.java`): Play Games achievements and events.
 * Android only, and silent for a player the SDK did not sign in — the calls
 * then do nothing, and the next run tries again.
 */
const PlayGames = registerPlugin<{
  unlock(options: { ids: string[] }): Promise<{ signedIn: boolean }>
  increment(options: { id: string; steps: number }): Promise<{ signedIn: boolean }>
  showAchievements(): Promise<{ signedIn: boolean }>
  player(): Promise<{ signedIn: boolean; name?: string }>
}>('PlayGames')

const playGamesReady = native && Capacitor.getPlatform() === 'android'

export function playGamesUnlock(ids: readonly string[]): void {
  if (playGamesReady && ids.length > 0) quietly(() => PlayGames.unlock({ ids: [...ids] }))
}

export function playGamesIncrement(id: string, steps: number): void {
  if (playGamesReady && steps > 0) quietly(() => PlayGames.increment({ id, steps }))
}

/** The Play Games gamer name of the player the SDK signed in, or null. */
export async function playGamesPlayer(): Promise<string | null> {
  if (!playGamesReady) return null
  try {
    const { signedIn, name } = await PlayGames.player()
    return signedIn ? (name ?? '') : null
  } catch {
    return null
  }
}
