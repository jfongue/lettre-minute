import { isNamed, type AchievementId } from '../domain/achievements'
import { APP_ONLY_FEATURES, SERVER_FEATURES, SUPER_MODERATOR_FEATURES, type AdBreak, type Host, type RewardedResult } from './host'
import { fitHistory, HISTORY_KEY, SAVED_KEYS } from './saves'

/**
 * The Playgama shell, as `crazygames.ts` is the CrazyGames one: everything the
 * portal's Bridge SDK (v2, `@playgama/bridge`) is asked goes through here, and
 * nothing here ever throws. Only the Playgama build reaches it (`host`,
 * `src/platform/index.ts`). The Bridge ships inside the build and loads as the
 * page's first script (`vite.config.ts`), as Playgama requires; off the portal
 * it runs as its own mock and answers anyway.
 *
 * The build is `npm run playgama:build`, documented in `playgama/README.md`.
 */

type AdState = 'loading' | 'opened' | 'closed' | 'rewarded' | 'failed'
type BannerState = 'loading' | 'shown' | 'hidden' | 'failed'

interface Bridge {
  initialize(): Promise<void>
  platform: {
    id: string
    language: string
    isAudioEnabled: boolean
    isPaused: boolean
    sendMessage(message: string): Promise<unknown>
    on(event: string, listener: (on: boolean) => void): void
  }
  advertisement: {
    isInterstitialSupported: boolean
    isRewardedSupported: boolean
    interstitialState?: AdState
    rewardedState?: AdState
    isAdvancedBannersSupported?: boolean
    showInterstitial(placement?: string): void
    showRewarded(placement?: string): void
    showAdvancedBanners?(placement?: string): void
    hideAdvancedBanners?(): void
    on(event: 'advanced_banners_state_changed', listener: (state: BannerState) => void): void
    on(event: string, listener: (state: AdState) => void): void
  }
  achievements?: {
    unlock(id: string): Promise<unknown>
    getAchievements(): Promise<{ id: string; unlocked: boolean }[]>
  }
  storage: {
    get(keys: string[], tryParseJson?: boolean): Promise<unknown>
    set(keys: string[], values: unknown[]): Promise<void>
    delete(keys: string[]): Promise<void>
  }
  player?: {
    isAuthorizationSupported: boolean
    isAuthorized: boolean
    name: string | null
    extra: unknown
    authorize(options?: object): Promise<void>
  }
  leaderboards?: {
    type: 'not_available' | 'in_game' | 'native' | 'native_popup'
    setScore(id: string, score: number): Promise<void>
  }
}

// Set once `initialize` has answered; null while it has not, or never will.
let bridge: Bridge | null = null

function safely(call: (bridge: Bridge) => void): void {
  if (!bridge) return
  try {
    call(bridge)
  } catch {
    /* the portal's shell is a guest: a failure there never reaches the game */
  }
}

// The Bridge answers in a few hundred milliseconds; one that hangs must not
// leave the page blank.
const INIT_PATIENCE_MS = 8000

function within<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([promise, new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms))])
}

/** Wakes the Bridge and follows its sound, pause and ad states; resolves in every case. */
export async function initPlaygama(): Promise<void> {
  const candidate = (window as { bridge?: Bridge }).bridge
  if (!candidate) return
  try {
    if ((await within(candidate.initialize().then(() => 'ready' as const), INIT_PATIENCE_MS)) !== 'ready') return
    bridge = candidate
    platformSilent = !candidate.platform.isAudioEnabled || candidate.platform.isPaused
    const follow = () => {
      platformSilent = !candidate.platform.isAudioEnabled || candidate.platform.isPaused
      announceMute()
    }
    candidate.platform.on('audio_state_changed', follow)
    candidate.platform.on('pause_state_changed', follow)
    candidate.advertisement.on('interstitial_state_changed', (state) => adStateChanged('interstitial', state))
    candidate.advertisement.on('rewarded_state_changed', (state) => adStateChanged('rewarded', state))
    candidate.advertisement.on('advanced_banners_state_changed', reserveBanner)
    unlockedRead = readUnlocked()
  } catch {
    bridge = null
  }
  // Read before the first render: where the portal has no account the game
  // can check, no « Sign in » shows that would do nothing.
  if (!accountsVerifiable()) {
    delete playgamaHost.account
    delete playgamaHost.accountService
    delete playgamaHost.onAccount
    delete playgamaHost.promptAccount
  }
}

