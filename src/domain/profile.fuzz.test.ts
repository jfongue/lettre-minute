import { describe, expect, it } from 'vitest'
import { CATALOGUE } from './catalogue'
import { choosePower, dealPowerOffer, equipPower, equippedPowers, MAX_EQUIPPED, ownedPowers, POWER_IDS, POWER_OFFER_SIZE, powerPicksOwed } from './powers'
import { applyRun, NEW_PROFILE, type Profile } from './progression'
import { createRng, type Rng } from './rng'
import { chooseCategory, dealLineup, dealOffer, MAX_CATEGORIES_PER_RUN, OFFER_SIZE, ownedCategoryIds, picksOwed, swapCategory } from './unlocks'

/**
 * A player's whole career, played at random: runs, offers, picks, slots and
 * swaps in any order. Whatever the order, the profile must stay one the
 * screens can show — no category owned twice, no power worn that is not owned.
 */
const pick = <T,>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng.next() * items.length)]!
const unique = (items: readonly string[]) => new Set(items).size === items.length

function checkProfile(profile: Profile, tag: string): void {
  const owned = ownedCategoryIds(profile)
  expect(unique(owned), `${tag} owned twice: ${owned}`).toBe(true)
  expect(profile.offer.length, tag).toBeLessThanOrEqual(OFFER_SIZE)
  for (const id of profile.offer) expect(owned, `${tag} offers an owned category`).not.toContain(id)
  expect(picksOwed(profile), tag).toBeGreaterThanOrEqual(0)

  const powers = ownedPowers(profile)
  expect(unique(powers), `${tag} power owned twice: ${powers}`).toBe(true)
  expect(profile.powerOffer.length, tag).toBeLessThanOrEqual(POWER_OFFER_SIZE)
  for (const id of profile.powerOffer) expect(powers, `${tag} offers an owned power`).not.toContain(id)
  expect(powerPicksOwed(profile), tag).toBeGreaterThanOrEqual(0)

  const worn = equippedPowers(profile)
  expect(worn.length, tag).toBeLessThanOrEqual(MAX_EQUIPPED)
  expect(unique(worn), `${tag} worn twice: ${worn}`).toBe(true)
  for (const id of worn) expect(powers, `${tag} wears a power not owned`).toContain(id)
}

function career(seed: number): void {
  const rng = createRng(seed)
  const available = CATALOGUE.map((category) => category.id).filter(() => rng.next() < 0.8)
  let profile: Profile = NEW_PROFILE

  for (let step = 0; step < 120; step++) {
    const tag = `seed=${seed} step=${step}`
    const roll = rng.next()
    if (roll < 0.3) profile = applyRun(profile, { score: Math.floor(rng.next() * 900), words: [], bestCombo: 3 })
    else if (roll < 0.4) profile = dealOffer(profile, available, step)
    else if (roll < 0.5 && profile.offer.length > 0) profile = chooseCategory(profile, pick(rng, profile.offer))
    else if (roll < 0.55) profile = chooseCategory(profile, pick(rng, CATALOGUE).id)
    else if (roll < 0.65) profile = dealPowerOffer(profile, step)
    else if (roll < 0.75 && profile.powerOffer.length > 0) profile = choosePower(profile, pick(rng, profile.powerOffer))
    else if (roll < 0.8) profile = choosePower(profile, pick(rng, POWER_IDS))
    else if (roll < 0.95) {
      const choice = rng.next() < 0.2 ? null : pick(rng, POWER_IDS)
      profile = equipPower(profile, Math.floor(rng.next() * (MAX_EQUIPPED + 2)) - 1, choice)
    } else {
      const owned = ownedCategoryIds(profile)
      let lineup = dealLineup(step, owned)
      for (let swap = 0; swap < 4; swap++) lineup = swapCategory(lineup, Math.floor(rng.next() * (MAX_CATEGORIES_PER_RUN + 1)))
      expect(lineup.dealt.length, tag).toBe(Math.min(MAX_CATEGORIES_PER_RUN, owned.length))
      expect([...lineup.dealt, ...lineup.reserve].sort(), `${tag} a swap lost or doubled a category`).toEqual([...owned].sort())
    }
    checkProfile(profile, tag)
  }
}

describe('fuzz: a career played in any order', () => {
  it('keeps the profile coherent', () => {
    const master = createRng(Number(process.env.FUZZ_SEED ?? 20260924) >>> 0)
    const careers = Number(process.env.FUZZ_RUNS ?? 40)
    for (let i = 0; i < careers; i++) career(Math.floor(master.next() * 2 ** 32))
  }, 30_000 + Number(process.env.FUZZ_RUNS ?? 40) * 20)
})
