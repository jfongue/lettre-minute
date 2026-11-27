import {
  CHATTER_WORDS,
  COMPLICATION_BOOST,
  ALWAYS_ON_POWER_IDS,
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
  type Scale,
  type WordUsage,
} from './rarity'
import { MODE_SECONDS, enduranceBonus, modeEdge, secondsOf, type GameMode } from './modes'
import { DEFAULT_RUN_TUNING, runTuning, type RunTuning } from './tuning'
import { pickWeighted, streamFor, type Rng } from './rng'
import { compactWord, finalOf, initialOf, normalizeWord } from './text'
import { knownByLetter, type WordMatch, type WordPack } from './words'

/** La durée du solo, sur laquelle l'écran dessine son disque. */
export const RUN_SECONDS = MODE_SECONDS.solo
/** A skip costs clock, not points: the player always leaves with what they found. */
export const SKIP_PENALTY_SECONDS = DEFAULT_RUN_TUNING['run.skipPenalty']

/** Ce que dure une partie de ce mode, selon ses réglages. */
export function modeSeconds(tuning: RunTuning, mode: GameMode): number {
  return secondsOf(mode, tuning)
}

/** Le barème que la partie paie, selon ses réglages. */
export function scaleOf(run: Pick<Run, 'tuning'>): Scale {
  const t = run.tuning
  return { basePoints: t['run.basePoints'], rarityPoints: t['run.rarityPoints'], comboStep: t['run.comboStep'], comboMax: t['run.comboMax'] }
}

/**
 * A pair with fewer known words than this is dealt once per run: the second
 * time, the one or two answers everyone knows may already be spent.
 */
export const THIN_PROMPT_WORDS = 10
/**
 * Le bilan ne juge la frappe que sur les mots d'au moins cinq lettres trouvés
 * en au moins quatre dixièmes de seconde : sous ces seuils, le mot dit la
 * longueur du dictionnaire ou la chance du tirage, pas la vivacité du joueur.
 */
export const SPEED_MIN_LETTERS = 5
export const SPEED_MIN_SECONDS = 0.4
/** Mots trouvés qu'il faut à une partie propre : une partie abandonnée n'en a pas dix. */
export const CLEAN_MIN_WORDS = 10

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
  /**
  * Un mot que le Professeur avait proposé au bilan précédent : sa première
  * écriture le marque, sans rien changer à ce qu'il paie.
  */
  taught: boolean
  /** Complication's multiplier, 1 when it did not apply. */
  boost: number
}

/** A word the run kept, with the seconds its prompt stayed on screen before it came. */
export interface KeptWord extends FoundWord {
  seconds: number
  /** The run clock when it was validated: what a challenge replays its rivals by. */
  at: number
}

export type VerdictKind = 'empty' | 'must-empty' | 'unknown' | 'wrong-letter' | 'already' | 'accepted' | 'spell'

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
  /**
   * L'axe que son dictionnaire juge : la première lettre, la dernière en
   * renversé. Le tirage y règle le poids de ses lettres.
   */
  edge?: 'first' | 'last'
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
  /** The best-known base word the prompt could take (by key), following the judge's edge: what the Joker writes. */
  common?(categoryId: string, letter: string, played: readonly string[]): string | null
  /**
   * Le mot que le bilan montre pour une question passée : le plus souvent
   * répondu, ou le moins payant quand personne ne l'a jamais dit. `rare`, le
   * Professeur, sort à la place un mot peu commun.
   */
  suggest?(categoryId: string, letter: string, played: readonly string[], rare?: boolean): string | null
}

