import { APP_ONLY_FEATURES, SERVER_FEATURES, type AdBreak, type Host, type RewardedResult } from './host'
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
    showInterstitial(placement?: string): void
    showRewarded(placement?: string): void
    on(event: string, listener: (state: AdState) => void): void
  }
  storage: {
    get(keys: string[], tryParseJson?: boolean): Promise<unknown>
    set(keys: string[], values: unknown[]): Promise<void>
    delete(keys: string[]): Promise<void>
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
    candidate.advertisement.on('interstitial_state_changed', (state) => adListener?.('interstitial', state))
    candidate.advertisement.on('rewarded_state_changed', (state) => adListener?.('rewarded', state))
  } catch {
    bridge = null
  }
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
let adPlaying = false
let platformSilent = false

function announceMute(): void {
  for (const listener of muteListeners) listener(adPlaying || platformSilent)
}

/**
 * Called with true while the portal wants silence — its own sound setting, a
 * pause, an ad on screen — and false once it lets go. Playgama refuses a game
 * that plays sound under an ad.
 */
function onPlatformMute(listener: (muted: boolean) => void): void {
  muteListeners.add(listener)
  listener(adPlaying || platformSilent)
}

/**
 * An ad that never calls back must not hold the next run forever. The Bridge
 * answers `failed` at once to an interstitial too close to the last one, so a
 * silent wait is a broken one; an ad that actually plays gets the length of one.
 */
const AD_START_MS = 10_000
const AD_TIMEOUT_MS = 60_000

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
      if (adPlaying) {
        adPlaying = false
        announceMute()
      }
      resolve(shown)
    }
    let timer = setTimeout(() => finish(false), AD_START_MS)
    // Set before the call: the Bridge answers a refused ad within it.
    adListener = (asked, state) => {
      if (asked !== kind) return
      if (state === 'opened') {
        adPlaying = true
        announceMute()
        clearTimeout(timer)
        timer = setTimeout(() => finish(false), AD_TIMEOUT_MS)
      } else if (state === 'rewarded') paid = true
      else if (state === 'closed') finish(kind === 'interstitial' || paid)
      else if (state === 'failed') finish(false)
    }
    try {
      if (kind === 'interstitial') bridge.advertisement.showInterstitial()
      else bridge.advertisement.showRewarded()
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
 * The server a Playgama player reaches is the boards alone, read as a guest:
 * the portal's accounts are not linked to the game's (no `crazygames-auth`
 * equivalent), so nothing that needs a named account — friends, the duel, the
 * words proposed and their moderation — opens here, nor anything that leads
 * off the portal's page or sells.
 */
const OPEN_FEATURES = new Set(['leaderboards'])

/**
 * Playgama hosts the game like a CrazyGames guest: the boards from the server,
 * the progress in the portal's storage, its interstitial between runs and its
 * rewarded ad for the summary's reveals. It lists the game as « Letter
 * Minute » in every language.
 */
export const playgamaHost: Host = {
  // Filtering is earned by a level bonus or Premium: the portal has neither
  // the server account nor the store that would make the padlock winnable.
  closedFeatures: new Set([...SERVER_FEATURES, ...APP_ONLY_FEATURES, 'categoryBans'].filter((id) => !OPEN_FEATURES.has(id))),
  // As on CrazyGames: the challenge of the moment needs no account, and the
  // powers are picked on their own screen before each run.
  openedFeatures: new Set(['weekly', 'powerLoadout']),
  // No game account on this portal: no role to read.
  superModeratorFeatures: new Set(),
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
  anonymousAccounts: false,
  guestBoards: true,
  setGameplay,
  celebrate(): void {},
  submitScore(): void {},
  prepareRewarded(): void {},
  showRewarded,
  breakAfterRecap: () => Promise.resolve('none'),
  midgame,
  onMute: onPlatformMute,
}
