import { describe, expect, it } from 'vitest'
import { CATEGORIES_PER_CARD, drawCard } from './card'
import { CATEGORIES } from './categories'
import { PLAYABLE_LETTERS } from './letters'
import { createRng, streamFor } from './rng'

describe('drawCard', () => {
  it('deals the same card twice from the same seed', () => {
    expect(drawCard(createRng(7))).toEqual(drawCard(createRng(7)))
  })

  it('never puts a category on a letter it cannot be played with', () => {
    for (let seed = 0; seed < 200; seed++) {
      const card = drawCard(streamFor(seed, 0))
      expect(card.categories).toHaveLength(CATEGORIES_PER_CARD)
      for (const category of card.categories) {
        expect(category.unplayable ?? []).not.toContain(card.letter)
      }
    }
  })

  it('draws three distinct categories', () => {
    for (let seed = 0; seed < 100; seed++) {
      const ids = drawCard(streamFor(seed, 1)).categories.map((category) => category.id)
      expect(new Set(ids).size).toBe(CATEGORIES_PER_CARD)
    }
  })

  it('only deals letters from the deck', () => {
    const deck = PLAYABLE_LETTERS.map((entry) => entry.letter)
    for (let seed = 0; seed < 100; seed++) {
      expect(deck).toContain(drawCard(streamFor(seed, 2)).letter)
    }
  })

  it('avoids categories already played', () => {
    const card = drawCard(createRng(3))
    const again = drawCard(createRng(3), { usedCategoryIds: card.categories.map((category) => category.id) })
    expect(again.categories.map((category) => category.id)).not.toContain(card.categories[0]!.id)
  })

  it('reuses categories rather than dealing a short card once the catalogue runs dry', () => {
    const card = drawCard(createRng(11), { usedCategoryIds: CATEGORIES.map((category) => category.id) })
    expect(card.categories).toHaveLength(CATEGORIES_PER_CARD)
  })

  it('skips a letter the catalogue cannot fill', () => {
    const catalogue = CATEGORIES.slice(0, 6).map((category) => ({ ...category, unplayable: ['A'] }))
    for (let seed = 0; seed < 50; seed++) {
      expect(drawCard(streamFor(seed, 0), { catalogue }).letter).not.toBe('A')
    }
  })
})
