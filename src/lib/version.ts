import { PLATFORM, type Platform } from '../platform'

/**
 * The build the player is running: Vite stamps the Play Store's `versionName`
 * on every build (`vite.config.ts`). Null where the build sets none (Reddit),
 * so no screen claims a version it does not know.
 */
export const APP_VERSION: string | null = import.meta.env.VITE_APP_VERSION ?? null

/** Brand names, kept as they are in every language. */
const PLATFORM_NAMES: Record<Platform, string> = {
  android: 'Android',
  web: 'Web',
  crazygames: 'CrazyGames',
  reddit: 'Reddit',
}

/** The platform as the player knows it, beside the version they test. */
export const PLATFORM_NAME = PLATFORM_NAMES[PLATFORM]
