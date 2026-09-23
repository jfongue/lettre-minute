import { describe, expect, it } from 'vitest'
import { CATALOGUE, unlockedCategories } from './catalogue'
import {
  applyRun,
  levelFor,
  levelProgress,
  newlyUnlocked,
  NEW_PROFILE,
  rewardSubmission,
  SUBMISSION_REWARD_XP,
  xpForLevel,
} from './progression'

describe('levels', () => {
  it('starts every player at level 1', () => {
    expect(levelFor(0)).toBe(1)
    expect(xpForLevel(1)).toBe(0)
  })

  it('costs a little more at each level', () => {
    const steps = [2, 3, 4, 5].map((level) => xpForLevel(level) - xpForLevel(level - 1))

    expect(steps).toEqual([...steps].sort((a, b) => a - b))
  })

  it('reports where the player stands inside a level', () => {
    const progress = levelProgress(xpForLevel(3))

    expect(progress.level).toBe(3)
    expect(progress.into).toBe(0)
    expect(progress.ratio).toBe(0)
  })
})

describe('applyRun', () => {
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

describe('unlocks', () => {
  it('opens the game on a handful of categories', () => {
    const opening = unlockedCategories(1)

    expect(opening.length).toBeGreaterThanOrEqual(3)
    expect(opening.length).toBeLessThan(CATALOGUE.length)
  })

  it('announces what a new level opened', () => {
    const opened = newlyUnlocked(1, 3).map((category) => category.id)

    expect(opened).toEqual(CATALOGUE.filter((c) => c.unlockLevel === 2 || c.unlockLevel === 3).map((c) => c.id))
  })

  it('ends up offering everything', () => {
    const top = Math.max(...CATALOGUE.map((category) => category.unlockLevel))

    expect(unlockedCategories(top)).toHaveLength(CATALOGUE.length)
  })
})

describe('rewardSubmission', () => {
  it('pays the player whose word entered the dictionary', () => {
    expect(rewardSubmission(NEW_PROFILE).xp).toBe(SUBMISSION_REWARD_XP)
  })
})
