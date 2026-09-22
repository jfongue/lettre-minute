import type { WordEntry } from './words'

export interface WordUsage {
  /** Times this player has already answered this word in past runs. */
  own: number
  /** Share of recent runs, all players, where the word came up — 0 when unknown. */
  globalShare: number
}

export const NO_USAGE: WordUsage = { own: 0, globalShare: 0 }

export type RarityTier = 'courant' | 'peu commun' | 'rare' | 'très rare'

const BASE_POINTS = 100
const RARITY_POINTS = 300
const MAX_COMBO_STEPS = 9

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * How well known a word is, on 0..1. Two signals are needed because neither
 * covers the whole catalogue: proper nouns (Kiribati, Praséodyme) are absent
 * from the book corpus, and common nouns (marteau) have no Wikipedia fame of
 * their own. The better-known of the two wins, so a word is only rare when
 * both agree that it is.
 */
export function notoriety(entry: WordEntry): number {
  const corpus = Math.log10(1 + entry.frequency) / 2.2
  const fame = Math.log10(1 + entry.sitelinks) / 2.5
  return clamp(Math.max(corpus, fame), 0, 1)
}

/**
 * The rarity actually paid for: what the language says, worn down by what the
 * players do. Answering "chat" is never worth much; answering the same obscure
 * word every single run stops being worth much either.
 */
export function rarityScore(entry: WordEntry, usage: WordUsage = NO_USAGE): number {
  const own = 1 / (1 + Math.max(0, usage.own) * 0.6)
  const crowd = 1 - clamp(usage.globalShare, 0, 0.8)
  return clamp((1 - notoriety(entry)) * own * crowd, 0, 1)
}

export function tierOf(rarity: number): RarityTier {
  if (rarity < 0.25) return 'courant'
  if (rarity < 0.5) return 'peu commun'
  if (rarity < 0.75) return 'rare'
  return 'très rare'
}

export function comboMultiplier(combo: number): number {
  return 1 + Math.min(Math.max(0, combo), MAX_COMBO_STEPS) * 0.1
}

/** `combo` is the number of valid answers already chained before this one. */
export function pointsFor(entry: WordEntry, usage: WordUsage, combo: number): number {
  return Math.round((BASE_POINTS + RARITY_POINTS * rarityScore(entry, usage)) * comboMultiplier(combo))
}
