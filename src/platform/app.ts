import { quiet, type Host } from './host'

/**
 * Android and the web share one build (`npm run build`, embedded as is by
 * Capacitor): what the phone adds — ads, pushes, Play Games, the store — lives
 * in `src/lib/native.ts`, which does nothing in a browser, and the feature
 * table decides the rest. The host itself asks nothing of either.
 */
export const appHost: Host = {
  closedFeatures: new Set(),
  title: null,
  languages: () => [],
  fallbackLocale: null,
  keepsProgress: false,
  ...quiet,
}
