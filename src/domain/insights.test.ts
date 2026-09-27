import { describe, expect, it } from 'vitest'
import {
  averagePoints,
  MIN_PAIR_DEALT,
  MIN_POWER_RUNS,
  mostEquipped,
  mostProfitable,
  mostProfitablePairs,
  mostPassedPairs,
  pairKey,
  pairYield,
  passRate,
  peak,
  type ActivityBucket,
  type PairTally,
  type PowerTally,
} from './insights'

const power = (id: string, runs: number, points: number, best = points): PowerTally => ({ power: id, runs, points, best })

const pair = (categoryId: string, letter: string, dealt: number, passed: number, words: number, points: number): PairTally => ({
  categoryId,
  letter,
  dealt,
  passed,
  words,
  points,
})

describe('averagePoints', () => {
  it('divides the points by the runs that carried the power', () => {
    expect(averagePoints(power('joker', 4, 300))).toBe(75)
  })

  it('answers zero rather than infinity on a power nobody played', () => {
    expect(averagePoints(power('joker', 0, 0))).toBe(0)
  })
})

describe('mostEquipped', () => {
  it('ranks by the runs first, the points breaking a tie', () => {
    const rows = mostEquipped([power('joker', 3, 900), power('hush', 9, 100), power('magic', 3, 200)])
    expect(rows.map((row) => row.power)).toEqual(['hush', 'joker', 'magic'])
  })

  it('keeps every power, however few runs it has', () => {
    expect(mostEquipped([power('joker', 1, 10), power('magic', 40, 10)])).toHaveLength(2)
  })

  it('leaves the tallies it was given alone', () => {
    const rows = [power('joker', 1, 10), power('magic', 40, 10)]
    mostEquipped(rows)
    expect(rows[0]!.power).toBe('joker')
  })
})

describe('mostProfitable', () => {
  it('ranks by the mean of a run, and hides what has not been played enough', () => {
    const rows = mostProfitable([
      power('joker', MIN_POWER_RUNS, 500),
      power('magic', MIN_POWER_RUNS + 1, 400),
      power('hush', MIN_POWER_RUNS - 1, 100000),
    ])
    expect(rows.map((row) => row.power)).toEqual(['joker', 'magic'])
  })

  it('keeps what it can rank, ties going to the power played most', () => {
    const rows = mostProfitable([power('joker', 5, 250), power('magic', 10, 500)])
    expect(rows.map((row) => row.power)).toEqual(['magic', 'joker'])
  })
})

describe('a pair', () => {
  it('yields its points on every draw, a pair left empty counting zero', () => {
    expect(pairYield(pair('pays', 'B', 10, 4, 6, 300))).toBe(30)
    expect(pairYield(pair('pays', 'B', 0, 0, 0, 0))).toBe(0)
  })

  it('passes in the share of its draws the players left empty', () => {
    expect(passRate(pair('pays', 'B', 10, 4, 6, 300))).toBe(0.4)
    expect(passRate(pair('pays', 'B', 0, 0, 0, 0))).toBe(0)
  })

  it('is named by its category and its letter', () => {
    expect(pairKey({ categoryId: 'pays', letter: 'B' })).toBe('pays:B')
  })
})

describe('mostProfitablePairs', () => {
  it('ranks by what a draw brings, thin pairs left out', () => {
    const rows = mostProfitablePairs([
      pair('pays', 'B', 20, 2, 18, 600),
      pair('animaux', 'Z', 20, 19, 1, 400),
      pair('couleurs', 'V', MIN_PAIR_DEALT - 1, 0, 4, 900),
    ])
    expect(rows.map(pairKey)).toEqual(['pays:B', 'animaux:Z'])
  })

  it('breaks a tie on the pair that was drawn most', () => {
    const rows = mostProfitablePairs([pair('pays', 'B', 10, 0, 10, 100), pair('pays', 'C', 40, 0, 40, 400)])
    expect(rows.map(pairKey)).toEqual(['pays:C', 'pays:B'])
  })
})

describe('mostPassedPairs', () => {
  it('ranks by the share of draws left empty, thin pairs left out', () => {
    const rows = mostPassedPairs([
      pair('pays', 'Z', 10, 9, 1, 10),
      pair('animaux', 'Z', 10, 5, 5, 100),
      pair('couleurs', 'V', MIN_PAIR_DEALT - 1, 100, 0, 0),
    ])
    expect(rows.map(pairKey)).toEqual(['pays:Z', 'animaux:Z'])
  })
})

describe('peak', () => {
  const buckets: ActivityBucket[] = [
    { at: 0, runs: 3, accounts: 0 },
    { at: 1, runs: 0, accounts: 7 },
  ]

  it('reads the tallest bar of the series it is showing', () => {
    expect(peak(buckets, 'runs')).toBe(3)
    expect(peak(buckets, 'accounts')).toBe(7)
  })

  it('never answers zero, which would divide the bars by nothing', () => {
    expect(peak([], 'runs')).toBe(1)
    expect(peak([{ at: 0, runs: 0, accounts: 0 }], 'accounts')).toBe(1)
  })
})
