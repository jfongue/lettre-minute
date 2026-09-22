import { PLAYABLE_LETTERS } from './letters'
import { NO_USAGE, pointsFor, rarityScore, tierOf, type RarityTier, type WordUsage } from './rarity'
import { pickWeighted, streamFor } from './rng'
import { initialOf, normalizeWord } from './text'
import type { WordEntry } from './words'

export const RUN_SECONDS = 94
/** A skip costs clock, not points: the player always leaves with what they found. */
export const SKIP_PENALTY_SECONDS = 5
/** Below this, a letter is not offered for a category — the prompt must be answerable. */
export const MIN_WORDS_PER_PROMPT = 12

export interface Prompt {
  categoryId: string
  letter: string
}

export interface FoundWord {
  prompt: Prompt
  /** Normalized form, which is what uniqueness and usage are counted on. */
  word: string
  display: string
  points: number
  rarity: number
  tier: RarityTier
}

export type VerdictKind = 'empty' | 'unknown' | 'wrong-letter' | 'already' | 'accepted'

export interface Verdict {
  kind: VerdictKind
  /** Set when the word is accepted, so the interface can show the reward before the player validates. */
  found: FoundWord | null
}

/** Everything the rules need from the outside: the dictionary and what players do with it. */
export interface Judge {
  find(categoryId: string, word: string): WordEntry | null
  usage(word: string): WordUsage
  /** Letters that category can honestly be prompted on. */
  letters(categoryId: string): readonly string[]
}

export interface Run {
  seed: number
  categoryIds: readonly string[]
  prompt: Prompt
  /** How many prompts have been drawn, which also seeds the next draw. */
  drawn: number
  found: readonly FoundWord[]
  used: readonly string[]
  skips: number
  penaltySeconds: number
  combo: number
  bestCombo: number
  score: number
}

function drawPrompt(seed: number, drawn: number, categoryIds: readonly string[], judge: Judge, avoid?: string): Prompt {
  const rng = streamFor(seed, drawn)
  const pool = categoryIds.filter((id) => id !== avoid && judge.letters(id).length > 0)
  const fallback = categoryIds.filter((id) => judge.letters(id).length > 0)
  const candidates = pool.length > 0 ? pool : fallback
  const categoryId = candidates[Math.floor(rng.next() * candidates.length)] ?? categoryIds[0] ?? ''

  const available = new Set(judge.letters(categoryId))
  const deck = PLAYABLE_LETTERS.filter((entry) => available.has(entry.letter))
  const letter = pickWeighted(rng, deck, (entry) => entry.weight)?.letter ?? deck[0]?.letter ?? 'A'

  return { categoryId, letter }
}

export interface CreateRunInput {
  seed: number
  categoryIds: readonly string[]
}

export function createRun({ seed, categoryIds }: CreateRunInput, judge: Judge): Run {
  return {
    seed,
    categoryIds,
    prompt: drawPrompt(seed, 0, categoryIds, judge),
    drawn: 1,
    found: [],
    used: [],
    skips: 0,
    penaltySeconds: 0,
    combo: 0,
    bestCombo: 0,
    score: 0,
  }
}

/**
 * Judges an answer without playing it, which is what the field does on every
 * keystroke. `submit` is the same verdict, kept.
 */
export function inspect(run: Run, raw: string, judge: Judge): Verdict {
  const word = normalizeWord(raw)
  if (word === '') return { kind: 'empty', found: null }
  if (run.used.includes(word)) return { kind: 'already', found: null }
  if (initialOf(word) !== run.prompt.letter) return { kind: 'wrong-letter', found: null }

  const entry = judge.find(run.prompt.categoryId, word)
  if (!entry) return { kind: 'unknown', found: null }

  const usage = judge.usage(word) ?? NO_USAGE
  const rarity = rarityScore(entry, usage)
  return {
    kind: 'accepted',
    found: {
      prompt: run.prompt,
      word,
      display: entry.display,
      points: pointsFor(entry, usage, run.combo),
      rarity,
      tier: tierOf(rarity),
    },
  }
}

export interface Played {
  run: Run
  verdict: Verdict
}

export function submit(run: Run, raw: string, judge: Judge): Played {
  const verdict = inspect(run, raw, judge)
  if (verdict.kind !== 'accepted' || !verdict.found) return { run, verdict }

  const combo = run.combo + 1
  return {
    verdict,
    run: {
      ...run,
      prompt: drawPrompt(run.seed, run.drawn, run.categoryIds, judge, run.prompt.categoryId),
      drawn: run.drawn + 1,
      found: [...run.found, verdict.found],
      used: [...run.used, verdict.found.word],
      combo,
      bestCombo: Math.max(run.bestCombo, combo),
      score: run.score + verdict.found.points,
    },
  }
}

export function skip(run: Run, judge: Judge): Run {
  return {
    ...run,
    prompt: drawPrompt(run.seed, run.drawn, run.categoryIds, judge, run.prompt.categoryId),
    drawn: run.drawn + 1,
    skips: run.skips + 1,
    penaltySeconds: run.penaltySeconds + SKIP_PENALTY_SECONDS,
    combo: 0,
  }
}

export function remainingSeconds(run: Run, elapsedSeconds: number): number {
  return Math.max(0, RUN_SECONDS - elapsedSeconds - run.penaltySeconds)
}
