import { createContext, useContext } from 'react'
import { categoryMeta } from '../domain/catalogue'
import { fr, type Messages } from './fr'

export type { Messages } from './fr'

export type Locale = 'fr' | 'en' | 'es' | 'nl' | 'de' | 'it' | 'pt'

/** In the order the language picker lists them, each named in its own language. */
export const LOCALES: readonly { id: Locale; name: string }[] = [
  { id: 'fr', name: 'Français' },
  { id: 'en', name: 'English' },
  { id: 'es', name: 'Español' },
  { id: 'de', name: 'Deutsch' },
  { id: 'it', name: 'Italiano' },
  { id: 'nl', name: 'Nederlands' },
  { id: 'pt', name: 'Português' },
]

// Only French ships in the first bundle — it is the typed reference and every
// fallback. A player reads one language: the six others would be parsed at
// each launch for nothing.
const LOADERS: Record<Locale, () => Promise<Messages>> = {
  fr: () => Promise.resolve(fr),
  en: () => import('./en').then((module) => module.en),
  es: () => import('./es').then((module) => module.es),
  de: () => import('./de').then((module) => module.de),
  it: () => import('./it').then((module) => module.it),
  nl: () => import('./nl').then((module) => module.nl),
  pt: () => import('./pt').then((module) => module.pt),
}

const loaded: Partial<Record<Locale, Messages>> = { fr }

/** Fetches a language's texts once; `messagesFor` answers with them afterwards. */
export async function loadMessages(locale: Locale): Promise<Messages> {
  const known = loaded[locale]
  if (known) return known
  const messages = await LOADERS[locale]()
  loaded[locale] = messages
  return messages
}

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale.id === value)
}

/** A language loaded by `loadMessages`; French until then. */
export function messagesFor(locale: Locale): Messages {
  return loaded[locale] ?? fr
}

/**
 * The first of the device's languages the game speaks, read by its primary
 * subtag: « pt-BR » and « pt-PT » both get Portuguese. Null when none of them
 * is known — the player then picks, rather than being handed a guess.
 */
export function detectLocale(languages: readonly string[]): Locale | null {
  for (const tag of languages) {
    const primary = tag.toLowerCase().split(/[-_]/)[0]
    if (isLocale(primary)) return primary
  }
  return null
}

export const MessagesContext = createContext<Messages>(fr)

export function useT(): Messages {
  return useContext(MessagesContext)
}

/** A category's name and hint in the player's language, the French catalogue as a fallback. */
export function categoryText(t: Messages, id: string): { label: string; hint: string } {
  const translated = t.categories[id]
  if (translated) return { label: translated[0], hint: translated[1] }
  const meta = categoryMeta(id)
  return { label: meta?.label ?? id, hint: meta?.hint ?? '' }
}

export function formatNumber(t: Messages, value: number): string {
  return value.toLocaleString(t.tag)
}
