import { describe, expect, it } from 'vitest'
import { capitalized, compactWord, initialOf, normalizeWord } from './text'

describe('normalizeWord', () => {
  it('reads accents, case and stray spacing as the same word', () => {
    expect(normalizeWord('  Éléphant ')).toBe('elephant')
    expect(normalizeWord('ELEPHANT')).toBe('elephant')
  })

  it('spells out ligatures, which NFD leaves alone', () => {
    expect(normalizeWord('Œuf')).toBe('oeuf')
    expect(normalizeWord('nævus')).toBe('naevus')
    expect(normalizeWord('Weißstorch')).toBe('weissstorch')
  })

  it('reads barred letters as their base letter rather than dropping them', () => {
    expect(normalizeWord('Ørsted')).toBe('orsted')
    expect(initialOf('Ørsted')).toBe('O')
    expect(normalizeWord('Łódź')).toBe('lodz')
    expect(normalizeWord('Đoković')).toBe('dokovic')
    expect(normalizeWord('Þingvellir')).toBe('thingvellir')
  })

  it('collapses punctuation so a hyphen is not a different answer', () => {
    expect(normalizeWord("Porte-clés")).toBe('porte cles')
    expect(normalizeWord('porte clés')).toBe('porte cles')
  })
})

describe('compactWord', () => {
  it('drops spaces, hyphens and apostrophes as well as accents', () => {
    expect(compactWord('Côte d’Ivoire')).toBe('cotedivoire')
    expect(compactWord("Côte-d'Ivoire")).toBe('cotedivoire')
    expect(compactWord('cote divoire')).toBe('cotedivoire')
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
