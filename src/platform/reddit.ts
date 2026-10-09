import { APP_ONLY_FEATURES, quiet, SERVER_FEATURES, type Host } from './host'

/**
 * The Reddit daily (`reddit/`, Devvit): one run a day on the day's seed, the
 * same for every player of a post, so no powers and a judge without usage
 * counters. It borrows the run's screens, not the app: its own entries
 * (`reddit/src/client/`) decide the rest, and Reddit's server keeps the scores.
 */
export const redditHost: Host = {
  closedFeatures: new Set([...SERVER_FEATURES, ...APP_ONLY_FEATURES, 'powers', 'powerGift']),
  title: null,
  languages: () => [],
  fallbackLocale: 'en',
  keepsProgress: true,
  premiumStore: false,
  rewardedAds: false,
  ...quiet,
}
