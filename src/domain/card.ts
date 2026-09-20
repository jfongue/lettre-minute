import { CATEGORIES, categoriesForLetter, type Category } from './categories'
import { PLAYABLE_LETTERS, type PlayableLetter } from './letters'
import { pickWeighted, shuffled, type Rng } from './rng'

export const CATEGORIES_PER_CARD = 3

export interface Card {
  letter: string
  categories: readonly Category[]
}

export interface DrawOptions {
  /** Categories already played in this match — avoided while there are enough left. */
  usedCategoryIds?: readonly string[]
  /** Letters already drawn in this match — same idea, the deck refills once exhausted. */
  usedLetters?: readonly string[]
  catalogue?: readonly Category[]
  letters?: readonly PlayableLetter[]
}

export function drawCard(rng: Rng, options: DrawOptions = {}): Card {
  const catalogue = options.catalogue ?? CATEGORIES
  const deck = options.letters ?? PLAYABLE_LETTERS
  const usedCategoryIds = new Set(options.usedCategoryIds ?? [])
  const usedLetters = new Set(options.usedLetters ?? [])

  // A letter is only dealt if it can fill a whole card; otherwise the round
  // would open on a category nobody can answer.
  const viable = deck.filter((entry) => categoriesForLetter(entry.letter, catalogue).length >= CATEGORIES_PER_CARD)
  const pool = viable.length > 0 ? viable : deck
  const unseen = pool.filter((entry) => !usedLetters.has(entry.letter))
  const letter = pickWeighted(rng, unseen.length > 0 ? unseen : pool, (entry) => entry.weight)?.letter ?? pool[0]!.letter

  const eligible = categoriesForLetter(letter, catalogue)
  const fresh = eligible.filter((category) => !usedCategoryIds.has(category.id))
  const drawPool = fresh.length >= CATEGORIES_PER_CARD ? fresh : eligible

  return { letter, categories: shuffled(rng, drawPool).slice(0, CATEGORIES_PER_CARD) }
}
