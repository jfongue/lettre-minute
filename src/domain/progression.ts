import { unlockedAt, type CategoryMeta } from './catalogue'

/** A run of 300 points is worth 300 XP — the first levels go by in a few runs. */
export const XP_PER_POINT = 1
/** Paid once a word the player proposed enters the dictionary. */
export const SUBMISSION_REWARD_XP = 150

/** Cumulative XP needed to reach a level. Quadratic: each level costs a little more than the last. */
export function xpForLevel(level: number): number {
  const steps = Math.max(0, level - 1)
  return 300 * steps + 50 * steps * steps
}

export function levelFor(xp: number): number {
  let level = 1
  while (xp >= xpForLevel(level + 1)) level++
  return level
}

export interface LevelProgress {
  level: number
  /** XP earned inside the current level, and what the next one costs. */
  into: number
  span: number
  ratio: number
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFor(xp)
  const floor = xpForLevel(level)
  const span = xpForLevel(level + 1) - floor
  const into = xp - floor
  return { level, into, span, ratio: span > 0 ? into / span : 1 }
}

export interface Profile {
  xp: number
  runs: number
  bestScore: number
  wordsFound: number
  bestCombo: number
  /** Normalized word → times answered, all runs. Feeds the rarity decay. */
  usage: Readonly<Record<string, number>>
}

export const NEW_PROFILE: Profile = { xp: 0, runs: 0, bestScore: 0, wordsFound: 0, bestCombo: 0, usage: {} }

export interface RunOutcome {
  score: number
  words: readonly string[]
  bestCombo: number
}

export function applyRun(profile: Profile, outcome: RunOutcome): Profile {
  const usage = { ...profile.usage }
  for (const word of outcome.words) usage[word] = (usage[word] ?? 0) + 1

  return {
    xp: profile.xp + Math.round(outcome.score * XP_PER_POINT),
    runs: profile.runs + 1,
    bestScore: Math.max(profile.bestScore, outcome.score),
    wordsFound: profile.wordsFound + outcome.words.length,
    bestCombo: Math.max(profile.bestCombo, outcome.bestCombo),
    usage,
  }
}

export function rewardSubmission(profile: Profile): Profile {
  return { ...profile, xp: profile.xp + SUBMISSION_REWARD_XP }
}

/** Categories that opened between two levels — what the end screen announces. */
export function newlyUnlocked(before: number, after: number): CategoryMeta[] {
  const opened: CategoryMeta[] = []
  for (let level = before + 1; level <= after; level++) opened.push(...unlockedAt(level))
  return opened
}
