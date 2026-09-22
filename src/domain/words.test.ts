import { describe, expect, it } from 'vitest'
import { lettersWithEnough, lookup, parseWordPack } from './words'

const raw = ['Chat|120|45.30', 'Chien|150|60.00', 'Écureuil|60|3.20', 'Zèbre|90|1.40', ''].join('\n')

describe('parseWordPack', () => {
  it('reads a word, its fame and its corpus frequency', () => {
    const pack = parseWordPack('animaux', raw)

    expect(pack.entries.size).toBe(4)
    expect(pack.entries.get('chat')).toMatchObject({
      key: 'chat',
      display: 'Chat',
      sitelinks: 120,
      frequency: 45.3,
    })
  })

  it('counts the words available per letter, accents folded', () => {
    const pack = parseWordPack('animaux', raw)

    expect(pack.counts.get('C')).toBe(2)
    expect(pack.counts.get('E')).toBe(1)
    expect(pack.counts.get('Z')).toBe(1)
  })

  it('keeps the first spelling when a word appears twice', () => {
    const pack = parseWordPack('animaux', 'Chat|120|45.30\nCHAT|1|0.00')

    expect(pack.entries.size).toBe(1)
    expect(pack.entries.get('chat')?.display).toBe('Chat')
  })
})

describe('notoriété', () => {
  it('ranks the words of a category against each other', () => {
    const pack = parseWordPack('animaux', raw)

    const pack2 = pack
    expect(pack2.entries.get('chien')!.notoriety).toBeGreaterThan(pack2.entries.get('zebre')!.notoriety)
    expect(pack2.entries.get('zebre')!.notoriety).toBeGreaterThan(pack2.entries.get('ecureuil')!.notoriety)
    expect(pack2.entries.get('chien')!.notoriety).toBeLessThanOrEqual(1)
  })

  it('gives an inflected form the standing of the word it bends', () => {
    const pack = parseWordPack('animaux', ['Chat|120|45.30', 'Chats|120|8.00|chat', 'Zébu|1|0.10'].join('\n'))

    expect(pack.entries.get('chats')!.notoriety).toBe(pack.entries.get('chat')!.notoriety)
  })
})

describe('lookup', () => {
  it('finds a word however the player spelled it', () => {
    const pack = parseWordPack('animaux', raw)

    expect(lookup(pack, '  ÉCUREUIL ')?.display).toBe('Écureuil')
    expect(lookup(pack, 'ecureuil')?.display).toBe('Écureuil')
    expect(lookup(pack, 'castor')).toBeNull()
  })
})

describe('formes fléchies', () => {
  const inflected = parseWordPack('animaux', ['Chat|120|45.30', 'Chats|120|8.00|chat'].join('\n'))

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
    const pack = parseWordPack('animaux', raw)

    expect(lettersWithEnough(pack, 2)).toEqual(['C'])
    expect(lettersWithEnough(pack, 1)).toEqual(['C', 'E', 'Z'])
  })
})
