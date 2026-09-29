import { describe, expect, it } from 'vitest'
import { refIn } from './inviteRef'

describe('refIn', () => {
  it('reads the code from an address and from a Play referrer', () => {
    expect(refIn('https://jfongue.github.io/lettre-minute/?ref=0123456789ab')).toBe('0123456789ab')
    expect(refIn('ref=0123456789ab&utm_source=x')).toBe('0123456789ab')
  })

  it('refuses anything that is not a code', () => {
    expect(refIn('https://jfongue.github.io/lettre-minute/')).toBeNull()
    expect(refIn('utm_source=google-play&utm_medium=organic')).toBeNull()
    expect(refIn('ref=../../etc')).toBeNull()
  })
})
