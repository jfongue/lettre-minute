import { detectLocale, isLocale, messagesFor, type Locale } from '../i18n'

const LOCALE_KEY = 'lettre-minute.locale.v1'

/**
 * The language the player chose, else the first of the device's that the game
 * speaks. Null when neither is known: the game asks before anything else.
 */
export function loadLocale(): Locale | null {
  try {
    const stored = localStorage.getItem(LOCALE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    /* no storage: fall through to the device */
  }
  if (typeof navigator === 'undefined') return null
  return detectLocale(navigator.languages?.length ? navigator.languages : [navigator.language])
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
  document.title = messagesFor(locale).appName.join(' ')
}
