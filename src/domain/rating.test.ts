import { describe, expect, it } from 'vitest'
import { NEW_PROFILE } from './progression'
import { markRatingAsked, markRatingDone, ratingDue } from './rating'

describe('ratingDue', () => {
  it('comes at the tenth run', () => {
    expect(ratingDue({ ...NEW_PROFILE, runs: 9 })).toBe(false)
    expect(ratingDue({ ...NEW_PROFILE, runs: 10 })).toBe(true)
  })

  it('comes back twenty runs after a « Plus tard »', () => {
    const asked = markRatingAsked({ ...NEW_PROFILE, runs: 10 })
    expect(ratingDue({ ...asked, runs: 29 })).toBe(false)
    expect(ratingDue({ ...asked, runs: 30 })).toBe(true)
  })

  it('waits for the next run once asked', () => {
    expect(ratingDue(markRatingAsked({ ...NEW_PROFILE, runs: 10 }))).toBe(false)
  })

  it('never asks again once the store page was opened', () => {
    const done = markRatingDone({ ...NEW_PROFILE, runs: 10 })
    expect(ratingDue({ ...done, runs: 200 })).toBe(false)
  })
})
