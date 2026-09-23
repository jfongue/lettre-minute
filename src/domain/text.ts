/**
 * Answers are compared the way players read them aloud: "Éléphant", "elephant"
 * and "ELEPHANT " are the same word, so a table never argues about an accent.
 */
const COMBINING_MARKS = /[̀-ͯ]/g

/** Ligatures survive NFD decomposition, so they are spelled out before stripping. */
function expandLigatures(raw: string): string {
  return raw.replace(/œ/gi, 'oe').replace(/æ/gi, 'ae')
}

export function normalizeWord(raw: string): string {
  return expandLigatures(raw)
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** The letter an answer is judged on: its first alphabetic character, accents removed. */
export function initialOf(raw: string): string {
  const normalized = normalizeWord(raw)
  const first = normalized.match(/[a-z]/)
  return first ? first[0].toUpperCase() : ''
}

/** Answers are shown and typed as names — « Dauphin », « Pérou » — whatever case the dictionary keeps. */
export function capitalized(text: string): string {
  return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1)
}
