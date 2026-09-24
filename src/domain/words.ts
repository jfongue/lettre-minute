import { compactWord, initialOf, normalizeWord } from './text'

export interface WordEntry {
  /**
   * The word this entry counts as. An inflected form points back at its base
   * word — "chats" and "chat" are one answer, worth one score, once per run.
   */
  key: string
  /** The spelling shown back to the player. */
  display: string
  /** Wikipedia editions describing the thing — a decent proxy for "everyone knows it". */
  sitelinks: number
  /** Occurrences per million in Lexique's books or film subtitles; 0 for proper nouns it ignores. */
  frequency: number
  /**
   * Daily views of the French Wikipedia article, when there is one. It
   * supersedes the sitelinks: bots wrote an article in forty languages for
   * every bird species and every commune, and only the French readers' clicks
   * tell "Aigle martial" from "Aigle royal".
   */
  views?: number
  /**
   * How well known this word is, on 0..1: half its rank inside its own
   * category, half the absolute reading of the raw signals. Rank alone makes
   * a category of obscure shades crown "vermillon" as common; the absolute
   * scale alone flattens a whole category whose words are little looked up.
   */
  notoriety: number
}

/** Daily views at which an article counts as known by everyone (~2 000). */
const VIEWS_SCALE = 3.3

/** The raw, absolute reading of the signals — only ever used to rank. */
function rawFame(entry: Pick<WordEntry, 'sitelinks' | 'frequency' | 'views'>): number {
  const spoken = Math.log10(1 + entry.frequency) / 2.2
  const read =
    entry.views === undefined ? Math.log10(1 + entry.sitelinks) / 2.5 : Math.log10(1 + entry.views) / VIEWS_SCALE
  return Math.max(spoken, read)
}

export interface WordPack {
  categoryId: string
  /**
   * Compact word (`compactWord`) → entry. It is what the player is judged on,
   * while `WordEntry.key` keeps its spaces: it is the name usage counters are
   * stored under, server side.
   */
  entries: ReadonlyMap<string, WordEntry>
  /** Letter → how many words start with it, to never prompt a dead end. */
  counts: ReadonlyMap<string, number>
  /**
   * Compact words grouped by their initial. The near-miss search runs on
   * every keystroke, and a prompt already fixes the initial: narrowing to one
   * letter turns a scan of twenty thousand words into a few hundred.
   */
  byLetter: ReadonlyMap<string, readonly string[]>
}

export interface WordMatch {
  entry: WordEntry
  /** True when the dictionary had to correct a slip to find it. */
  approximate: boolean
  /** How many letters it corrected: 0, 1, or 2 under the Dyslexie power. */
  edits: number
}

/** Shorter than this, a single edit turns one word into too many others. */
export const MIN_LENGTH_FOR_APPROXIMATE = 4
/** Two edits reach much further: under six letters, they turn a word into half its category. */
export const MIN_LENGTH_FOR_TWO_EDITS = 6

/**
 * One dictionary row as scripts/import-words.ts writes it:
 * `[display, sitelinks, frequency, canonical?, views?]`. The canonical form is
 * set on inflected forms only (empty otherwise); views are left out on a
 * homonymy page, which then falls back on the sitelinks. Positional rather than
 * one object per word: keys repeated sixty thousand times would double the
 * payload.
 */
export type WordRow = readonly [display: string, sitelinks: number, frequency: number, canonical?: string, views?: number]

export function buildWordPack(categoryId: string, rows: readonly WordRow[]): WordPack {
  const entries = new Map<string, WordEntry>()
  const counts = new Map<string, number>()
  const byLetter = new Map<string, string[]>()

  for (const [display, sitelinks, frequency, canonical = '', views] of rows) {
    const word = compactWord(display)
    if (word === '' || entries.has(word)) continue

    const key = canonical === '' ? normalizeWord(display) : canonical
    entries.set(word, {
      key,
      display,
      sitelinks,
      frequency,
      ...(views === undefined ? {} : { views }),
      notoriety: 0,
    })

    const letter = initialOf(display)
    if (letter !== '') {
      const bucket = byLetter.get(letter) ?? []
      bucket.push(word)
      byLetter.set(letter, bucket)
    }

    // Inflected forms are not counted: they start with the same letter as the
    // word they bend, and would make a thin letter look well stocked.
    if (canonical !== '') continue
    if (letter !== '') counts.set(letter, (counts.get(letter) ?? 0) + 1)
  }

  rankNotoriety(entries)
  return { categoryId, entries, counts, byLetter }
}

/**
 * The best-known words of a category, in their base form: what the unlock
 * screen types out to show what picking it would bring. Inflected forms are
 * left out — "chats" after "chat" says nothing new.
 */
export function showcaseWords(pack: WordPack, count: number): string[] {
  return [...pack.entries.values()]
    .filter((entry) => entry.key === normalizeWord(entry.display))
    .sort((a, b) => b.notoriety - a.notoriety)
    .slice(0, count)
    .map((entry) => entry.display)
}

/** The best-known base word on that letter the run has not played yet (by `key`): a debug shortcut's answer. */
export function commonWord(pack: WordPack, letter: string, played: readonly string[]): string | null {
  let best: WordEntry | null = null
  for (const word of pack.byLetter.get(letter) ?? []) {
    const entry = pack.entries.get(word)!
    if (entry.key !== normalizeWord(entry.display) || played.includes(entry.key)) continue
    if (!best || entry.notoriety > best.notoriety) best = entry
  }
  return best?.display ?? null
}

/**
 * Turns the raw signals into a rank inside the category. Inflected forms borrow
 * the rank of the word they bend: "chats" is exactly as well known as "chat".
 */
