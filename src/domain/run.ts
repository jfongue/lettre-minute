import {
  CHATTER_WORDS,
FLAWLESS_POINTS,
FLAWLESS_STREAK,
LATECOMER_CAP_SECONDS,
LATECOMER_SECONDS,
LATECOMER_THRESHOLD_SECONDS,
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
import { ENDURANCE_TIME_BONUS, MODE_SECONDS, modeEdge, type GameMode } from './modes'
import { pickWeighted, streamFor, type Rng } from './rng'
import { compactWord, finalOf, initialOf, normalizeWord } from './text'
import { knownByLetter, type WordMatch, type WordPack } from './words'

/** La durée du solo, sur laquelle l'écran dessine son disque. */
export const RUN_SECONDS = MODE_SECONDS.solo
/** A skip costs clock, not points: the player always leaves with what they found. */
export const SKIP_PENALTY_SECONDS = 5
/**
 * A pair with fewer known words than this is dealt once per run: the second
 * time, the one or two answers everyone knows may already be spent.
 */
export const THIN_PROMPT_WORDS = 10

export interface Prompt {
  categoryId: string
  letter: string
}

/** A prompt as a single string, which is how a run remembers what it drew. */
export function promptKey(prompt: Prompt): string {
  return `${prompt.categoryId}:${prompt.letter}`
}

/** The prompt a key stands for, as `promptKey` wrote it. */
export function promptOf(key: string): Prompt {
  const cut = key.lastIndexOf(':')
  return { categoryId: key.slice(0, cut), letter: key.slice(cut + 1) }
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
  /** The run clock when it was validated: what a challenge replays its rivals by. */
  at: number
}

export type VerdictKind = 'empty' | 'unknown' | 'wrong-letter' | 'already' | 'accepted' | 'spell'

export interface Verdict {
  kind: VerdictKind
  /** Set when the word is accepted, so the interface can show the reward before the player validates. */
  found: FoundWord | null
  /** Set when the field holds a power's word (« Joker », « chut ») that validating would cast. */
  spell?: Spell
  /** The accepted word ends with « … » and Bavardage has a use: validating keeps the prompt. */
  chatter?: boolean
}

/** Everything the rules need from the outside: the dictionary and what players do with it. */
export interface Judge {
  /** `tolerance`: how many letters a slip may be off, 1 unless a power says otherwise. */
  find(categoryId: string, word: string, tolerance?: number): WordMatch | null
  usage(word: string): WordUsage
  /** Letters that category can honestly be prompted on: at least one of its words there is known. */
  letters(categoryId: string): readonly string[]
  /** How many known words the category has on that letter (`KNOWN_FAME`), which sets how often it is drawn. */
  known(categoryId: string, letter: string): number
  /**
   * What the players' runs said of that pair (`promptPull`): above 1 it comes
   * back more often, below it fades. Left out of a challenge, whose draw must
   * follow the seed and the embedded dictionaries alone.
   */
  pull?(categoryId: string, letter: string): number
  /** What casts each spell in the dictionary's language, compact (`compactWord`). */
  spells?: Readonly<Record<Spell, readonly string[]>>
  /** The best-known base word on that letter not yet played (by key): what the Joker writes. */
  common?(categoryId: string, letter: string, played: readonly string[]): string | null
}

export interface Run {
  seed: number
  /**
   * Le mode de la réserve qui change une règle du solo, « solo » pour la
   * partie ordinaire. Il fixe la durée, la lettre jugée et ce qu'un mot rend.
   */
  mode: GameMode
  /**
   * Le mode retard : la question à laquelle le champ répond vraiment, une
   * derrière celle qui est affichée. Null partout ailleurs.
   */
  answer: Prompt | null
  /** Le retard attend une première validation à vide : c'est elle qui lance le chrono. */
  armed: boolean
  categoryIds: readonly string[]
  prompt: Prompt
  /** How many prompts have been drawn, which also seeds the next draw. */
  drawn: number
  /** The previous run's prompts: this one does not deal them again. */
  avoid: readonly string[]
  /** Every prompt this run dealt, skipped ones included — the next run's `avoid`. */
  dealt: readonly string[]
  /**
   * Every prompt the run moved on from, in order, repeats included: what the
   * crowd's record learns about a pair (`promptOutcomes`). A pair dealt twice
   * would leave no trace in `dealt`, which never names one twice.
   */
  settled: readonly SettledPrompt[]
  /**
   * Played by several on one seed, in a challenge: the draw must not depend
   * on what this player did, so only `seeded` locks a thin pair, never a
   * letter Magie brought.
   */
  shared: boolean
  /** The prompts the seed itself dealt, Magie's letters left out. */
  seeded: readonly string[]
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
  /** Bavardage holds the prompt for this many more words; a skip meanwhile is free. */
  chatter: number
/** Extra seconds earned by Retardataire. */
latecomerSeconds: number
/** Secondes rendues par les mots validés, en endurance. */
bonusSeconds: number
/** Correct words in the current streak that count toward Sans faute. */
flawlessStreak: number
/** A free follow-up skip from Passe-passe is ready after a paid skip. */
freeSkipReady: boolean
}

/** A prompt the run moved on from, and whether it was left empty. */
export interface SettledPrompt {
  prompt: Prompt
  /** The player moved on without writing anything the dictionary knew. */
  passed: boolean
}

/** Le poids d'une lettre au tirage : ses mots connus, en logarithme — jamais zéro tant qu'un seul est connu. */
export function letterWeight(known: number): number {
  return Math.log2(1 + known)
}

/**
 * La part du tirage que chaque lettre reçoit d'une catégorie quand seule la
 * question du dictionnaire compte : le poids de `drawLetter`, sans la foule
 * qui le penche ni le verrou de la partie précédente. L'écran des mots la
 * compare à ce que le tirage a réellement donné.
 */
export function letterShares(pack: WordPack): Map<string, number> {
  const weights = new Map([...knownByLetter(pack)].map(([letter, known]) => [letter, letterWeight(known)]))
  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0)
  return new Map([...weights].map(([letter, weight]) => [letter, total > 0 ? weight / total : 0]))
}

