import { trackFeature } from '../lib/feature'
import { APP_ONLY_FEATURES, SERVER_FEATURES, type AdBreak, type Host, type RewardedResult } from './host'
import { fitHistory, HISTORY_KEY, SAVED_KEYS } from './saves'

/**
 * The Y8 shell, as `crazygames.ts` is the CrazyGames one: everything Y8's SDK
 * (minimal SDK 2.0, docs.y8.com) is asked goes through here, and nothing here
 * ever throws. Only the Y8 build reaches it (`host`, `src/platform/index.ts`).
 * Without the ids the Developer Portal gives (`VITE_Y8_APP_ID`,
 * `VITE_Y8_GAME_ID`), or without the SDK, the game runs as it would anywhere:
 * no ad, progress in the browser alone.
 *
 * The build is `npm run y8:build`, documented in `y8/README.md`.
 */

interface ShowAd {
  type: 'next' | 'reward'
  name: string
  beforeAd?(): void
  afterAd?(): void
  beforeReward?(showAdFn: () => void): void
  adViewed?(): void
  adDismissed?(): void
  adBreakDone?(info: { breakStatus?: string }): void
}

interface Y8Sdk {
  init(app: { appId: string; autoLogin: boolean }, ads?: { gameId: string; preloadAdBreaks: 'on'; sound: 'on'; onReady?(): void }): void
  onAuth(listener: (user: unknown, error: unknown) => void): void
  getUser(): unknown
  getPlatformLocale?(): Promise<string>
  showAd(options: ShowAd): Promise<unknown> | void
  saveData(options: { key: string; value: string; retries?: boolean }): Promise<unknown>
  loadData(options: { key: string }): Promise<string | null>
}

declare global {
  interface Window {
    y8?: { sdk(): Y8Sdk; emitReadyEvent?(): void }
  }
}

const SDK_URL = 'https://cdn.y8.com/minimal-sdk/2-0/y8.min.js'
const APP_ID = import.meta.env.VITE_Y8_APP_ID ?? ''
const GAME_ID = import.meta.env.VITE_Y8_GAME_ID ?? ''

// Set once the SDK is ready and initialised; null everywhere it is not.
let sdk: Y8Sdk | null = null
// Y8's language (`fr`), read once at start: `languages()` answers at once.
let locale: string | null = null
// Whether a Y8 player is signed in: the cloud save is theirs alone.
let signedIn = false

// The SDK answers in a few hundred milliseconds; one that hangs, or a script
// an ad blocker refuses, must not leave the page blank. Y8 requires the game
// to stay playable with an ad blocker.
const SDK_PATIENCE_MS = 6000
const AUTH_PATIENCE_MS = 3000

function within<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([promise, new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms))])
}

function loadSdk(): Promise<boolean> {
  return new Promise((resolve) => {
    // The SDK announces itself by an event, which an early script may fire
    // before this listener: `emitReadyEvent` fires it again (docs.y8.com/sdk/intro).
    window.addEventListener('y8sdk.ready', () => resolve(true), { once: true })
    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.onload = () => window.y8?.emitReadyEvent?.()
    script.onerror = () => resolve(false)
    document.head.append(script)
  })
}

/** Wakes the SDK, signs in a player already signed in to Y8, reads its language; resolves in every case. */
export async function initY8(): Promise<void> {
  if (!APP_ID) return
  try {
    if ((await within(loadSdk(), SDK_PATIENCE_MS)) !== true || !window.y8) return
    const candidate = window.y8.sdk()
    // The first answer of `onAuth` says who plays: the save is read after it.
    const authed = new Promise<void>((resolve) =>
      candidate.onAuth((user) => {
        signedIn = Boolean(user)
        resolve()
      }),
    )
    candidate.init({ appId: APP_ID, autoLogin: true }, GAME_ID ? { gameId: GAME_ID, preloadAdBreaks: 'on', sound: 'on' } : undefined)
    sdk = candidate
    await within(authed, AUTH_PATIENCE_MS)
    const asked = candidate.getPlatformLocale?.()
    const found = asked ? await within(asked, AUTH_PATIENCE_MS) : 'timeout'
    if (typeof found === 'string' && found !== 'timeout') locale = found
  } catch {
    /* left as it was: the game runs as it would anywhere */
  }
}

