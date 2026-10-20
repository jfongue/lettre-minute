import { breakDue, INTERSTITIAL_BREAKS, nextBreak } from '../domain/adBreaks'
import { trackFeature } from '../lib/feature'
import { adsSupported, playInterstitial, prepareInterstitial, prepareRewardedAd, showRewardedAd } from '../lib/native'
import { quiet, type AdBreak, type Host } from './host'

// Loaded this many runs ahead of its break: a run is time enough to load one,
// and the ad answers sooner than it expires (an hour).
const LOAD_AHEAD_RUNS = 2

/**
 * The phone's interstitial between two runs, on the session's schedule
 * (`INTERSTITIAL_BREAKS`), after the word recap like CrazyGames' midgame. In a
 * browser `adsSupported` is false and nothing is ever due: the web shows no ad.
 * A second tap while the ad plays joins it.
 */
let finishedRuns = 0
let pendingBreak: Promise<AdBreak> | null = null
function breakAfterRecap(adFree: boolean): Promise<AdBreak> {
  if (pendingBreak) return pendingBreak
  finishedRuns += 1
  if (!adsSupported()) return Promise.resolve('none')
  const due = breakDue(finishedRuns, INTERSTITIAL_BREAKS)
  if (adFree) return Promise.resolve(due ? 'spared' : 'none')
  const loadAhead = () => {
    if (nextBreak(finishedRuns, INTERSTITIAL_BREAKS) - finishedRuns <= LOAD_AHEAD_RUNS) prepareInterstitial()
  }
  if (!due) {
    loadAhead()
    return Promise.resolve('none')
  }
  const played = playInterstitial().then((result) => {
    trackFeature('ad', { source: 'midgame', result })
    pendingBreak = null
    loadAhead()
    return result
  })
  pendingBreak = played
  return played
}

/**
 * Android and the web share one build (`npm run build`, embedded as is by
 * Capacitor): what the phone adds — ads, pushes, Play Games, the store — lives
 * in `src/lib/native.ts`, which does nothing in a browser, and the feature
 * table decides the rest. The host itself asks nothing of either.
 */
export const appHost: Host = {
  closedFeatures: new Set(),
  openedFeatures: new Set(),
  superModeratorFeatures: new Set(),
  title: null,
  languages: () => [],
  fallbackLocale: null,
  ownMute: false,
  playFirst: false,
  keepsProgress: false,
  // The web shares this host but has no store: `PLATFORM` tells it apart.
  premiumStore: true,
  rewardedAds: true,
  levelBonuses: true,
  unlimitedReveals: false,
  anonymousAccounts: true,
  guestBoards: false,
  ...quiet,
  prepareRewarded: prepareRewardedAd,
  showRewarded: showRewardedAd,
  breakAfterRecap,
}