/**
 * A letter the category can be prompted on, preferring those the lock leaves open and not `except`.
 * Its odds grow with the logarithm of its known words: Z still comes up on the
 * countries, only rarer than C, and the dozens of « République de… » do not
 * turn R into the countries' only letter. What players did with the pair bends
 * those odds without ever cancelling them.
 */
function drawLetter(rng: Rng, categoryId: string, judge: Judge, locked: ReadonlySet<string>, except?: string): string {
  const honest = judge.letters(categoryId)
  const open = honest.filter((letter) => !locked.has(promptKey({ categoryId, letter })))
  const tiers = [open.filter((letter) => letter !== except), honest.filter((letter) => letter !== except), open, honest]
  const available = tiers.find((tier) => tier.length > 0) ?? []
  const weight = (letter: string) => letterWeight(judge.known(categoryId, letter)) * (judge.pull?.(categoryId, letter) ?? 1)
  return pickWeighted(rng, available, weight) ?? available[0] ?? 'A'
}

/** What a run may not deal: the previous run's prompts, and the thin pairs it already dealt. */
function lockOf(avoid: readonly string[], dealt: readonly string[], judge: Judge): Set<string> {
  const locked = new Set(avoid)
  for (const key of dealt) {
    const cut = key.lastIndexOf(':')
    if (judge.known(key.slice(0, cut), key.slice(cut + 1)) < THIN_PROMPT_WORDS) locked.add(key)
  }
  return locked
}

/**
 * A prompt the previous run dealt is off the table for this one, so two runs
 * in a row never open on the same pair. Within a run, only a pair with plenty
 * of known words may come back. When a category has nothing else left, the
 * lock gives way rather than leaving it undrawable.
 */
function drawPrompt(seed: number, drawn: number, categoryIds: readonly string[], judge: Judge, locked: ReadonlySet<string>, skipCategory?: string): Prompt {
  const rng = streamFor(seed, drawn)
  const open = (id: string) => judge.letters(id).filter((letter) => !locked.has(promptKey({ categoryId: id, letter })))
  const playable = categoryIds.filter((id) => judge.letters(id).length > 0)
  const fresh = playable.filter((id) => open(id).length > 0)
  const preferred = fresh.filter((id) => id !== skipCategory)
  const others = playable.filter((id) => id !== skipCategory)
  // The lock outranks the change of category: dealing the same category twice
  // costs nothing, dealing a thin pair twice may leave it without an answer.
  const candidates = [preferred, fresh, others].find((tier) => tier.length > 0) ?? playable
  const categoryId = candidates[Math.floor(rng.next() * candidates.length)] ?? categoryIds[0] ?? ''

  return { categoryId, letter: drawLetter(rng, categoryId, judge, locked) }
}

/**
 * The prompt the run will deal next — drawn from the seed and the count alone,
 * so Divination can show it and `advance` is bound to deal that very one.
 */
export function nextPrompt(run: Run, judge: Judge): Prompt {
  const dealt = run.shared ? run.seeded : run.dealt
  return drawPrompt(run.seed, run.drawn, run.categoryIds, judge, lockOf(run.avoid, dealt, judge), run.prompt.categoryId)
}

