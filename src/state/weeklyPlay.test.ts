import { describe, expect, it } from 'vitest'
import { mergeUsed } from './weeklyPlay'

describe('the attempts used today', () => {
  it('never fall below what the device saw start, nor what the server counted', () => {
    expect(mergeUsed(2, null)).toBe(2)
    expect(mergeUsed(1, 3)).toBe(3)
    expect(mergeUsed(0, 0)).toBe(0)
  })
})
