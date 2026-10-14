import { describe, expect, it } from 'vitest'
import { DEFAULT_AVATAR } from './avatar'
import type { RunRecord } from './history'
import { localBoards, localLeaderboard, LOCAL_BOARD_SIZE } from './localBoards'

const run = (at: number, score: number, bestCombo = 0, words = 0): RunRecord => ({
  at,
  lang: 'fr',
  score,
  bestCombo,
  skips: 0,
  categoryIds: [],
  words: Array.from({ length: words }, () => ({ categoryId: 'animaux', word: 'chat', display: 'chat', points: 1 })),
})

// Wednesday 2026-10-14, midday local time.
const NOW = new Date(2026, 9, 14, 12).getTime()
const at = (day: number, hour = 9) => new Date(2026, 9, day, hour).getTime()
const DAY = at(14, 0)
const label = (stamp: number) => String(stamp)

describe('le classement local', () => {
  it('range les parties de la période, la meilleure d’abord, et marque toutes les lignes comme celles du joueur', () => {
    const board = localLeaderboard('best', DAY, [run(at(14, 11), 40), run(at(14, 8), 70), run(at(14, 10), 55)], NOW, DEFAULT_AVATAR, label)
    expect(board.rows.map((row) => row.value)).toEqual([70, 55, 40])
    expect(board.rows.map((row) => row.place)).toEqual([1, 2, 3])
    expect(board.rows.every((row) => row.mine)).toBe(true)
    expect(board.me).toBeNull()
  })

  it('partage la place entre deux parties à égalité', () => {
    const board = localLeaderboard('best', 0, [run(at(14), 50), run(at(13), 50), run(at(12), 30)], NOW, DEFAULT_AVATAR, label)
    expect(board.rows.map((row) => row.place)).toEqual([1, 1, 3])
  })

  it('ne regarde que la mesure demandée, et laisse de côté les parties qui valent zéro', () => {
    const history = [run(at(14), 10, 3, 5), run(at(14, 10), 90, 0, 0)]
    const values = (stat: 'combo' | 'words') => localLeaderboard(stat, DAY, history, NOW, DEFAULT_AVATAR, label).rows.map((row) => row.value)
    expect(values('combo')).toEqual([3])
    expect(values('words')).toEqual([5])
  })

  it('ne garde que les meilleures parties', () => {
    const history = Array.from({ length: LOCAL_BOARD_SIZE + 5 }, (_, index) => run(at(14) + index, index + 1))
    expect(localLeaderboard('best', DAY, history, NOW, DEFAULT_AVATAR, label).rows).toHaveLength(LOCAL_BOARD_SIZE)
  })

  it('nomme chaque ligne par l’instant de sa partie', () => {
    const board = localLeaderboard('best', DAY, [run(at(14, 8), 10)], NOW, DEFAULT_AVATAR, label)
    expect(board.rows[0]!.name).toBe(String(at(14, 8)))
  })
})

describe('les classements de l’accueil, en local', () => {
  it('donnent le jour et la semaine, sans découvertes', () => {
    const boards = localBoards([run(at(14), 40), run(at(12), 60)], NOW, (period) => (period === 'day' ? DAY : at(12, 0)), DEFAULT_AVATAR, () => label)
    expect(boards.day.map((row) => row.value)).toEqual([40])
    expect(boards.week.map((row) => row.value)).toEqual([60, 40])
    expect(boards.discoveries).toEqual([])
    expect(boards.day[0]!.own).toBe(true)
  })
})
