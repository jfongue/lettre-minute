import { host } from '../platform'
import { detectLocale, isLocale, messagesFor, type Locale } from '../i18n'

const LOCALE_KEY = 'lettre-minute.locale.v1'

/**
 * The language the player chose, else the first of the device's that the game
 * speaks — or of the host's, given first (the CrazyGames portal's). Null when
 * none is known: the game asks before anything else.
 */
export function loadLocale(hostLanguages: readonly string[] = []): Locale | null {
  try {
    const stored = localStorage.getItem(LOCALE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    /* no storage: fall through to the device */
  }
  if (typeof navigator === 'undefined') return detectLocale(hostLanguages)
  return detectLocale([...hostLanguages, ...(navigator.languages?.length ? navigator.languages : [navigator.language])])
}

export function saveLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    /* the choice lasts until the app closes */
  }
}

export function applyLocale(locale: Locale): void {
  document.documentElement.lang = locale
  document.title = (host.title ?? messagesFor(locale).appName).join(' ')
}
