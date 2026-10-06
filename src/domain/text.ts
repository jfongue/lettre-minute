/**
 * Answers are compared the way players read them aloud: "Éléphant", "elephant"
 * and "ELEPHANT " are the same word, so a table never argues about an accent.
 */
const COMBINING_MARKS = /[̀-ͯ]/g
const PRINTABLE_ASCII = /^[ -~]*$/

/**
 * Ligatures, the German ß and the barred Nordic and Slavic letters survive NFD
 * decomposition, so they are spelled out before stripping: dropped instead,
 * « Ørsted » would answer on R.
 */
function expandLigatures(raw: string): string {
  return raw
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/ĳ/gi, 'ij')
    .replace(/[øØ]/g, 'o')
    .replace(/[łŁ]/g, 'l')
    .replace(/[đĐðÐ]/g, 'd')
    .replace(/[þÞ]/g, 'th')
    .replace(/ı/g, 'i')
}

export function normalizeWord(raw: string): string {
  // Plain ASCII has no ligature nor accent to take apart: a dictionary is
  // mostly that, and each of its words is normalized as it loads.
  if (PRINTABLE_ASCII.test(raw)) return raw.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return expandLigatures(raw)
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * The form an answer is matched on. Spaces, hyphens and apostrophes are not
 * letters the player got wrong: « cotedivoire » is « Côte d’Ivoire » spelled
 * right, not a word the tolerance had to rescue — and a missing space would
 * otherwise spend the one edit it is allowed.
 */
export function compactWord(raw: string): string {
  return normalizeWord(raw).replace(/ /g, '')
}

/** The letter an answer is judged on: its first alphabetic character, accents removed. */
export function initialOf(raw: string): string {
  return initialOfNormalized(normalizeWord(raw))
}

/**
 * La dernière lettre d'une réponse, sur laquelle un mode renversé la juge :
 * « Vietnam » répond à un M là où `initialOf` demanderait un V.
 */
export function finalOf(raw: string): string {
  const letters = compactWord(raw).match(/[a-z]/g)
  return letters ? letters[letters.length - 1]!.toUpperCase() : ''
}

/** `initialOf`, for a word already through `normalizeWord`. */
export function initialOfNormalized(normalized: string): string {
  const first = normalized.match(/[a-z]/)
  return first ? first[0].toUpperCase() : ''
}

/** Answers are shown and typed as names — « Dauphin », « Pérou » — whatever case the dictionary keeps. */
export function capitalized(text: string): string {
  return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1)
}
