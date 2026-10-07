import type { ChallengeWord } from './challenge'
import type { RarityTier } from './rarity'
import { RUN_SECONDS } from './run'
import { MAX_CATEGORIES_PER_RUN, dealLineup } from './unlocks'

/**
 * The daily puzzle, as a Reddit post plays it: one seed per calendar day, the
 * same five categories for every reader, no powers. Everything here follows
 * the day and the embedded dictionaries alone — never the crowd, which would
 * deal a reader in the morning another game than one at night.
 */

/** The first daily, numbered #1: the posts count from it. */
export const DAILY_EPOCH = '2026-10-08'

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** The UTC day an instant falls on, as `YYYY-MM-DD`: the posts turn over at midnight UTC for everyone. */
export function dayOf(at: number): string {
  return new Date(at).toISOString().slice(0, 10)
}

export function isDay(value: unknown): value is string {
  return typeof value === 'string' && DAY_PATTERN.test(value) && dayOf(Date.parse(value)) === value
}

/** The number a day's post carries, #1 on `DAILY_EPOCH`. */
export function dailyNumber(day: string): number {
  return Math.round((Date.parse(day) - Date.parse(DAILY_EPOCH)) / DAY_MS) + 1
}

/** FNV-1a over the day and its language: a French and an English post of the same day are two games. */
export function dailySeed(day: string, lang: string): number {
  const text = `lettre-minute:${lang}:${day}`
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  return hash >>> 0
}

/**
 * The day's categories, drawn from those the language ships. `available` is
 * sorted first: the order a bundler lists its files in must not change the game.
 */
export function dailyLineup(day: string, lang: string, available: readonly string[]): string[] {
  return [...dealLineup(dailySeed(day, lang), [...available].sort()).dealt].slice(0, MAX_CATEGORIES_PER_RUN)
}

/** One square per word, by tier: the result a reader shares without giving a word away. */
export const TIER_SQUARES: Readonly<Record<RarityTier, string>> = {
  courant: '🟨',
  'peu commun': '🟩',
  rare: '🟦',
  'très rare': '🟪',
}
/** A word the dictionary had to correct: found, but paid the flat rate. */
export const SLIP_SQUARE = '⬜'
const SQUARES_PER_ROW = 8

export function tierGrid(words: readonly Pick<ChallengeWord, 'tier' | 'approximate'>[]): string {
  const squares = words.map((word) => (word.approximate ? SLIP_SQUARE : TIER_SQUARES[word.tier]))
  const rows: string[] = []
  for (let at = 0; at < squares.length; at += SQUARES_PER_ROW) rows.push(squares.slice(at, at + SQUARES_PER_ROW).join(''))
  return rows.join('\n')
}

/** No word pays more: the rarest word on the longest chain, `(10 + 20) × 1.9`. */
export const MAX_WORD_POINTS = 57
/** Far above what anyone types in a minute: past it, the result was not typed. */
export const MAX_DAILY_WORDS = 80
/** The clock may stop a little late on a slow phone: a word validated just after 60 s is honest. */
const LATE_SECONDS = 2
const TIERS: readonly string[] = Object.keys(TIER_SQUARES)

/**
 * What the server can check of a result without the dictionaries: words on
 * the day's categories, each paid within the scale, in clock order, none
 * twice, adding up to the score. A determined cheat passes it; a forged
 * request or a broken client does not.
 */
export function plausibleDaily(score: number, words: readonly ChallengeWord[], lineup: readonly string[]): boolean {
  if (!Number.isInteger(score) || score < 0 || words.length > MAX_DAILY_WORDS) return false
  const seen = new Set<string>()
  let clock = 0
  let total = 0
  for (const word of words) {
    if (!lineup.includes(word.categoryId) || typeof word.key !== 'string' || word.key === '') return false
    if (typeof word.letter !== 'string' || [...word.letter].length !== 1 || !TIERS.includes(word.tier)) return false
    if (!Number.isInteger(word.points) || word.points < 1 || word.points > MAX_WORD_POINTS) return false
    if (!(word.at >= clock && word.at <= RUN_SECONDS + LATE_SECONDS)) return false
    const id = `${word.categoryId}:${word.key}`
    if (seen.has(id)) return false
    seen.add(id)
    clock = word.at
    total += word.points
  }
  return total === score
}
