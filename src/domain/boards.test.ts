import { describe, expect, it } from 'vitest'
import { DEFAULT_AVATAR } from './avatar'
import { completeBoards, HOUSE_PLAYER, withHousePlayer, type BoardRow } from './boards'

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
