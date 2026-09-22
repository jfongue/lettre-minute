import { initialOf, normalizeWord } from './text'

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
  /** Occurrences per million in the Lexique book corpus; 0 for proper nouns it ignores. */
  frequency: number
  /**
   * How well known this word is, on 0..1: half its rank inside its own
   * category, half the absolute reading of the two raw signals. Rank alone
   * makes a category of obscure shades crown "vermillon" as common; the
   * absolute scale alone calls every everyday word the book corpus rarely
   * prints — "libellule", "abeille" — a rare find.
   */
  notoriety: number
}

/** The raw, absolute reading of the two signals — only ever used to rank. */
function rawFame(sitelinks: number, frequency: number): number {
  return Math.max(Math.log10(1 + frequency) / 2.2, Math.log10(1 + sitelinks) / 2.5)
}

export interface WordPack {
  categoryId: string
  /** Normalized word → entry. The normalized form is what the player is judged on. */
  entries: ReadonlyMap<string, WordEntry>
  /** Letter → how many words start with it, to never prompt a dead end. */
  counts: ReadonlyMap<string, number>
}

/**
 * Parses the `display|sitelinks|frequency` lines produced by
 * scripts/import-words.ts. The format stays a flat text file because a JSON
 * object per word triples the payload for sixty thousand words.
 */
export function parseWordPack(categoryId: string, raw: string): WordPack {
  const entries = new Map<string, WordEntry>()
  const counts = new Map<string, number>()

  for (const line of raw.split('\n')) {
    if (line === '') continue
    const [display = '', sitelinks = '0', frequency = '0', canonical = ''] = line.split('|')
    const word = normalizeWord(display)
    if (word === '' || entries.has(word)) continue

    const key = canonical === '' ? word : canonical
    entries.set(word, {
      key,
      display,
      sitelinks: Number(sitelinks) || 0,
      frequency: Number(frequency) || 0,
      notoriety: 0,
    })

    // Inflected forms are not counted: they start with the same letter as the
    // word they bend, and would make a thin letter look well stocked.
    if (canonical !== '') continue
    const letter = initialOf(display)
    if (letter !== '') counts.set(letter, (counts.get(letter) ?? 0) + 1)
  }

  rankNotoriety(entries)
  return { categoryId, entries, counts }
}

/**
 * Turns the raw signals into a rank inside the category. Inflected forms borrow
 * the rank of the word they bend: "chats" is exactly as well known as "chat".
 */
function rankNotoriety(entries: Map<string, WordEntry>): void {
  const ranked = [...entries.values()].sort(
    (a, b) => rawFame(a.sitelinks, a.frequency) - rawFame(b.sitelinks, b.frequency),
  )
  const last = Math.max(1, ranked.length - 1)
  for (const [index, entry] of ranked.entries()) {
    const absolute = Math.min(1, Math.max(0, rawFame(entry.sitelinks, entry.frequency)))
    entry.notoriety = (index / last + absolute) / 2
  }

  for (const entry of entries.values()) {
    if (entry.key === '') continue
    const base = entries.get(entry.key)
    if (base && base !== entry) entry.notoriety = base.notoriety
  }
}

export function lookup(pack: WordPack, raw: string): WordEntry | null {
  return pack.entries.get(normalizeWord(raw)) ?? null
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
  for (const entry of extra) {
    const word = normalizeWord(entry.display)
    if (word === '' || entries.has(word)) continue
    entries.set(word, {
      ...entry,
      key: entry.key === '' ? word : entry.key,
      // A community word joins after the ranking: it is read on the absolute
      // scale, which keeps it out of the "everybody knows it" band.
      notoriety: entry.notoriety || rawFame(entry.sitelinks, entry.frequency),
    })
    const letter = initialOf(entry.display)
    if (letter !== '') counts.set(letter, (counts.get(letter) ?? 0) + 1)
  }

  return { categoryId: pack.categoryId, entries, counts }
}
