import { describe, expect, it } from 'vitest'
import { NEW_PROFILE } from '../domain/progression'
import { NO_USAGE } from '../domain/rarity'
import { chargesLeft, type Judge } from '../domain/run'
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

describe('the day\'s run', () => {
  const veteran = { ...NEW_PROFILE, lastPrompts: ['animaux:A'], powers: ['permutation'], equipped: ['permutation'] }
  const ready = () =>
    sessionReducer(initialSession(veteran), {
      type: 'ready',
      judge,
      seed: 7,
      categoryIds: ['animaux'],
      reserve: ['pays'],
      noPowers: true,
      daily: { day: '2026-10-13', bonus: 80 },
    })

  it('draws from the seed alone, without powers or swaps', () => {
    const session = ready()
    expect(session.run!.avoid).toEqual([])
    expect(session.run!.powers).toEqual([])
    expect(session.swapsLeft).toBe(0)
    expect(session.reserve).toEqual([])
    expect(session.daily).toEqual({ day: '2026-10-13', bonus: 80 })
  })

  it('counts like a solo run and pays the streak on top', () => {
    const started = sessionReducer(ready(), { type: 'start' })
    const typed = sessionReducer(started, { type: 'type', draft: `${started.run!.prompt.letter}nimal0` })
    const over = sessionReducer(typed, { type: 'time-up', at: 60 })

    expect(over.profile.runs).toBe(1)
    expect(over.profile.bestScore).toBe(over.run!.score)
    const unpaid = sessionReducer(
      sessionReducer(sessionReducer({ ...ready(), daily: { day: '2026-10-13', bonus: 0 } }, { type: 'start' }), {
        type: 'type',
        draft: `${started.run!.prompt.letter}nimal0`,
      }),
      { type: 'time-up', at: 60 },
    )
    expect(over.profile.xp - unpaid.profile.xp).toBe(80)
    expect(sessionReducer(over, { type: 'home' }).daily).toBeNull()
  })
})

describe('permutation', () => {
  const swapper = { ...NEW_PROFILE, powers: ['permutation'], equipped: ['permutation'] }
  const countdown = sessionReducer(initialSession(swapper), {
    type: 'ready',
    judge,
    seed: 7,
    categoryIds: ['animaux'],
    reserve: ['pays'],
  })

  it('marque Permutation sur la partie qu’elle recrée', () => {
    expect(countdown.swapsLeft).toBe(2)
    expect(countdown.run!.usedPowers).toEqual([])

    const traded = sessionReducer(countdown, { type: 'swapped', judge, categoryIds: ['pays'], reserve: ['animaux'] })

    expect(traded.swapsLeft).toBe(1)
    expect(traded.run!.usedPowers).toEqual(['permutation'])
    // Un échange ne change pas la graine : c'est la liste de catégories qui bouge.
    expect(traded.run!.seed).toBe(countdown.run!.seed)
  })

  it('ne marque rien quand il n’y a plus d’échange', () => {
    const spent = { ...countdown, swapsLeft: 0 }

    expect(sessionReducer(spent, { type: 'swapped', judge, categoryIds: ['pays'], reserve: ['animaux'] })).toBe(spent)
  })
})

describe('proposals', () => {
  const proposal = (word: string, at: number) => ({ word, categoryId: 'animaux', at, lang: 'fr' })
  const proposed = (word: string, at: number) => sessionReducer(playing(), { type: 'propose', proposal: proposal(word, at) })

  it('keeps one proposal per word, however it was spelled', () => {
    const twice = sessionReducer(proposed('Axolotl', 1), { type: 'propose', proposal: proposal(' axolotl ', 2) })

    expect(twice.proposals).toEqual([proposal('Axolotl', 1)])
  })

  it('respells the word the summary hands back, and leaves the others alone', () => {
    const both = sessionReducer(proposed('axolotl', 1), { type: 'propose', proposal: proposal('narval', 2) })

    const amended = sessionReducer(both, { type: 'proposal-amended', at: 2, display: 'Narval' })

    expect(amended.proposals).toEqual([proposal('axolotl', 1), proposal('Narval', 2)])
  })

  it('drops the request taken back, and the next run starts with none', () => {
    const both = sessionReducer(proposed('axolotl', 1), { type: 'propose', proposal: proposal('narval', 2) })
    const withdrawn = sessionReducer(both, { type: 'proposal-withdrawn', at: 1 })

    expect(withdrawn.proposals).toEqual([proposal('narval', 2)])
    expect(sessionReducer(withdrawn, { type: 'ready', judge, seed: 7, categoryIds: ['animaux'], reserve: [] }).proposals).toEqual([])
  })

  it('ignores an empty word, and a respelling of no proposal at all', () => {
    expect(proposed(' ', 1).proposals).toEqual([])
    expect(sessionReducer(proposed('axolotl', 1), { type: 'proposal-amended', at: 9, display: 'x' }).proposals).toEqual([
      proposal('axolotl', 1),
    ])
  })
})

