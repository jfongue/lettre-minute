import { CATALOGUE, categoryMeta } from './catalogue'
import { levelFor, type Profile } from './progression'
import { powersEarnedAt, unlockEveryPower } from './powers'
import { createRng, shuffled } from './rng'

/** Each level up puts this many categories on the table; the player keeps one. */
export const OFFER_SIZE = 3

/** Categories dealt into a run. Past this, the prompts come round too rarely to warm up on any of them. */
export const MAX_CATEGORIES_PER_RUN = 5

/** The categories every player owns from the first run. */
export function starterCategoryIds(): string[] {
  return CATALOGUE.filter((category) => category.unlockLevel <= 1).map((category) => category.id)
}

/** Starters first, then the picks in the order they were made, then the categories once given as a gift. */
export function ownedCategoryIds(profile: Profile): string[] {
  const starters = starterCategoryIds()
  const picks = picked(profile).filter((id) => !starters.includes(id))
  const gifts = profile.gifted.filter((id) => !starters.includes(id) && !picks.includes(id))
  return [...starters, ...picks, ...gifts]
}

// A category withdrawn from the catalogue no longer counts as a pick made:
// the player is owed a replacement.
function picked(profile: Profile): string[] {
  return profile.unlocked.filter((id) => categoryMeta(id) !== null)
}

/**
 * One pick per level above the first that does not bring a power — every
 * level, once the powers run out — minus those already made. Derived rather
 * than stored so that a player who levelled up on another device, whose picks
 * the server does not keep, is simply offered them again here.
 */
export function picksOwed(profile: Profile): number {
  const level = levelFor(profile.xp)
  return Math.max(0, level - 1 - powersEarnedAt(level) - picked(profile).length)
}

/**
 * Deals the next offer if a pick is owed and none is on the table. The previous
 * offer is set aside while enough other categories remain: seeing the same
 * three twice in a row reads as the game having nothing else.
 *
 * `availableIds` is what the build ships a dictionary for — a category without
 * words can be neither offered nor played.
 */
export function dealOffer(profile: Profile, availableIds: readonly string[], seed: number): Profile {
  if (profile.offer.length > 0 || picksOwed(profile) === 0) return profile

  const owned = new Set(ownedCategoryIds(profile))
  const candidates = CATALOGUE.map((category) => category.id).filter(
    (id) => availableIds.includes(id) && !owned.has(id),
  )
  if (candidates.length === 0) return profile

  const rng = createRng(seed)
  const fresh = shuffled(rng, candidates.filter((id) => !profile.lastOffer.includes(id)))
  const seen = shuffled(rng, candidates.filter((id) => profile.lastOffer.includes(id)))
  return { ...profile, offer: [...fresh, ...seen].slice(0, OFFER_SIZE) }
}

/**
 * Ads are off for now: the summary's ask for support is the only one. Turned
 * back on, the SDK, consent and the offer's notice all follow from `adsDue`.
 */
export const ADS_ENABLED = false

/** Picks made before the game asks for an ad: the first reward stays a pure reward. */
export const PICKS_BEFORE_ADS = 1

/**
 * Whether the player's next pick will come with an ad — true long before that
 * offer is dealt, which leaves the ad the time of a whole run to load.
 */
export function adsDue(profile: Profile): boolean {
  return ADS_ENABLED && picked(profile).length >= PICKS_BEFORE_ADS
}

/** Whether keeping a category from the offer on the table comes with an ad. */
export function pickShowsAd(profile: Profile): boolean {
  return profile.offer.length > 0 && adsDue(profile)
}

/**
 * Every category of the catalogue, owned without a pick — for the house
 * account, which plays to test them all.
 */
export function unlockEverything(profile: Profile): Profile {
  const owned = new Set(ownedCategoryIds(profile))
  const missing = CATALOGUE.map((category) => category.id).filter((id) => !owned.has(id))
  const categories = missing.length === 0 && profile.offer.length === 0
    ? profile
    : { ...profile, unlocked: [...profile.unlocked, ...missing], offer: [] }
  return unlockEveryPower(categories)
}

export function chooseCategory(profile: Profile, categoryId: string): Profile {
  if (!profile.offer.includes(categoryId)) return profile
  return { ...profile, unlocked: [...profile.unlocked, categoryId], offer: [], lastOffer: profile.offer }
}

export interface Lineup {
  /** What the run plays with, in the order announced. */
  dealt: readonly string[]
  /** Owned categories left out, next in line for a swap. */
  reserve: readonly string[]
}

export function dealLineup(seed: number, ownedIds: readonly string[]): Lineup {
  const deck = shuffled(createRng(seed), ownedIds)
  return { dealt: deck.slice(0, MAX_CATEGORIES_PER_RUN), reserve: deck.slice(MAX_CATEGORIES_PER_RUN) }
}

/**
 * Trades a dealt category for the first one in reserve — the Permutation power. The one set aside goes
 * to the back of the queue, so tapping the same slot again walks through the
 * whole reserve before it comes back.
 */
export function swapCategory(lineup: Lineup, index: number): Lineup {
  const [incoming, ...rest] = lineup.reserve
  const outgoing = lineup.dealt[index]
  if (incoming === undefined || outgoing === undefined) return lineup
  return {
    dealt: lineup.dealt.map((id, at) => (at === index ? incoming : id)),
    reserve: [...rest, outgoing],
  }
}
