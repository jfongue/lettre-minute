import { describe, expect, it } from 'vitest'
import { botsOfferAfter, decayedRating, eloDeltas, overdue, ratingWindow, settledRating, stakes, standing, tierOrder, waitHint, PLACEMENT_GAMES } from './ranked'

describe('l’Elo', () => {
  // Les mêmes cas que supabase/tests/50_ranked_duel.sql : le serveur règle, l'écran annonce.
  it('rend les chiffres du serveur', () => {
    expect(eloDeltas([1000, 1000], [0, 0])).toEqual([40, -40])
    expect(eloDeltas([1000, 1000], [5, 5])).toEqual([20, -20])
    expect(eloDeltas([1000, 1000], [20, 20])).toEqual([10, -10])
    expect(eloDeltas([1200, 1000], [20, 20])).toEqual([5, -5])
    expect(eloDeltas([1000, 1200], [20, 20])).toEqual([15, -15])
    expect(eloDeltas([1000, 1000, 1000], [20, 20, 20])).toEqual([10, 0, -10])
    expect(eloDeltas([1400, 1000], [30, 0])).toEqual([2, -7])
  })

  it('annonce l’enjeu d’un duel des deux côtés', () => {
    expect(stakes({ rating: 1000, games: 20 }, { rating: 1200, games: 20 })).toEqual({ win: 15, loss: -5 })
    expect(stakes({ rating: 1000, games: 0 }, { rating: 1000, games: 0 })).toEqual({ win: 40, loss: -40 })
  })
})

describe('les rangs', () => {
  it('attendent les trois placements', () => {
    expect(standing({ rating: 1300, games: PLACEMENT_GAMES - 1 }).tier).toEqual({ kind: 'placement', placed: 2 })
    expect(standing({ rating: 1300, games: PLACEMENT_GAMES }).tier).toEqual({ kind: 'league', league: 'platinum', division: 2 })
  })

  it('coupent chaque ligue en trois divisions, III en bas, I en haut', () => {
    expect(standing({ rating: 1100, games: 9 }).tier).toEqual({ kind: 'league', league: 'gold', division: 3 })
    expect(standing({ rating: 1150, games: 9 }).tier).toEqual({ kind: 'league', league: 'gold', division: 2 })
    expect(standing({ rating: 1249, games: 9 }).tier).toEqual({ kind: 'league', league: 'gold', division: 1 })
    expect(standing({ rating: 760, games: 9 }).tier).toEqual({ kind: 'league', league: 'bronze', division: 3 })
    expect(standing({ rating: 1125, games: 9 }).progress).toBeCloseTo(0.5)
    expect(standing({ rating: 1900, games: 9 })).toMatchObject({ tier: { kind: 'league', league: 'diamond', division: 1 }, progress: 1 })
  })

  it('font Maîtres les dix premiers du classement', () => {
    expect(standing({ rating: 1500, games: 30 }, 3).tier).toEqual({ kind: 'master', spot: 3 })
    expect(standing({ rating: 1500, games: 30 }, 11).tier).toEqual({ kind: 'league', league: 'diamond', division: 1 })
    expect(standing({ rating: 1500, games: 2 }, 1).tier.kind).toBe('placement')
  })

  it('se suivent du Bronze III au Maître n° 1', () => {
    const order = [
      standing({ rating: 800, games: 9 }).tier,
      standing({ rating: 960, games: 9 }).tier,
      standing({ rating: 1110, games: 9 }).tier,
      standing({ rating: 1500, games: 9 }).tier,
      standing({ rating: 1500, games: 9 }, 2).tier,
      standing({ rating: 1500, games: 9 }, 1).tier,
    ].map(tierOrder)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('placent entre le Bronze et l’Or, et l’inactivité grignote', () => {
    expect(settledRating(1400, 3)).toBe(1249)
    expect(settledRating(700, 3)).toBe(800)
    expect(settledRating(1400, 4)).toBe(1400)
    expect(decayedRating(1200, 6)).toBe(1200)
    expect(decayedRating(1200, 10)).toBe(1185)
    expect(decayedRating(1200, 200)).toBe(1050)
    expect(decayedRating(980, 200)).toBe(950)
    expect(decayedRating(900, 200)).toBe(900)
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
