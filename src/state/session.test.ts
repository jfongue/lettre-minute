import { describe, expect, it } from 'vitest'
import { NEW_PROFILE } from '../domain/progression'
import { NO_USAGE } from '../domain/rarity'
import type { Judge } from '../domain/run'
import { buildWordPack, findWord, lettersWithEnough } from '../domain/words'
import { initialSession, sessionReducer, type Session } from './session'

const LETTERS = 'ABCDEFGHIJLMNOPRSTV'.split('')
const PER_LETTER = 12
const animals = buildWordPack(
  'animaux',
  LETTERS.flatMap((letter) =>
    Array.from({ length: PER_LETTER }, (_, i) => [`${letter}nimal${i}`, 50, 1] as const),
  ),
)
const judge: Judge = {
  find: (_, word) => findWord(animals, word),
  usage: () => NO_USAGE,
  letters: () => lettersWithEnough(animals, PER_LETTER),
  known: () => PER_LETTER,
}

function playing(): Session {
  const ready = sessionReducer(initialSession(NEW_PROFILE), {
    type: 'ready',
    judge,
    seed: 7,
    categoryIds: ['animaux'],
    reserve: [],
  })
  return sessionReducer(ready, { type: 'start' })
}

describe('time-up', () => {
  it('scores a correct word left in the field', () => {
    const session = playing()
    const typed = sessionReducer(session, { type: 'type', draft: `${session.run!.prompt.letter}nimal0` })

    const over = sessionReducer(typed, { type: 'time-up', at: 60 })

    expect(over.phase).toBe('over')
    expect(over.run!.found).toHaveLength(1)
    expect(over.profile.wordsFound).toBe(1)
    expect(over.profile.bestScore).toBe(over.run!.score)
  })

  it('drops a wrong word left in the field', () => {
    const typed = sessionReducer(playing(), { type: 'type', draft: 'zzz' })

    const over = sessionReducer(typed, { type: 'time-up', at: 60 })

    expect(over.run!.found).toHaveLength(0)
    expect(over.profile.wordsFound).toBe(0)
  })
})

describe('challenge runs', () => {
  const veteran = { ...NEW_PROFILE, bestScore: 999, lastPrompts: ['animaux:A'], powers: ['permutation'], equipped: ['permutation'] }
  const ready = (profile = veteran) =>
    sessionReducer(initialSession(profile), {
      type: 'ready',
      judge,
      seed: 7,
      categoryIds: ['animaux'],
      reserve: ['pays'],
      challenge: { id: 'c1', powers: [] },
    })

  it('draws from the seed alone, with the powers picked for it and nothing to swap', () => {
    const session = ready()
    const solo = sessionReducer(initialSession(NEW_PROFILE), { type: 'ready', judge, seed: 7, categoryIds: ['animaux'], reserve: [] })

    expect(session.run!.avoid).toEqual([])
    expect(session.run!.prompt).toEqual(solo.run!.prompt)
    expect(session.run!.powers).toEqual([])
    expect(session.swapsLeft).toBe(0)
    expect(session.reserve).toEqual([])
    expect(session.challengeId).toBe('c1')
  })

  it('pays the challenge bonus and leaves the record alone', () => {
    const started = sessionReducer(ready(), { type: 'start' })
    const typed = sessionReducer(started, { type: 'type', draft: `${started.run!.prompt.letter}nimal0` })
    const over = sessionReducer(typed, { type: 'time-up', at: 60 })

    expect(over.profile.bestScore).toBe(999)
    expect(over.profile.xp).toBeGreaterThan(over.run!.score)
    expect(over.profile.lastPrompts).toEqual(['animaux:A'])
  })
})
