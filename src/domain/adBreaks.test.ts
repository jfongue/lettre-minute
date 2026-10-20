import { describe, expect, it } from 'vitest'
import { breakDue, INTERSTITIAL_BREAKS, MIDGAME_BREAKS, nextBreak } from './adBreaks'

const dueAmong = (schedule: typeof MIDGAME_BREAKS, runs: number) =>
  Array.from({ length: runs }, (_, i) => i + 1).filter((n) => breakDue(n, schedule))

describe('breakDue', () => {
  it('breaks CrazyGames on the 2nd, 5th, 9th, 14th and 20th finished run, gaps growing by one', () => {
    expect(dueAmong(MIDGAME_BREAKS, 40)).toEqual([2, 5, 9, 14, 20, 27, 35])
  })

  it('breaks the phone on the 3rd, 7th, 13th, 21st and 31st finished run, gaps growing by two', () => {
    expect(dueAmong(INTERSTITIAL_BREAKS, 60)).toEqual([3, 7, 13, 21, 31, 43, 57])
  })

  it('never interrupts the first run, nor counts garbage', () => {
    for (const schedule of [MIDGAME_BREAKS, INTERSTITIAL_BREAKS]) {
      expect(breakDue(0, schedule)).toBe(false)
      expect(breakDue(1, schedule)).toBe(false)
      expect(breakDue(-3, schedule)).toBe(false)
      expect(breakDue(2.5, schedule)).toBe(false)
      expect(breakDue(Number.NaN, schedule)).toBe(false)
    }
  })
})

describe('nextBreak', () => {
  it('names the break to load an ad for, a run or more ahead', () => {
    expect(nextBreak(0, INTERSTITIAL_BREAKS)).toBe(3)
    expect(nextBreak(2, INTERSTITIAL_BREAKS)).toBe(3)
    expect(nextBreak(3, INTERSTITIAL_BREAKS)).toBe(7)
    expect(nextBreak(12, INTERSTITIAL_BREAKS)).toBe(13)
    expect(nextBreak(13, INTERSTITIAL_BREAKS)).toBe(21)
  })
})
