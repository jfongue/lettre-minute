import { describe, expect, it } from 'vitest'
import { botsOfferAfter, eloDeltas, overdue, ratingWindow, stakes, standing, waitHint, PLACEMENT_GAMES } from './ranked'

describe('l’Elo', () => {
  // Les mêmes cas que supabase/tests/50_ranked_duel.sql : le serveur règle, l'écran annonce.
  it('rend les chiffres du serveur', () => {
    expect(eloDeltas([1000, 1000], [0, 0])).toEqual([20, -20])
    expect(eloDeltas([1000, 1000], [20, 20])).toEqual([10, -10])
    expect(eloDeltas([1200, 1000], [20, 20])).toEqual([5, -5])
    expect(eloDeltas([1000, 1200], [20, 20])).toEqual([15, -15])
    expect(eloDeltas([1000, 1000, 1000], [20, 20, 20])).toEqual([10, 0, -10])
    expect(eloDeltas([1400, 1000], [30, 0])).toEqual([2, -4])
  })

  it('annonce l’enjeu d’un duel des deux côtés', () => {
    expect(stakes({ rating: 1000, games: 20 }, { rating: 1200, games: 20 })).toEqual({ win: 15, loss: -5 })
    expect(stakes({ rating: 1000, games: 0 }, { rating: 1000, games: 0 })).toEqual({ win: 20, loss: -20 })
  })
})

describe('les ligues', () => {
  it('attendent la fin des placements', () => {
    expect(standing({ rating: 1300, games: PLACEMENT_GAMES - 1 })).toMatchObject({ league: null, placed: 4 })
    expect(standing({ rating: 1300, games: PLACEMENT_GAMES })).toMatchObject({ league: 'platinum', placed: 5, next: 1400 })
  })

  it('montent avec l’Elo, et le diamant n’a pas de suite', () => {
    expect(standing({ rating: 940, games: 9 }).league).toBe('bronze')
    expect(standing({ rating: 950, games: 9 }).league).toBe('silver')
    expect(standing({ rating: 1100, games: 9 }).league).toBe('gold')
    expect(standing({ rating: 1650, games: 9 })).toMatchObject({ league: 'diamond', progress: 1, next: null })
    expect(standing({ rating: 1025, games: 9 }).progress).toBeCloseTo(0.5)
  })
})

describe('la file', () => {
  it('élargit l’écart d’Elo toutes les cinq secondes, puis l’ouvre', () => {
    expect(ratingWindow(0)).toBe(100)
    expect(ratingWindow(12)).toBe(200)
    expect(ratingWindow(30)).toBe(Infinity)
  })

  it('arrondit l’attente annoncée', () => {
    expect(waitHint(null)).toEqual({ kind: 'unknown' })
    expect(waitHint(3)).toEqual({ kind: 'seconds', value: 10 })
    expect(waitHint(37)).toEqual({ kind: 'seconds', value: 35 })
    expect(waitHint(70)).toEqual({ kind: 'minutes', value: 1 })
    expect(waitHint(150)).toEqual({ kind: 'minutes', value: 3 })
    expect(waitHint(400)).toEqual({ kind: 'long' })
  })

  it('propose les joueurs ordinateur tout de suite quand l’attente sera longue', () => {
    expect(botsOfferAfter(null)).toBe(15)
    expect(botsOfferAfter(20)).toBe(15)
    expect(botsOfferAfter(90)).toBe(0)
  })

  it('dit quand l’attente dépasse nettement l’estimation', () => {
    expect(overdue(40, 30)).toBe(false)
    expect(overdue(50, 30)).toBe(true)
    expect(overdue(500, null)).toBe(false)
  })
})