export interface Run {
  seed: number
  /**
   * Les réglages que cette partie joue (`src/domain/tuning.ts`) : ceux de
   * l'appareil au lancement, ou l'instantané d'un défi — chaque appareil
   * rejoue alors la même partie.
   */
  tuning: RunTuning
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
  /** Played by several on one seed, in a challenge or a robot's run. */
  shared: boolean
  /**
   * The share of the rarity and chain bonuses this run pays (`bonusWeight`):
   * less than whole only for a newcomer's solo run. A shared run always pays
   * it whole, so every player of a seed scores alike.
   */
  bonusWeight: number
  found: readonly KeptWord[]
  used: readonly string[]
  /**
  * Les mots que le Professeur a proposés à une partie passée et que le joueur
  * n'a pas encore repris (`compactWord`) : écrits, ils se marquent une fois.
  */
  taught: readonly string[]
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
  /**
   * Les pouvoirs qui ont réellement servi dans la partie, dans l'ordre de leur
   * première activation : ce que le bilan relit une fois la partie finie.
   */
  usedPowers: readonly PowerId[]
  /** The word the Joker wrote for the current prompt, by key, until the prompt changes. */
  joker: { key: string; display: string } | null
  /** Silence holds the clock from this run time, until a word is validated or `HUSH_SECONDS` pass. */
  hush: { at: number } | null
  /** Seconds a finished Silence held the clock. */
  heldSeconds: number
  /**
   * Magie a libéré la lettre de la question en cours : un mot de la catégorie
   * y répond, quelle que soit sa première lettre, jusqu'à la question suivante.
   */
  letterFreed: boolean
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

/**
 * Le poids d'une lettre au tirage : ses mots connus, en logarithme — jamais
 * zéro tant qu'un seul est connu. Le renversé, lui, pèse droit : ses lettres
 * faciles (le E qui finit la moitié des pays) doivent revenir souvent, là où
 * le logarithme garde les rares jouables en mode normal.
 */
export function letterWeight(known: number, edge: 'first' | 'last' = 'first'): number {
  return edge === 'last' ? known : Math.log2(1 + known)
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
 * A letter the category can be prompted on, preferring those the lock leaves open.
 * Its odds grow with the logarithm of its known words: Z still comes up on the
 * countries, only rarer than C, and the dozens of « République de… » do not
 * turn R into the countries' only letter. A reversed mode weighs them straight
 * instead (`letterWeight`). What players did with the pair bends those odds
 * without ever cancelling them.
 */
function drawLetter(rng: Rng, categoryId: string, judge: Judge, locked: ReadonlySet<string>): string {
  const honest = judge.letters(categoryId)
  const open = honest.filter((letter) => !locked.has(promptKey({ categoryId, letter })))
  const available = open.length > 0 ? open : honest
  const weight = (letter: string) => letterWeight(judge.known(categoryId, letter), judge.edge) * (judge.pull?.(categoryId, letter) ?? 1)
  return pickWeighted(rng, available, weight) ?? available[0] ?? 'A'
}

/**
 * What a run may not deal: the previous run's prompts, the thin pairs it
 * already dealt, and — in a run played alone — every pair the player left
 * empty, along with the one on screen. The pair on screen is locked whether it
 * is answered or passed, so that Divination, which shows the next prompt
 * before the player chooses, still tells the truth. A shared run keeps to the
 * seed and the dictionaries alone: what one player passes must not change
 * what another is dealt.
 */
function lockOf(run: Run, judge: Judge): Set<string> {
  const locked = new Set(run.avoid)
  for (const key of run.dealt) {
    const cut = key.lastIndexOf(':')
    if (judge.known(key.slice(0, cut), key.slice(cut + 1)) < THIN_PROMPT_WORDS) locked.add(key)
  }
  if (!run.shared) {
    for (const settled of run.settled) if (settled.passed) locked.add(promptKey(settled.prompt))
    locked.add(promptKey(run.prompt))
  }
  return locked
}

/**
 * A prompt the previous run dealt is off the table for this one, so two runs
 * in a row never open on the same pair. Within a run, only a pair with plenty
 * of known words may come back, and in a run played alone, never one the
 * player passed. When a category has nothing else left, the
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
  return drawPrompt(run.seed, run.drawn, run.categoryIds, judge, lockOf(run, judge), run.prompt.categoryId)
}

/** The run moved on to a new prompt: the one it leaves is settled, and the next is drawn and remembered. */
function advance(
  run: Run,
  judge: Judge,
  /** The prompt being left was answered. */
  answered: boolean,
): Pick<Run, 'prompt' | 'answer' | 'drawn' | 'dealt' | 'settled' | 'joker' | 'letterFreed'> {
  const prompt = nextPrompt(run, judge)
  const key = promptKey(prompt)
  return {
    prompt,
    // Le retard garde la question quittée : c'est elle que le champ doit encore satisfaire.
    answer: run.mode === 'delayed' ? run.prompt : null,
    drawn: run.drawn + 1,
    dealt: run.dealt.includes(key) ? run.dealt : [...run.dealt, key],
    settled: [...run.settled, { prompt: run.prompt, passed: !answered }],
    joker: null,
    letterFreed: false,
  }
}

/** La question que le champ doit satisfaire : celle d'avant, en mode retard. */
export function answerPrompt(run: Run): Prompt {
  return run.answer ?? run.prompt
}

/**
 * Le retard commence : la question affichée s'en va sans réponse — le clic qui
 * la valide est aussi celui qui lance le chrono — et la suivante prend sa place.
 * Du texte dans le champ ne lance rien : la question part à vide, « dit lui
 * s'il le fait » vivant dans `inspect`.
 */
export function arm(run: Run, judge: Judge, raw = ''): Run {
  if (run.armed || normalizeWord(raw) !== '') return run
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
  return { hush: null, heldSeconds: run.heldSeconds + Math.min(run.tuning['run.hushSeconds'], Math.max(0, at - run.hush.at)) }
}

export function hasPower(run: Run, power: PowerId): boolean {
  return run.powers.includes(power)
}

export function chargesLeft(run: Run, power: PowerId): number {
  return hasPower(run, power) ? (run.charges[power] ?? 0) : 0
}

/**
 * Records that a power really served this run, once, in the order it first did.
 * The screen calls it where a power acts outside `run.ts` — Permutation in
 * `src/state/session.ts`, Divination and Célérité at the field.
 */
export function markPowerUsed(run: Run, power: PowerId): Run {
  return run.usedPowers.includes(power) ? run : { ...run, usedPowers: [...run.usedPowers, power] }
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
  /** Les mots du Professeur que le joueur n'a pas encore repris (`Profile.professorWords`). */
  taught?: readonly string[]
  /** A challenge run: see `Run.shared`. */
  shared?: boolean
  /** See `Run.bonusWeight`. */
  bonusWeight?: number
  /** Les réglages figés d'une partie partagée ; ceux de l'appareil sinon. */
  tuning?: RunTuning
}

export function createRun({ seed, mode = 'solo', categoryIds, avoid = [], powers = [], taught = [], shared = false, bonusWeight = 1, tuning = runTuning() }: CreateRunInput, judge: Judge): Run {
  const prompt = drawPrompt(seed, 0, categoryIds, judge, new Set(avoid))
  return {
    seed,
    tuning,
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
    bonusWeight,
    found: [],
    used: [],
    taught,
    promptAt: 0,
    skips: 0,
    penaltySeconds: 0,
    combo: 0,
    bestCombo: 0,
    score: 0,
    powers,
    charges: Object.fromEntries(powers.flatMap((power) => (POWER_CHARGES[power] ? [[power, POWER_CHARGES[power]]] : []))),
    usedPowers: [],
    joker: null,
    hush: null,
    heldSeconds: 0,
    letterFreed: false,
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
  // rien à satisfaire, et c'est le clic qui lance le chrono. Le texte qui y
  // entrerait est refusé, et la ligne de refus le dit.
  if (!run.armed) return normalizeWord(raw) === '' ? { kind: 'empty', found: null } : { kind: 'must-empty', found: null }
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
  // Magie libère l'initiale sans élargir la recherche : `find` ne corrige une
  // faute que parmi les mots de la lettre tapée, son chemin chaud ordinaire.
  if (!run.letterFreed && edge !== prompt.letter) return { kind: 'wrong-letter', found: null }

  const match = judge.find(prompt.categoryId, word, hasPower(run, 'dyslexia') ? 2 : 1)
  if (!match) return { kind: 'unknown', found: null }
  // Judged on the canonical form: "chats" after "chat" is the same answer.
  if (run.used.includes(match.entry.key)) return { kind: 'already', found: null }

  const joker = run.joker?.key === match.entry.key
  const taught = run.taught.includes(compactWord(match.entry.key))
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
      points: flat ? pointsForApproximate(run.combo, run.bonusWeight, scaleOf(run)) : pointsFor(match.entry, usage, run.combo, boost, run.bonusWeight, scaleOf(run)),
      rarity,
      tier,
      approximate: match.approximate,
      edits: match.edits,
      joker,
      taught,
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
? Math.min(run.tuning['run.latecomerCap'], run.latecomerSeconds + run.tuning['run.latecomerSeconds'])
: run.latecomerSeconds
const flawlessStreak = hasPower(run, 'flawless') && !verdict.found.approximate && !verdict.found.joker
? run.flawlessStreak + 1
: 0
const flawlessBonus = flawlessStreak > 0 && flawlessStreak % run.tuning['run.flawlessStreak'] === 0 ? run.tuning['run.flawlessPoints'] : 0
  // Bavardage keeps the prompt: cast, it holds for `CHATTER_WORDS` more; under way, it counts one down.
  const chatter = verdict.chatter ? CHATTER_WORDS : Math.max(0, run.chatter - 1)
  const stays = verdict.chatter === true || run.chatter > 0 ? chatter > 0 : false
  // L'endurance paie ses mots en secondes, selon la rareté qu'ils valent.
  const bonusSeconds = run.bonusSeconds + (run.mode === 'endurance' ? enduranceBonus(verdict.found.tier, run.tuning) : 0)
  // Les pouvoirs dont l'effet a vraiment joué : deux lettres corrigées n'existent
  // que sous Dyslexie, un bonus de points que sous Complication.
  const served: PowerId[] = []
  if (latecomerTriggered) served.push('latecomer')
  if (verdict.chatter) served.push('chatter')
  if (verdict.found.edits >= 2) served.push('dyslexia')
  if (verdict.found.boost > 1) served.push('complication')
  if (flawlessBonus > 0) served.push('flawless')
  const next: Run = {
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
  }
  return { verdict, run: served.reduce(markPowerUsed, next) }
}

/**
 * The Joker writes the best-known word left on the prompt, which the player
 * still has to validate; Silence holds the clock. Both are spent on casting.
 */
function cast(run: Run, spell: Spell, judge: Judge, at: number): Run {
  if (spell === 'hush') {
    return run.hush ? run : markPowerUsed({ ...run, hush: { at }, charges: spend(run, 'hush') }, 'hush')
  }

  const display = judge.common?.(run.prompt.categoryId, run.prompt.letter, run.used)
  const match = display ? judge.find(run.prompt.categoryId, display, 0) : null
  if (!display || !match) return run
  return markPowerUsed({ ...run, joker: { key: match.entry.key, display }, charges: spend(run, 'joker') }, 'joker')
}

export function skipPenalty(run: Run): number {
  if (run.chatter > 0 || run.freeSkipReady) return 0
  return hasPower(run, 'dodge') ? run.tuning['run.dodgePenalty'] : run.tuning['run.skipPenalty']
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
const penalty = skipPenalty(run)
const grantsFreeSkip = hasPower(run, 'double-skip') && paid && !run.freeSkipReady
  const served: PowerId[] = []
  if (penalty > 0 && hasPower(run, 'dodge')) served.push('dodge')
  if (grantsFreeSkip) served.push('double-skip')
  const next: Run = {
    ...run,
    ...advanced,
    ...release(run, at),
    promptAt: at,
    // Leaving a Bavardage is free: no skip counted, no seconds, the series kept.
    skips: run.chatter > 0 ? run.skips : run.skips + 1,
    penaltySeconds: run.penaltySeconds + penalty,
    combo: run.chatter > 0 || grantsFreeSkip ? run.combo : 0,
freeSkipReady: grantsFreeSkip,
    chatter: 0,
  }
  return served.reduce(markPowerUsed, next)
}

/**
 * Magie : la question en cours accepte un mot de sa catégorie quelle que soit
 * son initiale. La lettre affichée ne change pas, ni le tirage qui suit : la
 * Divination montre toujours ce qu'`advance` distribuera.
 */
export function freeLetter(run: Run): Run {
  if (run.letterFreed || chargesLeft(run, 'magic') <= 0) return run
  return markPowerUsed({ ...run, letterFreed: true, charges: spend(run, 'magic') }, 'magic')
}

/** Seconds Silence has held the clock so far, the one under way included. */
export function heldSeconds(run: Run, elapsedSeconds: number): number {
  const current = run.hush ? Math.min(run.tuning['run.hushSeconds'], Math.max(0, elapsedSeconds - run.hush.at)) : 0
  return run.heldSeconds + current
}

/** True while Silence holds the clock: cast, not yet released, not yet run out. */
export function isHushed(run: Run, elapsedSeconds: number): boolean {
  return run.hush !== null && elapsedSeconds - run.hush.at < run.tuning['run.hushSeconds']
}

export function latecomerDue(run: Run, elapsedSeconds: number): boolean {
  return latecomerOpen(run, remainingSeconds(run, elapsedSeconds))
}

/** Retardataire paierait un mot validé maintenant : ce que l'écran annonce, au même seuil. */
export function latecomerOpen(run: Run, remaining: number): boolean {
  return chargesLeft(run, 'latecomer') > 0 && remaining < run.tuning['run.latecomerThreshold']
}

export function remainingSeconds(run: Run, elapsedSeconds: number): number {
  // L'arrivée de la course arrête la partie comme un chrono vide : la même fin, le même bilan.
  if (raceSeconds(run) !== null) return 0
  return Math.max(
    0,
    modeSeconds(run.tuning, run.mode) - elapsedSeconds - run.penaltySeconds + heldSeconds(run, elapsedSeconds) + run.latecomerSeconds + run.bonusSeconds,
  )
}

/**
 * Le temps d'une course arrivée : l'heure du dixième mot, plus les secondes
 * que les passes ont coûtées ; null tant qu'elle n'est pas arrivée, et hors
 * course.
 */
export function raceSeconds(run: Run): number | null {
  if (run.mode !== 'race' || run.found.length < run.tuning['run.raceWords']) return null
  return Math.round((run.found[run.tuning['run.raceWords'] - 1]!.at + run.penaltySeconds) * 10) / 10
}

/**
 * Le score d'une partie : les points du solo ; en endurance, les secondes de
 * survie — le temps que la partie a tenu, mots rendus et pénalités compris ;
 * en course, les secondes d'avance sur le plafond, zéro sans arrivée. Plus
 * grand gagne partout : le classement du défi n'a qu'un sens de tri.
 */
export function runScore(run: Run): number {
  if (run.mode === 'race') {
    const time = raceSeconds(run)
    return time === null ? 0 : Math.max(0, Math.round((modeSeconds(run.tuning, 'race') - time) * 10) / 10)
  }
  if (run.mode !== 'endurance') return run.score
  return Math.max(
    0,
    modeSeconds(run.tuning, run.mode) - run.penaltySeconds + run.heldSeconds + run.latecomerSeconds + run.bonusSeconds,
  )
}

/**
 * Le retard : revoir la question à remplir coûte des secondes, comme passer.
 * Hors de sa première question, il n'a rien à rappeler.
 */
export function recall(run: Run): Run {
  if (run.mode !== 'delayed' || !run.armed) return run
  return { ...run, penaltySeconds: run.penaltySeconds + run.tuning['run.recallSeconds'] }
}

export interface RunMilestones {
  /** La plus longue forme validée, en lettres. */
  longest: number
  /** La frappe la plus vive, en dixièmes de lettre par seconde : 0 si aucun mot ne qualifie. */
  speed: number
  /** La partie n'a laissé passer aucune question, et assez de mots pour compter. */
  clean: boolean
  /** La partie n'a laissé passer aucune question du tout, même sans assez de mots. */
  noPass: boolean
  /** Le plus de mots de moins de cinq lettres trouvés d'affilée. */
  shortStreak: number
  /** Les pouvoirs qui y ont servi : ceux qu'un geste a déclenchés, puis ceux qui n'ont pas de geste. */
  powers: readonly PowerId[]
  /** Les catégories où elle a trouvé un mot. */
  categories: readonly string[]
}

/** Ce qu'une partie seule sait mesurer, une fois finie : ce que le profil en garde. */
export function runMilestones(run: Run): RunMilestones {
  const longest = run.found.reduce((best, word) => Math.max(best, word.display.length), 0)
  const speed = run.found.reduce((best, word) => {
    if (word.display.length < SPEED_MIN_LETTERS || word.seconds < SPEED_MIN_SECONDS) return best
    return Math.max(best, Math.round((10 * word.display.length) / word.seconds))
  }, 0)
  // Une partie qui a laissé partir une question n'a pas passé personne, même
  // sans passe comptée : le retard abandonne la sienne (`settled.passed`) sans
  // `skips`.
  const noPass = run.skips === 0 && !run.settled.some((settled) => settled.passed)
  const clean = noPass && run.found.length >= CLEAN_MIN_WORDS
  // Une suite de mots courts se casse au premier mot de cinq lettres ou plus.
  const shortStreak = run.found.reduce(
    (streak, word) => {
      const chain = word.display.length < 5 ? streak.chain + 1 : 0
      return { best: Math.max(streak.best, chain), chain }
    },
    { best: 0, chain: 0 },
  ).best
  return {
    longest,
    speed,
    clean,
    noPass,
    shortStreak,
    powers: [
      ...run.usedPowers,
      // Un pouvoir sans charge travaille toute la partie : mené jusqu'au chrono,
      // il a servi, même si aucun mot n'a eu besoin de lui.
      ...ALWAYS_ON_POWER_IDS.filter((id) => run.powers.includes(id) && !run.usedPowers.includes(id)),
    ],
    categories: [...new Set(run.found.map((word) => word.prompt.categoryId))],
  }
}
