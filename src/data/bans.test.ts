import { describe, expect, it } from 'vitest'
import { bannedByLang, dampingFor, withoutBanned, type Row } from '../../scripts/ban-words.ts'

const row = (display: string, canonical?: string): Row => [display, 10, 1, canonical]

describe('withoutBanned', () => {
  it('retire le mot banni et les formes qui le fléchissent', () => {
    const rows = [row('chat'), row('chats', 'chat'), row('chien')]
    expect(withoutBanned(rows, new Set(['chat'])).map((line) => line[0])).toEqual(['chien'])
  })

  it('retire une forme visée elle-même', () => {
    const rows = [row('chat'), row('chats', 'chat')]
    expect(withoutBanned(rows, new Set(['chats'])).map((line) => line[0])).toEqual(['chat'])
  })

  it('laisse le dictionnaire entier quand rien n’est banni', () => {
    const rows = [row('chat'), row('chien')]
    expect(withoutBanned(rows, new Set())).toHaveLength(2)
  })
})

describe('dampingFor', () => {
  /** `total` lignes sur Z, dont `banned` signalées. */
  const fixture = (total: number, banned: number): [Row[], Set<string>] => {
    const rows = Array.from({ length: total }, (_, index) => row(`z${index}`))
    return [rows, new Set(rows.slice(0, banned).map((line) => line[0]))]
  }

  it('freine un couple qui a perdu la moitié de ses mots', () => {
    const [rows, banned] = fixture(10, 6)
    expect(dampingFor(rows, banned)).toEqual({ Z: 0.2 })
  })

  it('freine plus fort un couple presque vidé', () => {
    const [rows, banned] = fixture(10, 9)
    expect(dampingFor(rows, banned)).toEqual({ Z: 0.05 })
  })

  it('ne touche pas un couple intact', () => {
    const [rows, banned] = fixture(10, 0)
    expect(dampingFor(rows, banned)).toEqual({})
  })

  it('se tait sur un couple trop court pour dire quelque chose', () => {
    const [rows, banned] = fixture(4, 3)
    expect(dampingFor(rows, banned)).toEqual({})
  })

  it('ignore les mots que le dictionnaire n’a pas — un ban d’une autre version', () => {
    const [rows] = fixture(10, 0)
    expect(dampingFor(rows, new Set(['jamaisvu']))).toEqual({})
  })
})

describe('bannedByLang', () => {
  it('garde la dernière décision, ajout compris', () => {
    const bans = bannedByLang([
      { category_id: 'animaux', word: 'chat', kind: 'ban', decided_at: '2026-01-01' },
      { category_id: 'animaux', word: 'chat', kind: 'add', decided_at: '2026-02-01' },
      { category_id: 'de:animaux', word: 'katze', kind: 'ban', decided_at: '2026-01-01' },
    ])
    expect(bans.get('fr')).toBeUndefined()
    expect(bans.get('de')?.get('animaux')).toEqual(['katze'])
  })

  it('ne retient que les bans', () => {
    expect(bannedByLang([{ category_id: 'pays', word: 'urss', kind: 'add' }]).size).toBe(0)
  })
})
