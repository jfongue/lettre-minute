import { describe, expect, it } from 'vitest'
import { DEFAULT_AVATAR } from './avatar'
import { HOUSE_PLAYER } from './boards'
import { completeLeaderboard, myPlace, type PlacedRow } from './leaderboards'

function row(name: string, value: number, place: number, mine = false): PlacedRow {
  return { name, avatar: DEFAULT_AVATAR, value, place, mine }
}

describe('completeLeaderboard', () => {
  it('ranks the house player on the best run of the day, pushing those below him down', () => {
    const board = completeLeaderboard('best', 'day', { rows: [row('Ada', 200, 1), row('Zoé', 40, 2), row('Yan', 40, 2)], me: null })

    expect(board.rows.map((entry) => [entry.name, entry.place])).toEqual([
      ['Ada', 1],
      ['Demontoon', 2],
      ['Zoé', 3],
      ['Yan', 3],
    ])
  })

  it('shares a place with an equal score', () => {
    const board = completeLeaderboard('best', 'week', { rows: [row('Ada', HOUSE_PLAYER.value, 1)], me: null })

    expect(board.rows.map((entry) => entry.place)).toEqual([1, 1])
  })

  it('moves a far player down a place when the house player beats him', () => {
    const board = completeLeaderboard('best', 'day', { rows: [row('Ada', 200, 1)], me: row('Moi', 10, 51, true) })

    expect(board.me?.place).toBe(52)
  })

  it('keeps him off totals and counts', () => {
    const board = { rows: [row('Ada', 200, 1)], me: null }

    expect(completeLeaderboard('best', 'all', board)).toBe(board)
    expect(completeLeaderboard('runs', 'day', board)).toBe(board)
  })

  it('leaves the account its own real score', () => {
    const board = { rows: [row('demontoon', 12, 1)], me: null }

    expect(completeLeaderboard('best', 'day', board)).toBe(board)
  })
})

describe('myPlace', () => {
  it('finds the player among the rows or past them', () => {
    expect(myPlace({ rows: [row('Ada', 3, 1), row('Moi', 2, 2, true)], me: null })?.place).toBe(2)
    expect(myPlace({ rows: [row('Ada', 3, 1)], me: row('Moi', 1, 70, true) })?.place).toBe(70)
    expect(myPlace({ rows: [row('Ada', 3, 1)], me: null })).toBeNull()
  })
})