/**
 * The platforms whose sign-in Playgama's API vouches for (`playgama-auth`):
 * the Bridge runs the game on partners' portals too, where it stays a guest's.
 * The sandbox is Playgama's own platform under another name, with the same
 * players: `playgama-auth` has it verified as `playgama`.
 */
const VERIFIABLE_PLATFORMS = new Set(['playgama', 'playgama_sandbox', 'msn', 'microsoft_store'])

function accountsVerifiable(): boolean {
  try {
    return Boolean(bridge?.player?.isAuthorizationSupported && VERIFIABLE_PLATFORMS.has(bridge.platform.id))
  } catch {
    return false
  }
}

/**
 * The signed-in player, as the token `playgama-auth` checks: the Bridge's
 * proof of the authorization (`player.extra`), which Playgama's API verifies,
 * with the platform it comes from and the portal's name. Null for a guest.
 */
async function portalAccount(): Promise<string | null> {
  try {
    const player = bridge?.player
    if (!bridge || !player?.isAuthorized || !accountsVerifiable()) return null
    return JSON.stringify({ platform: bridge.platform.id, extra: player.extra, name: player.name ?? '' })
  } catch {
    return null
  }
}

const accountListeners: (() => void)[] = []

function onPortalAccount(listener: () => void): void {
  accountListeners.push(listener)
}

/**
 * The portal's own sign-in, asked by a tap; true once the player is signed
 * in. The page does not reload: the game account is followed at once.
 */
async function promptPortalAccount(): Promise<boolean> {
  const player = bridge?.player
  if (!player?.isAuthorizationSupported) return false
  try {
    if (!player.isAuthorized) await player.authorize()
  } catch {
    return false
  }
  if (!player.isAuthorized) return false
  for (const listener of accountListeners) listener()
  return true
}

/** The board the partners' portals keep for the game (`playgama-bridge-config.json`). */
const BRIDGE_BOARD = 'best_score'

/** A run's points, for a partner portal's own board (MSN, YouTube…); Playgama itself has none. */
function submitScore(score: number): void {
  safely((b) => {
    if (!b.leaderboards || b.leaderboards.type === 'not_available' || score <= 0) return
    void b.leaderboards.setScore(BRIDGE_BOARD, score).catch(() => undefined)
  })
}

/** The first playable screen is up: the one message Playgama requires. */
export function gameReady(): void {
  safely((b) => void b.platform.sendMessage('game_ready').catch(() => undefined))
}

let inGameplay = false

/** In a run or not: only the changes reach the portal, as a level started and done. */
function setGameplay(on: boolean): void {
  if (on === inGameplay) return
  inGameplay = on
  safely((b) => void b.platform.sendMessage(on ? 'level_started' : 'level_completed').catch(() => undefined))
}

/** The portal's language (`en`, `fr`), then the browser's. */
function platformLanguages(): readonly string[] {
  const language = bridge?.platform.language
  return language ? [language] : []
}

const muteListeners = new Set<(muted: boolean) => void>()
const adBreakListeners = new Set<(covered: boolean) => void>()
let platformSilent = false

// Followed for every ad the Bridge reports, not only the one the game waits
// for: an ad the game gave up on may still open later, over a run.
const adsOnScreen = new Set<'interstitial' | 'rewarded'>()

function adPlaying(): boolean {
  return adsOnScreen.size > 0
}

