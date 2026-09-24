import { describe, expect, it } from 'vitest'
import { NEW_PROFILE, type Profile } from './progression'
import { markSupportAsked, supportDue } from './support'

const before: Profile = { ...NEW_PROFILE, runs: 11, bestScore: 1000 }
const after: Profile = { ...before, runs: 12 }

describe('supportDue', () => {
  it('asks after a record', () => {
    expect(supportDue(before, after, 1200, false)).toBe(true)
  })

  it('asks after a score close to the record', () => {
    expect(supportDue(before, after, 800, false)).toBe(true)
    expect(supportDue(before, after, 799, false)).toBe(false)
  })

  it('asks after a category or a power is kept', () => {
    expect(supportDue(before, { ...after, unlocked: ['sports'] }, 0, false)).toBe(true)
    expect(supportDue(before, { ...after, powers: ['joker'] }, 0, false)).toBe(true)
  })

  it('waits ten runs after the last ask', () => {
    expect(supportDue(before, { ...after, supportAskedAt: 3 }, 1200, false)).toBe(false)
    expect(supportDue(before, { ...after, supportAskedAt: 2 }, 1200, false)).toBe(true)
  })

  it('does not ask in the first ten runs, nor on the first run for its score', () => {
    const fresh = { ...NEW_PROFILE, runs: 1 }
    expect(supportDue(NEW_PROFILE, fresh, 500, false)).toBe(false)
    expect(supportDue({ ...NEW_PROFILE, runs: 0 }, { ...NEW_PROFILE, runs: 10 }, 500, false)).toBe(false)
  })

  it('never asks after a challenge run', () => {
    expect(supportDue(before, after, 1200, true)).toBe(false)
  })

  it('stops asking once asked, until ten more runs', () => {
    const asked = markSupportAsked(after)
    expect(supportDue(before, asked, 1200, false)).toBe(false)
    expect(supportDue(before, { ...asked, runs: asked.runs + 10 }, 1200, false)).toBe(true)
  })
})
