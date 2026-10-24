import { describe, expect, it } from 'vitest'
import { mergeUsed, rankFrom } from './weeklyPlay'

describe('the attempts used today', () => {
  it('never fall below what the device saw start, nor what the server counted', () => {
    expect(mergeUsed(2, null)).toBe(2)
    expect(mergeUsed(1, 3)).toBe(3)
    expect(mergeUsed(0, 0)).toBe(0)
  })
})

describe('the rank shown', () => {
  it('follows the server only once it has a classified attempt to place', () => {
    expect(rankFrom({ best: 61, rank: 2 })).toBe(2)
    // Un invité de CrazyGames joue sur son appareil : le serveur ne le classe
    // pas, et son récap n'a pas de valeur à comparer — pas de rang, pas de
    // « 1er sur 9 ».
    expect(rankFrom({ best: null, rank: 1 })).toBeNull()
    expect(rankFrom(null)).toBeNull()
  })
})
