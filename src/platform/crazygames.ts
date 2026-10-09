import { APP_ONLY_FEATURES, SERVER_FEATURES, type Host } from './host'

/**
 * The CrazyGames shell, as `native.ts` is the phone's: everything the portal's
 * SDK (HTML5 v3) is asked goes through here, and nothing here ever throws.
 * Only the CrazyGames build reaches it (`host`, `src/platform/index.ts`); a
 * page of that build served anywhere but the portal or localhost finds the SDK
 * `disabled` (or not loaded at all) and stays quiet.
 *
 * The SDK script is added by `initCrazyGames`, never by a blocking tag; the build is
 * `npm run crazygames:build`, documented in `crazygames/README.md`.
 */

interface AdCallbacks {
  adStarted?(): void
  adFinished?(): void
  adError?(error: unknown): void
}

interface CrazySdk {
  init(): Promise<void>
  environment: 'local' | 'crazygames' | 'disabled'
  game: {
    gameplayStart(): void
    gameplayStop(): void
    loadingStart(): void
    loadingStop(): void
    happytime(): void
    settings?: { muteAudio?: boolean }
    addSettingsChangeListener?(listener: (settings: { muteAudio?: boolean }) => void): void
  }
  ad: { requestAd(type: 'midgame' | 'rewarded', callbacks: AdCallbacks): void }
  data?: {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
  }
  user?: { systemInfo?: { locale?: string } }
}

declare global {
  interface Window {
    CrazyGames?: { SDK?: CrazySdk }
  }
}

// Set once `init` has answered on the portal or on localhost; null everywhere else.
let sdk: CrazySdk | null = null

function safely(call: (sdk: CrazySdk) => void): void {
  if (!sdk) return
  try {
    call(sdk)
  } catch {
    /* the portal's shell is a guest: a failure there never reaches the game */
  }
}

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js'
/**
 * How long the game waits for the SDK, script and init each, before starting
 * without it. On the portal (or localhost, where the SDK runs in its local
 * mode) the SDK holds the saved progress, so the wait is long; anywhere else
 * — a test server, a mirror — the SDK can only end up `disabled`, after an
 * init that takes seconds, and a short wait keeps the page from staying blank.
 */
function sdkPatience(): number {
  const hostOf = (address: string) => {
    try {
      return new URL(address).hostname
    } catch {
      return ''
    }
  }
  const hosts = [location.hostname, hostOf(document.referrer), ...Array.from(location.ancestorOrigins ?? [], hostOf)]
  return hosts.some((host) => /(^|\.)crazygames\.[a-z.]+$|^localhost$|^127\.0\.0\.1$/.test(host)) ? 8000 : 1500
}

function within<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([promise, new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms))])
}

/**
 * Added by script rather than written in the page: a blocking `<script>` tag
 * whose host never answers would leave the page blank for good.
 */
function loadSdkScript(): Promise<boolean> {
  if (window.CrazyGames?.SDK) return Promise.resolve(true)
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.head.append(script)
  })
}

/** Wakes the SDK; resolves in every case. */
export async function initCrazyGames(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const patience = sdkPatience()
    if ((await within(loadSdkScript(), patience)) !== true) return
    const candidate = window.CrazyGames?.SDK
    // Anywhere but the portal and localhost the SDK is `disabled` from the
    // start, and its init there takes seconds for nothing.
    if (!candidate || candidate.environment === 'disabled') return
    if ((await within(candidate.init().then(() => 'ready' as const), patience)) !== 'ready') return
    // Read again: the SDK settles its environment while it inits.
    if ((candidate.environment as string) === 'disabled') return
    sdk = candidate
  } catch {
    /* left as null: the game runs as it would anywhere */
  }
}

export function loadingStart(): void {
  safely((s) => s.game.loadingStart())
}

export function loadingStop(): void {
  safely((s) => s.game.loadingStop())
}

let inGameplay = false
let endedSinceAd = false

/** In gameplay or not: only the changes reach the SDK, a run's end is remembered for the next break. */
function setGameplay(on: boolean): void {
  if (on === inGameplay) return
  inGameplay = on
  if (!on) endedSinceAd = true
  safely((s) => (on ? s.game.gameplayStart() : s.game.gameplayStop()))
}

/** A new record: the portal's celebration, kept for the rare moment it is. */
function happytime(): void {
  safely((s) => s.game.happytime())
}

/** The portal's language first (`en-US`), then the browser's. */
function platformLanguages(): readonly string[] {
  const locale = sdk?.user?.systemInfo?.locale
  return locale ? [locale] : []
}

const muteListeners = new Set<(muted: boolean) => void>()
let adPlaying = false
let portalMuted = false

function announceMute(): void {
  for (const listener of muteListeners) listener(adPlaying || portalMuted)
}

/**
 * Called with true while the portal wants silence — its own mute setting, or
 * an ad on screen — and false once it lets go. The setting outranks the game's
 * own volume: the in-game mute button cannot bring the sound back.
 */
