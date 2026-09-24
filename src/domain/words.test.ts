import { describe, expect, it } from 'vitest'
import { buildWordPack, findWord, lettersWithEnough, lookup, showcaseWords, withinOneEdit, type WordRow } from './words'

const rows: WordRow[] = [['Chat', 120, 45.3], ['Chien', 150, 60], ['Écureuil', 60, 3.2], ['Zèbre', 90, 1.4]]

describe('buildWordPack', () => {
  it('reads a word, its fame and its corpus frequency', () => {
    const pack = buildWordPack('animaux', rows)

    expect(pack.entries.size).toBe(4)
    expect(pack.entries.get('chat')).toMatchObject({
      key: 'chat',
      display: 'Chat',
      sitelinks: 120,
      frequency: 45.3,
    })
  })

  it('counts the words available per letter, accents folded', () => {
    const pack = buildWordPack('animaux', rows)

    expect(pack.counts.get('C')).toBe(2)
    expect(pack.counts.get('E')).toBe(1)
    expect(pack.counts.get('Z')).toBe(1)
  })

  it('keeps the first spelling when a word appears twice', () => {
    const pack = buildWordPack('animaux', [['Chat', 120, 45.3], ['CHAT', 1, 0]])

    expect(pack.entries.size).toBe(1)
    expect(pack.entries.get('chat')?.display).toBe('Chat')
  })
})

describe('notoriété', () => {
  it('ranks the words of a category against each other', () => {
    const pack = buildWordPack('animaux', rows)

    const pack2 = pack
    expect(pack2.entries.get('chien')!.notoriety).toBeGreaterThan(pack2.entries.get('zebre')!.notoriety)
    expect(pack2.entries.get('zebre')!.notoriety).toBeGreaterThan(pack2.entries.get('ecureuil')!.notoriety)
    expect(pack2.entries.get('chien')!.notoriety).toBeLessThanOrEqual(1)
  })

  it('trusts what French readers look up over how many Wikipedias describe it', () => {
    // A bird with an article in eighty languages, all written by bots, against
    // one with fewer articles that French readers actually open.
    const pack = buildWordPack('oiseaux', [['Aigle martial', 80, 0, '', 12], ['Aigle royal', 60, 0, '', 900], ['Zébu', 5, 0.1]])

    expect(pack.entries.get('aigleroyal')!.views).toBe(900)
    expect(pack.entries.get('zebu')!.views).toBeUndefined()
    expect(pack.entries.get('aigleroyal')!.notoriety).toBeGreaterThan(pack.entries.get('aiglemartial')!.notoriety)
  })

  it('gives an inflected form the standing of the word it bends', () => {
    const pack = buildWordPack('animaux', [['Chat', 120, 45.3], ['Chats', 120, 8, 'chat'], ['Zébu', 1, 0.1]])

    expect(pack.entries.get('chats')!.notoriety).toBe(pack.entries.get('chat')!.notoriety)
  })
})

describe('lookup', () => {
  it('finds a word however the player spelled it', () => {
    const pack = buildWordPack('animaux', rows)

    expect(lookup(pack, '  ÉCUREUIL ')?.display).toBe('Écureuil')
    expect(lookup(pack, 'ecureuil')?.display).toBe('Écureuil')
    expect(lookup(pack, 'castor')).toBeNull()
  })
})

describe('formes fléchies', () => {
  const inflected = buildWordPack('animaux', [['Chat', 120, 45.3], ['Chats', 120, 8, 'chat']])

  it('accepts an inflected form and counts it as its base word', () => {
    expect(lookup(inflected, 'chats')?.key).toBe('chat')
    expect(lookup(inflected, 'chat')?.key).toBe('chat')
  })

  it('does not let a plural inflate what a letter can answer', () => {
    expect(inflected.counts.get('C')).toBe(1)
  })
})

