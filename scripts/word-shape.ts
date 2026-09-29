import { normalizeWord } from '../src/domain/text.ts'

/**
 * Wikidata labels carry disambiguations, catalogue numbers and stray plurals.
 * Anything a player could not type in a hurry is dropped rather than kept as a
 * word that would only ever be refused.
 *
 * The dictionaries hold nothing this rejects, so the committed snapshot of the
 * words moderators accepted (`scripts/community-words.ts`) is read through it
 * too: a word the import would drop — « M » for a colour, « C&A » for a brand —
 * would fail `src/data/words.test.ts` for ever if it entered the snapshot.
 */
export function acceptable(display: string): boolean {
  if (display.length < 2 || display.length > 28) return false
  if (/[0-9(),:;"«»/\\[\]]/.test(display)) return false
  if (/\b(?:sp|ssp|var|cf)\./.test(display)) return false
  // Any Latin letter: Latin-1 alone turned away « cœur », « œil » and « bœuf »,
  // and the Wiktionary's typographic apostrophe every « maître d’hôtel ».
  if (!/^\p{Script=Latin}[\p{Script=Latin}'’ -]*$/u.test(display.normalize('NFC'))) return false
  // A letter the matching cannot spell in ASCII — « ə », « ŋ » — would vanish
  // from the answer, and a word judged without one of its letters is another word.
  return [...display.normalize('NFC')].every((char) => !/\p{L}/u.test(char) || normalizeWord(char) !== '')
}
