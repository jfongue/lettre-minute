import { describe, expect, it } from 'vitest'
import { NO_USAGE } from './rarity'
import { NEW_PROFILE, type Profile } from './progression'
import {
  ban,
  banNews,
  bannedOf,
  banVerdict,
  feedbackDue,
  FREE_PEEKS,
  hiddenAnswers,
  joinPlus,
  markBanIntroSeen,
  markFeedbackAsked,
  markPlusThanked,
  plusThanksDue,
  peeksLeft,
  playableCategoryIds,
  spendPeek,
  unban,
} from './perks'
import { createRun, skip, submit, type Judge } from './run'
import { buildWordPack, commonWord, findWord, lettersWithEnough } from './words'

const SEVEN = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
const SIX = SEVEN.slice(0, 6)

describe('bans', () => {
  it('open at the seventh category', () => {
    expect(banVerdict(NEW_PROFILE, SIX, 'a')).toBe('locked')
    expect(banVerdict(NEW_PROFILE, SEVEN, 'a')).toBe('ok')
    expect(banNews(NEW_PROFILE, SIX)).toBe(false)
    expect(banNews(NEW_PROFILE, SEVEN)).toBe(true)
    expect(banNews(markBanIntroSeen(NEW_PROFILE), SEVEN)).toBe(false)
  })

  it('keep the banned category out of the draw', () => {
    const banned = ban(NEW_PROFILE, SEVEN, 'c')
    expect(playableCategoryIds(banned, SEVEN)).toEqual(['a', 'b', 'd', 'e', 'f', 'g'])
    expect(playableCategoryIds(unban(banned, 'c'), SEVEN)).toEqual(SEVEN)
  })

  it('ask for Premium past the free ban', () => {
    const one = ban(NEW_PROFILE, SEVEN, 'c')
    expect(banVerdict(one, SEVEN, 'd')).toBe('plus')
    expect(ban(one, SEVEN, 'd')).toBe(one)
    const plus = joinPlus(one, 1)
    expect(banVerdict(plus, SEVEN, 'd')).toBe('ok')
    expect(bannedOf(ban(plus, SEVEN, 'd'), SEVEN)).toEqual(['c', 'd'])
  })

  it('never leave fewer categories than a run deals', () => {
    const plus = joinPlus(ban(ban(joinPlus(NEW_PROFILE, 1), SEVEN, 'a'), SEVEN, 'b'), 1)
    expect(banVerdict(plus, SEVEN, 'c')).toBe('full')
  })

  it('fall back to the free ban when Premium is gone', () => {
    const plus: Profile = { ...NEW_PROFILE, plusSince: 1, banned: ['a', 'b'] }
    expect(bannedOf({ ...plus, plusSince: 0 }, SEVEN)).toEqual(['a'])
  })

  it('forget a category no longer owned', () => {
    expect(bannedOf({ ...NEW_PROFILE, banned: ['z', 'a'] }, SEVEN)).toEqual(['a'])
  })
})

describe('peeks', () => {
  it('stop after five without Premium', () => {
    let profile = NEW_PROFILE
    for (let i = 0; i < FREE_PEEKS + 2; i++) profile = spendPeek(profile)
    expect(profile.peeks).toBe(FREE_PEEKS)
    expect(peeksLeft(profile)).toBe(0)
    expect(peeksLeft(joinPlus(profile, 1))).toBe(Infinity)
  })
})

describe('plusThanksDue', () => {
  it('thanks a new Premium member once', () => {
    expect(plusThanksDue(NEW_PROFILE)).toBe(false)
    const plus = joinPlus(NEW_PROFILE, 1)
    expect(plusThanksDue(plus)).toBe(true)
    expect(plusThanksDue(markPlusThanked(plus))).toBe(false)
  })
})

describe('feedbackDue', () => {
  it('asks after ten runs, then every thirty', () => {
    expect(feedbackDue({ ...NEW_PROFILE, runs: 9 })).toBe(false)
    const ten = { ...NEW_PROFILE, runs: 10 }
    expect(feedbackDue(ten)).toBe(true)
    const asked = markFeedbackAsked(ten)
    expect(feedbackDue({ ...asked, runs: 39 })).toBe(false)
    expect(feedbackDue({ ...asked, runs: 40 })).toBe(true)
  })
})

describe('hiddenAnswers', () => {
  const pack = buildWordPack(
    'animaux',
    'ABCDEFGHIJLMNOPRSTV'.split('').flatMap((letter) => [
      [`${letter}chat`, 90, 1] as const,
      [`${letter}rare`, 1, 1] as const,
    ]),
  )
  const judge: Judge = {
    find: (_, word) => findWord(pack, word),
    usage: () => NO_USAGE,
    known: () => 2,
    letters: () => lettersWithEnough(pack, 1),
    common: (_, letter, played) => commonWord(pack, letter, played),
  }

  it('names the best-known word of each skipped prompt, once', () => {
    let run = createRun({ seed: 3, categoryIds: ['animaux'] }, judge)
    const first = run.prompt
    run = skip(run, judge)
    run = submit(run, `${run.prompt.letter}chat`, judge).run
    const answers = hiddenAnswers(run, judge)
    expect(answers).toHaveLength(1)
    expect(answers[0]!.prompt).toEqual(first)
    expect(answers[0]!.display.toLowerCase()).toBe(`${first.letter}chat`.toLowerCase())
  })

})
