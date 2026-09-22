import { initialOf, normalizeWord } from './text'

export interface WordEntry {
  /** The spelling shown back to the player. */
  display: string
  /** Wikipedia editions describing the thing — a decent proxy for "everyone knows it". */
  sitelinks: number
  /** Occurrences per million in the Lexique book corpus; 0 for proper nouns it ignores. */
  frequency: number
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
    const [display = '', sitelinks = '0', frequency = '0'] = line.split('|')
    const key = normalizeWord(display)
    if (key === '' || entries.has(key)) continue

    entries.set(key, { display, sitelinks: Number(sitelinks) || 0, frequency: Number(frequency) || 0 })
    const letter = initialOf(display)
    if (letter !== '') counts.set(letter, (counts.get(letter) ?? 0) + 1)
  }

  return { categoryId, entries, counts }
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
    const key = normalizeWord(entry.display)
    if (key === '' || entries.has(key)) continue
    entries.set(key, entry)
    const letter = initialOf(entry.display)
    if (letter !== '') counts.set(letter, (counts.get(letter) ?? 0) + 1)
  }

  return { categoryId: pack.categoryId, entries, counts }
}