function rankNotoriety(entries: Map<string, WordEntry>): void {
  const ranked = [...entries.values()].sort(
    (a, b) => rawFame(a) - rawFame(b),
  )
  const last = Math.max(1, ranked.length - 1)
  for (const [index, entry] of ranked.entries()) {
    const absolute = Math.min(1, Math.max(0, rawFame(entry)))
    entry.notoriety = (index / last + absolute) / 2
  }

  for (const entry of entries.values()) {
    if (entry.key === '') continue
    const base = entries.get(compactWord(entry.key))
    if (base && base !== entry) entry.notoriety = base.notoriety
  }
}

export function lookup(pack: WordPack, raw: string): WordEntry | null {
  return pack.entries.get(compactWord(raw)) ?? null
}

/**
 * True when `typed` is `known` with exactly one letter wrong: one swapped pair,
 * one missing letter, one letter too many, or one letter mistyped. Written as a
 * single pass rather than an edit-distance matrix because it runs against every
 * candidate of a letter, on every keystroke.
 */
export function withinOneEdit(typed: string, known: string): boolean {
  if (typed === known) return false
  if (Math.abs(typed.length - known.length) > 1) return false

  if (typed.length === known.length) {
    let first = -1
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] === known[i]) continue
      if (first < 0) {
        first = i
        continue
      }
      // A second difference is only forgivable as two letters swapped.
      return (
        first === i - 1 &&
        typed[first] === known[i] &&
        typed[i] === known[first] &&
        typed.slice(i + 1) === known.slice(i + 1)
      )
    }
    return first >= 0
  }

  const [shorter, longer] = typed.length < known.length ? [typed, known] : [known, typed]
  let atShort = 0
  let atLong = 0
  let skipped = false
  while (atShort < shorter.length && atLong < longer.length) {
    if (shorter[atShort] === longer[atLong]) {
      atShort++
      atLong++
      continue
    }
    if (skipped) return false
    skipped = true
    atLong++
  }
  return true
}

/**
 * Optimal string alignment distance — a swap of two neighbours is one edit —
 * or `limit + 1` as soon as it is certain to exceed `limit`. Only the Dyslexie
 * power reaches for it: the one-edit check above stays the hot path.
 */
export function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1
  let before = new Array<number>(b.length + 1).fill(0)
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = new Array<number>(b.length + 1).fill(0)
    current[0] = i
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, before[j - 2]! + 1)
      current[j] = value
      best = Math.min(best, value)
    }
    if (best > limit) return limit + 1
    before = previous
    previous = current
  }
  return Math.min(previous[b.length]!, limit + 1)
}

const AMBIGUOUS = 'ambiguous'

/** The one word `typed` is at `edits` letters from, among those of its initial; ambiguous when two keys are. */
function nearest(pack: WordPack, typed: string, edits: 1 | 2): WordEntry | null | typeof AMBIGUOUS {
  let found: WordEntry | null = null
  for (const candidate of pack.byLetter.get(initialOf(typed)) ?? []) {
    if (Math.abs(candidate.length - typed.length) > edits) continue
    if (edits === 1 ? !withinOneEdit(typed, candidate) : editDistance(typed, candidate, 2) !== 2) continue

    const entry = pack.entries.get(candidate)!
    if (found && found.key !== entry.key) return AMBIGUOUS
    if (!found) found = entry
  }
  return found
}

/**
 * The dictionary's answer to what the player typed: the word itself, or the one
 * word it is a letter away from — two letters under `tolerance` 2. An ambiguous
 * slip — two candidates as close — is refused rather than guessed, and a
 * closer word always wins over a further one.
 */
export function findWord(pack: WordPack, raw: string, tolerance = 1): WordMatch | null {
  const typed = compactWord(raw)
  if (typed === '') return null

  const exact = pack.entries.get(typed)
  if (exact) return { entry: exact, approximate: false, edits: 0 }
  if (tolerance < 1 || typed.length < MIN_LENGTH_FOR_APPROXIMATE) return null

  const one = nearest(pack, typed, 1)
  if (one === AMBIGUOUS) return null
  if (one) return { entry: one, approximate: true, edits: 1 }
  if (tolerance < 2 || typed.length < MIN_LENGTH_FOR_TWO_EDITS) return null

  const two = nearest(pack, typed, 2)
  return two && two !== AMBIGUOUS ? { entry: two, approximate: true, edits: 2 } : null
}

export function lettersWithEnough(pack: WordPack, minimum: number): string[] {
  return [...pack.counts.entries()]
    .filter(([, count]) => count >= minimum)
    .map(([letter]) => letter)
    .sort()
}

/**
 * Adds words the community had accepted since the file was built. The pack is
 * rebuilt rather than mutated: a judge holds it for the length of a run and
 * must not see it change under its feet.
 */
export function withExtraWords(pack: WordPack, extra: readonly WordEntry[]): WordPack {
  if (extra.length === 0) return pack

  const entries = new Map(pack.entries)
  const counts = new Map(pack.counts)
  const byLetter = new Map<string, string[]>([...pack.byLetter].map(([letter, words]) => [letter, [...words]]))

  for (const entry of extra) {
    const word = compactWord(entry.display)
    if (word === '' || entries.has(word)) continue
    entries.set(word, {
      ...entry,
      key: entries.get(compactWord(entry.key))?.key ?? (entry.key === '' ? normalizeWord(entry.display) : entry.key),
      // A community word joins after the ranking: it is read on the absolute
      // scale, which keeps it out of the "everybody knows it" band.
      notoriety: entry.notoriety || rawFame(entry),
    })
    const letter = initialOf(entry.display)
    if (letter === '') continue
    counts.set(letter, (counts.get(letter) ?? 0) + 1)
    byLetter.set(letter, [...(byLetter.get(letter) ?? []), word])
  }

  return { categoryId: pack.categoryId, entries, counts, byLetter }
}
