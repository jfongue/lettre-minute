import { APP_ONLY_FEATURES, SERVER_FEATURES, SUPER_MODERATOR_FEATURES, type Host, type RewardedResult } from './host'

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
  user?: {
    systemInfo?: { locale?: string }
    /** False where the page is embedded by anyone but the portal. */
    isUserAccountAvailable?: boolean
    submitScore?(score: { encryptedScore: string; score: number }): void
    getUser?(): Promise<{ username: string } | null>
    getUserToken?(): Promise<string>
    addAuthListener?(listener: (user: unknown) => void): void
    showAuthPrompt?(): Promise<unknown>
  }
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

/**
 * The portal's leaderboard wants the score encrypted with a key its own
 * settings generate: AES-GCM, the IV in front of the ciphertext, the whole
 * thing base64. Kept as the portal's snippet writes it, so a score it decrypts
 * is a score it ranks.
 */
export async function encryptScore(score: number, key: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const algorithm = { name: 'AES-GCM', iv }
  const keyBytes = Uint8Array.from(atob(key), (character) => character.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, algorithm, false, ['encrypt'])
  const cipher = new Uint8Array(await crypto.subtle.encrypt(algorithm, cryptoKey, new TextEncoder().encode(String(score))))
  const combined = new Uint8Array(iv.length + cipher.length)
  combined.set(iv)
  combined.set(cipher, iv.length)
  return btoa(String.fromCharCode(...combined))
}

/**
 * A run's points, for the portal's own board — one per game, a weekly season,
 * ranked by the portal (`crazygames/README.md`). Nothing without the key its
 * settings generated (`VITE_CRAZYGAMES_LEADERBOARD_KEY`), nothing for a player
 * the portal does not rank, and a refusal costs a rank rather than a run.
 */
function submitScore(score: number): void {
  const key = import.meta.env.VITE_CRAZYGAMES_LEADERBOARD_KEY
  const portal = sdk?.user
  if (!portal?.submitScore || portal.isUserAccountAvailable === false || !key) return
  const submit = portal.submitScore.bind(portal)
  encryptScore(score, key)
    .then((encryptedScore) => submit({ encryptedScore, score }))
    .catch(() => {
      /* a score the portal refuses costs a rank, never the run that made it */
    })
}

/** The portal's account, where it has one: the page embedded anywhere else plays as a guest. */
function portalUser(): NonNullable<CrazySdk['user']> | null {
  const user = sdk?.user
  return user && user.isUserAccountAvailable !== false ? user : null
}

// The SDK answers fast on the portal; one that hangs must not hold the boards.
const ACCOUNT_TIMEOUT_MS = 5000

/**
 * The signed-in player's token, for `crazygames-auth` to check: null for a
 * guest, for a page off the portal, and for an SDK that refuses or hangs. The
 * SDK refreshes the token itself, so it is asked for each time, never kept.
 */
async function portalAccount(): Promise<string | null> {
  const user = portalUser()
  if (!user?.getUser || !user.getUserToken) return null
  try {
    const signedIn = await within(user.getUser(), ACCOUNT_TIMEOUT_MS)
    if (!signedIn || signedIn === 'timeout') return null
    const token = await within(user.getUserToken(), ACCOUNT_TIMEOUT_MS)
    return typeof token === 'string' && token !== 'timeout' ? token : null
  } catch {
    return null
  }
}

/** A sign-in on the portal: with the Data module on, the portal reloads the page instead. */
function onPortalAccount(listener: () => void): void {
  safely(() => portalUser()?.addAuthListener?.(() => listener()))
}

