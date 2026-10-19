import { describe, expect, it } from 'vitest'
import { midgameDue } from './adBreaks'

describe('midgameDue', () => {
  it('falls on the 2nd, 5th, 9th, 14th and 20th finished run, gaps growing by one', () => {
    const due = Array.from({ length: 40 }, (_, i) => i + 1).filter(midgameDue)
    expect(due).toEqual([2, 5, 9, 14, 20, 27, 35])
  })

  it('never interrupts the first run, nor counts garbage', () => {
    expect(midgameDue(0)).toBe(false)
    expect(midgameDue(1)).toBe(false)
    expect(midgameDue(-3)).toBe(false)
    expect(midgameDue(2.5)).toBe(false)
    expect(midgameDue(Number.NaN)).toBe(false)
  })
})
