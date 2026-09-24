export interface PlayableLetter {
  letter: string
  /** Relative odds of being drawn — a table wants "M" far more often than "H". */
  weight: number
}

/**
 * K, Q, U, W, X, Y and Z are left out of the deck entirely: in French they turn
 * every category into the same three words, which kills the round instead of
 * making it hard.
 */
export const PLAYABLE_LETTERS: readonly PlayableLetter[] = [
  { letter: 'A', weight: 7 },
  { letter: 'B', weight: 7 },
  { letter: 'C', weight: 9 },
  { letter: 'D', weight: 6 },
  { letter: 'E', weight: 4 },
  { letter: 'F', weight: 6 },
  { letter: 'G', weight: 5 },
  { letter: 'H', weight: 2 },
  { letter: 'I', weight: 2 },
  { letter: 'J', weight: 3 },
  { letter: 'L', weight: 6 },
  { letter: 'M', weight: 8 },
  { letter: 'N', weight: 3 },
  { letter: 'O', weight: 2 },
  { letter: 'P', weight: 9 },
  { letter: 'R', weight: 6 },
  { letter: 'S', weight: 8 },
  { letter: 'T', weight: 7 },
  { letter: 'V', weight: 4 },
]

/** `"A7 B7 C9"`: a deck written as its letters and their weights. */
function deck(spec: string): PlayableLetter[] {
  return spec.split(' ').map((entry) => ({ letter: entry[0]!, weight: Number(entry.slice(1)) }))
}

/**
 * Each language has its own deck: German wants K, W and Z, which French
 * leaves out, and has almost no C; Italian barely starts a word with H or J.
 * A letter the category cannot honour is still dropped by the judge.
 */
export const LETTER_DECKS: Readonly<Record<string, readonly PlayableLetter[]>> = {
  fr: PLAYABLE_LETTERS,
  en: deck('A7 B7 C9 D5 E3 F5 G5 H5 I2 J2 K2 L5 M7 N3 O2 P8 R5 S10 T6 V2 W5'),
  es: deck('A8 B6 C10 D4 E5 F4 G5 H3 I2 J3 L5 M8 N2 O2 P9 R5 S5 T6 V3'),
  de: deck('A6 B7 D4 E4 F6 G6 H6 I2 J2 K8 L5 M7 N3 O2 P6 R5 S10 T5 V3 W6 Z3'),
  it: deck('A8 B6 C11 D4 E3 F5 G5 I2 L5 M8 N2 O2 P9 R5 S10 T6 V4'),
  nl: deck('A5 B8 D5 E3 F3 G6 H6 I1 J2 K8 L5 M6 N3 O3 P6 R5 S9 T5 V6 W5 Z6'),
  pt: deck('A8 B6 C10 D4 E4 F5 G5 H1 I2 J3 L5 M8 N2 O2 P9 R5 S5 T6 V3'),
}

export const LETTER_CODES: readonly string[] = PLAYABLE_LETTERS.map((entry) => entry.letter)