function adStateChanged(kind: 'interstitial' | 'rewarded', state: AdState): void {
  const before = adPlaying()
  if (state === 'opened') adsOnScreen.add(kind)
  else if (state === 'closed' || state === 'failed') adsOnScreen.delete(kind)
  if (adPlaying() !== before) {
    announceMute()
    for (const listener of adBreakListeners) listener(adPlaying())
  }
  adListener?.(kind, state)
}

/** True while a Bridge ad covers the game: the run's clock holds. */
function onAdBreak(listener: (covered: boolean) => void): void {
  adBreakListeners.add(listener)
  listener(adPlaying())
}

function announceMute(): void {
  for (const listener of muteListeners) listener(adPlaying() || platformSilent)
}

/**
 * Called with true while the portal wants silence — its own sound setting, a
 * pause, an ad on screen — and false once it lets go. Playgama refuses a game
 * that plays sound under an ad.
 */
function onPlatformMute(listener: (muted: boolean) => void): void {
  muteListeners.add(listener)
  listener(adPlaying() || platformSilent)
}

/**
 * An ad that never calls back must not hold the next run forever. The Bridge
 * answers `failed` at once to an interstitial too close to the last one, or
 * `loading` while the portal fetches it, so a silent wait is a broken one. An
 * ad still loading gets longer: the portal's video ads take more than ten
 * seconds, and a run started meanwhile had the ad open over it. One that
 * actually plays gets the length of one.
 */
const AD_START_MS = 10_000
const AD_LOAD_MS = 30_000
const AD_TIMEOUT_MS = 60_000

const BUSY: readonly (AdState | undefined)[] = ['loading', 'opened']

let adListener: ((kind: 'interstitial' | 'rewarded', state: AdState) => void) | null = null

/**
 * Asks the Bridge for an ad; true once an interstitial closes, or a rewarded
 * one closes after paying (`rewarded`, the only state Playgama lets a reward
 * follow). False on `failed`, a throw or silence.
 */
function playAd(kind: 'interstitial' | 'rewarded'): Promise<boolean> {
  return new Promise((resolve) => {
    if (!bridge) return resolve(false)
    let done = false
    let paid = false
    const finish = (shown: boolean) => {
      if (done) return
      done = true
      clearTimeout(timer)
      adListener = null
      resolve(shown)
    }
    let timer = setTimeout(() => finish(false), AD_START_MS)
    // Set before the call: the Bridge answers a refused ad within it.
    adListener = (asked, state) => {
      if (asked !== kind) return
      if (state === 'loading') {
        clearTimeout(timer)
        timer = setTimeout(() => finish(false), AD_LOAD_MS)
      } else if (state === 'opened') {
        clearTimeout(timer)
        timer = setTimeout(() => finish(false), AD_TIMEOUT_MS)
      } else if (state === 'rewarded') paid = true
      else if (state === 'closed') finish(kind === 'interstitial' || paid)
      else if (state === 'failed') finish(false)
    }
    try {
      const { advertisement } = bridge
      // The Bridge silently drops a request while an ad of either kind is under
      // way: wait for that one to end instead of asking again.
      if (BUSY.includes(advertisement.interstitialState) || BUSY.includes(advertisement.rewardedState)) {
        clearTimeout(timer)
        timer = setTimeout(() => finish(false), AD_LOAD_MS)
        const waiting = adListener
        adListener = (asked, state) => {
          if (state === 'closed' || state === 'failed') finish(false)
          else waiting?.(asked, state)
        }
      } else if (kind === 'interstitial') advertisement.showInterstitial()
      else advertisement.showRewarded()
    } catch {
      finish(false)
    }
  })
}

/**
 * The interstitial, asked by every button that leads to gameplay: Playgama
 * wants one at each natural pause and paces them itself (a minimum delay
 * between two, refused with `failed` at once), so there is no schedule here.
 * A second tap while the ad is pending joins it.
 */
let pendingBreak: Promise<AdBreak> | null = null
function midgame(adFree: boolean): Promise<AdBreak> {
  if (pendingBreak) return pendingBreak
  if (!bridge || adFree) return Promise.resolve('none')
  const asked = playAd('interstitial')
    .then((shown): AdBreak => (shown ? 'shown' : 'unavailable'))
    .finally(() => {
      pendingBreak = null
    })
  pendingBreak = asked
  return asked
}

