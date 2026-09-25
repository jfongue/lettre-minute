/** A run of 300 points is worth 300 XP — the first levels go by in a few runs. */
export const XP_PER_POINT = 1
/** Paid once a word the player proposed enters the dictionary. */
export const SUBMISSION_REWARD_XP = 150

/** What the first level up costs: half a decent run, so a newcomer levels up on their first try. */
export const FIRST_LEVEL_XP = 150

/**
 * Cumulative XP needed to reach a level. The first costs `FIRST_LEVEL_XP`,
 * then each one 50 more than the last, from 300: level 10 comes within a
 * couple of dozen modest runs.
 */
export function xpForLevel(level: number): number {
  const steps = Math.max(0, level - 1)
  if (steps === 0) return 0
  return 25 * steps * steps + 225 * steps - (250 - FIRST_LEVEL_XP)
}

/** Beating one's record under this score pays `RECORD_BONUS_XP` on top: past it, the runs pay enough. */
export const RECORD_BONUS_BELOW = 250
export const RECORD_BONUS_XP = 100

/** The bonus a run's score earns by beating the player's record, for a player still scoring low. */
export function recordBonus(profile: Profile, score: number): number {
  return profile.bestScore > 0 && score > profile.bestScore && score < RECORD_BONUS_BELOW ? RECORD_BONUS_XP : 0
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
  /** Categories picked at level ups, on top of the starters. */
  unlocked: readonly string[]
  /**
   * Categories owned without a pick, such as a new wave's gift to a player
   * who had already unlocked everything else — kept apart from `unlocked` so
   * `picksOwed` doesn't count one as a level-up pick spent.
   */
  gifted: readonly string[]
  /** The categories on the table while a pick is owed; empty otherwise. */
  offer: readonly string[]
  /** The previous offer, which the next one avoids repeating. */
  lastOffer: readonly string[]
  /** The prompts the last run dealt, locked for the next one (`promptKey`). */
  lastPrompts: readonly string[]
  /** Powers picked at level ups (`PowerId`), in the order they were made. */
  powers: readonly string[]
  /** The two powers on the table while a power pick is owed; empty otherwise. */
  powerOffer: readonly string[]
  /** The previous power offer, which the next one avoids repeating. */
  lastPowerOffer: readonly string[]
  /** The powers the player takes into a run, at most two. */
  equipped: readonly string[]
  /** `runs` when the game last asked for support (`supportDue`); 0 before it ever did. */
  supportAskedAt: number
}

export const NEW_PROFILE: Profile = {
  xp: 0,
  runs: 0,
  bestScore: 0,
  wordsFound: 0,
  bestCombo: 0,
  usage: {},
  unlocked: [],
  gifted: [],
  offer: [],
  lastOffer: [],
  lastPrompts: [],
  powers: [],
  powerOffer: [],
  lastPowerOffer: [],
  equipped: [],
  supportAskedAt: 0,
}

export interface RunOutcome {
  score: number
  words: readonly string[]
  bestCombo: number
  /** Every prompt the run dealt, which the next run will not deal again. */
  prompts?: readonly string[]
}

/**
 * How many times a word was counted, read as an own property only: « constructor »
 * is a Spanish job, and `{}['constructor']` is Object itself — the score turned NaN.
 * A count already corrupted in a saved profile reads as zero.
 */
export function countOf(counts: Readonly<Record<string, number>>, word: string): number {
  const value = Object.hasOwn(counts, word) ? counts[word] : 0
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function applyRun(profile: Profile, outcome: RunOutcome): Profile {
  const usage = { ...profile.usage }
  for (const word of outcome.words) usage[word] = countOf(usage, word) + 1

  return {
    ...profile,
    xp: profile.xp + Math.round(outcome.score * XP_PER_POINT) + recordBonus(profile, outcome.score),
    runs: profile.runs + 1,
    bestScore: Math.max(profile.bestScore, outcome.score),
    wordsFound: profile.wordsFound + outcome.words.length,
    bestCombo: Math.max(profile.bestCombo, outcome.bestCombo),
    usage,
    lastPrompts: outcome.prompts ?? profile.lastPrompts,
  }
}

export function rewardSubmission(profile: Profile): Profile {
  return { ...profile, xp: profile.xp + SUBMISSION_REWARD_XP }
}