/** Y8's language first, then the browser's. */
function platformLanguages(): readonly string[] {
  return locale ? [locale] : []
}

const muteListeners = new Set<(muted: boolean) => void>()
let adPlaying = false

function setAdPlaying(on: boolean): void {
  if (adPlaying === on) return
  adPlaying = on
  for (const listener of muteListeners) listener(on)
}

/** Called with true while an ad plays, false once it is over: Y8 refuses a game that sounds under one. */
function onAdMute(listener: (muted: boolean) => void): void {
  muteListeners.add(listener)
  listener(adPlaying)
}

/**
 * A break whose callbacks never come must not hold the next run forever. The
 * SDK answers `adBreakDone` even to a break it skips (`frequencyCapped`,
 * `noAdPreloaded`), so a long silence is a broken SDK; an ad playing gets the
 * length of one.
 */
const AD_START_MS = 10_000
const AD_TIMEOUT_MS = 60_000

/** Asks Y8 for a break; resolves with `adBreakDone`'s status, or `timeout`, `error`. */
function playAd(type: 'next' | 'reward', onViewed?: () => void): Promise<string> {
  return new Promise((resolve) => {
    if (!sdk || !GAME_ID) return resolve('error')
    let done = false
    const finish = (status: string) => {
      if (done) return
      done = true
      clearTimeout(timer)
      setAdPlaying(false)
      resolve(status)
    }
    let timer = setTimeout(() => finish('timeout'), AD_START_MS)
    try {
      const answer = sdk.showAd({
        type,
        name: type === 'next' ? 'play-again' : 'reveal-words',
        beforeAd: () => {
          setAdPlaying(true)
          clearTimeout(timer)
          timer = setTimeout(() => finish('timeout'), AD_TIMEOUT_MS)
        },
        afterAd: () => setAdPlaying(false),
        // The reward button was the player's choice: the ad plays as soon as it is ready.
        beforeReward: (showAdFn) => showAdFn(),
        adViewed: onViewed,
        adBreakDone: (info) => finish(info?.breakStatus ?? 'other'),
      })
      if (answer && typeof answer.then === 'function') answer.then(undefined, () => finish('error'))
    } catch {
      finish('error')
    }
  })
}

/**
 * The interstitial, asked by the buttons that lead to gameplay (Play, Play
 * again) and by nothing else — Y8 refuses an interstitial no click asked
 * for, even at a run's end. Y8 paces them itself (one every three minutes by
 * default), and a capped break answers at once. A second tap joins it.
 */
let pendingBreak: Promise<AdBreak> | null = null
function midgame(adFree: boolean): Promise<AdBreak> {
  if (pendingBreak) return pendingBreak
  if (!sdk || !GAME_ID || adFree) return Promise.resolve('none')
  const asked = playAd('next')
    .then((status): AdBreak => {
      const result = status === 'viewed' ? 'shown' : status === 'frequencyCapped' ? 'none' : 'unavailable'
      trackFeature('ad', { source: 'midgame', result })
      return result
    })
    .finally(() => {
      pendingBreak = null
    })
  pendingBreak = asked
  return asked
}

/** A rewarded ad: the reward only on `adViewed`, never on a dismissal, a skip or an error. */
function showRewarded(): Promise<RewardedResult> {
  if (!sdk || !GAME_ID) return Promise.resolve('unavailable')
  let viewed = false
  return playAd('reward', () => {
    viewed = true
  }).then((status) => (viewed ? 'rewarded' : status === 'dismissed' ? 'skipped' : 'unavailable'))
}

// The whole save under one key: Y8 takes one write per key every five
// seconds, 30 KB a value, and only for a signed-in player.
const SAVE_KEY = 'lettre-minute'
const SAVE_BUDGET = 28_000
const SAVE_PAUSE_MS = 6000

/**
 * Before the first render, a signed-in Y8 player's cloud save replaces the
 * browser's: it is theirs, whichever device they come from. A player without
 * one hands the browser's progress to it. From then on every change to a
 * saved key is gathered and sent at most every six seconds, the history cut
 * to its latest runs so the whole fits in Y8's 30 KB. A guest keeps the
 * browser's progress alone, as Y8 lets them play without an account.
 */
