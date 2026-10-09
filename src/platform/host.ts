import type { FeatureId } from '../domain/features'
import type { Locale } from '../i18n'

/** Where the game runs: the four versions built from this one code (CLAUDE.md, « Plateformes »). */
export type Platform = 'android' | 'web' | 'crazygames' | 'reddit'

/**
 * What really differs from one version to the next, asked by the shared code
 * of whichever host it runs in (`host`, `src/platform/index.ts`). Like
 * `cloud.ts` and `native.ts`, nothing here ever throws: a host that fails
 * costs its own service, never a run.
 */
export interface Host {
  /**
   * Closed whatever the feature table says (`enabledFeatures`): what this host
   * cannot carry — a server, an account, a link off its page — or forbids.
   */
  closedFeatures: ReadonlySet<FeatureId>
  /** The name the host lists the game under, shown in every language; null: the interface's own. */
  title: readonly [string, string] | null
  /** The host's languages, given before the device's (`loadLocale`). */
  languages(): readonly string[]
  /** The language when neither speaks one of the game's; null asks the player first. */
  fallbackLocale: Locale | null
  /** The host keeps the progress itself, wherever its player signs in: no « on this device only » note. */
  keepsProgress: boolean
  /**
   * The host can sell Premium for real money, and show rewarded ads: the phone
   * shell alone (`premiumStoreOpen`, `rewardedAdsOpen`, `src/platform/index.ts`).
   */
  premiumStore: boolean
  rewardedAds: boolean
  /** In a run (countdown, clock, first lesson) or not; only the changes matter. */
  setGameplay(on: boolean): void
  /** A run that beats a record the player already had. */
  celebrate(): void
  /** The host's break before a new run (an ad); resolves once it is over, failed or skipped. */
  breakBetweenRuns(): Promise<void>
  /** Called with true while the host wants silence — its own mute, an ad — and false once it lets go. */
  onMute(listener: (muted: boolean) => void): void
}

/** Everything that needs the game's server or a named account. */
export const SERVER_FEATURES: readonly FeatureId[] = [
  'challenges',
  'duel',
  'friends',
  'friendInvite',
  'rivalry',
  'reactions',
  'leaderboards',
  'proposeWord',
  'myRequests',
  'wordsNews',
  'moderation',
  'moderatorOffer',
  'electModerator',
  'wordFlag',
  'ideasBox',
  'feedback',
]

/** The phone's own offers and the developer's tools, which a web portal has no use for. */
export const APP_ONLY_FEATURES: readonly FeatureId[] = [
  'premium',
  'gameModes',
  'support',
  'pushOffer',
  'storeUpdate',
  'playGames',
  'ads',
  'share',
  'wordsBoard',
  'dashboard',
  'ideasAdmin',
  'debugBoard',
]

export const quiet = {
  setGameplay(): void {},
  celebrate(): void {},
  breakBetweenRuns: (): Promise<void> => Promise.resolve(),
  onMute(): void {},
}
