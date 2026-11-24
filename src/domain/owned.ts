import { CATALOGUE, categoryMeta } from './catalogue'
import type { Profile } from './progression'

/** The categories every player owns from the first run. */
export function starterCategoryIds(): string[] {
  return CATALOGUE.filter((category) => category.unlockLevel <= 1).map((category) => category.id)
}

// A category withdrawn from the catalogue no longer counts as a pick made:
// the player is owed a replacement. An avant-première is never a pick.
export function pickedCategories(profile: Profile): string[] {
  return profile.unlocked.filter((id) => {
    const meta = categoryMeta(id)
    return meta !== null && !meta.premiere
  })
}

/**
 * The avant-premières that opened to everyone: a Premium member owned them
 * before they could be picked, and keeps them whatever their level.
 */
export const FORMER_PREMIERES: readonly string[] = ['ingredients', 'lieux']

/** What Premium owns without a pick: the avant-premières, and those it owned before they opened. */
function premiumGrants(profile: Profile, held: readonly string[]): string[] {
  if (profile.plusSince <= 0) return []
  const premieres = CATALOGUE.filter((category) => category.premiere).map((category) => category.id)
  return [...premieres, ...FORMER_PREMIERES.filter((id) => categoryMeta(id) !== null)].filter((id) => !held.includes(id))
}

/** Starters, picks in the order they were made, then the categories once given as a gift. */
function heldCategoryIds(profile: Profile): string[] {
  const starters = starterCategoryIds()
  const picks = pickedCategories(profile).filter((id) => !starters.includes(id))
  const gifts = profile.gifted.filter((id) => !starters.includes(id) && !picks.includes(id) && categoryMeta(id)?.premiere !== true)
  return [...starters, ...picks, ...gifts]
}

/** The categories the player owns: what they hold, then what Premium owns without a pick. */
export function ownedCategoryIds(profile: Profile): string[] {
  const held = heldCategoryIds(profile)
  return [...held, ...premiumGrants(profile, held)]
}

/** What counts toward the bonus levels and the free choice: owned without what Premium owns unpicked. */
export function ownedPlainCount(profile: Profile): number {
  return heldCategoryIds(profile).length
}
