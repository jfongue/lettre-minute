import { levelFor, PERKS_VERSION, type Profile } from './progression'
import { ownedPlainCount } from './owned'
import { ownedPowers } from './powers'
import { createRng, pickWeighted } from './rng'

/** What a bonus level gives: identifiers only, the names live in `src/i18n/`. */
export type BonusId = 'filter' | 'slot' | 'reveal' | 'moderator'

export const BONUS_IDS: readonly BonusId[] = ['filter', 'slot', 'reveal', 'moderator']

/** How many times each can be taken. */
export const BONUS_CAPS: Readonly<Record<BonusId, number>> = { filter: 2, slot: 1, reveal: 3, moderator: 1 }

/** Reveals are the likeliest on the table: they are what the game runs out of first. */
export const BONUS_WEIGHTS: Readonly<Record<BonusId, number>> = { filter: 1, slot: 1, reveal: 3, moderator: 1 }

export const BONUS_OFFER_SIZE = 2

/** Powers and categories owned before levels start paying bonuses. */
export const BONUS_MIN_POWERS = 3
export const BONUS_MIN_CATEGORIES = 6

/**
 * First level at which the two conditions hold for a player who made every
 * pick — three powers by level 7, three category picks on top of the three
 * starters — and from which every third level pays a bonus, not a category.
 */
export const BONUS_FROM_LEVEL = 7
export const BONUS_EVERY_LEVELS = 3

export function isBonusId(value: unknown): value is BonusId {
  return BONUS_IDS.includes(value as BonusId)
}

export function bonusCount(profile: Profile, id: BonusId): number {
  return profile.bonuses.filter((taken) => taken === id).length
}

/** The kinds still on offer: below their cap, and no moderator offer for someone who already is one. */
export function bonusPool(profile: Profile, isModerator: boolean): BonusId[] {
  return BONUS_IDS.filter(
    (id) => bonusCount(profile, id) < BONUS_CAPS[id] && !(id === 'moderator' && isModerator),
  )
}

function poolRoom(profile: Profile, isModerator: boolean): number {
  return bonusPool(profile, isModerator).reduce((sum, id) => sum + BONUS_CAPS[id] - bonusCount(profile, id), 0)
}

/** Bonuses won at a level, as against those the catch-up gave. */
function won(profile: Profile): number {
  return Math.max(0, profile.bonuses.filter(isBonusId).length - profile.bonusGifts)
}

export function bonusUnlocked(profile: Profile): boolean {
  return ownedPowers(profile).length >= BONUS_MIN_POWERS && ownedPlainCount(profile) >= BONUS_MIN_CATEGORIES
}

/**
 * The levels reached so far that pay a bonus rather than a category: every
 * third from `BONUS_FROM_LEVEL` once the conditions hold, as many as the
 * bonuses left to take — a level with nothing left in the pool is a category
 * again (`picksOwed`). Derived from the level like the picks, never stored.
 */
export function bonusLevels(profile: Profile, isModerator = false): number {
  const taken = won(profile)
  if (!bonusUnlocked(profile)) return taken
  const reached = Math.max(0, Math.floor((levelFor(profile.xp) - BONUS_FROM_LEVEL) / BONUS_EVERY_LEVELS))
  return Math.max(taken, Math.min(reached, taken + poolRoom(profile, isModerator)))
}

/** Bonuses the player has earned and not yet picked. */
export function bonusesOwed(profile: Profile, isModerator = false): number {
  return Math.max(0, bonusLevels(profile, isModerator) - won(profile))
}

/** Two bonuses, weighted by kind, if one is owed and none is on the table. */
export function dealBonusOffer(profile: Profile, seed: number, isModerator = false): Profile {
  if (profile.bonusOffer.length > 0 || bonusesOwed(profile, isModerator) === 0) return profile

  const rng = createRng(seed)
  const left = bonusPool(profile, isModerator)
  const offer: BonusId[] = []
  while (offer.length < BONUS_OFFER_SIZE) {
    const next = pickWeighted(rng, left, (id) => BONUS_WEIGHTS[id])
    if (next === null) break
    offer.push(next)
    left.splice(left.indexOf(next), 1)
  }
  return offer.length === 0 ? profile : { ...profile, bonusOffer: offer }
}

/**
 * Keeps a bonus from the table. `moderator` is only written down: the screen
 * then opens the moderator offer, which needs a named account.
 */
export function chooseBonus(profile: Profile, id: string): Profile {
  if (!profile.bonusOffer.includes(id) || !isBonusId(id)) return profile
  return { ...profile, bonuses: [...profile.bonuses, id], bonusOffer: [], lastBonusOffer: profile.bonusOffer }
}

/**
 * The rules this build brought, owed to a profile older than them — once.
 * A ban already laid is a filter bonus taken, two powers worn the second slot:
 * what they enjoyed keeps working. Gifts, so no level's reward is spent on them.
 */
export function catchUpPerks(profile: Profile): Profile {
  if (profile.perksVersion >= PERKS_VERSION) return profile
  const gifts: BonusId[] = []
  if (profile.banned.length >= 1 && !profile.bonuses.includes('filter')) gifts.push('filter')
  if (profile.equipped.length >= 2 && !profile.bonuses.includes('slot')) gifts.push('slot')
  return {
    ...profile,
    bonuses: [...profile.bonuses, ...gifts],
    bonusGifts: profile.bonusGifts + gifts.length,
    perksVersion: PERKS_VERSION,
  }
}
