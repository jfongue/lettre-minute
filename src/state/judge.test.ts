import { describe, expect, it } from 'vitest'
import { NO_USAGE } from '../domain/rarity'
import { createJudge } from './judge'

describe('createJudge', () => {
  it('reads no usage for a word named like an Object property', () => {
    // « constructor » is a Spanish job: `{}['constructor']` once made its points NaN.
    const judge = createJudge([], { own: {}, crowd: {} })
    expect(judge.usage('constructor')).toBe(NO_USAGE)
    expect(judge.usage('hasOwnProperty')).toBe(NO_USAGE)
  })

  it('slows a pair damped by hand, with or without the crowd record', () => {
    const damped = { 'couleurs:H': 0.25 }
    const alone = createJudge([], { own: {}, crowd: {} }, undefined, undefined, damped)
    expect(alone.pull?.('couleurs', 'H')).toBe(0.25)
    expect(alone.pull?.('couleurs', 'B')).toBe(1)
    const records = { 'couleurs:H': { dealt: 0, passed: 0 } }
    expect(createJudge([], { own: {}, crowd: {} }, undefined, records, damped).pull?.('couleurs', 'H')).toBe(0.25)
  })

  it('leaves the draw to the dictionaries alone without records or damping, as in a challenge', () => {
    expect(createJudge([], { own: {}, crowd: {} }).pull).toBeUndefined()
  })
})