function onPlatformMute(listener: (muted: boolean) => void): void {
  muteListeners.add(listener)
  if (!sdk) return
  safely((s) => {
    portalMuted = s.game.settings?.muteAudio === true
    s.game.addSettingsChangeListener?.((settings) => {
      portalMuted = settings.muteAudio === true
      announceMute()
    })
  })
  listener(adPlaying || portalMuted)
}

// An ad that never calls back must not hold the next run forever.
const AD_TIMEOUT_MS = 60_000

/**
 * The break between two runs: a midgame ad when a run has ended since the
 * last one. The SDK keeps them three minutes apart and answers `adError` to an
 * early request, so asking at every « Play again » is the recommended use.
 * Resolves once the ad is over, failed or skipped; the sound is cut only while
 * one actually plays.
 */
function breakBetweenRuns(): Promise<void> {
  if (!sdk || !endedSinceAd) return Promise.resolve()
  endedSinceAd = false
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      if (adPlaying) {
        adPlaying = false
        announceMute()
      }
      resolve()
    }
    const timer = setTimeout(finish, AD_TIMEOUT_MS)
    safely((s) =>
      s.ad.requestAd('midgame', {
        adStarted: () => {
          adPlaying = true
          announceMute()
        },
        adFinished: finish,
        adError: finish,
      }),
    )
    if (!sdk) finish()
  })
}

/**
 * What the game keeps between visits: the profile (level, categories, powers,
 * records), its history, avatar and settings. The portal's Data module syncs
 * them to a signed-in player's account; a guest's stay in the browser, as they
 * would anyway. The rest of localStorage — caches, the device's queues — is
 * left alone.
 */
const SAVED_KEYS = [
  'lettre-minute.profile.v1',
  'lettre-minute.history.v1',
  'lettre-minute.avatar.v1',
  'lettre-minute.tutorial.v1',
  'lettre-minute.revealed-recaps.v1',
  'lettre-minute.theme.v1',
  'lettre-minute.sound.v1',
  'lettre-minute.locale.v1',
]
const HISTORY_KEY = 'lettre-minute.history.v1'
// The Data module refuses past 1 MiB, all keys together: the history, the one
// key that grows with every run, is cut to its latest runs to stay well under.
const DATA_BUDGET = 900_000

function fitHistory(value: string, others: number): string {
  if (value.length + others <= DATA_BUDGET) return value
  try {
    const runs: unknown = JSON.parse(value)
    if (!Array.isArray(runs)) return '[]'
    let kept = runs
    let text = value
    while (kept.length > 0 && text.length + others > DATA_BUDGET) {
      kept = kept.slice(0, Math.floor(kept.length * 0.8))
      text = JSON.stringify(kept)
    }
    return text
  } catch {
    return '[]'
  }
}

/**
 * Before the first render: the portal's copy wins over the browser's (it is
 * the signed-in player's, whichever device they come from), a key it lacks is
 * handed to it once, and from then on every write to one of these keys is
 * mirrored to it. Without the Data module (not enabled at submission), the
 * first refusal turns the mirror off and the game keeps localStorage alone.
 */
export function restoreSavedProgress(): void {
  const data = sdk?.data
  if (!data) return
  let mirroring = true
  const store = window.localStorage
  const local = (key: string) => {
    try {
      return store.getItem(key)
    } catch {
      return null
    }
  }
  const othersSize = () => SAVED_KEYS.reduce((size, key) => size + (key === HISTORY_KEY ? 0 : (local(key)?.length ?? 0)), 0)
  const mirror = (key: string, value: string | null) => {
    if (!mirroring) return
    try {
      if (value === null) data.removeItem(key)
      else data.setItem(key, key === HISTORY_KEY ? fitHistory(value, othersSize()) : value)
    } catch {
      mirroring = false
    }
  }
  try {
    for (const key of SAVED_KEYS) {
      const saved = data.getItem(key)
      if (saved !== null) store.setItem(key, saved)
      else {
        const found = local(key)
        if (found !== null) mirror(key, found)
      }
    }
  } catch {
    return
  }
  // Patched on the prototype, not the instance: a property set on
  // localStorage itself would be stored as an item named « setItem ».
  const saved = new Set(SAVED_KEYS)
  const { setItem, removeItem } = Storage.prototype
  Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
    setItem.call(this, key, value)
    if (this === store && saved.has(key)) mirror(key, String(value))
  }
  Storage.prototype.removeItem = function (this: Storage, key: string) {
    removeItem.call(this, key)
    if (this === store && saved.has(key)) mirror(key, null)
  }
}

/**
 * The portal hosts the game alone: no server, no account, nothing that leads
 * off its page (it refuses a button that does nothing, such as « share —
 * soon »), none of the phone's offers. It lists the game as « Letter Minute »
 * in every language, and English stands in for the language picker: a player
 * there must land in the game, not on a question.
 */
export const crazyGamesHost: Host = {
  closedFeatures: new Set([...SERVER_FEATURES, ...APP_ONLY_FEATURES]),
  title: ['Letter', 'Minute'],
  languages: platformLanguages,
  fallbackLocale: 'en',
  keepsProgress: true,
  premiumStore: false,
  rewardedAds: false,
  setGameplay,
  celebrate: happytime,
  breakBetweenRuns,
  onMute: onPlatformMute,
}
