import { describe, expect, it } from 'vitest'
import { DEFAULT_AVATAR } from './avatar'
import { boardsStillValid, completeBoards, focusedRows, hasPlayers, HOUSE_PLAYER, openingBoard, projectBoards, withHousePlayer, type BoardRow, type Boards } from './boards'

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

  it('opens a long one on the podium, the player and friends, at their real rank, topped up with the best strangers', () => {
    const focused = focusedRows(rows(30), ['P12', 'p25'])
    expect(focused.rows.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 12, 25])
    expect(focused.more).toBe(true)
  })

  it('keeps every friend when they alone pass ten rows', () => {
    const friends = Array.from({ length: 12 }, (_, index) => `p${index + 15}`)
    const focused = focusedRows(rows(30), friends)
    expect(focused.rows.map((entry) => entry.rank)).toEqual([1, 2, 3, ...Array.from({ length: 12 }, (_, index) => index + 15)])
  })
})

describe('projectBoards', () => {
  const row = (name: string, value: number): BoardRow => ({ name, avatar: DEFAULT_AVATAR, value })
  const me = { name: 'Moi', avatar: DEFAULT_AVATAR }
  const boards = (day: BoardRow[]): Boards => ({ day, week: day, discoveries: [row('Ana', 3)] })

  it('raises the player to the place their new best earns, ahead of a tie on the name', () => {
    const next = projectBoards(boards([row('Ana', 200), row('Moi', 90), row('Bob', 120), row('Zoé', 150)].sort((a, b) => b.value - a.value)), me, 150)
    expect(next.day.map((line) => `${line.name} ${line.value}`)).toEqual(['Ana 200', 'Moi 150', 'Zoé 150', 'Bob 120'])
    expect(next.week).toEqual(next.day)
    expect(next.discoveries).toEqual([row('Ana', 3)])
  })

  it('leaves the board alone for a run under the player’s best', () => {
    const day = [row('Ana', 200), row('Moi', 180)]
    expect(projectBoards(boards(day), me, 100).day).toEqual(day)
  })

  it('brings a newcomer in where they rank, but not onto a full board they do not reach', () => {
    expect(projectBoards(boards([row('Ana', 200)]), me, 50).day.map((line) => line.name)).toEqual(['Ana', 'Moi'])
    const full = Array.from({ length: 50 }, (_, index) => row(`P${index}`, 500 - index))
    expect(projectBoards(boards(full), me, 10).day).toEqual(full)
    expect(projectBoards(boards(full), me, 1000).day[0]?.name).toBe('Moi')
  })
})

describe('boardsStillValid', () => {
  const kept: Boards = { day: [HOUSE_PLAYER], week: [HOUSE_PLAYER], discoveries: [HOUSE_PLAYER] }
  // Tuesday 24 November 2026, 10:00 in Paris.
  const tuesday = Date.parse('2026-11-24T10:00:00+01:00')

  it('keeps today’s boards, and empties a day or a week gone by', () => {
    expect(boardsStillValid(kept, tuesday - 3_600_000, tuesday)).toEqual(kept)
    expect(boardsStillValid(kept, tuesday - 86_400_000, tuesday)).toEqual({ day: [], week: [HOUSE_PLAYER], discoveries: [HOUSE_PLAYER] })
    expect(boardsStillValid(kept, tuesday - 3 * 86_400_000, tuesday)).toEqual({ day: [], week: [], discoveries: [] })
  })
})

describe('openingBoard', () => {
  const house = { ...HOUSE_PLAYER }
  it('opens on the week when only the house player stands on the day', () => {
    expect(openingBoard({ day: [house], week: [row('ana', 80), house], discoveries: [] })).toBe('week')
    expect(openingBoard({ day: [], week: [row('ana', 80)], discoveries: [] })).toBe('week')
  })
  it('stays on the day once someone has played today, or when the week is as empty', () => {
    expect(openingBoard({ day: [row('ana', 80), house], week: [row('ana', 80), house], discoveries: [] })).toBe('day')
    expect(openingBoard({ day: [house], week: [house], discoveries: [] })).toBe('day')
  })
  it('counts the house player by name, whatever its case', () => {
    expect(hasPlayers([row('demontoon', 50)])).toBe(false)
    expect(hasPlayers([row('Moi', 50)])).toBe(true)
  })
})
