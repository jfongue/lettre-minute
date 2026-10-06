import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NEW_PROFILE } from '../domain/progression'
import type { RunRecord } from '../domain/history'
import { loadAvatar, loadHistory, loadMultiplayerNews, loadProfile, loadSubmissions, saveHistory, saveMultiplayerPlayed, saveProfile } from './storage'

const store = new Map<string, string>()
const memory = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
}

const put = (key: string, raw: string) => store.set(`lettre-minute.${key}.v1`, raw)

beforeEach(() => {
  store.clear()
  Object.defineProperty(globalThis, 'localStorage', { value: memory, configurable: true })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage')
})

const RUN: RunRecord = {
  at: 1_700_000_000_000,
  lang: 'fr',
  score: 42,
  bestCombo: 3,
  skips: 1,
  categoryIds: ['pays', 'animaux'],
  words: [{ categoryId: 'pays', word: 'france', display: 'France', points: 12 }],
}

describe('local storage', () => {
  it('reads back what it wrote', () => {
    const profile = { ...NEW_PROFILE, xp: 900, runs: 4, usage: { chat: 2 }, unlocked: ['sports'] }
    saveProfile(profile)
    expect(loadProfile()).toEqual(profile)
    saveHistory([RUN])
    expect(loadHistory()).toEqual([RUN])
  })

  it('falls back to a new profile on anything that is not one', () => {
    for (const raw of ['{', 'null', '42', '"xp"', '[1,2]', 'true']) {
      put('profile', raw)
      expect(loadProfile(), raw).toEqual(NEW_PROFILE)
    }
  })

  it('keeps the well-formed fields of a damaged profile and only those', () => {
    put(
      'profile',
      JSON.stringify({
        xp: 'lots',
        runs: 7,
        bestScore: -3,
        wordsFound: Number.MAX_VALUE,
        bestCombo: null,
        usage: { chat: 2, chien: 'x', loup: -1 },
        unlocked: ['sports', 3, null],
        offer: 'pays',
        stray: true,
      }),
    )
    const profile = loadProfile()
    expect(profile).toEqual({
      ...NEW_PROFILE,
      runs: 7,
      wordsFound: Number.MAX_VALUE,
      usage: { chat: 2 },
      unlocked: ['sports'],
    })
    expect('stray' in profile).toBe(false)
  })

  it('survives a storage that throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => {
          throw new Error('SecurityError')
        },
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
      },
      configurable: true,
    })
    expect(loadProfile()).toEqual(NEW_PROFILE)
    expect(loadHistory()).toEqual([])
    expect(loadSubmissions()).toEqual([])
    expect(() => saveProfile(NEW_PROFILE)).not.toThrow()
    expect(loadAvatar()).toEqual(loadAvatar())
  })

  it('drops one malformed run rather than the whole history', () => {
    const good = [RUN.at, 'fr', 42, 3, 1, ['pays', 'animaux'], [['pays', 'france', 'France', 12]]]
    put('history', JSON.stringify([good, null, 'run', [1, 'fr'], [RUN.at, 'fr', 10, 1, 0, ['pays'], 'words'], good]))
    expect(loadHistory()).toEqual([RUN, RUN])
  })

  it('drops the malformed words of a run and keeps the run', () => {
    put('history', JSON.stringify([[RUN.at, 'fr', 42, 3, 1, ['pays', 7], [['pays', 'france', 'France', 12], ['pays'], null, ['pays', 'x', 'X', 'ten']]]]))
    expect(loadHistory()).toEqual([{ ...RUN, categoryIds: ['pays'] }])
  })

  it('keeps only the well-formed pending submissions', () => {
    const fine = { word: 'licorne', categoryId: 'animaux', at: 5, lang: 'fr' }
    const old = { word: 'dahu', categoryId: 'animaux', at: 6 }
    put('submissions', JSON.stringify([fine, null, { word: 3, categoryId: 'animaux', at: 1 }, { word: 'x', at: 1 }, old, { ...old, lang: 4 }]))
    expect(loadSubmissions()).toEqual([fine, old])
    put('submissions', '{"word":"licorne"}')
    expect(loadSubmissions()).toEqual([])
  })

  it('keeps the multiplayer badge until a first game is launched', () => {
    expect(loadMultiplayerNews()).toBe(true)
    saveMultiplayerPlayed()
    expect(loadMultiplayerNews()).toBe(false)
  })

  it('falls back to the default avatar on a corrupted one', () => {
    const fallback = loadAvatar()
    put('avatar', '{not json')
    expect(loadAvatar()).toEqual(fallback)
    put('avatar', JSON.stringify({ design: 'big', ground: 'plaid' }))
    expect(loadAvatar()).toEqual(fallback)
  })

})
