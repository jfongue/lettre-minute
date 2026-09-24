import { describe, expect, it } from 'vitest'
import { PLAYABLE_LETTERS } from '../domain/letters'
import { NO_USAGE } from '../domain/rarity'
import { createJudge } from './judge'

describe('createJudge', () => {
  it('reads no usage for a word named like an Object property', () => {
    // « constructor » is a Spanish job: `{}['constructor']` once made its points NaN.
    const judge = createJudge([], { own: {}, crowd: {} }, PLAYABLE_LETTERS)
    expect(judge.usage('constructor')).toBe(NO_USAGE)
    expect(judge.usage('hasOwnProperty')).toBe(NO_USAGE)
  })
})
