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

export const LETTER_CODES: readonly string[] = PLAYABLE_LETTERS.map((entry) => entry.letter)
