import { describe, expect, it } from 'vitest'
import type { Card } from './card'
import { BONUS_FULL_CARD, POINTS_SHARED, POINTS_UNIQUE, scoreRound } from './scoring'

const card: Card = {
  letter: 'C',
  categories: [
    { id: 'a', label: 'Animaux' },
    { id: 'b', label: 'Villes' },
    { id: 'c', label: 'Desserts' },
  ],
}

describe('scoreRound', () => {
  it('pays a word nobody else found more than a word everyone wrote', () => {
    const [ana, boris] = scoreRound(card, [
      { playerId: 'ana', words: ['Chat', 'Caen', 'Crumble'] },
      { playerId: 'boris', words: ['Chat', 'Cannes', ''] },
    ])

    expect(ana!.answers[0]!.status).toBe('shared')
    expect(ana!.answers[0]!.points).toBe(POINTS_SHARED)
    expect(ana!.answers[1]!.status).toBe('unique')
    expect(ana!.answers[1]!.points).toBe(POINTS_UNIQUE)
    expect(boris!.answers[2]!.status).toBe('blank')
    expect(boris!.answers[2]!.points).toBe(0)
  })

  it('treats accents and case as the same answer when looking for duplicates', () => {
    const [ana, boris] = scoreRound(card, [
      { playerId: 'ana', words: ['Crème', '', ''] },
      { playerId: 'boris', words: ['CREME', '', ''] },
    ])

    expect(ana!.answers[0]!.status).toBe('shared')
    expect(boris!.answers[0]!.status).toBe('shared')
  })

  it('rejects a word that does not start with the letter', () => {
    const [ana] = scoreRound(card, [{ playerId: 'ana', words: ['Tarte', '', ''] }])

    expect(ana!.answers[0]!.status).toBe('wrong-letter')
    expect(ana!.total).toBe(0)
  })

  it('does not let a rejected word count as a duplicate for the others', () => {
    const [, boris] = scoreRound(card, [
      { playerId: 'ana', words: ['Tarte', '', ''] },
      { playerId: 'boris', words: ['Tarte', '', ''] },
    ])

    expect(boris!.answers[0]!.status).toBe('wrong-letter')
  })

  it('adds the full-sheet bonus only when the three answers count', () => {
    const [ana, boris] = scoreRound(card, [
      { playerId: 'ana', words: ['Chat', 'Caen', 'Crumble'] },
      { playerId: 'boris', words: ['Cheval', 'Cannes', 'Tiramisu'] },
    ])

    expect(ana!.bonus).toBe(BONUS_FULL_CARD)
    expect(ana!.total).toBe(POINTS_UNIQUE * 3 + BONUS_FULL_CARD)
    expect(boris!.bonus).toBe(0)
  })

  it('keeps one score per player, in the order they were given', () => {
    const scores = scoreRound(card, [
      { playerId: 'ana', words: [] },
      { playerId: 'boris', words: [] },
    ])

    expect(scores.map((score) => score.playerId)).toEqual(['ana', 'boris'])
  })
})