describe('lettersWithEnough', () => {
  it('only keeps letters the category can answer', () => {
    const pack = buildWordPack('animaux', rows)

    expect(lettersWithEnough(pack, 2)).toEqual(['C'])
    expect(lettersWithEnough(pack, 1)).toEqual(['C', 'E', 'Z'])
  })
})

describe('withinOneEdit', () => {
  it('forgives two letters swapped', () => {
    expect(withinOneEdit('libellule', 'libelllue')).toBe(true)
    expect(withinOneEdit('renrad', 'renard')).toBe(true)
  })

  it('forgives a missing letter and a letter too many', () => {
    expect(withinOneEdit('libelule', 'libellule')).toBe(true)
    expect(withinOneEdit('libelllule', 'libellule')).toBe(true)
  })

  it('forgives one mistyped letter', () => {
    expect(withinOneEdit('libeflule', 'libellule')).toBe(true)
  })

  it('refuses two errors', () => {
    expect(withinOneEdit('libeflul', 'libellule')).toBe(false)
    expect(withinOneEdit('chien', 'chat')).toBe(false)
  })

  it('is not a way of spelling the word right', () => {
    expect(withinOneEdit('chat', 'chat')).toBe(false)
  })
})

describe('findWord', () => {
  const pack = buildWordPack(
    'animaux',
    [['Chat', 120, 45.3], ['Libellule', 0, 2.16], ['Lézard', 30, 1.1], ['Loutre', 20, 0.8], ['Loutres', 20, 0.1, 'loutre']],
  )

  it('answers exactly when the word is spelled right', () => {
    expect(findWord(pack, 'libellule')).toEqual({ entry: pack.entries.get('libellule'), approximate: false })
  })

  it('corrects a one-letter slip, and says that it did', () => {
    const match = findWord(pack, 'libelule')

    expect(match?.entry.display).toBe('Libellule')
    expect(match?.approximate).toBe(true)
  })

  it('reads a missing space, hyphen or apostrophe as the word spelled right', () => {
    const spaced = buildWordPack('pays', [['Côte d’Ivoire', 150, 3], ['Porte-clés', 0, 1], ['Aigle royal', 60, 0]])

    expect(findWord(spaced, 'cotedivoire')).toMatchObject({ approximate: false, entry: { display: 'Côte d’Ivoire' } })
    expect(findWord(spaced, 'porte cles')).toMatchObject({ approximate: false, entry: { display: 'Porte-clés' } })
    expect(findWord(spaced, 'aigleroyal')).toMatchObject({ approximate: false, entry: { key: 'aigle royal' } })
    // The one edit is still there for a real slip.
    expect(findWord(spaced, 'aiglerooyal')).toMatchObject({ approximate: true, entry: { display: 'Aigle royal' } })
  })

  it('corrects towards an inflected form as readily as a base word', () => {
    expect(findWord(pack, 'loutrs')?.entry.key).toBe('loutre')
  })

  it('refuses to guess between two words a letter away', () => {
    const ambiguous = buildWordPack('animaux', [['Loutre', 20, 0.8], ['Coutre', 5, 0.1], ['Louire', 5, 0.1]])

    expect(findWord(ambiguous, 'louvre')).toBeNull()
  })

  it('does not stretch a short word into another one', () => {
    const short = buildWordPack('animaux', [['Rat', 50, 10], ['Rut', 5, 1]])

    expect(findWord(short, 'ras')).toBeNull()
  })

  it('still answers nothing for a word that is nowhere near', () => {
    expect(findWord(pack, 'abracadabrantesque')).toBeNull()
  })
})

describe('showcaseWords', () => {
  it('lists the best-known base words first, inflected forms left out', () => {
    const pack = buildWordPack('animaux', [
      ['Chat', 120, 45.3],
      ['Chats', 120, 45.3, 'chat'],
      ['Zèbre', 90, 1.4],
      ['Chien', 150, 60],
    ])

    expect(showcaseWords(pack, 2)).toEqual(['Chien', 'Chat'])
    expect(showcaseWords(pack, 10)).not.toContain('Chats')
  })
})
