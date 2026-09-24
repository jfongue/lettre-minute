import { describe, expect, it } from 'vitest'
import { PLAYABLE_LETTERS } from '../domain/letters'
import { NEW_PROFILE } from '../domain/progression'
import { NO_USAGE } from '../domain/rarity'
import { MIN_WORDS_PER_PROMPT, type Judge } from '../domain/run'
import { buildWordPack, findWord, lettersWithEnough } from '../domain/words'
import { initialSession, sessionReducer, type Session } from './session'

const LETTERS = 'ABCDEFGHIJLMNOPRSTV'.split('')
const animals = buildWordPack(
  'animaux',
  LETTERS.flatMap((letter) =>
    Array.from({ length: MIN_WORDS_PER_PROMPT }, (_, i) => [`${letter}nimal${i}`, 50, 1] as const),
  ),
)
const judge: Judge = {
  find: (_, word) => findWord(animals, word),
  usage: () => NO_USAGE,
  letters: () => lettersWithEnough(animals, MIN_WORDS_PER_PROMPT),
  deck: PLAYABLE_LETTERS,
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
