import type { PlayableLetter } from './letters'
import {
  COMPLICATION_BOOST,
  DODGE_PENALTY_SECONDS,
  HUSH_SECONDS,
  POWER_CHARGES,
  type PowerId,
  type Spell,
} from './powers'
import {
  NO_USAGE,
  pointsFor,
  pointsForApproximate,
  rarityScore,
  tierOf,
  type RarityTier,
  type WordUsage,
} from './rarity'
import { pickWeighted, streamFor, type Rng } from './rng'
import { compactWord, initialOf, normalizeWord } from './text'
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
  /** The dictionary corrected a slip to accept this answer. */
  approximate: boolean
  /** Letters it corrected: 0, 1, or 2 under Dyslexie. */
  edits: number
  /** Put in the field by the Joker: paid the flat rate, like a corrected answer. */
  joker: boolean
  /** Complication's multiplier, 1 when it did not apply. */
  boost: number
}

/** A word the run kept, with the seconds its prompt stayed on screen before it came. */
export interface KeptWord extends FoundWord {
  seconds: number
}

export type VerdictKind = 'empty' | 'unknown' | 'wrong-letter' | 'already' | 'accepted' | 'spell'

export interface Verdict {
  kind: VerdictKind
  /** Set when the word is accepted, so the interface can show the reward before the player validates. */
  found: FoundWord | null
  /** Set when the field holds a power's word (« Joker », « chut ») that validating would cast. */
  spell?: Spell
}

/** Everything the rules need from the outside: the dictionary and what players do with it. */
export interface Judge {
  /** `tolerance`: how many letters a slip may be off, 1 unless a power says otherwise. */
  find(categoryId: string, word: string, tolerance?: number): WordMatch | null
  usage(word: string): WordUsage
  /** Letters that category can honestly be prompted on. */
  letters(categoryId: string): readonly string[]
  /** The letters of the dictionary's language and how often each is drawn. */
  deck: readonly PlayableLetter[]
  /** What casts each spell in the dictionary's language, compact (`compactWord`). */
  spells?: Readonly<Record<Spell, readonly string[]>>
  /** The best-known base word on that letter not yet played (by key): what the Joker writes. */
  common?(categoryId: string, letter: string, played: readonly string[]): string | null
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
  /** The powers the player brought in. */
  powers: readonly PowerId[]
  /** Uses left of the powers that have a count (`POWER_CHARGES`). */
  charges: Readonly<Partial<Record<PowerId, number>>>
  /** The word the Joker wrote for the current prompt, by key, until the prompt changes. */
  joker: { key: string; display: string } | null
  /** Silence holds the clock from this run time, until a word is validated or `HUSH_SECONDS` pass. */
  hush: { at: number } | null
  /** Seconds a finished Silence held the clock. */
  heldSeconds: number
  /** Letters changed by Magie: each one reads from its own stream. */
  rerolls: number
  /** Under Professeur, what each skipped prompt could have been answered with. */
  missed: readonly MissedWord[]
}

/** A skipped prompt and the best-known word it still had. */
export interface MissedWord {
  prompt: Prompt
  display: string
}

/** A letter the category can be prompted on, preferring those the lock leaves open and not `except`. */
function drawLetter(rng: Rng, categoryId: string, judge: Judge, locked: ReadonlySet<string>, except?: string): string {
  const honest = judge.letters(categoryId)
  const open = honest.filter((letter) => !locked.has(promptKey({ categoryId, letter })))
  const tiers = [open.filter((letter) => letter !== except), honest.filter((letter) => letter !== except), open, honest]
  const available = new Set(tiers.find((tier) => tier.length > 0) ?? [])
  const deck = judge.deck.filter((entry) => available.has(entry.letter))
  return pickWeighted(rng, deck, (entry) => entry.weight)?.letter ?? deck[0]?.letter ?? 'A'
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

  return { categoryId, letter: drawLetter(rng, categoryId, judge, locked) }
}

/**
 * The prompt the run will deal next — drawn from the seed and the count alone,
 * so Divination can show it and `advance` is bound to deal that very one.
 */
export function nextPrompt(run: Run, judge: Judge): Prompt {
  return drawPrompt(run.seed, run.drawn, run.categoryIds, judge, run.avoid, run.prompt.categoryId)
}

