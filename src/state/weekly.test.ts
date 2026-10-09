import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { lastRecapSeen, loadLocalAttempts, markRecapSeen, recapDue, recordLocalAd, recordLocalAttempt } from './weekly'

const store = new Map<string, string>()
const memory = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
}

beforeEach(() => {
  store.clear()
  Object.defineProperty(globalThis, 'localStorage', { value: memory, configurable: true })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage')
})

const MONDAY = { weekId: '2026-10-11', day: '2026-10-12' }
const TUESDAY = { weekId: '2026-10-11', day: '2026-10-13' }

describe('the local attempts', () => {
  it('count within a window and start again in the next day or week', () => {
    expect(loadLocalAttempts(MONDAY)).toEqual({ used: 0, ads: 0 })
    recordLocalAttempt(MONDAY)
    recordLocalAd(MONDAY)
    expect(recordLocalAttempt(MONDAY)).toEqual({ used: 2, ads: 1 })
    expect(loadLocalAttempts(MONDAY)).toEqual({ used: 2, ads: 1 })
    expect(loadLocalAttempts(TUESDAY)).toEqual({ used: 0, ads: 0 })
    expect(loadLocalAttempts({ weekId: '2026-10-18', day: '2026-10-12' })).toEqual({ used: 0, ads: 0 })
  })

  it('shrug off a damaged value', () => {
    store.set('lettre-minute.weekly-attempts.v1', '{"weekId":"2026-10-11","day":"2026-10-12","used":-3,"ads":"x"}')
    expect(loadLocalAttempts(MONDAY)).toEqual({ used: 0, ads: 0 })
    store.set('lettre-minute.weekly-attempts.v1', '{nope')
    expect(loadLocalAttempts(MONDAY)).toEqual({ used: 0, ads: 0 })
  })
})

describe('the recap', () => {
  it('is due once, after the week played has closed', () => {
    expect(lastRecapSeen()).toBeNull()
    expect(recapDue('2026-10-18', '2026-10-11')).toBe(true)
    expect(recapDue('2026-10-11', '2026-10-11')).toBe(false)
    expect(recapDue('2026-10-18', null)).toBe(false)
    markRecapSeen('2026-10-11')
    expect(recapDue('2026-10-18', '2026-10-11')).toBe(false)
    expect(recapDue('2026-10-25', '2026-10-18')).toBe(true)
  })
})
