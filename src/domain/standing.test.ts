import { describe, expect, it } from 'vitest'
import { DEFAULT_AVATAR } from './avatar'
import type { BoardRow } from './boards'
import { standingMove } from './standing'

function board(...entries: [name: string, value: number][]): BoardRow[] {
  return entries.map(([name, value]) => ({ name, avatar: DEFAULT_AVATAR, value }))
}

describe('standingMove', () => {
  it('names the players a run overtook', () => {
    const before = board(['Ada', 300], ['Bob', 200], ['Cyd', 150], ['Moi', 100])
    const after = board(['Ada', 300], ['Moi', 250], ['Bob', 200], ['Cyd', 150])

    const move = standingMove(before, after, 'Moi')

    expect(move).toMatchObject({ from: 4, to: 2 })
    expect(move?.passed.map((row) => row.name)).toEqual(['Bob', 'Cyd'])
  })

  it('counts a first appearance as overtaking everyone now below', () => {
    const before = board(['Ada', 300], ['Bob', 200])
    const after = board(['Ada', 300], ['Moi', 250], ['Bob', 200])

    const move = standingMove(before, after, 'Moi')

    expect(move?.from).toBeNull()
    expect(move?.to).toBe(2)
    expect(move?.passed.map((row) => row.name)).toEqual(['Bob'])
  })

  it('does not count a newcomer below as overtaken', () => {
    const before = board(['Moi', 100])
    const after = board(['Moi', 120], ['Zoé', 90])

    expect(standingMove(before, after, 'Moi')).toEqual({ from: 1, to: 1, passed: [] })
  })

  it('reports a fall when others played better meanwhile', () => {
    const before = board(['Moi', 100], ['Ada', 90])
    const after = board(['Ada', 180], ['Moi', 100])

    expect(standingMove(before, after, 'Moi')).toEqual({ from: 1, to: 2, passed: [] })
  })

  it('finds the player whatever the case of their name', () => {
    expect(standingMove([], board(['Élodie', 10]), 'élodie')?.to).toBe(1)
  })

  it('has nothing to show when the player is off the board', () => {
    expect(standingMove(board(['Ada', 10]), board(['Ada', 10]), 'Moi')).toBeNull()
  })
})
