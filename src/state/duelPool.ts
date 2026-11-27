import { availableCategoryIds } from '../data/packs'
import { sharedCategoryIds } from '../domain/catalogue'
import { playableCategoryIds } from '../domain/perks'
import { ownedCategoryIds } from '../domain/unlocks'
import { loadProfile } from './storage'

/** Les catégories qu'une table peut distribuer à ce joueur : celles qu'il a, sans les avant-premières. */
export function duelPool(lang: string): string[] {
  const profile = loadProfile()
  const shipped = availableCategoryIds(lang)
  return sharedCategoryIds(playableCategoryIds(profile, ownedCategoryIds(profile))).filter((id) => shipped.includes(id))
}
