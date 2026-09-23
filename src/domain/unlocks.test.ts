import { describe, expect, it } from 'vitest'
import { CATALOGUE } from './catalogue'
import { NEW_PROFILE, xpForLevel, type Profile } from './progression'
import {
  chooseCategory,
  dealLineup,
  dealOffer,
  MAX_CATEGORIES_PER_RUN,
  OFFER_SIZE,
  ownedCategoryIds,
  picksOwed,
  starterCategoryIds,
  swapCategory,
} from './unlocks'

const ALL = CATALOGUE.map((category) => category.id)
const atLevel = (level: number, profile: Profile = NEW_PROFILE): Profile => ({ ...profile, xp: xpForLevel(level) })

describe('owned categories', () => {
  it('opens the game on the starters alone', () => {
    expect(ownedCategoryIds(NEW_PROFILE)).toEqual(starterCategoryIds())
    expect(starterCategoryIds().length).toBeGreaterThanOrEqual(3)
    expect(starterCategoryIds().length).toBeLessThan(CATALOGUE.length)
  })

  it('owes one pick per level above the first', () => {
    expect(picksOwed(NEW_PROFILE)).toBe(0)
    expect(picksOwed(atLevel(4))).toBe(3)
    expect(picksOwed({ ...atLevel(4), unlocked: ['sports'] })).toBe(2)
  })
})

describe('dealOffer', () => {
  it('offers nothing while no pick is owed', () => {
    expect(dealOffer(NEW_PROFILE, ALL, 1)).toBe(NEW_PROFILE)
  })

  it('puts three categories the player does not own on the table', () => {
    const { offer } = dealOffer(atLevel(2), ALL, 1)

    expect(offer).toHaveLength(OFFER_SIZE)
    expect(new Set(offer).size).toBe(OFFER_SIZE)
    for (const id of offer) expect(starterCategoryIds()).not.toContain(id)
  })

  it('keeps the offer on the table until the player picks', () => {
    const dealt = dealOffer(atLevel(2), ALL, 1)

    expect(dealOffer(dealt, ALL, 2)).toBe(dealt)
  })

  it('never offers a category the build ships no words for', () => {
    const shipped = [...starterCategoryIds(), 'sports', 'metiers']

    expect([...dealOffer(atLevel(2), shipped, 1).offer].sort()).toEqual(['metiers', 'sports'])
  })

  it('avoids repeating the previous offer while others remain', () => {
    const first = dealOffer(atLevel(3), ALL, 1)
    const picked = chooseCategory(first, first.offer[0]!)
    const second = dealOffer(picked, ALL, 1)

    for (const id of second.offer) expect(first.offer).not.toContain(id)
  })

  it('falls back on the previous offer when nothing else is left', () => {
    const owned = ALL.slice(0, -3)
    const profile: Profile = { ...atLevel(20), unlocked: owned, lastOffer: ALL.slice(-2) }

    expect([...dealOffer(profile, ALL, 1).offer].sort()).toEqual([...ALL.slice(-3)].sort())
  })
})

describe('chooseCategory', () => {
  it('adds the pick to what the player owns and clears the table', () => {
    const offered = dealOffer(atLevel(2), ALL, 1)
    const picked = chooseCategory(offered, offered.offer[1]!)

    expect(ownedCategoryIds(picked)).toContain(offered.offer[1])
    expect(picked.offer).toEqual([])
    expect(picked.lastOffer).toEqual(offered.offer)
    expect(picksOwed(picked)).toBe(0)
  })

  it('ignores a category that was not offered', () => {
    const offered = dealOffer(atLevel(2), ALL, 1)
    const outsider = ALL.find((id) => !offered.offer.includes(id))!

    expect(chooseCategory(offered, outsider)).toBe(offered)
  })
})

describe('lineup', () => {
  const owned = ['pays', 'animaux', 'couleurs', 'metiers', 'sports', 'insectes', 'capitales']

  it('plays with five categories at most and keeps the rest in reserve', () => {
    const lineup = dealLineup(5, owned)

    expect(lineup.dealt).toHaveLength(MAX_CATEGORIES_PER_RUN)
    expect([...lineup.dealt, ...lineup.reserve].sort()).toEqual([...owned].sort())
    expect(dealLineup(5, owned)).toEqual(lineup)
  })

  it('deals everything when the player owns fewer', () => {
    expect(dealLineup(5, ['pays', 'animaux']).reserve).toEqual([])
  })

  it('trades a dealt category for the next one in reserve', () => {
    const lineup = dealLineup(5, owned)
    const swapped = swapCategory(lineup, 2)

    expect(swapped.dealt[2]).toBe(lineup.reserve[0])
    expect(swapped.reserve.at(-1)).toBe(lineup.dealt[2])
    expect(swapped.dealt.filter((id, at) => id !== lineup.dealt[at])).toHaveLength(1)
  })

  it('walks the whole reserve before a category comes back', () => {
    let lineup = dealLineup(5, owned)
    const first = lineup.dealt[0]
    const seen = new Set<string>()
    for (let i = 0; i < lineup.reserve.length; i++) {
      lineup = swapCategory(lineup, 0)
      seen.add(lineup.dealt[0]!)
    }

    expect(seen.has(first!)).toBe(false)
    expect(swapCategory(lineup, 0).dealt[0]).toBe(first)
  })

  it('changes nothing without a reserve', () => {
    const lineup = dealLineup(5, ['pays', 'animaux'])

    expect(swapCategory(lineup, 0)).toBe(lineup)
  })
})

describe('withdrawn categories', () => {
  it('owes a new pick for a category the catalogue no longer has', () => {
    const profile: Profile = { ...atLevel(2), unlocked: ['retiree-du-catalogue'] }

    expect(picksOwed(profile)).toBe(1)
    expect(ownedCategoryIds(profile)).toEqual(starterCategoryIds())
  })
})
