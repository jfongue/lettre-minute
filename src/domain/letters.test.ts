import { describe, expect, it } from 'vitest'
import { LETTER_DECKS, PLAYABLE_LETTERS } from './letters'

describe('LETTER_DECKS', () => {
  it('keeps the French deck as it was', () => {
    expect(LETTER_DECKS.fr).toBe(PLAYABLE_LETTERS)
  })

  it('gives German the letters French leaves out', () => {
    const german = LETTER_DECKS.de!.map((entry) => entry.letter)
    expect(german).toEqual(expect.arrayContaining(['K', 'W', 'Z']))
  })

  it('writes every deck as single capitals with a positive weight', () => {
    for (const deck of Object.values(LETTER_DECKS)) {
      for (const { letter, weight } of deck) {
        expect(letter).toMatch(/^[A-Z]$/)
        expect(weight).toBeGreaterThan(0)
      }
    }
  })
})