/** The portal's own sign-in window; false once closed without signing in, or anywhere it cannot open. */
async function promptPortalAccount(): Promise<boolean> {
  const user = portalUser()
  if (!user?.showAuthPrompt) return false
  try {
    return Boolean(await user.showAuthPrompt())
  } catch {
    return false
  }
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
 * A rewarded ad from the portal: the reward only on `adFinished`, nothing on
 * `adError` (an ad blocker included, which must never cost more than the
 * reward) and nothing for an ad that never answers. The sound is cut only
 * while it plays, as for the midgame.
 */
function showRewarded(): Promise<RewardedResult> {
  if (!sdk) return Promise.resolve('unavailable')
  return new Promise((resolve) => {
    let done = false
    const finish = (result: RewardedResult) => {
      if (done) return
      done = true
      clearTimeout(timer)
      if (adPlaying) {
        adPlaying = false
        announceMute()
      }
      resolve(result)
    }
    const timer = setTimeout(() => finish('unavailable'), AD_TIMEOUT_MS)
    safely((s) =>
      s.ad.requestAd('rewarded', {
        adStarted: () => {
          adPlaying = true
          announceMute()
        },
        adFinished: () => finish('rewarded'),
        adError: () => finish('unavailable'),
      }),
    )
    if (!sdk) finish('unavailable')
  })
}

/**
 * Rewarded ads are refused during a Basic Launch, and a rewarded button that
 * pays nothing would be refused with them: the build turns them on once the
 * portal allows ads (`VITE_CRAZYGAMES_REWARDED=true npm run crazygames:build`).
 */
const REWARDED = import.meta.env.VITE_CRAZYGAMES_REWARDED === 'true'

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
  'lettre-minute.weekly-attempts.v1',
  'lettre-minute.weekly-intro.v1',
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

// Set once this browser's saves from before the Data module have been handed
// to it: from then on a key the module lacks is a key the player lacks.
const HANDED_OVER_KEY = 'lettre-minute.crazygames-data.v1'

/**
 * Before the first render, the portal's copy replaces the browser's: it is the
 * signed-in player's, whichever device they come from, or the guest's once
 * they sign out — the portal reloads the page on both. The browser's own
 * saves are handed to it only once, the first time the module answers;
 * handing them over at every start gave a signed-out guest the progress of
 * the account that had just left. From then on every write to one of these
 * keys is mirrored to it. Without the Data module, the first refusal turns the
 * mirror off and the game keeps localStorage alone, which is never erased.
 */
export function restoreSavedProgress(): void {
  const data = sdk?.data
  if (!data) return
  let mirroring = true
  // Only a module that has answered once is trusted to erase what it lacks.
  let answered = false
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
      answered = true
    } catch {
      mirroring = false
    }
  }
  try {
    const handingOver = local(HANDED_OVER_KEY) === null
    for (const key of SAVED_KEYS) {
      const saved = data.getItem(key)
      if (saved !== null) {
        answered = true
        store.setItem(key, saved)
      } else if (handingOver) {
        const found = local(key)
        if (found !== null) mirror(key, found)
      } else store.removeItem(key)
    }
    if (handingOver && answered && mirroring) store.setItem(HANDED_OVER_KEY, '1')
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
 * The server a portal player may reach: the boards a guest reads, and — since
 * `crazygames-auth` (0073) gives a named account to whoever is signed in to the
 * portal — the friends, the face-off with them and the duel, matchmaking
 * included, plus the words he proposes and the moderation those words feed: the
 * offer to become a moderator, the queue of words to judge, his own requests,
 * the words a moderator flags and the election of a friend moderator. A guest
 * of the portal has no session, so the friends tab offers the portal's own
 * sign-in, the duel falls back on the house players, and proposing a word does
 * nothing. What stays closed: the twenty-four-hour challenge (the duel's own
 * screen would open a game a friend cannot be invited to), inviting a friend by
 * e-mail or by a shared link (both lead off the portal's page), the reactions
 * that ride on a challenge, and the ideas box, which is not moderation.
 */
const OPEN_FEATURES = new Set([
  'leaderboards',
  'friends',
  'rivalry',
  'duel',
  'proposeWord',
  'myRequests',
  'wordsNews',
  'moderation',
  'moderatorOffer',
  'electModerator',
  'wordFlag',
])

/**
 * The portal hosts the game nearly alone: the server for the boards, the
 * friends, the duel and the words a signed-in player brings to the moderation,
 * the portal's own account as the only one, nothing that leads off its page (it
 * refuses a button that does nothing, such as « share — soon »), none of the
 * phone's offers. It lists the game as « Letter Minute » in every language, and
 * English stands in for the language picker: a player there must land in the
 * game, not on a question.
 */
export const crazyGamesHost: Host = {
  // Filtering is earned by a level bonus or Premium, neither of which the
  // portal has: left open, « Mes catégories » would promise a padlock no
  // player can win.
  closedFeatures: new Set(
    [...SERVER_FEATURES, ...APP_ONLY_FEATURES, 'categoryBans'].filter((id) => !OPEN_FEATURES.has(id)),
  ),
  // A portal game lives on players coming back: the challenge of the moment,
  // which the app opens to everyone, needs no server — attempts are counted
  // on the device, the progress they pay is saved by the Data module.
  // Its players come back between two runs rather than to a menu: the powers
  // are picked on a screen of their own before each run, not under « Play ».
  openedFeatures: new Set(['weekly', 'powerLoadout']),
  // The developer plays here too, under a CrazyGames account the server made a super moderator.
  superModeratorFeatures: new Set(SUPER_MODERATOR_FEATURES),
  title: ['Letter', 'Minute'],
  languages: platformLanguages,
  fallbackLocale: 'en',
  keepsProgress: true,
  premiumStore: false,
  rewardedAds: REWARDED,
  // Each level of a portal game pays something the player plays with: a
  // power or a category, never a bonus to read about.
  levelBonuses: false,
  // Until the portal allows the ad that pays for them, the reveals are free.
  unlimitedReveals: !REWARDED,
  // A guest of the portal plays without any account: nothing of theirs
  // reaches the server, which they read as anyone may.
  anonymousAccounts: false,
  guestBoards: true,
  account: portalAccount,
  onAccount: onPortalAccount,
  promptAccount: promptPortalAccount,
  setGameplay,
  celebrate: happytime,
  submitScore,
  prepareRewarded(): void {},
  showRewarded,
  breakBetweenRuns,
  onMute: onPlatformMute,
}