function showRewarded(): Promise<RewardedResult> {
  if (!bridge?.advertisement.isRewardedSupported) return Promise.resolve('unavailable')
  return playAd('rewarded').then((paid) => (paid ? 'rewarded' : 'unavailable'))
}

/**
 * Before the first render, the Bridge's copy replaces the browser's: Playgama
 * keeps a player's progress in its own storage (its cloud for a signed-in
 * player) and refuses a game that saves anywhere else. A key the Bridge lacks
 * but the browser holds — a save from before this module — is handed to it.
 * From then on every write to one of these keys is mirrored to the Bridge,
 * which batches them; the same value is never sent twice, so the Bridge's own
 * local fallback, which may write to this very localStorage, cannot loop.
 */
export async function restoreSavedProgress(): Promise<void> {
  const storage = bridge?.storage
  if (!storage) return
  const store = window.localStorage
  const { setItem, removeItem } = Storage.prototype
  const sent = new Map<string, string | null>()
  const local = (key: string) => {
    try {
      return store.getItem(key)
    } catch {
      return null
    }
  }
  const othersSize = () => SAVED_KEYS.reduce((size, key) => size + (key === HISTORY_KEY ? 0 : (local(key)?.length ?? 0)), 0)
  const mirror = (key: string, value: string | null) => {
    const next = value !== null && key === HISTORY_KEY ? fitHistory(value, othersSize()) : value
    if (sent.get(key) === next) return
    sent.set(key, next)
    const write = next === null ? storage.delete([key]) : storage.set([key], [next])
    write.catch(() => sent.delete(key))
  }

  let values: unknown
  try {
    const answer = await within(storage.get([...SAVED_KEYS], false), INIT_PATIENCE_MS)
    if (answer === 'timeout') return
    values = answer
  } catch {
    return
  }
  if (!Array.isArray(values)) return
  SAVED_KEYS.forEach((key, index) => {
    const saved: unknown = values[index]
    try {
      if (typeof saved === 'string') {
        sent.set(key, saved)
        setItem.call(store, key, saved)
      } else {
        const found = local(key)
        if (found !== null) mirror(key, found)
      }
    } catch {
      /* a storage that refuses keeps what it had */
    }
  })
  // Patched on the prototype, not the instance: a property set on
  // localStorage itself would be stored as an item named « setItem ».
  const saved = new Set(SAVED_KEYS)
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
 * The banner strip along the bottom of the window (`run` in
 * `playgama-bridge-config.json`, 12 % of its height): the Bridge lays it over
 * the page, so the page keeps that much free below the game — `crazygames.css`
 * reads `data-portal-banner` — but only while one actually shows, never an
 * empty band for a banner that failed. The Bridge hides it under a
 * full-screen ad and brings it back by itself.
 */
const BANNER_PLACEMENT = 'run'
let bannerWanted = false

function reserveBanner(state: BannerState): void {
  try {
    if (state === 'shown') document.documentElement.dataset.portalBanner = ''
    else if (state === 'hidden' || state === 'failed') delete document.documentElement.dataset.portalBanner
  } catch {
    /* no document: nothing to lay out */
  }
}

function setBanner(wanted: boolean): void {
  if (wanted === bannerWanted) return
  bannerWanted = wanted
  safely((b) => {
    if (!b.advertisement.isAdvancedBannersSupported) return
    if (wanted) b.advertisement.showAdvancedBanners?.(BANNER_PLACEMENT)
    else b.advertisement.hideAdvancedBanners?.()
  })
  if (!wanted) reserveBanner('hidden')
}

/**
 * The achievements the Bridge knows (`playgama-bridge-config.json`, the named
 * ones: the ladder's rungs are the grid's alone), each sent once: what it
 * already holds is read at start, what this session sent is remembered.
 */
const sentAchievements = new Set<string>()
let unlockedRead: Promise<void> = Promise.resolve()

async function readUnlocked(): Promise<void> {
  try {
    const held = await bridge?.achievements?.getAchievements()
    for (const achievement of held ?? []) if (achievement.unlocked) sentAchievements.add(achievement.id)
  } catch {
    /* unknown: each one is sent, and the Bridge ignores a repeat */
  }
}

/** The Bridge's id for one of the game's: snake_case, as its config wants. */
export function bridgeAchievementId(id: AchievementId): string {
  return id.replace(/-/g, '_')
}

function unlockAchievements(ids: readonly AchievementId[]): void {
  void unlockedRead.then(() => sendAchievements(ids))
}

function sendAchievements(ids: readonly AchievementId[]): void {
  safely((b) => {
    const achievements = b.achievements
    if (!achievements) return
    for (const id of ids) {
      const bridgeId = bridgeAchievementId(id)
      if (!isNamed(id) || sentAchievements.has(bridgeId)) continue
      sentAchievements.add(bridgeId)
      void achievements.unlock(bridgeId).catch(() => sentAchievements.delete(bridgeId))
    }
  })
}

/**
 * The server a Playgama player reaches, as on CrazyGames: the boards a guest
 * reads, and — since `playgama-auth` (0114) gives a named account to whoever
 * is signed in to the portal — the friends, the face-off with them, the duel
 * with its matchmaking, the twenty-four-hour challenges sent to those friends
 * and their reactions, the words he proposes and the moderation they feed, and
 * the ideas box. A guest has no session: the friends tab offers the portal's
 * sign-in, the duel falls back on the house players. What stays closed leads
 * off the portal's page (an invitation by link or e-mail, the store) or sells.
 */
const OPEN_FEATURES = new Set([
  'leaderboards',
  'friends',
  'rivalry',
  'duel',
  'challenges',
  'reactions',
  'proposeWord',
  'myRequests',
  'wordsNews',
  'moderation',
  'moderatorOffer',
  'electModerator',
  'wordFlag',
  'ideasBox',
])

/**
 * Playgama hosts the game like CrazyGames: the server for the boards and,
 * once the player is signed in to the portal, everything a named account
 * carries; the progress in the portal's storage, its interstitial between
 * runs and its rewarded ad for the summary's reveals. It lists the game as
 * « Letter Minute » in every language.
 */
export const playgamaHost: Host = {
  // Filtering is earned by a level bonus or Premium: the portal has neither
  // the server account nor the store that would make the padlock winnable.
  closedFeatures: new Set([...SERVER_FEATURES, ...APP_ONLY_FEATURES, 'categoryBans'].filter((id) => !OPEN_FEATURES.has(id))),
  // As on CrazyGames: the challenge of the moment needs no account, and the
  // powers are picked on their own screen before each run.
  openedFeatures: new Set(['weekly', 'powerLoadout']),
  // The developer can play here under a Playgama account the server made a super moderator.
  superModeratorFeatures: new Set(SUPER_MODERATOR_FEATURES),
  title: ['Letter', 'Minute'],
  languages: platformLanguages,
  fallbackLocale: null,
  keepsProgress: true,
  ownMute: false,
  // A portal player wants to play before meeting a menu.
  playFirst: true,
  premiumStore: false,
  rewardedAds: true,
  levelBonuses: true,
  unlimitedReveals: false,
  // A guest of the portal plays without any account: nothing of theirs
  // reaches the server, which they read as anyone may.
  anonymousAccounts: false,
  guestBoards: true,
  account: portalAccount,
  accountService: 'playgama-auth',
  onAccount: onPortalAccount,
  promptAccount: promptPortalAccount,
  setGameplay,
  celebrate(): void {},
  submitScore,
  prepareRewarded(): void {},
  showRewarded,
  breakAfterRecap: () => Promise.resolve('none'),
  midgame,
  onMute: onPlatformMute,
  onAdBreak,
  setBanner,
  unlockAchievements,
}
