import type { FeatureId } from './features'
import { isPlus } from './perks'
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

/** Bans and reveals are already unlimited for Premium: those picks would spend themselves. */
export const USELESS_FOR_PLUS: readonly BonusId[] = ['filter', 'reveal']

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

/** What the player and the version they play decide about the bonus table. */
export interface BonusFacts {
  isModerator: boolean
  /** The player holds a named account, or can make one from the moderator offer. */
  canName: boolean
  /** Reveals cost nothing on this version (`Host.unlimitedReveals`). */
  unlimitedReveals: boolean
  open(feature: FeatureId): boolean
}

/**
 * The kinds this player is never dealt, for a card that would give nothing:
 * the moderator offer to someone who is one, or who has no account to take
 * it with; a reveal where they are free; a filter or a slot where filtering
 * categories or wearing powers is closed.
 */
export function barredBonuses({ isModerator, canName, unlimitedReveals, open }: BonusFacts): BonusId[] {
  const barred: BonusId[] = []
  if (!open('categoryBans')) barred.push('filter')
  if (!open('powers')) barred.push('slot')
  if (unlimitedReveals) barred.push('reveal')
  if (isModerator || !canName || !open('moderatorOffer')) barred.push('moderator')
  return barred
}

/** The kinds still on offer: below their cap, and not `barred` (`barredBonuses`). */
export function bonusPool(profile: Profile, barred: readonly BonusId[] = []): BonusId[] {
  return BONUS_IDS.filter(
    (id) =>
      bonusCount(profile, id) < BONUS_CAPS[id] && !barred.includes(id) && !(isPlus(profile) && USELESS_FOR_PLUS.includes(id)),
  )
}

function poolRoom(profile: Profile, barred: readonly BonusId[]): number {
  return bonusPool(profile, barred).reduce((sum, id) => sum + BONUS_CAPS[id] - bonusCount(profile, id), 0)
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
 *
 * `bonuses` false — a version that pays a power or a category at every level
 * (`Host.levelBonuses`) — counts only those already taken, so the picks made
 * before keep their place and every level to come is a category.
 */
export function bonusLevels(profile: Profile, barred: readonly BonusId[] = [], bonuses = true): number {
  const taken = won(profile)
  if (!bonuses || !bonusUnlocked(profile)) return taken
  const reached = Math.max(0, Math.floor((levelFor(profile.xp) - BONUS_FROM_LEVEL) / BONUS_EVERY_LEVELS))
  return Math.max(taken, Math.min(reached, taken + poolRoom(profile, barred)))
}

/** Bonuses the player has earned and not yet picked. */
export function bonusesOwed(profile: Profile, barred: readonly BonusId[] = [], bonuses = true): number {
  return Math.max(0, bonusLevels(profile, barred, bonuses) - won(profile))
}

/**
 * Two bonuses, weighted by kind, if one is owed and none is on the table. The
 * first table a player is dealt always holds the second slot, while it is to
 * take: it is the bonus every power worn asks for. A card the player is now
 * `barred` from — a table dealt on another version, or before an account was
 * lost — leaves the table, and an empty table is dealt again.
 */
export function dealBonusOffer(profile: Profile, seed: number, barred: readonly BonusId[] = [], bonuses = true): Profile {
  const kept = profile.bonusOffer.filter((id) => isBonusId(id) && !barred.includes(id))
  if (kept.length > 0) return kept.length === profile.bonusOffer.length ? profile : { ...profile, bonusOffer: kept }
  const cleared = profile.bonusOffer.length > 0 ? { ...profile, bonusOffer: [] } : profile
  if (bonusesOwed(cleared, barred, bonuses) === 0) return cleared

  const rng = createRng(seed)
  const pool = bonusPool(cleared, barred)
  const offer: BonusId[] = won(cleared) === 0 && pool.includes('slot') ? ['slot'] : []
  const left = pool.filter((id) => !offer.includes(id))
  while (offer.length < BONUS_OFFER_SIZE) {
    const next = pickWeighted(rng, left, (id) => BONUS_WEIGHTS[id])
    if (next === null) break
    offer.push(next)
    left.splice(left.indexOf(next), 1)
  }
  return offer.length === 0 ? cleared : { ...cleared, bonusOffer: offer }
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