/** The run moved on to a new prompt: the one it leaves is settled, and the next is drawn and remembered. */
function advance(
  run: Run,
  judge: Judge,
  /** The prompt being left was answered. */
  answered: boolean,
): Pick<Run, 'prompt' | 'answer' | 'drawn' | 'dealt' | 'seeded' | 'settled' | 'joker'> {
  const prompt = nextPrompt(run, judge)
  const key = promptKey(prompt)
  return {
    prompt,
    // Le retard garde la question quittée : c'est elle que le champ doit encore satisfaire.
    answer: run.mode === 'delayed' ? run.prompt : null,
    drawn: run.drawn + 1,
    dealt: run.dealt.includes(key) ? run.dealt : [...run.dealt, key],
    seeded: run.seeded.includes(key) ? run.seeded : [...run.seeded, key],
    settled: [...run.settled, { prompt: run.prompt, passed: !answered }],
    joker: null,
  }
}

/** La question que le champ doit satisfaire : celle d'avant, en mode retard. */
export function answerPrompt(run: Run): Prompt {
  return run.answer ?? run.prompt
}

/**
 * Le retard commence : la question affichée s'en va sans réponse — le clic qui
 * la valide est aussi celui qui lance le chrono — et la suivante prend sa place.
 */
export function arm(run: Run, judge: Judge): Run {
  if (run.armed) return run
  return { ...run, ...advance(run, judge, false), armed: true }
}

/**
 * What a finished run tells the crowd's record: the pairs it moved on from,
 * and whether it left them empty. The pair on screen when the clock stopped
 * has no verdict — nobody left it — and says nothing.
 */
export function promptOutcomes(run: Run): readonly SettledPrompt[] {
  return run.settled
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
  /** La réserve : « solo » par défaut, la partie ordinaire. */
  mode?: GameMode
  categoryIds: readonly string[]
  /** The prompts the previous run dealt. */
  avoid?: readonly string[]
  powers?: readonly PowerId[]
  /** A challenge run: see `Run.shared`. */
  shared?: boolean
}

export function createRun({ seed, mode = 'solo', categoryIds, avoid = [], powers = [], shared = false }: CreateRunInput, judge: Judge): Run {
  const prompt = drawPrompt(seed, 0, categoryIds, judge, new Set(avoid))
  return {
    seed,
    mode,
    answer: null,
    // Le retard attend une première validation à vide : c'est elle qui lance le chrono.
    armed: mode !== 'delayed',
    categoryIds,
    prompt,
    drawn: 1,
    avoid,
    dealt: [promptKey(prompt)],
    settled: [],
    shared,
    seeded: [promptKey(prompt)],
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
chatter: 0,
latecomerSeconds: 0,
bonusSeconds: 0,
flawlessStreak: 0,
freeSkipReady: false,
  }
}

/** Three dots after a word, typed or as one character: Bavardage's sign. */
const CHATTER_SIGN = /(\.\.\.|…)\s*$/

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
  // Le retard reste muet avant sa première validation : le champ n'a encore
  // rien à satisfaire, et c'est le clic qui lance le chrono.
  if (!run.armed) return { kind: 'empty', found: null }
  const word = normalizeWord(raw)
  if (word === '') return { kind: 'empty', found: null }
  const verdict = judgeWord(run, word, judge)
  // Only what the category does not know can be a spell: « chut » already played stays « déjà donné ».
  if (verdict.kind !== 'unknown' && verdict.kind !== 'wrong-letter' && verdict.kind !== 'accepted') return verdict
  if (verdict.kind === 'accepted') {
    // A Bavardage already under way takes no second one.
    const chatter = run.chatter === 0 && chargesLeft(run, 'chatter') > 0 && CHATTER_SIGN.test(raw)
    return chatter ? { ...verdict, chatter } : verdict
  }
  const spell = spellOf(run, raw, judge)
  return spell ? { kind: 'spell', found: null, spell } : verdict
}

