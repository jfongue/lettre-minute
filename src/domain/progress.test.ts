import { describe, expect, it } from 'vitest'
import { NEW_PROFILE, type Profile } from './progression'
import { parseProgress, progressOf, withProgress } from './progress'

const profile = (patch: Partial<Profile>): Profile => ({ ...NEW_PROFILE, ...patch })

describe('cloud progress', () => {
  it('survives the trip through the server', () => {
    const local = profile({ runs: 12, unlocked: ['sports'], powers: ['joker'], equipped: ['joker'], banned: ['pays'], peeks: 3, plusSince: 5 })
    const saved = parseProgress(JSON.parse(JSON.stringify(progressOf(local))))
    expect(saved).toEqual(progressOf(local))
    expect(withProgress(local, saved!)).toEqual(local)
  })

  it('reads nothing from what is not a save', () => {
    expect(parseProgress(null)).toBeNull()
    expect(parseProgress([1, 2])).toBeNull()
    expect(parseProgress({ unlocked: 'sports', powers: [3, 'hush'], peeks: -2 })).toMatchObject({ unlocked: [], powers: ['hush'], peeks: 0 })
  })

  it('never takes back a pick made on either device', () => {
    const phone = profile({ runs: 30, unlocked: ['sports'], powers: ['joker'] })
    const tablet = progressOf(profile({ runs: 10, unlocked: ['metiers'], powers: ['hush'] }))
    const merged = withProgress(phone, tablet)
    expect(merged.unlocked).toEqual(['sports', 'metiers'])
    expect(merged.powers).toEqual(['joker', 'hush'])
  })

  it('keeps what is under way from the copy that played last, without what the other already owns', () => {
    const phone = profile({ runs: 5, offer: ['sports', 'metiers', 'plantes'], equipped: [] })
    const tablet = progressOf(profile({ runs: 40, unlocked: ['plantes'], offer: ['objets', 'plantes', 'marques'], powers: ['hush'], equipped: ['hush', 'joker'], banned: ['pays'] }))
    const merged = withProgress(phone, tablet)
    expect(merged.offer).toEqual(['objets', 'marques'])
    expect(merged.equipped).toEqual(['hush'])
    expect(merged.banned).toEqual(['pays'])
    expect(merged.runs).toBe(5)
  })

  it('dates Premium from the first time, and keeps the highest counters', () => {
    const merged = withProgress(profile({ plusSince: 900, peeks: 2 }), progressOf(profile({ plusSince: 400, peeks: 7 })))
    expect(merged.plusSince).toBe(400)
    expect(merged.peeks).toBe(7)
    expect(withProgress(profile({ plusSince: 0 }), progressOf(profile({ plusSince: 400 }))).plusSince).toBe(400)
  })
})
