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

/** What the feature table opened, minus what this host cannot carry. */
export function hostFeatures(features: ReadonlySet<string>): ReadonlySet<string> {
  if (host.closedFeatures.size === 0) return features
  return new Set([...features].filter((id) => !host.closedFeatures.has(id)))
}

/** Real-money Premium: Android shell only, never the web page of the same build, CrazyGames or Reddit. */
export const premiumStoreOpen = host.premiumStore && PLATFORM === 'android'

/** Rewarded ads (AdMob): Android shell only. */
export const rewardedAdsOpen = host.rewardedAds && PLATFORM === 'android'
