import { describe, expect, it } from 'vitest'
import {
  AVATARS,
  DEFAULT_AVATAR,
  designUnlock,
  newlyEarned,
  ownedColours,
  ownedDesigns,
  PALETTE,
  parseAvatar,
  reached,
  type AvatarDesign,
} from './avatar'
import { applyRun, NEW_PROFILE, xpForLevel } from './progression'

describe('avatars', () => {
  // How many turns a shape takes before it looks the same again.
  const ORIENTATIONS: Record<string, number> = { circle: 1, square: 1, ring: 1, diamond: 1, sun: 1, bars: 2 }
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

  it('gives every tile a goal past the free ones', () => {
    expect(AVATARS.every((design) => design.id < 5 || designUnlock(design.id))).toBe(true)
  })

  it('starts a player with a few tiles and the three primaries', () => {
    expect(ownedDesigns(NEW_PROFILE)).toHaveLength(5)
    expect(ownedColours(NEW_PROFILE).map((colour) => colour.id)).toEqual(['rouge', 'bleu', 'jaune'])
    expect(reached(NEW_PROFILE, designUnlock(DEFAULT_AVATAR.design))).toBe(true)
  })

  it('earns nothing on a first run, even a very good one', () => {
    const words = Array.from({ length: 25 }, (_, index) => `mot${index}`)
    const after = applyRun(NEW_PROFILE, { score: 380, words, bestCombo: 9 })

    expect(newlyEarned(NEW_PROFILE, after)).toEqual({ designs: [], colours: [] })
  })

  it('pays out a first colour after a few runs', () => {
    let profile = NEW_PROFILE
    for (let run = 0; run < 3; run++) profile = applyRun(profile, { score: 120, words: ['chat'], bestCombo: 2 })

    expect(ownedColours(profile).map((colour) => colour.id)).toContain('noir')
  })

  it('opens the whole palette and every tile to a long career', () => {
    const veteran = { ...NEW_PROFILE, xp: xpForLevel(35), runs: 500, bestScore: 1000, wordsFound: 5000, bestCombo: 30 }

    expect(ownedColours(veteran)).toHaveLength(PALETTE.length)
    expect(ownedDesigns(veteran)).toHaveLength(AVATARS.length)
  })
})

describe('parseAvatar', () => {
  it('falls back on anything it does not recognise', () => {
    expect(parseAvatar(null)).toEqual(DEFAULT_AVATAR)
    expect(parseAvatar({ design: 999, ground: 'fuchsia', shape: 'noir' })).toEqual({
      ...DEFAULT_AVATAR,
      shape: 'noir',
    })
  })
})
