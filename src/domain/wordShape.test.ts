import { describe, expect, it } from 'vitest'
import { acceptable } from './wordShape'

/**
 * The same cases live in `supabase/tests/22_word_shape.sql`: the server
 * repeats the refusal to nobody's benefit, and the two must agree on what a
 * dictionary can hold. The words here are the ones the moderators really
 * vouched for and no line could take.
 */
describe('acceptable', () => {
  it('refuses a form no dictionary line can carry', () => {
    expect(acceptable('M')).toBe(false)
    expect(acceptable('U')).toBe(false)
    expect(acceptable('X')).toBe(false)
    expect(acceptable('C&A')).toBe(false)
    expect(acceptable('H&M')).toBe(false)
    expect(acceptable('')).toBe(false)
    expect(acceptable('a')).toBe(false)
  })

  it('refuses digits, brackets and punctuation', () => {
    expect(acceptable('3e âge')).toBe(false)
    expect(acceptable('chat (félin)')).toBe(false)
    expect(acceptable('oui/non')).toBe(false)
    expect(acceptable('l’homme, debout')).toBe(false)
    expect(acceptable('sp. machin')).toBe(false)
  })

  it('keeps every Latin spelling a player can type', () => {
    expect(acceptable('cœur')).toBe(true)
    expect(acceptable('œil')).toBe(true)
    expect(acceptable('Nouvelle-Zélande')).toBe(true)
    expect(acceptable('États-Unis')).toBe(true)
    expect(acceptable('maître d’hôtel')).toBe(true)
    expect(acceptable('Saint-Étienne')).toBe(true)
  })

  it('holds the length a card can show', () => {
    expect(acceptable('a'.repeat(28))).toBe(true)
    expect(acceptable('a'.repeat(29))).toBe(false)
  })

  it('refuses a letter the matching cannot spell', () => {
    expect(acceptable('xə')).toBe(false)
    expect(acceptable('ŋa')).toBe(false)
  })
})
