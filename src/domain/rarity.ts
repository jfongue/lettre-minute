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
// Three starter categories hold the easiest letters of the game: a newcomer's
// first runs used to pay rarity and long chains in full and post scores a
// seasoned player takes weeks to reach. Both bonuses grow back with each
// category, whole at five.
const NOVICE_CATEGORIES = 5
const NOVICE_STARTERS = 2

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * How well known a word is, on 0..1 — its rank inside its own category, set
 * when the dictionary is read. Going through this function rather than the
 * field keeps the clamp in one place.
 */
/**
 * Where a word the players brought in starts when nothing describes it: no
 * article, no wordfreq count. Obscure by construction, it would otherwise pay
 * as very rare the word its proposer just asked for. A word the sources do
 * describe takes its notoriety from them (`communityNotoriety`).
 */
export const COMMUNITY_NOTORIETY = 0.6

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

/** `weight`, the share of the chain's bonus paid (`bonusWeight`). */
export function comboMultiplier(combo: number, weight = 1): number {
  return 1 + Math.min(Math.max(0, combo), MAX_COMBO_STEPS) * 0.1 * weight
}

/** The share of the rarity and chain bonuses a solo run pays, from the number of categories it deals. */
export function bonusWeight(categoryCount: number): number {
  return clamp((categoryCount - NOVICE_STARTERS) / (NOVICE_CATEGORIES - NOVICE_STARTERS), 0, 1)
}

/**
 * `combo` is the number of valid answers already chained before this one;
 * `boost`, a power's multiplier; `weight`, the share of the rarity and chain bonuses paid.
 */
export function pointsFor(entry: WordEntry, usage: WordUsage, combo: number, boost = 1, weight = 1): number {
  return Math.round((BASE_POINTS + RARITY_POINTS * weight * rarityScore(entry, usage)) * comboMultiplier(combo, weight) * boost)
}

/**
 * An answer the dictionary had to correct is paid the flat rate, however rare
 * the word it corrected to: the bonus rewards knowing a word, not almost
 * spelling it. The chain is not broken — the answer counts.
 */
export function pointsForApproximate(combo: number, weight = 1): number {
  return Math.round(BASE_POINTS * comboMultiplier(combo, weight))
}
