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
 * Starters first, then the picks in the order they were made, then the
 * categories once given as a gift; a Premium member's avant-premières last.
 */
export function ownedCategoryIds(profile: Profile): string[] {
  const starters = starterCategoryIds()
  const picks = pickedCategories(profile).filter((id) => !starters.includes(id))
  const gifts = profile.gifted.filter((id) => !starters.includes(id) && !picks.includes(id) && categoryMeta(id)?.premiere !== true)
  const premieres = profile.plusSince > 0 ? CATALOGUE.filter((category) => category.premiere).map((category) => category.id) : []
  return [...starters, ...picks, ...gifts, ...premieres]
}

/** What counts toward the bonus levels and the free choice: owned without Premium's avant-premières. */
export function ownedPlainCount(profile: Profile): number {
  return ownedCategoryIds(profile).filter((id) => categoryMeta(id)?.premiere !== true).length
}
