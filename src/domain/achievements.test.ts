import { describe, expect, it } from 'vitest'
import {
  ACHIEVEMENTS,
  PLAY_ACHIEVEMENTS_ONLY,
  achievementIcon,
  achievementProgress,
  achievementReward,
  avatarNewsDue,
  colourWinner,
  designGoal,
  designWinner,
  earnedAchievements,
  isNamed,
  newlyEarnedAchievements,
  ownedColours,
  ownedDesigns,
  ownsEveryDesign,
} from './achievements'
import { AVATARS, FREE_COLOURS, FREE_DESIGNS, PALETTE } from './avatar'
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

  it('names every achievement once, on a tile that exists', () => {
    expect(new Set(ACHIEVEMENTS.map((achievement) => achievement.id)).size).toBe(ACHIEVEMENTS.length)
    for (const achievement of ACHIEVEMENTS) expect(AVATARS[achievement.design]).toBeDefined()
  })

  it('opens every tile and every colour of the catalogue, and each of them once', () => {
    const tiles = ACHIEVEMENTS.flatMap((achievement) => achievement.reward.design ?? [])
    const inks = ACHIEVEMENTS.flatMap((achievement) =>
      achievement.reward.colour === undefined ? [] : [achievement.reward.colour],
    )

    expect(new Set(tiles).size).toBe(tiles.length)
    expect(new Set(inks).size).toBe(inks.length)
    expect([...tiles].sort((left, right) => left - right)).toEqual(AVATARS.slice(FREE_DESIGNS).map((design) => design.id))
    expect([...inks].sort()).toEqual(PALETTE.slice(FREE_COLOURS).map((colour) => colour.id).sort())
  })

  it('poses each tile on the milestone of the success that opens it', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.reward.design !== undefined || achievement.reward.colour !== undefined).toBe(true)
      if (achievement.reward.design === undefined) continue
      expect(designGoal(achievement.reward.design)).toEqual(achievement.goal)
      expect(designWinner(achievement.reward.design)?.id).toBe(achievement.id)
    }
  })

  it('opens each exploit tile on the exploit that earned them', () => {
    expect(designWinner(50)?.id).toBe('score-666')
    expect(designWinner(51)?.id).toBe('reviews-10')
    expect(designWinner(52)?.id).toBe('no-pass-50')
  })

  it('gives every colour the milestone of the success that carries it', () => {
    for (const achievement of ACHIEVEMENTS) {
      if (achievement.reward.colour === undefined) continue
      expect(colourWinner(achievement.reward.colour)?.id).toBe(achievement.id)
    }
    // Le niveau 4 débloque la tuile et la couleur crème, au même jalon.
    expect(colourWinner('creme')?.id).toBe('level-4')
  })

  it('names only the successes the i18n carries, the others take their milestone', () => {
    const named = ACHIEVEMENTS.filter((achievement) => isNamed(achievement.id))

    expect(named).toHaveLength(34)
    for (const achievement of PLAY_ACHIEVEMENTS_ONLY) expect(isNamed(achievement.id)).toBe(true)
    for (const achievement of ACHIEVEMENTS) {
      if (isNamed(achievement.id)) continue
      expect(achievement.reward.design).toBeDefined()
    }
  })

  it('shows a tile of its own, the one its goal unlocks when the grid has it', () => {
    for (const achievement of ACHIEVEMENTS) {
      const icon = achievementIcon(achievement.id)
      expect(new Set([icon.ground, icon.shape, icon.accent]).size).toBe(3)
      // Les succès du jeu seul montrent une voisine libre plutôt qu'un jalon.
      if (achievement.play !== undefined && !['added-10', 'discoveries-15', 'score-666'].includes(achievement.id)) {
        expect(designGoal(icon.design)).toEqual(achievement.goal)
      }
    }
  })

  it('draws the same icon every time', () => {
    expect(achievementIcon('level-35')).toEqual(achievementIcon('level-35'))
  })

  it('offers each milestone achievement what its own milestone unlocks', () => {
    const at = (id: string) => ACHIEVEMENTS.find((achievement) => achievement.id === id)!
    for (const achievement of ACHIEVEMENTS) {
      const reward = achievementReward(achievement)
      if (reward.design !== null) expect(AVATARS[reward.design]).toBeDefined()
      if (reward.colour !== null) expect(PALETTE).toContain(reward.colour)
    }
    expect(achievementReward(at('level-4'))).toEqual({ design: 5, colour: PALETTE.find((colour) => colour.id === 'creme') })
    // Un exploit ne se borne à aucune statistique d'avatar : il paie sa couleur.
    expect(achievementReward(at('word-long-10')).design).toBeNull()
    expect(achievementReward(at('word-long-10')).colour?.id).toBe('vert')
  })

  it('earns nothing on a new profile, then what the profile reaches', () => {
    expect(earnedAchievements(NEW_PROFILE)).toEqual([])
    const profile = { ...NEW_PROFILE, xp: xpForLevel(10), runs: 12, bestScore: 520, wordsAdded: 10 }

    expect(earnedAchievements(profile).sort()).toEqual([
      'added-10',
      'added-5',
      'level-10',
      'level-4',
      'level-7',
      'runs-10',
      'runs-3',
      'score-350',
      'score-450',
    ])
    expect(earnedAchievements(profile, 14)).not.toContain('discoveries-15')
    expect(earnedAchievements(profile, 15)).toContain('discoveries-15')
  })

  it('earns the game-only ones on the run that bears them', () => {
    const before = { ...NEW_PROFILE, runs: 9, wordsFound: 599, bestScore: 449, longestWord: 9, bestCombo: 29, wordsAdded: 4, cleanRuns: 9 }
    const after = {
      ...before,
      runs: 10,
      wordsFound: 600,
      bestScore: 450,
      bestCombo: 30,
      wordsAdded: 5,
      longestWord: 11,
      cleanRuns: 10,
      powersUsed: ['joker', 'hush', 'magic', 'swap', 'peek', 'shuffle', 'double'],
      professorWordsPlayed: 1,
    }
    expect(
      newlyEarnedAchievements(before, after)
        .map((achievement) => achievement.id)
        .sort(),
      ).toEqual(['added-5', 'clean-run-10', 'combo-30', 'powers-7', 'professor-word', 'runs-10', 'score-450', 'word-long-10', 'words-600'])
    expect(
      newlyEarnedAchievements(before, { ...after, shortStreak: 10 }).map((achievement) => achievement.id),
    ).toContain('short-streak-10')
    expect(earnedAchievements(after)).not.toContain('powers-all')
  })

  it('fills a bar up to the goal and no further', () => {
    const half = achievementProgress({ ...NEW_PROFILE, wordsFound: 125 })
    const words = half.find((entry) => entry.achievement.id === 'words-600')!
    expect(words.value).toBe(125)
    expect(words.ratio).toBeCloseTo(125 / 600)
    const full = achievementProgress({ ...NEW_PROFILE, wordsFound: 9_999 }).find((entry) => entry.achievement.id === 'words-600')!
    expect(full.ratio).toBe(1)
  })

  it('owns the whole grid, and the colours the rungs carry, once a career reaches every rung', () => {
    const veteran = {
      ...NEW_PROFILE,
      xp: xpForLevel(50),
      runs: 1200,
      bestScore: 900,
      wordsFound: 8000,
      bestCombo: 30,
      wordsAdded: 500,
      wordsReviewed: 300,
      weeklyAttempts: 30,
      challengesFinished: 25,
      shortStreak: 10,
      noPassStreak: 50,
      professorWordsPlayed: 1,
    }
    const rungInks = ACHIEVEMENTS.filter(
      (achievement) => achievement.reward.design !== undefined && achievement.reward.colour !== undefined,
    )

    expect(ownedDesigns(veteran)).toHaveLength(AVATARS.length)
    // Dix-neuf succès donnent les deux : les douze couleurs de barreau, et les
    // sept exploits à qui la grille laisse une case — les pistes neuves, la
    // modération, les six cents et le 666.
    expect(rungInks).toHaveLength(19)
    for (const rung of rungInks) {
      expect(ownedColours(veteran).map((colour) => colour.id)).toContain(rung.reward.colour)
    }
  })
})

