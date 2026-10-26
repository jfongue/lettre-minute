import { describe, expect, it } from 'vitest'
import { breakDue, INTERSTITIAL_BREAKS, nextBreak, replayBreakDue } from './adBreaks'

const dueAmong = (schedule: typeof INTERSTITIAL_BREAKS, runs: number) =>
  Array.from({ length: runs }, (_, i) => i + 1).filter((n) => breakDue(n, schedule))

describe('breakDue', () => {
  it('breaks the phone on the 3rd, 7th, 13th, 21st and 31st finished run, gaps growing by two', () => {
    expect(dueAmong(INTERSTITIAL_BREAKS, 60)).toEqual([3, 7, 13, 21, 31, 43, 57])
  })

  it('never interrupts the first run, nor counts garbage', () => {
    for (const schedule of [INTERSTITIAL_BREAKS]) {
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

describe('replayBreakDue', () => {
  it('waits for two finished runs since the last break, so the first run never leads to one', () => {
    expect(replayBreakDue(0)).toBe(false)
    expect(replayBreakDue(1)).toBe(false)
    expect(replayBreakDue(2)).toBe(true)
    expect(replayBreakDue(3)).toBe(true)
    expect(replayBreakDue(Number.NaN)).toBe(false)
  })
})
