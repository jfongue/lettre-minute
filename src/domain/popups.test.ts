import { describe, expect, it } from 'vitest'
import { nextPop, type PopId } from './popups'

const due = (...ids: PopId[]) => new Set(ids)

describe('nextPop', () => {
  it('waits for the store before showing anything', () => {
    expect(nextPop(due('challenge', 'rating'), null, false)).toBeNull()
  })

  it('shows the update before any other', () => {
    expect(nextPop(due('rating', 'challenge', 'update'), null, true)).toBe('update')
  })

  it('goes on in order once the update is put off', () => {
    expect(nextPop(due('rating', 'challenge'), null, true)).toBe('challenge')
    expect(nextPop(due('rating'), null, true)).toBe('rating')
  })

  it('keeps the open pop-up when a more pressing one comes due', () => {
    expect(nextPop(due('update', 'rating'), 'rating', true)).toBe('rating')
  })

  it('moves on once the open pop-up is answered', () => {
    expect(nextPop(due('feedback'), 'rating', true)).toBe('feedback')
    expect(nextPop(due(), 'rating', true)).toBeNull()
  })
})