describe('Tricherie', () => {
  const spelling: Judge = { ...judge, spells: { joker: ['joker'], hush: ['chut'] }, common: (_, letter) => `${letter}nimal0` }
  const ready = () =>
    sessionReducer(initialSession({ ...NEW_PROFILE, powers: ['joker'], equipped: ['joker'] }), {
      type: 'ready',
      judge: spelling,
      seed: 7,
      categoryIds: ['animaux'],
      reserve: [],
    })

    it('écrit son mot dès que « Joker » est reconnu, sans valider', () => {
      const started = sessionReducer(ready(), { type: 'start' })
      const typed = sessionReducer(started, { type: 'type', draft: 'Joker' })

      expect(typed.run!.joker?.display).toBe(`${started.run!.prompt.letter}nimal0`)
      expect(typed.draft).toBe(typed.run!.joker!.display)
      expect(typed.live!.found?.joker).toBe(true)
      expect(chargesLeft(typed.run!, 'joker')).toBe(0)
    })

    it('ne se déclenche pas sans le pouvoir, ni sur un autre mot', () => {
      const starting = sessionReducer(
        sessionReducer(initialSession(NEW_PROFILE), { type: 'ready', judge: spelling, seed: 7, categoryIds: ['animaux'], reserve: [] }),
        { type: 'start' },
      )
      const typed = sessionReducer(starting, { type: 'type', draft: 'Joker' })
      expect(typed.run!.joker).toBeNull()
      expect(typed.live!.kind).not.toBe('spell')
    })
  })

  describe('le mot du Professeur', () => {
    const suggesting: Judge = { ...judge, suggest: (_, letter) => `${letter}nimal0` }
    const professing = { ...NEW_PROFILE, powers: ['professor'], equipped: ['professor'] }
    const ready = (profile = professing) =>
      sessionReducer(initialSession(profile), { type: 'ready', judge: suggesting, seed: 7, categoryIds: ['animaux'], reserve: [] })

      it('retient les mots proposés, puis marque leur première écriture une fois', () => {
        const started = sessionReducer(ready(), { type: 'start' })
        const proposed = `${started.run!.prompt.letter}nimal0`
        const skipped = sessionReducer(started, { type: 'skip', at: 5 })
        const over = sessionReducer(skipped, { type: 'time-up', at: 60 })
        expect(over.profile.professorWords).toEqual([proposed.toLowerCase()])
        expect(over.profile.professorWordsPlayed).toBe(0)

        const next = sessionReducer(ready({ ...professing, professorWords: over.profile.professorWords }), { type: 'start' })
        expect(next.run!.taught).toEqual([proposed.toLowerCase()])

        const typed = sessionReducer(next, { type: 'type', draft: proposed })
        expect(typed.live!.kind).toBe('accepted')
        const submitted = sessionReducer(typed, { type: 'submit', at: 10 })
        expect(submitted.cheer?.taught).toBe(true)

        const done = sessionReducer(submitted, { type: 'time-up', at: 60 })
        expect(done.profile.professorWordsPlayed).toBe(1)
        expect(done.profile.professorWords).toEqual([])
      })

      it('ne retient rien ni ne marque rien sans le pouvoir', () => {
        const plain = sessionReducer(initialSession(NEW_PROFILE), { type: 'ready', judge: suggesting, seed: 7, categoryIds: ['animaux'], reserve: [] })
        const skipped = sessionReducer(sessionReducer(plain, { type: 'start' }), { type: 'skip', at: 5 })
        const over = sessionReducer(skipped, { type: 'time-up', at: 60 })

        expect(over.profile.professorWords).toEqual([])
        expect(over.profile.professorWordsPlayed).toBe(0)
        expect(over.run!.taught).toEqual([])
      })
    })
