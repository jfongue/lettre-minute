import { isNativeApp } from '../lib/native'
import { appHost } from './app'
import { crazyGamesHost } from './crazygames'
import type { Host, Platform } from './host'
import { redditHost } from './reddit'

export type { Host, Platform } from './host'

/**
 * The build, fixed by Vite's `define` (`vite.config.ts`, `reddit/vite.config.ts`)
 * and compared as a literal, so the minifier drops the other hosts' code: the
 * Android and web bundle carries no CrazyGames SDK, and the reverse.
 */
const BUILD = import.meta.env.VITE_PLATFORM as 'app' | 'crazygames' | 'reddit'

/** Android and the web are one build: only the phone's shell tells them apart. */
export const PLATFORM: Platform =
  BUILD === 'crazygames' ? 'crazygames' : BUILD === 'reddit' ? 'reddit' : isNativeApp() ? 'android' : 'web'

export const host: Host = BUILD === 'crazygames' ? crazyGamesHost : BUILD === 'reddit' ? redditHost : appHost

/**
 * What the feature table opened, plus what this host opens itself, minus what
 * it cannot carry — save, for a super moderator, the tools it keeps for them.
 */
export function hostFeatures(features: ReadonlySet<string>, superModerator = false): ReadonlySet<string> {
  if (host.closedFeatures.size === 0 && host.openedFeatures.size === 0) return features
  const kept = superModerator ? host.superModeratorFeatures : new Set<string>()
  return new Set([...features, ...host.openedFeatures].filter((id) => !host.closedFeatures.has(id) || kept.has(id)))
}

/**
 * Real-money Premium: the phone's shell through Play Billing, or the web page
 * through its own merchant (`VITE_PREMIUM_WEB`, off unless the merchant is
 * ready — a debug publication must never ask for money by accident).
 * CrazyGames and Reddit sell nothing.
 */
export const premiumStoreOpen =
  host.premiumStore && (PLATFORM === 'android' || (PLATFORM === 'web' && import.meta.env.VITE_PREMIUM_WEB === 'true'))

/** Rewarded ads: AdMob in the Android shell, the portal's SDK on CrazyGames once its build allows them; never the web page. */
export const rewardedAdsOpen = host.rewardedAds && (PLATFORM === 'android' || PLATFORM === 'crazygames')