export async function restoreSavedProgress(): Promise<void> {
  if (!sdk || !signedIn) return
  const cloud = sdk
  const store = window.localStorage
  const { setItem, removeItem } = Storage.prototype
  const local = (key: string) => {
    try {
      return store.getItem(key)
    } catch {
      return null
    }
  }

  let lastSent: string | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const send = () => {
    timer = null
    const others = SAVED_KEYS.reduce((size, key) => size + (key === HISTORY_KEY ? 0 : (local(key)?.length ?? 0)), 0)
    const entries = SAVED_KEYS.flatMap((key) => {
      const value = local(key)
      if (value === null) return []
      return [[key, key === HISTORY_KEY ? fitHistory(value, others, SAVE_BUDGET) : value] as const]
    })
    const value = JSON.stringify(Object.fromEntries(entries))
    if (value === lastSent) return
    lastSent = value
    cloud.saveData({ key: SAVE_KEY, value, retries: true }).catch(() => {
      lastSent = null
    })
  }
  const schedule = () => {
    if (!timer) timer = setTimeout(send, SAVE_PAUSE_MS)
  }

  try {
    const answer = await within(cloud.loadData({ key: SAVE_KEY }), SDK_PATIENCE_MS)
    if (answer === 'timeout') return
    const saved: unknown = typeof answer === 'string' ? JSON.parse(answer) : null
    if (saved && typeof saved === 'object') {
      for (const key of SAVED_KEYS) {
        const value = (saved as Record<string, unknown>)[key]
        if (typeof value === 'string') setItem.call(store, key, value)
        else removeItem.call(store, key)
      }
      lastSent = answer as string
    } else schedule()
  } catch {
    return
  }
  // Patched on the prototype, not the instance: a property set on
  // localStorage itself would be stored as an item named « setItem ».
  const saved = new Set(SAVED_KEYS)
  Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
    setItem.call(this, key, value)
    if (this === store && saved.has(key)) schedule()
  }
  Storage.prototype.removeItem = function (this: Storage, key: string) {
    removeItem.call(this, key)
    if (this === store && saved.has(key)) schedule()
  }
  // A tab closed within the pause still saves what changed.
  window.addEventListener('pagehide', () => {
    if (timer) {
      clearTimeout(timer)
      send()
    }
  })
}

/**
 * The server a Y8 player reaches is the boards alone, read as a guest: Y8's
 * accounts are not linked to the game's, so nothing that needs a named
 * account — friends, the duel, the words proposed and their moderation —
 * opens here, nor anything that leads off Y8's page (« External links are
 * not allowed inside games on Y8 ») or sells.
 */
const OPEN_FEATURES = new Set(['leaderboards'])

/**
 * Y8 hosts the game like a CrazyGames guest: the boards from the server, the
 * progress in Y8's cloud save for a signed-in player, its interstitial behind
 * the Play buttons and its rewarded ad for the summary's reveals. Listed as
 * « Letter Minute » in every language.
 */
export const y8Host: Host = {
  // Filtering is earned by a level bonus or Premium: without the game's
  // account or a store, the padlock could not be won.
  closedFeatures: new Set([...SERVER_FEATURES, ...APP_ONLY_FEATURES, 'categoryBans'].filter((id) => !OPEN_FEATURES.has(id))),
  // As on CrazyGames: the challenge of the moment needs no account, and the
  // powers are picked on their own screen before each run.
  openedFeatures: new Set(['weekly', 'powerLoadout']),
  // No game account on Y8: no role to read.
  superModeratorFeatures: new Set(),
  title: ['Letter', 'Minute'],
  languages: platformLanguages,
  fallbackLocale: null,
  // True for a signed-in player only; a guest's progress is the browser's,
  // which is what the game says anywhere else.
  get keepsProgress() {
    return signedIn
  },
  ownMute: false,
  // Y8 asks for play before long menus and tutorials.
  playFirst: true,
  premiumStore: false,
  rewardedAds: Boolean(GAME_ID),
  levelBonuses: true,
  // Without an ad unit, nothing pays for the reveals: they are free.
  unlimitedReveals: !GAME_ID,
  anonymousAccounts: false,
  guestBoards: true,
  setGameplay(): void {},
  celebrate(): void {},
  submitScore(): void {},
  prepareRewarded(): void {},
  showRewarded,
  breakAfterRecap: () => Promise.resolve('none'),
  midgame,
  onMute: onAdMute,
}
