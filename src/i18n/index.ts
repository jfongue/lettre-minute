import { createContext, useContext } from 'react'
import { categoryMeta } from '../domain/catalogue'
import { de } from './de'
import { en } from './en'
import { es } from './es'
import { fr, type Messages } from './fr'
import { it } from './it'
import { nl } from './nl'
import { pt } from './pt'

export type { Messages } from './fr'

export type Locale = 'fr' | 'en' | 'es' | 'nl' | 'de' | 'it' | 'pt'

/** In the order the language picker lists them, each named in its own language. */
export const LOCALES: readonly { id: Locale; name: string; messages: Messages }[] = [
  { id: 'fr', name: 'Français', messages: fr },
  { id: 'en', name: 'English', messages: en },
  { id: 'es', name: 'Español', messages: es },
  { id: 'de', name: 'Deutsch', messages: de },
  { id: 'it', name: 'Italiano', messages: it },
  { id: 'nl', name: 'Nederlands', messages: nl },
  { id: 'pt', name: 'Português', messages: pt },
]

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale.id === value)
}

export function messagesFor(locale: Locale): Messages {
  return LOCALES.find((entry) => entry.id === locale)?.messages ?? fr
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
