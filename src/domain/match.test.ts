import { describe, expect, it } from 'vitest'
import { createMatch, isOver, recordRound, roundNumber, standings, type Match } from './match'
import type { RoundAnswers } from './scoring'

const players = [
  { id: 'ana', name: 'Ana' },
  { id: 'boris', name: 'Boris' },
]

function silentRound(match: Match): RoundAnswers[] {
  return match.players.map((player) => ({ playerId: player.id, words: [] }))
}

describe('createMatch', () => {
  it('opens on a card and no history', () => {
    const match = createMatch({ seed: 1, players })

    expect(match.history).toHaveLength(0)
    expect(match.card.categories).toHaveLength(3)
    expect(roundNumber(match)).toBe(1)
    expect(isOver(match)).toBe(false)
  })

  it('deals the same match from the same seed', () => {
    expect(createMatch({ seed: 42, players }).card).toEqual(createMatch({ seed: 42, players }).card)
  })
})

describe('recordRound', () => {
  it('files the played card and turns over a new one', () => {
    const match = createMatch({ seed: 5, players })
    const next = recordRound(match, silentRound(match))

    expect(next.history[0]!.card).toEqual(match.card)
    expect(next.card).not.toEqual(match.card)
    expect(roundNumber(next)).toBe(2)
  })

  it('never repeats a letter or a category while the deck holds', () => {
    let match = createMatch({ seed: 9, players, settings: { rounds: 8, seconds: 94 } })
    const letters: string[] = []
    const categories: string[] = []

    while (!isOver(match)) {
      letters.push(match.card.letter)
      categories.push(...match.card.categories.map((category) => category.id))
      match = recordRound(match, silentRound(match))
    }

    expect(new Set(letters).size).toBe(letters.length)
    expect(new Set(categories).size).toBe(categories.length)
  })

  it('stops dealing once the last round is in', () => {
    let match = createMatch({ seed: 2, players, settings: { rounds: 2, seconds: 60 } })
    const first = match.card
    match = recordRound(match, silentRound(match))
    const second = match.card
    match = recordRound(match, silentRound(match))

    expect(isOver(match)).toBe(true)
    expect(match.history.map((round) => round.card)).toEqual([first, second])
    expect(match.card).toEqual(second)
  })
})

describe('standings', () => {
  it('adds up every round and ranks from the top', () => {
    let match = createMatch({ seed: 4, players })
    const letter = match.card.letter
    match = recordRound(match, [
      { playerId: 'ana', words: [`${letter}a`, `${letter}b`, `${letter}c`] },
      { playerId: 'boris', words: ['', '', ''] },
    ])

    const [first, second] = standings(match)
    expect(first!.player.id).toBe('ana')
    expect(first!.rank).toBe(1)
    expect(first!.points).toBe(7)
    expect(second!.player.id).toBe('boris')
    expect(second!.rank).toBe(2)
  })

  it('gives tied players the same rank', () => {
    const match = createMatch({ seed: 6, players })

    expect(standings(match).map((entry) => entry.rank)).toEqual([1, 1])
  })

  it('lists a player who has not scored yet', () => {
    const match = createMatch({ seed: 8, players })

    expect(standings(match).map((entry) => entry.points)).toEqual([0, 0])
  })
})
