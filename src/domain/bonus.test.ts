import { describe, expect, it } from 'vitest'
import {
  BONUS_CAPS,
  BONUS_EVERY_LEVELS,
  BONUS_FROM_LEVEL,
  bonusCount,
  bonusLevels,
  bonusPool,
  bonusUnlocked,
  bonusesOwed,
  catchUpPerks,
  chooseBonus,
  dealBonusOffer,
  type BonusId,
} from './bonus'
import { CATALOGUE } from './catalogue'
import { LEVEL_POWER_IDS, powersEarnedAt } from './powers'
import { NEW_PROFILE, PERKS_VERSION, xpForLevel, type Profile } from './progression'
import { ownedCategoryIds, picksOwed, starterCategoryIds } from './unlocks'

const EXTRA = CATALOGUE.filter((category) => !category.premiere && !starterCategoryIds().includes(category.id)).map((category) => category.id)

/**
 * A player at `level` who made every pick the levels paid: the powers, the
 * categories, and the bonus levels in the place of a category each.
 */
function diligent(level: number, patch: Partial<Profile> = {}): Profile {
  const powers = LEVEL_POWER_IDS.slice(0, powersEarnedAt(level))
  const bonusLevelsReached = level < BONUS_FROM_LEVEL ? 0 : Math.floor((level - BONUS_FROM_LEVEL) / BONUS_EVERY_LEVELS)
  const picks = Math.max(0, level - 1 - powers.length - bonusLevelsReached)
  return { ...NEW_PROFILE, xp: xpForLevel(level), powers, unlocked: EXTRA.slice(0, picks), ...patch }
}

const FIRST_BONUS = BONUS_FROM_LEVEL + BONUS_EVERY_LEVELS

describe('bonus levels', () => {
  it('start from the level where three powers and six categories are owned', () => {
    // The constant is a derivation, not a guess: the first level that gives both.
    const first = [...Array(40).keys()].find(
      (level) => powersEarnedAt(level) >= 3 && starterCategoryIds().length + (level - 1 - powersEarnedAt(level)) >= 6,
    )
    expect(first).toBe(BONUS_FROM_LEVEL)
  })

  it('pay nothing before the conditions hold', () => {
    const profile = { ...NEW_PROFILE, xp: xpForLevel(20) }
    expect(bonusUnlocked(profile)).toBe(false)
    expect(bonusLevels(profile)).toBe(0)
    const powers = ['joker', 'hush', 'dodge']
    expect(bonusUnlocked({ ...profile, powers, unlocked: EXTRA.slice(0, 2) })).toBe(false)
    expect(bonusUnlocked({ ...profile, powers, unlocked: EXTRA.slice(0, 3) })).toBe(true)
  })

  it('take one level in three, and its category with it', () => {
    expect(bonusesOwed(diligent(FIRST_BONUS - 1))).toBe(0)
    const first = diligent(FIRST_BONUS)
    expect(bonusesOwed(first)).toBe(1)
    expect(picksOwed(first)).toBe(0)
    // The bonus pays the category of its level: with it taken, nothing more is owed.
    expect(picksOwed({ ...first, bonuses: ['filter'] })).toBe(0)
    // A player who skipped picks keeps owing them: no bonus level before the conditions hold.
    const short = { ...first, unlocked: first.unlocked.slice(0, 2) }
    expect(bonusUnlocked(short)).toBe(false)
    expect(picksOwed(short)).toBe(FIRST_BONUS - 1 - powersEarnedAt(FIRST_BONUS) - 2)
  })

  it('count two bonus levels three levels later', () => {
    const level = FIRST_BONUS + BONUS_EVERY_LEVELS
    expect(bonusLevels(diligent(level))).toBe(2)
    expect(bonusesOwed(diligent(level))).toBe(2)
    expect(bonusesOwed(diligent(level, { bonuses: ['reveal'] }))).toBe(1)
  })

  it('give a bonus level back to the categories once the pool is empty', () => {
    const everything = diligent(40, { bonuses: ['filter', 'filter', 'slot', 'reveal', 'reveal', 'reveal', 'moderator'] })
    expect(bonusPool(everything, false)).toEqual([])
    expect(bonusesOwed(everything)).toBe(0)
    // A moderator is not offered the moderator bonus: with the rest taken, nothing is left.
    const rest = { ...everything, bonuses: ['filter', 'filter', 'slot', 'reveal', 'reveal', 'reveal'] }
    expect(bonusPool(rest, true)).toEqual([])
    expect(bonusPool(rest, false)).toEqual(['moderator'])
    expect(bonusesOwed(rest, true)).toBe(0)
    // The level that found the pool empty is a category again.
    expect(picksOwed(rest, true)).toBe(picksOwed(rest, false) + 1)
  })

  it('do not spend a level on what the catch-up gave', () => {
    expect(bonusesOwed(diligent(FIRST_BONUS, { bonuses: ['filter'], bonusGifts: 1 }))).toBe(1)
    const level = FIRST_BONUS + BONUS_EVERY_LEVELS
    expect(bonusesOwed(diligent(level, { bonuses: ['filter'], bonusGifts: 1 }))).toBe(2)
  })
})

