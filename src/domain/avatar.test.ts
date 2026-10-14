import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ACHIEVEMENTS,
  designGoal,
  newlyEarnedAchievements,
  ownedColours,
  ownedDesigns,
  unseenColours,
  unseenDesigns,
} from './achievements'
import {
  AVATARS,
  DEFAULT_AVATAR,
  isDefaultAvatar,
  PALETTE,
  paintsAccent,
  parseAvatar,
  sameAvatar,
  type AvatarDesign,
} from './avatar'
import { applyRun, NEW_PROFILE, xpForLevel } from './progression'

describe('avatars', () => {
  // How many turns a shape takes before it looks the same again.
  const ORIENTATIONS: Record<string, number> = {
    circle: 1, square: 1, ring: 1, diamond: 1, sun: 1, cross: 1, flower: 1, dots: 1, frame: 1, target: 1,
  pinwheel: 1,
    bars: 2, checker: 2, hexagon: 2, lens: 2, pill: 2, hourglass: 2,
    // Deux quarts de tour rendent l'anneau brisé, l'éclipse et le point
    // d'exclamation à l'identique ; la fleur, elle, en demande cinq, et l'arche
    // est d'aplomb dans les quatre sens.
    ringbroken: 2, eclipse: 2, bang: 2, bloom: 5, archway: 1,
  }
  const orientations = (design: AvatarDesign) => ORIENTATIONS[design.shape] ?? 4

  it('never draws the same tile twice', () => {
    const looks = new Set(
      AVATARS.map((design) => `${design.shape}/${design.turn % orientations(design)}/${design.accent}`),
    )

    expect(looks.size).toBe(AVATARS.length)
    expect(AVATARS.map((design) => design.id)).toEqual(AVATARS.map((_, index) => index))
  })

  it('keeps the turning motions off shapes whose turn is their look', () => {
    const turned = AVATARS.filter((design) => design.motion === 'turn' || design.motion === 'spin')

    expect(turned.every((design) => orientations(design) === 1)).toBe(true)
  })

  it('gives every tile past the free ones a success to open it', () => {
    expect(AVATARS.every((design) => design.id < 5 || designGoal(design.id) !== null)).toBe(true)
  })

  it('starts a player with a few tiles and the three primaries', () => {
    expect(ownedDesigns(NEW_PROFILE)).toHaveLength(5)
    expect(ownedColours(NEW_PROFILE).map((colour) => colour.id)).toEqual(['rouge', 'bleu', 'jaune'])
    expect(ownedDesigns(NEW_PROFILE).map((design) => design.id)).toContain(DEFAULT_AVATAR.design)
  })

it('frames the tiles and the colours the editor has not shown, and forgets the ones it has', () => {
  const owned = ownedDesigns(NEW_PROFILE).map((design) => design.id)
  const inks = ownedColours(NEW_PROFILE).map((colour) => colour.id)

  expect(unseenDesigns(NEW_PROFILE, [])).toEqual(owned)
  expect(unseenDesigns(NEW_PROFILE, owned)).toEqual([])
  expect(unseenDesigns(NEW_PROFILE, owned.slice(0, 2))).toEqual(owned.slice(2))
  expect(unseenColours(NEW_PROFILE, [])).toEqual(inks)
  expect(unseenColours(NEW_PROFILE, inks)).toEqual([])
  expect(unseenColours(NEW_PROFILE, inks.slice(0, 1))).toEqual(inks.slice(1))
})

it('earns nothing on a first run, even a very good one', () => {
    const words = Array.from({ length: 25 }, (_, index) => `mot${index}`)
    const after = applyRun(NEW_PROFILE, { score: 300, words, bestCombo: 9 })

    expect(newlyEarnedAchievements(NEW_PROFILE, after)).toEqual([])
  })

  it('pays out a first colour after a few runs', () => {
    let profile = NEW_PROFILE
    for (let run = 0; run < 3; run++) profile = applyRun(profile, { score: 120, words: ['chat'], bestCombo: 2 })

    expect(ownedColours(profile).map((colour) => colour.id)).toContain('noir')
  })

  it('opens every tile to a long career, and the colours the rungs carry', () => {
    const veteran = { ...NEW_PROFILE, xp: xpForLevel(50), runs: 1200, bestScore: 900, wordsFound: 8000, bestCombo: 30, wordsAdded: 500, wordsReviewed: 300, weeklyAttempts: 30, challengesFinished: 25, shortStreak: 10, noPassStreak: 50, professorWordsPlayed: 1 }
    const rungInks = ACHIEVEMENTS.filter(
      (achievement) => achievement.reward.design !== undefined && achievement.reward.colour !== undefined,
    )

    expect(ownedDesigns(veteran)).toHaveLength(AVATARS.length)
    // Dix-neuf succès donnent les deux : les douze couleurs de barreau, et les
    // sept exploits à qui la grille laisse une case.
    expect(rungInks).toHaveLength(19)
    for (const rung of rungInks) {
      expect(ownedColours(veteran).map((colour) => colour.id)).toContain(rung.reward.colour)
    }
  })

  it('never hands a tile to a player who has not played or added a word', () => {
    expect(ownedDesigns(NEW_PROFILE)).toHaveLength(5)
  })

  // Les cinq tuiles des mots ajoutés : la première dès cinq mots acceptés —
  // nul n'en a un avant que les modérateurs aient voté —, la dernière à cinq cents.
  it('pays a tile at each word the player got into the dictionary', () => {
    const withWords = (wordsAdded: number) => ownedDesigns({ ...NEW_PROFILE, wordsAdded })

    expect(withWords(0)).toHaveLength(5)
    expect(withWords(4)).toHaveLength(5)
    expect(withWords(5)).toHaveLength(6)
    expect(withWords(9)).toHaveLength(6)
    expect(withWords(10)).toHaveLength(7)
    expect(withWords(39)).toHaveLength(7)
    expect(withWords(40)).toHaveLength(8)
    expect(withWords(149)).toHaveLength(8)
    expect(withWords(150)).toHaveLength(9)
    expect(withWords(499)).toHaveLength(9)
    expect(withWords(500)).toHaveLength(10)
    expect(withWords(100000)).toHaveLength(10)
  })

  it('keeps every tile past the free ones on a goal of its own', () => {
    const goals = AVATARS.slice(5).map((design) => {
      const goal = designGoal(design.id)
      expect(goal).not.toBeNull()
      return `${goal!.stat}:${goal!.at}`
    })

    expect(new Set(goals).size).toBe(goals.length)
  })
})

