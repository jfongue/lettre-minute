import { describe, expect, it } from 'vitest'
import { comboMultiplier, NO_USAGE, notoriety, pointsFor, rarityScore, tierOf } from './rarity'
import type { WordEntry } from './words'

const common: WordEntry = { key: 'chat', display: 'Chat', sitelinks: 150, frequency: 120, notoriety: 0.95 }
const obscure: WordEntry = { key: 'zebu', display: 'Zébu', sitelinks: 40, frequency: 0.3, notoriety: 0.2 }

describe('notoriety', () => {
  it('reads the rank the dictionary computed', () => {
    expect(notoriety(common)).toBe(0.95)
    expect(notoriety(obscure)).toBeLessThan(notoriety(common))
  })

  it('stays within 0 and 1 whatever it is handed', () => {
    expect(notoriety({ key: 'x', display: 'X', sitelinks: 0, frequency: 0, notoriety: -1 })).toBe(0)
    expect(notoriety({ key: 'y', display: 'Y', sitelinks: 0, frequency: 0, notoriety: 4 })).toBe(1)
  })
})

describe('rarityScore', () => {
  it('pays a rare word more than a common one', () => {
    expect(rarityScore(obscure)).toBeGreaterThan(rarityScore(common))
  })

  it('wears down a word the player keeps reusing', () => {
    const fresh = rarityScore(obscure, NO_USAGE)
    const worn = rarityScore(obscure, { own: 3, globalShare: 0 })

    expect(worn).toBeLessThan(fresh / 2)
  })

  it('wears down a word everybody plays', () => {
    expect(rarityScore(obscure, { own: 0, globalShare: 0.8 })).toBeLessThan(rarityScore(obscure) * 0.3)
  })
})

describe('pointsFor', () => {
  it('always pays for a valid word, however common', () => {
    expect(pointsFor(common, NO_USAGE, 0)).toBeGreaterThanOrEqual(10)
  })

  it('pays a rare word more', () => {
    expect(pointsFor(obscure, NO_USAGE, 0)).toBeGreaterThan(pointsFor(common, NO_USAGE, 0))
  })

  it('multiplies a chain of answers, up to a ceiling', () => {
    expect(pointsFor(common, NO_USAGE, 3)).toBeGreaterThan(pointsFor(common, NO_USAGE, 0))
    expect(comboMultiplier(20)).toBe(comboMultiplier(9))
  })
})

describe('tierOf', () => {
  it('names each band for the player', () => {
    expect(tierOf(0.1)).toBe('courant')
    expect(tierOf(0.4)).toBe('peu commun')
    expect(tierOf(0.6)).toBe('rare')
    expect(tierOf(0.9)).toBe('très rare')
  })
})
