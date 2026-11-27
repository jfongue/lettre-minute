import { describe, expect, it } from 'vitest'
import { clockOf } from './rankedText'

describe('l’horloge de la file', () => {
  it('lit les minutes, puis les heures d’une longue pause', () => {
    expect(clockOf(42)).toBe('0:42')
    expect(clockOf(185)).toBe('3:05')
    expect(clockOf(3870)).toBe('1:04:30')
    expect(clockOf(-3)).toBe('0:00')
  })
})