// Seven palette inks are the light theme's own tokens, written twice: the
// domain cannot read a stylesheet, so the two ends are tied here instead. The
// dark theme brightens its tokens and leaves the palette alone — a red tile is
// not a red button — so only the first definition counts.
const SHARED_INKS: readonly [string, string][] = [
  ['rouge', '--red'],
  ['bleu', '--blue'],
  ['jaune', '--yellow'],
  ['noir', '--black'],
  ['creme', '--cream'],
  ['vert', '--green'],
  ['rose', '--pink'],
]

describe('accent layer', () => {
  it('is offered by every tile whose figure has a part the accent paints', () => {
    expect(paintsAccent(AVATARS.find((design) => design.shape === 'steps')!)).toBe(true)
    expect(paintsAccent(AVATARS.find((design) => design.accent === 'circle')!)).toBe(true)
    expect(paintsAccent(AVATARS[0])).toBe(false)
    expect(AVATARS.filter(paintsAccent).length).toBeGreaterThan(AVATARS.filter((design) => design.accent).length)
  })
})

describe('palette inks', () => {
  it('keeps every shared colour on its light theme token', () => {
    const sheet = readFileSync(join(import.meta.dirname, '..', 'styles.css'), 'utf8')
    for (const [id, token] of SHARED_INKS) {
      const ink = sheet.match(new RegExp(`${token}: (#[0-9a-f]{6});`))?.[1]
      expect(PALETTE.find((colour) => colour.id === id)?.hex, token).toBe(ink)
    }
  })
})

describe('parseAvatar', () => {
  it('falls back on anything it does not recognise', () => {
    expect(parseAvatar(null)).toEqual(DEFAULT_AVATAR)
    expect(parseAvatar({ design: 999, ground: 'chartreuse', shape: 'noir' })).toEqual({
      ...DEFAULT_AVATAR,
      shape: 'noir',
    })
  })
})

// Chaque figure a son mouvement, et un nom de classe sans images clés laisse
// une tuile immobile sans le dire : les deux bouts sont noués ici, comme pour
// les encres de la palette, parce que le domaine ne lit pas de feuille de
// style. Deux mouvements n'animent qu'une pièce de la tuile — la boule de
// « half », les deux parts de « split » — et se lisent sur la règle de celle-ci.
// « still » n'en a pas, c'est justement celui qui ne bouge pas.
describe('motions', () => {
  it('gives every motion its class and its keyframes', () => {
    const sheet = readFileSync(join(import.meta.dirname, '..', 'styles.css'), 'utf8')
    const motions = new Set(AVATARS.map((design) => design.motion))
    motions.delete('still')

    expect(motions.size).toBeGreaterThan(30)
    for (const motion of motions) {
      // Le mouvement est porté par la tuile, ou par la pièce qu'elle anime seule —
      // la boule de « half », les deux parts de « split » : les deux se lisent ici.
      const rule =
        sheet.match(new RegExp(`\\.motion-${motion} \\{([^}]*)\\}`))?.[1] ??
        sheet.match(new RegExp(`\\.motion-${motion} [^{}]*\\{([^}]*)\\}`))?.[1]
      expect(rule, `.motion-${motion}`).toBeDefined()
      const name = rule?.match(/animation:\s*([\w-]+)/)?.[1]
      expect(name, motion).toBeTruthy()
      expect(sheet, name).toContain(`@keyframes ${name} {`)
    }
  })
})

describe('worn tiles', () => {
  it('reads the starting tile as one nobody chose', () => {
    expect(isDefaultAvatar(DEFAULT_AVATAR)).toBe(true)
    expect(isDefaultAvatar({ ...DEFAULT_AVATAR, ground: 'jaune' })).toBe(false)
    expect(isDefaultAvatar({ ...DEFAULT_AVATAR, design: 30 })).toBe(false)
  })

  it('tells two tiles apart on any of their four layers', () => {
    expect(sameAvatar(DEFAULT_AVATAR, { ...DEFAULT_AVATAR })).toBe(true)
    expect(sameAvatar(DEFAULT_AVATAR, { ...DEFAULT_AVATAR, accent: 'violet' })).toBe(false)
  })
})
