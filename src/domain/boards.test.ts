import { describe, expect, it } from 'vitest'
import { DEFAULT_AVATAR } from './avatar'
import { completeBoards, focusedRows, HOUSE_PLAYER, withHousePlayer, type BoardRow } from './boards'

function row(name: string, value: number): BoardRow {
  return { name, avatar: DEFAULT_AVATAR, value }
}

describe('withHousePlayer', () => {
  it('fills an empty board', () => {
    expect(withHousePlayer([])).toEqual([HOUSE_PLAYER])
  })

  it('ranks the house score among the others', () => {
    const board = withHousePlayer([row('Ada', 200), row('Zoé', 40)])

    expect(board.map((entry) => entry.name)).toEqual(['Ada', 'Demontoon', 'Zoé'])
    expect(board[1].value).toBe(94)
  })

  it('keeps a real score by the house account, whatever it is', () => {
    const board = withHousePlayer([row('Ada', 200), row('demontoon', 12)])

    expect(board).toEqual([row('Ada', 200), row('demontoon', 12)])
  })
})

describe('completeBoards', () => {
  it('leaves the discoveries board to real finds', () => {
    const boards = completeBoards({ day: [], week: [], discoveries: [] })

    expect(boards.day).toEqual([HOUSE_PLAYER])
    expect(boards.week).toEqual([HOUSE_PLAYER])
    expect(boards.discoveries).toEqual([])
  })
})

describe('focusedRows', () => {
  const rows = (count: number) => Array.from({ length: count }, (_, index) => ({ name: `p${index + 1}`, avatar: DEFAULT_AVATAR, value: 100 - index }))

  it('shows a short board whole', () => {
    expect(focusedRows(rows(10), []).rows).toHaveLength(10)
    expect(focusedRows(rows(10), []).more).toBe(false)
  })

  it('opens a long one on the podium, the player and friends, at their real rank', () => {
    const focused = focusedRows(rows(30), ['P12', 'p25'])
    expect(focused.rows.map((entry) => entry.rank)).toEqual([1, 2, 3, 12, 25])
    expect(focused.more).toBe(true)
  })
})