function judgeWord(run: Run, word: string, judge: Judge): Verdict {
  const prompt = answerPrompt(run)
  // La question renversée contraint la dernière lettre : « Vietnam » répond à M.
  const edge = modeEdge(run.mode) === 'last' ? finalOf(word) : initialOf(word)
  if (edge !== prompt.letter) return { kind: 'wrong-letter', found: null }

  const match = judge.find(prompt.categoryId, word, hasPower(run, 'dyslexia') ? 2 : 1)
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
      prompt,
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

/**
 * Célérité validates an accepted word on its own, slips included — except the
 * word spelled right with one letter still missing: that is a player midway
 * through typing it, whom validating would rob of the exact word's bonus.
 */
export function celerityDue(verdict: Verdict | null, raw: string): boolean {
  const found = verdict?.kind === 'accepted' ? verdict.found : null
  if (!found) return false
  if (!found.approximate) return true
  return !(found.edits === 1 && compactWord(raw).length === compactWord(found.display).length - 1)
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
const latecomerTriggered = latecomerDue(run, at) && chargesLeft(run, 'latecomer') > 0
const latecomerCharges = latecomerTriggered ? spend(run, 'latecomer') : run.charges
const latecomerSeconds = latecomerTriggered
? Math.min(LATECOMER_CAP_SECONDS, run.latecomerSeconds + LATECOMER_SECONDS)
: run.latecomerSeconds
const flawlessStreak = hasPower(run, 'flawless') && !verdict.found.approximate && !verdict.found.joker
? run.flawlessStreak + 1
: 0
const flawlessBonus = flawlessStreak > 0 && flawlessStreak % FLAWLESS_STREAK === 0 ? FLAWLESS_POINTS : 0
  // Bavardage keeps the prompt: cast, it holds for `CHATTER_WORDS` more; under way, it counts one down.
  const chatter = verdict.chatter ? CHATTER_WORDS : Math.max(0, run.chatter - 1)
  const stays = verdict.chatter === true || run.chatter > 0 ? chatter > 0 : false
  // L'endurance paie ses mots en secondes, selon la rareté qu'ils valent.
  const bonusSeconds = run.bonusSeconds + (run.mode === 'endurance' ? ENDURANCE_TIME_BONUS[verdict.found.tier] : 0)
  return {
    verdict,
    run: {
      ...run,
      ...(stays ? { joker: null } : advance(run, judge, true)),
      ...release(run, at),
      chatter,
latecomerSeconds,
bonusSeconds,

flawlessStreak,
      charges: verdict.chatter ? { ...latecomerCharges, ...spend(run, 'chatter') } : latecomerCharges,
      found: [...run.found, { ...verdict.found, seconds: Math.max(0, at - run.promptAt), at }],
      promptAt: at,
      used: [...run.used, verdict.found.word],
      combo,
      bestCombo: Math.max(run.bestCombo, combo),
      score: run.score + verdict.found.points + flawlessBonus,
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
  if (run.chatter > 0 || run.freeSkipReady) return 0
  return hasPower(run, 'dodge') ? DODGE_PENALTY_SECONDS : SKIP_PENALTY_SECONDS
}

export function skip(run: Run, judge: Judge, at = run.promptAt): Run {
// Passer avant la première validation du retard ne quitterait aucune question.
if (!run.armed) return run
const advanced = advance(run, judge, false)
if (run.chatter === 0 && run.freeSkipReady) {
return {
...run,
...advanced,
...release(run, at),
promptAt: at,
skips: run.skips + 1,
combo: run.combo,
chatter: 0,
freeSkipReady: false,

}
}
const paid = run.chatter === 0
const grantsFreeSkip = hasPower(run, 'double-skip') && paid && !run.freeSkipReady && chargesLeft(run, 'double-skip') > 0
  return {
    ...run,
    ...advanced,
    ...release(run, at),
    promptAt: at,
    // Leaving a Bavardage is free: no skip counted, no seconds, the series kept.
    skips: run.chatter > 0 ? run.skips : run.skips + 1,
    penaltySeconds: run.penaltySeconds + skipPenalty(run),
    combo: run.chatter > 0 || grantsFreeSkip ? run.combo : 0,
freeSkipReady: grantsFreeSkip,
...(grantsFreeSkip && { charges: spend(run, 'double-skip') }),
    chatter: 0,
  }
}

/**
 * Magie: a new letter for the same category, never the one it replaces while
 * the category has another. The series is kept — the player did not give up.
 */
export function reroll(run: Run, judge: Judge, at = run.promptAt): Run {
  if (chargesLeft(run, 'magic') <= 0) return run
  const rng = streamFor((run.seed ^ 0x6d616769) >>> 0, run.drawn * 8 + run.rerolls)
  const letter = drawLetter(rng, run.prompt.categoryId, judge, lockOf(run.avoid, run.dealt, judge), run.prompt.letter)
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

export function latecomerDue(run: Run, elapsedSeconds: number): boolean {
return hasPower(run, 'latecomer') && chargesLeft(run, 'latecomer') > 0 && remainingSeconds(run, elapsedSeconds) < LATECOMER_THRESHOLD_SECONDS
}

export function remainingSeconds(run: Run, elapsedSeconds: number): number {
  return Math.max(
    0,
    MODE_SECONDS[run.mode] - elapsedSeconds - run.penaltySeconds + heldSeconds(run, elapsedSeconds) + run.latecomerSeconds + run.bonusSeconds,
  )
}
