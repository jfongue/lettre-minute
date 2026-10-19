import { describe, expect, it } from 'vitest'
import {
  applyDuel,
  applyRun,
  backfillCounters,
  countOf,
  levelFor,
  levelProgress,
  NEW_PROFILE,
  RECORD_BONUS_BELOW,
  RECORD_BONUS_XP,
  rewardSubmission,
  SUBMISSION_REWARD_XP,
  xpForLevel,
} from './progression'

describe('counters', () => {
  it('copies what the server already counted, and never downwards', () => {
    const profile = { ...NEW_PROFILE, weeklyAttempts: 1, challengesFinished: 4 }
    const filled = backfillCounters(profile, { weeklyAttempts: 0, challengesFinished: 6 })

    expect(filled.weeklyAttempts).toBe(1)
    expect(filled.challengesFinished).toBe(6)
  })
})

describe('levels', () => {
  it('starts every player at level 1', () => {
    expect(levelFor(0)).toBe(1)
    expect(xpForLevel(1)).toBe(0)
  })

  it('opens level 2 at 150 XP', () => {
    expect(xpForLevel(2)).toBe(150)
    expect(levelFor(149)).toBe(1)
    expect(levelFor(150)).toBe(2)
  })

  it('costs a little more at each level', () => {
    const steps = [2, 3, 4, 5].map((level) => xpForLevel(level) - xpForLevel(level - 1))

    expect(steps).toEqual([...steps].sort((a, b) => a - b))
  })

  it('reaches level 10 under 4 000 XP', () => {
    expect(xpForLevel(10)).toBe(3950)
  })

  it('reports where the player stands inside a level', () => {
    const progress = levelProgress(xpForLevel(3))

    expect(progress.level).toBe(3)
    expect(progress.into).toBe(0)
    expect(progress.ratio).toBe(0)
  })
})

describe('applyRun', () => {
  it('counts a word named like an Object property as any other', () => {
    const once = applyRun(NEW_PROFILE, { score: 10, words: ['constructor', 'tostring'], bestCombo: 1 })
    const twice = applyRun(once, { score: 10, words: ['constructor'], bestCombo: 1 })

    expect(twice.usage['constructor']).toBe(2)
    expect(twice.usage['tostring']).toBe(1)
  })

  it('reads a count a saved profile corrupted as zero', () => {
    expect(countOf({ constructor: 'function Object() {}1' as unknown as number }, 'constructor')).toBe(0)
    expect(countOf({}, 'constructor')).toBe(0)
    expect(countOf({ chat: 3 }, 'chat')).toBe(3)
  })

  it('banks XP, records the best and counts the words', () => {
    const profile = applyRun(NEW_PROFILE, { score: 300, words: ['chat', 'zebu'], bestCombo: 4 })

    expect(profile.xp).toBe(300)
    expect(profile.runs).toBe(1)
    expect(profile.bestScore).toBe(300)
    expect(profile.wordsFound).toBe(2)
    expect(profile.bestCombo).toBe(4)
  })

  it('remembers how often a word was answered, which is what wears its rarity down', () => {
    let profile = applyRun(NEW_PROFILE, { score: 100, words: ['zebu'], bestCombo: 1 })
    profile = applyRun(profile, { score: 100, words: ['zebu', 'chat'], bestCombo: 1 })

    expect(profile.usage.zebu).toBe(2)
    expect(profile.usage.chat).toBe(1)
  })

  it('keeps a worse run from lowering the record', () => {
    const profile = applyRun(applyRun(NEW_PROFILE, { score: 300, words: [], bestCombo: 7 }), {
      score: 50,
      words: [],
      bestCombo: 2,
    })

    expect(profile.bestScore).toBe(300)
    expect(profile.bestCombo).toBe(7)
  })
})

describe('applyDuel', () => {
  it('adds the duel’s XP alone: no run, no record, no word counted', () => {
    const after = applyDuel({ ...NEW_PROFILE, runs: 3, bestScore: 80 }, 240)
    expect(after.xp).toBe(240)
    expect(after.runs).toBe(3)
    expect(after.bestScore).toBe(80)
    expect(after.wordsFound).toBe(0)
  })

  it('leaves the level-up offers to the next solo summary', () => {
    const after = applyDuel(NEW_PROFILE, xpForLevel(3))
    expect(levelFor(after.xp)).toBe(3)
    expect(after.offer).toEqual([])
    expect(after.powerOffer).toEqual([])
  })

  it('keeps the profile as it was when nothing is earned', () => {
    expect(applyDuel(NEW_PROFILE, 0)).toBe(NEW_PROFILE)
  })
})

describe('rewardSubmission', () => {
  it('pays the player whose word entered the dictionary', () => {
    expect(rewardSubmission(NEW_PROFILE).xp).toBe(SUBMISSION_REWARD_XP)
  })
})

describe('record bonus', () => {
  const scored = { ...NEW_PROFILE, runs: 3, bestScore: 120 }

  it('pays a low scorer for beating their record', () => {
    expect(applyRun(scored, { score: 150, words: [], bestCombo: 0 }).xp).toBe(150 + RECORD_BONUS_XP)
  })

  it('pays nothing extra for the first run, a run under the record, or a record past the threshold', () => {
    expect(applyRun(NEW_PROFILE, { score: 150, words: [], bestCombo: 0 }).xp).toBe(150)
    expect(applyRun(scored, { score: 100, words: [], bestCombo: 0 }).xp).toBe(100)
    expect(applyRun(scored, { score: RECORD_BONUS_BELOW, words: [], bestCombo: 0 }).xp).toBe(RECORD_BONUS_BELOW)
  })
})
