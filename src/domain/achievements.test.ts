import { describe, expect, it } from 'vitest'
import {
  ACHIEVEMENTS,
  PLAY_ACHIEVEMENTS_ONLY,
  achievementIcon,
  achievementProgress,
  earnedAchievements,
  newlyEarnedAchievements,
} from './achievements'
import { AVATARS, designUnlock } from './avatar'
import { NEW_PROFILE, xpForLevel } from './progression'

describe('achievements', () => {
  it('stays within what Play Games accepts, and only the published fifteen ask for points', () => {
    expect(PLAY_ACHIEVEMENTS_ONLY.length).toBe(15)
    expect(ACHIEVEMENTS.filter((achievement) => achievement.play !== undefined)).toEqual([...PLAY_ACHIEVEMENTS_ONLY])
    for (const achievement of PLAY_ACHIEVEMENTS_ONLY) {
      expect(achievement.play! % 5).toBe(0)
      expect(achievement.play!).toBeLessThanOrEqual(200)
    }
    expect(PLAY_ACHIEVEMENTS_ONLY.reduce((total, achievement) => total + achievement.play!, 0)).toBe(1000)
  })

  it('names every achievement once, on a tile of its own', () => {
    expect(new Set(ACHIEVEMENTS.map((achievement) => achievement.id)).size).toBe(ACHIEVEMENTS.length)
    expect(new Set(ACHIEVEMENTS.map((achievement) => achievement.design)).size).toBe(ACHIEVEMENTS.length)
    for (const achievement of ACHIEVEMENTS) expect(AVATARS[achievement.design]).toBeDefined()
  })

  const HAND_PICKED = new Set(['added-10', 'discoveries-15', 'score-666', 'words-2000'])

  it('shows a tile of its own, the one its goal unlocks when the grid has it', () => {
    for (const achievement of ACHIEVEMENTS) {
      const icon = achievementIcon(achievement.id)
      expect(new Set([icon.ground, icon.shape, icon.accent]).size).toBe(3)
      // Les succès dont la tuile est choisie à la main, et ceux du jeu
      // seul, qui montrent une voisine libre plutôt qu'un jalon.
      if (achievement.play !== undefined && !HAND_PICKED.has(achievement.id)) {
        expect(designUnlock(icon.design)).toEqual(achievement.goal)
      }
    }
  })

  it('draws the same icon every time', () => {
    expect(achievementIcon('level-35')).toEqual(achievementIcon('level-35'))
  })

  it('earns nothing on a new profile, then what the profile reaches', () => {
    expect(earnedAchievements(NEW_PROFILE)).toEqual([])
    const profile = { ...NEW_PROFILE, xp: xpForLevel(10), runs: 12, bestScore: 520, wordsAdded: 10 }
    expect(earnedAchievements(profile).sort()).toEqual(['added-10', 'level-10', 'level-4', 'runs-10', 'score-400'])
    expect(earnedAchievements(profile, 14)).not.toContain('discoveries-15')
    expect(earnedAchievements(profile, 15)).toContain('discoveries-15')
  })

  it('earns the game-only ones on the run that bears them', () => {
    const before = { ...NEW_PROFILE, runs: 24, wordsFound: 249, bestScore: 399 }
    const after = {
      ...before,
      runs: 25,
      wordsFound: 257,
      bestScore: 404,
      longestWord: 11,
      powersUsed: ['joker', 'hush'],
      cleanRuns: 1,
    }
    expect(newlyEarnedAchievements(before, after).map((achievement) => achievement.id)).toEqual([
      'runs-25',
      'words-250',
      'score-400',
      'word-long-10',
      'clean-run',
    ])
    expect(earnedAchievements({ ...after, duelRounds4: 20, dailyFirst: 1, longestWord: 15, bestSpeed: 40 })).toContain(
      'duel-round-20',
    )
    expect(earnedAchievements({ ...after, powersUsed: [] })).not.toContain('powers-all')
  })

  it('fills a bar up to the goal and no further', () => {
    const half = achievementProgress({ ...NEW_PROFILE, wordsFound: 125 })
    const words = half.find((entry) => entry.achievement.id === 'words-250')!
    expect(words.value).toBe(125)
    expect(words.ratio).toBeCloseTo(0.5)
    const full = achievementProgress({ ...NEW_PROFILE, wordsFound: 9_999 }).find((entry) => entry.achievement.id === 'words-250')!
    expect(full.ratio).toBe(1)
  })
})