describe('le compte maison', () => {
  it('se reconnaît à son nom, sans casse', () => {
    expect(ownsEveryDesign('Demontoon')).toBe(true)
    expect(ownsEveryDesign('demontoon')).toBe(true)
    expect(ownsEveryDesign('Ada')).toBe(false)
    expect(ownsEveryDesign(null)).toBe(false)
    expect(ownsEveryDesign(undefined)).toBe(false)
  })

  it('porte toute la grille sans avoir rien gagné', () => {
    expect(ownedDesigns(NEW_PROFILE, 0)).toHaveLength(FREE_DESIGNS)
    expect(ownedDesigns(NEW_PROFILE, 0, true)).toHaveLength(AVATARS.length)
  })

  it('calls the player to the avatar editor at their first won tile, then every three', () => {
    expect(avatarNewsDue(NEW_PROFILE, null)).toBe(false)
    const rich = { ...NEW_PROFILE, xp: xpForLevel(30), runs: 400, bestScore: 900, wordsFound: 2_000, bestCombo: 40 }
    const owned = ownedDesigns(rich).map((design) => design.id)
    const earned = owned.filter((id) => designWinner(id) !== null)
    expect(earned.length).toBeGreaterThanOrEqual(3)
    expect(avatarNewsDue(rich, null)).toBe(true)
    expect(avatarNewsDue(rich, owned)).toBe(false)
    const without = (count: number) => owned.filter((id) => !earned.slice(0, count).includes(id))
    expect(avatarNewsDue(rich, without(2))).toBe(false)
    expect(avatarNewsDue(rich, without(3))).toBe(true)
  })
})
