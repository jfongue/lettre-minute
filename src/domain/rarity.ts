import type { WordEntry } from './words'

export interface WordUsage {
  /** Times this player has already answered this word in past runs. */
  own: number
  /** Share of recent runs, all players, where the word came up — 0 when unknown. */
  globalShare: number
}

export const NO_USAGE: WordUsage = { own: 0, globalShare: 0 }

export type RarityTier = 'courant' | 'peu commun' | 'rare' | 'très rare'

// Sized so that a modest run lands near 100 and a huge one near 1 000: about
// thirty words, most of them rare, on a long chain.
const BASE_POINTS = 10
const RARITY_POINTS = 20
const MAX_COMBO_STEPS = 9

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * How well known a word is, on 0..1 — its rank inside its own category, set
 * when the dictionary is read. Going through this function rather than the
 * field keeps the clamp in one place.
 */
export function notoriety(entry: WordEntry): number {
  return clamp(entry.notoriety, 0, 1)
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

/**
 * An answer the dictionary had to correct is paid the flat rate, however rare
 * the word it corrected to: the bonus rewards knowing a word, not almost
 * spelling it. The chain is not broken — the answer counts.
 */
export function pointsForApproximate(combo: number): number {
  return Math.round(BASE_POINTS * comboMultiplier(combo))
}
