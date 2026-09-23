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
} from './avatar'
import { applyRun, NEW_PROFILE, xpForLevel } from './progression'

describe('avatars', () => {
  it('offers a hundred distinct tiles', () => {
    const looks = new Set(AVATARS.map((design) => `${design.shape}/${design.turn}/${design.accent}`))

    expect(AVATARS).toHaveLength(100)
    expect(looks.size).toBe(100)
    expect(AVATARS.map((design) => design.id)).toEqual(AVATARS.map((_, index) => index))
  })

  it('gives every tile a goal past the free ones', () => {
    expect(AVATARS.every((design) => design.id < 6 || designUnlock(design.id) !== null)).toBe(true)
  })

  it('starts a player with a few tiles and the three primaries', () => {
    expect(ownedDesigns(NEW_PROFILE)).toHaveLength(6)
    expect(ownedColours(NEW_PROFILE).map((colour) => colour.id)).toEqual(['rouge', 'bleu', 'jaune'])
    expect(reached(NEW_PROFILE, designUnlock(DEFAULT_AVATAR.design))).toBe(true)
  })

  it('pays out a colour for the very first run', () => {
    const after = applyRun(NEW_PROFILE, { score: 40, words: ['chat'], bestCombo: 1 })

    expect(newlyEarned(NEW_PROFILE, after).colours.map((colour) => colour.id)).toEqual(['noir'])
  })

  it('opens the whole palette and every tile to a long career', () => {
    const veteran = { ...NEW_PROFILE, xp: xpForLevel(30), runs: 500, bestScore: 2000, wordsFound: 5000, bestCombo: 40 }

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
