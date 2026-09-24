import { levelFor, type Profile } from './progression'
import type { RarityTier } from './rarity'
import { createRng, shuffled } from './rng'

/**
 * What a player can take into a run on top of the rules. Identifiers only: the
 * names and what each one says live in `src/i18n/`.
 */
export type PowerId =
  | 'permutation'
  | 'joker'
  | 'dodge'
  | 'magic'
  | 'hush'
  | 'dyslexia'
  | 'divination'
  | 'complication'
  | 'celerity'
  | 'professor'

/** In the order the game introduces them when the draw has a choice. */
export const POWER_IDS: readonly PowerId[] = [
  'permutation',
  'joker',
  'dodge',
  'magic',
  'hush',
  'dyslexia',
  'divination',
  'complication',
  'celerity',
  'professor',
]

/** Uses per run. A power absent from this table works all run long. */
export const POWER_CHARGES: Readonly<Partial<Record<PowerId, number>>> = {
  permutation: 2,
  joker: 1,
  magic: 2,
  hush: 1,
}

/** The powers a player can type into the field, rather than tap. */
export type Spell = 'joker' | 'hush'

export const MAX_EQUIPPED = 2
export const POWER_OFFER_SIZE = 2
/** The level of the sixth category: the first power comes with it. */
export const FIRST_POWER_LEVEL = 4
/** Then one power every other level. */
export const POWER_LEVEL_STEP = 2

/** What a skip costs under Esquive, against `SKIP_PENALTY_SECONDS`. */
export const DODGE_PENALTY_SECONDS = 3
/** The longest Silence holds the clock, if no word is validated first. */
export const HUSH_SECONDS = 10
/** Complication's multiplier on the points of an uncommon or rarer word. */
export const COMPLICATION_BOOST: Readonly<Partial<Record<RarityTier, number>>> = {
  'peu commun': 1.15,
  rare: 1.3,
  'très rare': 1.3,
}

export function isPowerId(value: unknown): value is PowerId {
  return POWER_IDS.includes(value as PowerId)
}

/** Powers the player has earned by `level`: one at the first power level, then one every other level. */
export function powersEarnedAt(level: number): number {
  if (level < FIRST_POWER_LEVEL) return 0
  return Math.min(POWER_IDS.length, Math.floor((level - FIRST_POWER_LEVEL) / POWER_LEVEL_STEP) + 1)
}

/** The next level that brings a power, or null once they are all earned. */
export function nextPowerLevel(level: number): number | null {
  if (powersEarnedAt(level) >= POWER_IDS.length) return null
  if (level < FIRST_POWER_LEVEL) return FIRST_POWER_LEVEL
  return level + POWER_LEVEL_STEP - ((level - FIRST_POWER_LEVEL) % POWER_LEVEL_STEP)
}

// A power withdrawn from the game no longer counts as a pick made.
export function ownedPowers(profile: Profile): PowerId[] {
  return profile.powers.filter(isPowerId)
}

/** Derived from the level, like the category picks: another device's picks are simply offered again. */
export function powerPicksOwed(profile: Profile): number {
  return Math.max(0, powersEarnedAt(levelFor(profile.xp)) - ownedPowers(profile).length)
}

/**
 * Deals two powers if a pick is owed and none is on the table. The previous
 * offer is set aside while enough others remain, as for categories: the same
 * two cards twice in a row read as the game having nothing else.
 */
export function dealPowerOffer(profile: Profile, seed: number): Profile {
  if (profile.powerOffer.length > 0 || powerPicksOwed(profile) === 0) return profile

  const owned = new Set(ownedPowers(profile))
  const candidates = POWER_IDS.filter((id) => !owned.has(id))
  if (candidates.length === 0) return profile

  const rng = createRng(seed)
  const fresh = shuffled(rng, candidates.filter((id) => !profile.lastPowerOffer.includes(id)))
  const seen = shuffled(rng, candidates.filter((id) => profile.lastPowerOffer.includes(id)))
  return { ...profile, powerOffer: [...fresh, ...seen].slice(0, POWER_OFFER_SIZE) }
}

/** Keeps a power from the table, and wears it straight away if a slot is free. */
export function choosePower(profile: Profile, powerId: string): Profile {
  if (!profile.powerOffer.includes(powerId)) return profile
  const equipped = equippedPowers(profile)
  return {
    ...profile,
    powers: [...profile.powers, powerId],
    powerOffer: [],
    lastPowerOffer: profile.powerOffer,
    equipped: equipped.length < MAX_EQUIPPED ? [...equipped, powerId] : equipped,
  }
}

/** What the run will carry: owned powers only, never more than the slots. */
export function equippedPowers(profile: Profile): PowerId[] {
  const owned = new Set(ownedPowers(profile))
  return [...new Set(profile.equipped.filter(isPowerId))].filter((id) => owned.has(id)).slice(0, MAX_EQUIPPED)
}

/**
 * Puts a power in a slot, or empties it with null. A power already worn in the
 * other slot trades places with what this one held, so a slot never carries a
 * power twice.
 */
export function equipPower(profile: Profile, slot: number, powerId: PowerId | null): Profile {
  if (slot < 0 || slot >= MAX_EQUIPPED) return profile
  if (powerId !== null && !ownedPowers(profile).includes(powerId)) return profile

  const slots: (PowerId | null)[] = Array.from({ length: MAX_EQUIPPED }, (_, at) => equippedPowers(profile)[at] ?? null)
  const other = slots.indexOf(powerId)
  if (powerId !== null && other >= 0 && other !== slot) slots[other] = slots[slot] ?? null
  slots[slot] = powerId
  return { ...profile, equipped: slots.filter((id): id is PowerId => id !== null) }
}

/** Every power, owned without a pick — for the house account, which plays to test them all. */
export function unlockEveryPower(profile: Profile): Profile {
  const owned = new Set(ownedPowers(profile))
  const missing = POWER_IDS.filter((id) => !owned.has(id))
  if (missing.length === 0 && profile.powerOffer.length === 0) return profile
  return { ...profile, powers: [...profile.powers, ...missing], powerOffer: [] }
}
