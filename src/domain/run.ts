import type { PlayableLetter } from './letters'
import {
  NO_USAGE,
  pointsFor,
  pointsForApproximate,
  rarityScore,
  tierOf,
  type RarityTier,
  type WordUsage,
} from './rarity'
import { pickWeighted, streamFor } from './rng'
import { initialOf, normalizeWord } from './text'
import type { WordMatch } from './words'

export const RUN_SECONDS = 60
/** A skip costs clock, not points: the player always leaves with what they found. */
export const SKIP_PENALTY_SECONDS = 5
/** Below this, a letter is not offered for a category — the prompt must be answerable. */
export const MIN_WORDS_PER_PROMPT = 12

export interface Prompt {
  categoryId: string
  letter: string
}

/** A prompt as a single string, which is how a run remembers what it drew. */
export function promptKey(prompt: Prompt): string {
  return `${prompt.categoryId}:${prompt.letter}`
}

export interface FoundWord {
  prompt: Prompt
  /** Canonical form, which is what uniqueness and usage are counted on. */
  word: string
  display: string
  points: number
  rarity: number
  tier: RarityTier
  /** The dictionary corrected a one-letter slip to accept this answer. */
  approximate: boolean
}

/** A word the run kept, with the seconds its prompt stayed on screen before it came. */
export interface KeptWord extends FoundWord {
  seconds: number
}

export type VerdictKind = 'empty' | 'unknown' | 'wrong-letter' | 'already' | 'accepted'

export interface Verdict {
  kind: VerdictKind
  /** Set when the word is accepted, so the interface can show the reward before the player validates. */
  found: FoundWord | null
}

/** Everything the rules need from the outside: the dictionary and what players do with it. */
export interface Judge {
  find(categoryId: string, word: string): WordMatch | null
  usage(word: string): WordUsage
  /** Letters that category can honestly be prompted on. */
  letters(categoryId: string): readonly string[]
  /** The letters of the dictionary's language and how often each is drawn. */
  deck: readonly PlayableLetter[]
}

export interface Run {
  seed: number
  categoryIds: readonly string[]
  prompt: Prompt
  /** How many prompts have been drawn, which also seeds the next draw. */
  drawn: number
  /** The previous run's prompts: this one does not deal them again. */
  avoid: readonly string[]
  /** Every prompt this run dealt, skipped ones included — the next run's `avoid`. */
  dealt: readonly string[]
  found: readonly KeptWord[]
  used: readonly string[]
  /** The run clock, in seconds, when the current prompt appeared. */
  promptAt: number
  skips: number
  penaltySeconds: number
  combo: number
  bestCombo: number
  score: number
}

/**
 * A prompt the previous run dealt is off the table for this one, so two runs
 * in a row never open on the same pair. Within a run a pair may come back:
 * it is the next run that locks it. When a category has nothing else left,
 * the lock gives way rather than leaving it undrawable.
 */
function drawPrompt(seed: number, drawn: number, categoryIds: readonly string[], judge: Judge, avoid: readonly string[], skipCategory?: string): Prompt {
  const rng = streamFor(seed, drawn)
  const locked = new Set(avoid)
  const open = (id: string) => judge.letters(id).filter((letter) => !locked.has(promptKey({ categoryId: id, letter })))
  const playable = categoryIds.filter((id) => judge.letters(id).length > 0)
  const fresh = playable.filter((id) => open(id).length > 0)
  const preferred = fresh.filter((id) => id !== skipCategory)
  const others = playable.filter((id) => id !== skipCategory)
  const candidates = preferred.length > 0 ? preferred : others.length > 0 ? others : playable
  const categoryId = candidates[Math.floor(rng.next() * candidates.length)] ?? categoryIds[0] ?? ''

  const unlocked = open(categoryId)
  const available = new Set(unlocked.length > 0 ? unlocked : judge.letters(categoryId))
  const deck = judge.deck.filter((entry) => available.has(entry.letter))
  const letter = pickWeighted(rng, deck, (entry) => entry.weight)?.letter ?? deck[0]?.letter ?? 'A'

  return { categoryId, letter }
}

/** The run moved on to a new prompt: it is drawn, counted, and remembered for the next run. */
function advance(run: Run, judge: Judge): Pick<Run, 'prompt' | 'drawn' | 'dealt'> {
  const prompt = drawPrompt(run.seed, run.drawn, run.categoryIds, judge, run.avoid, run.prompt.categoryId)
  const key = promptKey(prompt)
  return {
    prompt,
    drawn: run.drawn + 1,
    dealt: run.dealt.includes(key) ? run.dealt : [...run.dealt, key],
  }
}

export interface CreateRunInput {
  seed: number
  categoryIds: readonly string[]
  /** The prompts the previous run dealt. */
  avoid?: readonly string[]
}

export function createRun({ seed, categoryIds, avoid = [] }: CreateRunInput, judge: Judge): Run {
  const prompt = drawPrompt(seed, 0, categoryIds, judge, avoid)
  return {
    seed,
    categoryIds,
    prompt,
    drawn: 1,
    avoid,
    dealt: [promptKey(prompt)],
    found: [],
    used: [],
    promptAt: 0,
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
  if (initialOf(word) !== run.prompt.letter) return { kind: 'wrong-letter', found: null }

  const match = judge.find(run.prompt.categoryId, word)
  if (!match) return { kind: 'unknown', found: null }
  // Judged on the canonical form: "chats" after "chat" is the same answer.
  if (run.used.includes(match.entry.key)) return { kind: 'already', found: null }

  const usage = judge.usage(match.entry.key) ?? NO_USAGE
  const rarity = match.approximate ? 0 : rarityScore(match.entry, usage)
  return {
    kind: 'accepted',
    found: {
      prompt: run.prompt,
      word: match.entry.key,
      display: match.entry.display,
      points: match.approximate ? pointsForApproximate(run.combo) : pointsFor(match.entry, usage, run.combo),
      rarity,
      tier: tierOf(rarity),
      approximate: match.approximate,
    },
  }
}

export interface Played {
  run: Run
  verdict: Verdict
}

/** `at` is the run clock in seconds, read by the interface: the rules keep no time of their own. */
export function submit(run: Run, raw: string, judge: Judge, at = run.promptAt): Played {
  const verdict = inspect(run, raw, judge)
  if (verdict.kind !== 'accepted' || !verdict.found) return { run, verdict }

  const combo = run.combo + 1
  return {
    verdict,
    run: {
      ...run,
      ...advance(run, judge),
      found: [...run.found, { ...verdict.found, seconds: Math.max(0, at - run.promptAt) }],
      promptAt: at,
      used: [...run.used, verdict.found.word],
      combo,
      bestCombo: Math.max(run.bestCombo, combo),
      score: run.score + verdict.found.points,
    },
  }
}

export function skip(run: Run, judge: Judge, at = run.promptAt): Run {
  return {
    ...run,
    ...advance(run, judge),
    promptAt: at,
    skips: run.skips + 1,
    penaltySeconds: run.penaltySeconds + SKIP_PENALTY_SECONDS,
    combo: 0,
  }
}

export function remainingSeconds(run: Run, elapsedSeconds: number): number {
  return Math.max(0, RUN_SECONDS - elapsedSeconds - run.penaltySeconds)
}
