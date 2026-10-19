import { describe, expect, it } from 'vitest'
import type { WordRow } from '../src/domain/words'
import { applyAmendments } from './amended-words'

const dictionary = (): Map<string, WordRow> =>
  new Map<string, WordRow>([
    ['ecureuil', ['Ecureuil', 60, 3.2]],
    ['ecureuils', ['Ecureuils', 60, 0, 'ecureuil']],
    ['chat', ['Chat', 120, 45.3, '', 900]],
    ['chats', ['Chats', 120, 0, 'chat']],
    ['cheval', ['Cheval', 90, 20]],
    ['chevaux', ['Chevaux', 90, 0, 'cheval']],
  ])

describe('applyAmendments', () => {
  it('renames a word, keeping what the row knew', () => {
    const rows = dictionary()
    expect(applyAmendments(rows, [{ from: 'chat', to: 'Chatte' }])).toEqual({ applied: 1, missing: [] })
    expect(rows.has('chat')).toBe(false)
    expect(rows.get('chatte')).toEqual(['Chatte', 120, 45.3, '', 900])
  })

  it('drops the forms of a spelling whose key changed', () => {
    const rows = dictionary()
    applyAmendments(rows, [{ from: 'cheval', to: 'Chevale' }])
    expect(rows.has('chevaux')).toBe(false)
    expect(rows.has('chevale')).toBe(true)
  })

  it('keeps the forms when only the display changed', () => {
    const rows = dictionary()
    applyAmendments(rows, [{ from: 'Ecureuil', to: 'Écureuil' }])
    expect(rows.get('ecureuil')?.[0]).toBe('Écureuil')
    expect(rows.get('ecureuils')?.[3]).toBe('ecureuil')
  })

  it('lets the corrected spelling beat another row it compacts alike', () => {
    const rows = dictionary()
    rows.set('alpen steinbock', ['Alpen-Steinbock', 10, 0])
    rows.set('alpensteinbok', ['Alpensteinbok', 20, 0])
    applyAmendments(rows, [{ from: 'alpensteinbok', to: 'Alpensteinbock' }])
    expect([...rows.keys()].filter((key) => key.includes('alpen'))).toEqual(['alpensteinbock'])
  })

  it('names the corrections that have no word left', () => {
    const rows = dictionary()
    expect(applyAmendments(rows, [{ from: 'zebre', to: 'Zèbre' }, { from: 'chat', to: 'Chat2' }])).toEqual({
      applied: 0,
      missing: ['zebre', 'chat'],
    })
    expect(rows.size).toBe(6)
  })

  it('applies a later correction of the same word on top of the first', () => {
    const rows = dictionary()
    applyAmendments(rows, [
      { from: 'cheval', to: 'Chevale' },
      { from: 'chevale', to: 'Chevalle' },
    ])
    expect(rows.has('chevale')).toBe(false)
    expect(rows.get('chevalle')?.[0]).toBe('Chevalle')
  })
})