/** The run moved on to a new prompt: it is drawn, counted, and remembered for the next run. */
function advance(run: Run, judge: Judge): Pick<Run, 'prompt' | 'drawn' | 'dealt' | 'joker'> {
  const prompt = nextPrompt(run, judge)
  const key = promptKey(prompt)
  return {
    prompt,
    drawn: run.drawn + 1,
    dealt: run.dealt.includes(key) ? run.dealt : [...run.dealt, key],
    joker: null,
  }
}

/** A validated word or a skip ends Silence: the clock takes back from `at`. */
function release(run: Run, at: number): Pick<Run, 'hush' | 'heldSeconds'> {
  if (!run.hush) return { hush: null, heldSeconds: run.heldSeconds }
  return { hush: null, heldSeconds: run.heldSeconds + Math.min(HUSH_SECONDS, Math.max(0, at - run.hush.at)) }
}

export function hasPower(run: Run, power: PowerId): boolean {
  return run.powers.includes(power)
}

export function chargesLeft(run: Run, power: PowerId): number {
  return hasPower(run, power) ? (run.charges[power] ?? 0) : 0
}

function spend(run: Run, power: PowerId): Run['charges'] {
  return { ...run.charges, [power]: Math.max(0, (run.charges[power] ?? 0) - 1) }
}

export interface CreateRunInput {
  seed: number
  categoryIds: readonly string[]
  /** The prompts the previous run dealt. */
  avoid?: readonly string[]
  powers?: readonly PowerId[]
}

export function createRun({ seed, categoryIds, avoid = [], powers = [] }: CreateRunInput, judge: Judge): Run {
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
    powers,
    charges: Object.fromEntries(powers.flatMap((power) => (POWER_CHARGES[power] ? [[power, POWER_CHARGES[power]]] : []))),
    joker: null,
    hush: null,
    heldSeconds: 0,
    rerolls: 0,
    missed: [],
  }
}

/** The spell the field holds, if the run carries that power and still has a use of it. */
function spellOf(run: Run, raw: string, judge: Judge): Spell | undefined {
  const typed = compactWord(raw)
  if (typed === '' || !judge.spells) return undefined
  for (const spell of ['joker', 'hush'] as const) {
    if (chargesLeft(run, spell) <= 0 || !judge.spells[spell].includes(typed)) continue
    // A Joker with no word left to write would spend itself on nothing.
    if (spell === 'joker' && !judge.common?.(run.prompt.categoryId, run.prompt.letter, run.used)) continue
    return spell
  }
  return undefined
}

/**
 * Judges an answer without playing it, which is what the field does on every
 * keystroke. `submit` is the same verdict, kept. A real word always wins over
 * a spell: « Chut » stays an answer wherever a category knows it.
 */
export function inspect(run: Run, raw: string, judge: Judge): Verdict {
  const word = normalizeWord(raw)
  if (word === '') return { kind: 'empty', found: null }
  const verdict = judgeWord(run, word, judge)
  // Only what the category does not know can be a spell: « chut » already played stays « déjà donné ».
  if (verdict.kind !== 'unknown' && verdict.kind !== 'wrong-letter') return verdict
  const spell = spellOf(run, raw, judge)
  return spell ? { kind: 'spell', found: null, spell } : verdict
}

