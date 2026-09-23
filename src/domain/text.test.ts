import { describe, expect, it } from 'vitest'
import { capitalized, initialOf, normalizeWord } from './text'

describe('normalizeWord', () => {
  it('reads accents, case and stray spacing as the same word', () => {
    expect(normalizeWord('  Éléphant ')).toBe('elephant')
    expect(normalizeWord('ELEPHANT')).toBe('elephant')
  })

  it('spells out ligatures, which NFD leaves alone', () => {
    expect(normalizeWord('Œuf')).toBe('oeuf')
    expect(normalizeWord('nævus')).toBe('naevus')
  })

  it('collapses punctuation so a hyphen is not a different answer', () => {
    expect(normalizeWord("Porte-clés")).toBe('porte cles')
    expect(normalizeWord('porte clés')).toBe('porte cles')
  })
})

describe('initialOf', () => {
  it('judges an answer on its first letter, accent removed', () => {
    expect(initialOf('Éclair')).toBe('E')
    expect(initialOf('  tarte')).toBe('T')
  })

  it('returns nothing for an answer with no letter in it', () => {
    expect(initialOf('   ')).toBe('')
    expect(initialOf('42')).toBe('')
  })
})

describe('capitalized', () => {
  it('raises the first letter only, accents included', () => {
    expect(capitalized('éléphant de mer')).toBe('Éléphant de mer')
    expect(capitalized('')).toBe('')
  })
})
