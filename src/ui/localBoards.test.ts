import { describe, expect, it } from 'vitest'
import { periodStart } from './localBoards'

describe('les périodes d’un classement local', () => {
  // Mercredi 14 octobre 2026, midi : le lundi de sa semaine est le 12.
  const now = new Date(2026, 9, 14, 12).getTime()

  it('ouvrent le jour à minuit de l’appareil', () => {
    expect(periodStart('day', now)).toBe(new Date(2026, 9, 14).getTime())
  })

  it('ouvrent la semaine le lundi, un dimanche compris dans celle qui finit', () => {
    expect(periodStart('week', now)).toBe(new Date(2026, 9, 12).getTime())
    expect(periodStart('week', new Date(2026, 9, 18, 23).getTime())).toBe(new Date(2026, 9, 12).getTime())
  })

  it('ne bornent pas le total', () => {
    expect(periodStart('all', now)).toBe(0)
  })
})
