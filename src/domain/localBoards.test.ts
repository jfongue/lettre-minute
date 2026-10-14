import { describe, expect, it } from 'vitest'
import { DEFAULT_AVATAR } from './avatar'
import type { RunRecord } from './history'
import type { Leaderboard, PlacedRow } from './leaderboards'
import { guestFits, guestValue, localBoards, localLeaderboard, LOCAL_BOARD_SIZE, placeGuest, placeGuestRow, SERVER_BOARD_SIZE } from './localBoards'

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

const other = (name: string, value: number, place: number): PlacedRow => ({ name, avatar: DEFAULT_AVATAR, value, place, mine: false })
const me = { name: 'Moi', avatar: DEFAULT_AVATAR }

describe('l’invité sur un classement du serveur', () => {
  const history = [run(at(14, 8), 40, 3, 5), run(at(14, 10), 70, 6, 8), run(at(13, 10), 90, 9, 2)]

  it('compte ses parties de la période comme le serveur compte celles d’un joueur', () => {
    expect(guestValue('best', history, DAY, NOW)).toBe(70)
    expect(guestValue('combo', history, DAY, NOW)).toBe(6)
    expect(guestValue('points', history, DAY, NOW)).toBe(110)
    expect(guestValue('words', history, DAY, NOW)).toBe(13)
    expect(guestValue('runs', history, DAY, NOW)).toBe(2)
    expect(guestValue('best', history, 0, NOW)).toBe(90)
    expect(guestValue('discoveries', history, 0, NOW)).toBe(0)
    expect(guestValue('best', [], DAY, NOW)).toBe(0)
  })

  it('se glisse parmi les lignes, après les égalités, et les places se recomptent', () => {
    const board: Leaderboard = { rows: [other('a', 90, 1), other('b', 70, 2), other('c', 40, 3)], me: null }
    const placed = placeGuest(board, { ...me, value: 70 }, null)
    expect(placed.rows.map((row) => [row.name, row.place])).toEqual([['a', 1], ['b', 2], ['Moi', 2], ['c', 4]])
    expect(placed.rows[2]!.mine).toBe(true)
    expect(placed.me).toBeNull()
  })

  it('se range en dernier sur un tableau court, sans demander de rang au serveur', () => {
    const board: Leaderboard = { rows: [other('a', 90, 1)], me: null }
    expect(guestFits(board, 5)).toBe(true)
    expect(placeGuest(board, { ...me, value: 5 }, null).rows.map((row) => row.place)).toEqual([1, 2])
  })

  it('passe sous un tableau plein à la place que le serveur lui donne', () => {
    const full: Leaderboard = { rows: Array.from({ length: SERVER_BOARD_SIZE }, (_, index) => other(`p${index}`, 100 - index, index + 1)), me: null }
    expect(guestFits(full, 40)).toBe(false)
    expect(guestFits(full, 60)).toBe(true)
    expect(placeGuest(full, { ...me, value: 40 }, 63).me).toMatchObject({ name: 'Moi', place: 63, mine: true })
    expect(placeGuest(full, { ...me, value: 40 }, null)).toBe(full)
  })

  it('ne se montre pas sans valeur', () => {
    const board: Leaderboard = { rows: [other('a', 90, 1)], me: null }
    expect(placeGuest(board, { ...me, value: 0 }, 2)).toBe(board)
  })

  it('prend sa place sur un tableau de l’accueil', () => {
    const rows = [{ name: 'a', avatar: DEFAULT_AVATAR, value: 90 }, { name: 'b', avatar: DEFAULT_AVATAR, value: 30 }]
    expect(placeGuestRow(rows, { ...me, value: 50 }).map((row) => row.name)).toEqual(['a', 'Moi', 'b'])
    expect(placeGuestRow(rows, { ...me, value: 50 })[1]!.own).toBe(true)
    expect(placeGuestRow(rows, { ...me, value: 0 })).toEqual(rows)
  })
})
