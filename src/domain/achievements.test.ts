import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, achievementIcon, earnedAchievements } from './achievements'
import { AVATARS, designUnlock } from './avatar'
import { NEW_PROFILE, xpForLevel } from './progression'

describe('achievements', () => {
  it('stays within what Play Games accepts and Level Up asks for', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(10)
    expect(new Set(ACHIEVEMENTS.map((achievement) => achievement.id)).size).toBe(ACHIEVEMENTS.length)
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.points % 5).toBe(0)
      expect(achievement.points).toBeLessThanOrEqual(200)
    }
    expect(ACHIEVEMENTS.reduce((total, achievement) => total + achievement.points, 0)).toBeLessThanOrEqual(1000)
  })

  it('shows a tile of its own, the one its goal unlocks when the grid has it', () => {
    for (const achievement of ACHIEVEMENTS) {
      const icon = achievementIcon(achievement.id)
      expect(AVATARS[icon.design]).toBeDefined()
      if (achievement.id !== 'added-10' && achievement.id !== 'discoveries-15') {
        expect(designUnlock(icon.design)).toEqual(achievement.goal)
      }
      expect(new Set([icon.ground, icon.shape, icon.accent]).size).toBe(3)
    }
    expect(new Set(ACHIEVEMENTS.map((achievement) => achievement.design)).size).toBe(ACHIEVEMENTS.length)
  })

  it('draws the same icon every time', () => {
    expect(achievementIcon('level-35')).toEqual(achievementIcon('level-35'))
  })

  it('earns nothing on a new profile, then what the profile reaches', () => {
    expect(earnedAchievements(NEW_PROFILE)).toEqual([])
    const profile = { ...NEW_PROFILE, xp: xpForLevel(10), runs: 12, bestScore: 520, wordsAdded: 10 }
    expect(earnedAchievements(profile).sort()).toEqual(['added-10', 'level-10', 'level-4', 'runs-10'])
    expect(earnedAchievements(profile, 14)).not.toContain('discoveries-15')
    expect(earnedAchievements(profile, 15)).toContain('discoveries-15')
  })
})