function judgeWord(run: Run, word: string, judge: Judge): Verdict {
  if (initialOf(word) !== run.prompt.letter) return { kind: 'wrong-letter', found: null }

  const match = judge.find(run.prompt.categoryId, word, hasPower(run, 'dyslexia') ? 2 : 1)
  if (!match) return { kind: 'unknown', found: null }
  // Judged on the canonical form: "chats" after "chat" is the same answer.
  if (run.used.includes(match.entry.key)) return { kind: 'already', found: null }

  const joker = run.joker?.key === match.entry.key
  // The bonus rewards knowing a word: not almost spelling it, nor being handed it.
  const flat = match.approximate || joker
  const usage = judge.usage(match.entry.key) ?? NO_USAGE
  const rarity = flat ? 0 : rarityScore(match.entry, usage)
  const tier = tierOf(rarity)
  const boost = !flat && hasPower(run, 'complication') ? (COMPLICATION_BOOST[tier] ?? 1) : 1
  return {
    kind: 'accepted',
    found: {
      prompt: run.prompt,
      word: match.entry.key,
      display: match.entry.display,
      points: flat ? pointsForApproximate(run.combo) : pointsFor(match.entry, usage, run.combo, boost),
      rarity,
      tier,
      approximate: match.approximate,
      edits: match.edits,
      joker,
      boost,
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
  if (verdict.kind === 'spell' && verdict.spell) return { run: cast(run, verdict.spell, judge, at), verdict }
  if (verdict.kind !== 'accepted' || !verdict.found) return { run, verdict }

  const combo = run.combo + 1
  return {
    verdict,
    run: {
      ...run,
      ...advance(run, judge),
      ...release(run, at),
      found: [...run.found, { ...verdict.found, seconds: Math.max(0, at - run.promptAt) }],
      promptAt: at,
      used: [...run.used, verdict.found.word],
      combo,
      bestCombo: Math.max(run.bestCombo, combo),
      score: run.score + verdict.found.points,
    },
  }
}

/**
 * The Joker writes the best-known word left on the prompt, which the player
 * still has to validate; Silence holds the clock. Both are spent on casting.
 */
function cast(run: Run, spell: Spell, judge: Judge, at: number): Run {
  if (spell === 'hush') return run.hush ? run : { ...run, hush: { at }, charges: spend(run, 'hush') }

  const display = judge.common?.(run.prompt.categoryId, run.prompt.letter, run.used)
  const match = display ? judge.find(run.prompt.categoryId, display, 0) : null
  if (!display || !match) return run
  return { ...run, joker: { key: match.entry.key, display }, charges: spend(run, 'joker') }
}

export function skipPenalty(run: Run): number {
  return hasPower(run, 'dodge') ? DODGE_PENALTY_SECONDS : SKIP_PENALTY_SECONDS
}

/**
 * Professeur: the word the player could have given on a prompt they skip —
 * the best-known one left, read before the run moves on.
 */
export function whisper(run: Run, judge: Judge): MissedWord | null {
  if (!hasPower(run, 'professor')) return null
  const display = judge.common?.(run.prompt.categoryId, run.prompt.letter, run.used)
  return display ? { prompt: run.prompt, display } : null
}

export function skip(run: Run, judge: Judge, at = run.promptAt): Run {
  const missed = whisper(run, judge)
  return {
    ...run,
    ...(missed && { missed: [...run.missed, missed] }),
    ...advance(run, judge),
    ...release(run, at),
    promptAt: at,
    skips: run.skips + 1,
    penaltySeconds: run.penaltySeconds + skipPenalty(run),
    combo: 0,
  }
}

/**
 * Magie: a new letter for the same category, never the one it replaces while
 * the category has another. The series is kept — the player did not give up.
 */
export function reroll(run: Run, judge: Judge, at = run.promptAt): Run {
  if (chargesLeft(run, 'magic') <= 0) return run
  const rng = streamFor((run.seed ^ 0x6d616769) >>> 0, run.drawn * 8 + run.rerolls)
  const letter = drawLetter(rng, run.prompt.categoryId, judge, new Set(run.avoid), run.prompt.letter)
  if (letter === run.prompt.letter) return run
  const prompt = { categoryId: run.prompt.categoryId, letter }
  const key = promptKey(prompt)
  return {
    ...run,
    prompt,
    dealt: run.dealt.includes(key) ? run.dealt : [...run.dealt, key],
    promptAt: at,
    joker: null,
    rerolls: run.rerolls + 1,
    charges: spend(run, 'magic'),
  }
}

/** Seconds Silence has held the clock so far, the one under way included. */
export function heldSeconds(run: Run, elapsedSeconds: number): number {
  const current = run.hush ? Math.min(HUSH_SECONDS, Math.max(0, elapsedSeconds - run.hush.at)) : 0
  return run.heldSeconds + current
}

/** True while Silence holds the clock: cast, not yet released, not yet run out. */
export function isHushed(run: Run, elapsedSeconds: number): boolean {
  return run.hush !== null && elapsedSeconds - run.hush.at < HUSH_SECONDS
}

export function remainingSeconds(run: Run, elapsedSeconds: number): number {
  return Math.max(0, RUN_SECONDS - elapsedSeconds - run.penaltySeconds + heldSeconds(run, elapsedSeconds))
}