describe('the offer', () => {
  const owing = diligent(FIRST_BONUS + BONUS_EVERY_LEVELS)

  it('deals two distinct kinds from the pool, only when one is owed', () => {
    expect(dealBonusOffer(NEW_PROFILE, 1)).toBe(NEW_PROFILE)
    const dealt = dealBonusOffer(owing, 1)
    expect(dealt.bonusOffer).toHaveLength(2)
    expect(new Set(dealt.bonusOffer).size).toBe(2)
    expect(dealBonusOffer(dealt, 2)).toBe(dealt)
  })

  it('is a function of the seed', () => {
    expect(dealBonusOffer(owing, 7).bonusOffer).toEqual(dealBonusOffer(owing, 7).bonusOffer)
  })

  it('favours reveals threefold', () => {
    const seen: Record<string, number> = { filter: 0, slot: 0, reveal: 0, moderator: 0 }
    for (let seed = 0; seed < 3000; seed++) for (const id of dealBonusOffer(owing, seed).bonusOffer) seen[id]!++
    expect(seen.reveal!).toBeGreaterThan(seen.filter! * 1.3)
    expect(seen.reveal!).toBeGreaterThan(seen.slot! * 1.3)
    expect(Math.abs(seen.filter! - seen.moderator!)).toBeLessThan(300)
  })

  it('leaves out what is capped, and the moderator offer for a moderator', () => {
    const capped = { ...diligent(22), bonuses: ['slot', 'filter', 'filter'], bonusGifts: 0 }
    for (let seed = 0; seed < 50; seed++) {
      expect(dealBonusOffer(capped, seed, true).bonusOffer).toEqual(['reveal'])
    }
  })

  it('records the choice, and keeps the offer in mind', () => {
    const dealt = dealBonusOffer(owing, 3)
    const kept = chooseBonus(dealt, dealt.bonusOffer[1]!)
    expect(kept.bonuses).toEqual([dealt.bonusOffer[1]])
    expect(kept.bonusOffer).toEqual([])
    expect(kept.lastBonusOffer).toEqual(dealt.bonusOffer)
    expect(chooseBonus(dealt, 'nope')).toBe(dealt)
    expect(chooseBonus(NEW_PROFILE, 'slot')).toBe(NEW_PROFILE)
  })

  it('never takes a kind past its cap', () => {
    let profile = diligent(60)
    for (let seed = 0; seed < 20; seed++) {
      const dealt = dealBonusOffer(profile, seed)
      profile = chooseBonus(dealt, dealt.bonusOffer[0] ?? '')
    }
    for (const [id, cap] of Object.entries(BONUS_CAPS)) expect(bonusCount(profile, id as BonusId)).toBeLessThanOrEqual(cap)
    expect(profile.bonuses.length).toBe(7)
  })
})

describe('the catch-up', () => {
  const old: Profile = { ...NEW_PROFILE, perksVersion: 0 }

  it('turns a ban into a filter bonus and two worn powers into the second slot, once', () => {
    const caught = catchUpPerks({ ...old, banned: ['pays'], equipped: ['joker', 'hush'], powers: ['joker', 'hush'] })
    expect(caught.bonuses).toEqual(['filter', 'slot'])
    expect(caught.bonusGifts).toBe(2)
    expect(caught.perksVersion).toBe(PERKS_VERSION)
    expect(catchUpPerks(caught)).toBe(caught)
  })

  it('gives nothing to a player who used neither', () => {
    expect(catchUpPerks({ ...old, equipped: ['joker'] })).toEqual({ ...old, equipped: ['joker'], perksVersion: PERKS_VERSION })
  })

  it('leaves the Premium date alone', () => {
    expect(catchUpPerks({ ...old, plusSince: 99 }).plusSince).toBe(99)
    expect(ownedCategoryIds({ ...old, plusSince: 99 }).length).toBeGreaterThan(starterCategoryIds().length)
  })
})
