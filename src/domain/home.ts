import { ownedCategoryIds } from './unlocks'
import type { Profile } from './progression'

/**
 * Catégories possédées avant que « Mes catégories » ne dise autre chose que ce
 * qu'une partie montre déjà : le tirage en distribue cinq, la sixième devient
 * donc la première réserve qu'une Permutation peut échanger.
 */
export const CATEGORIES_PAGE_FROM = 6

/** Les quatre tuiles de l'accueil, chacune ouverte à sa propre condition. */
export type HomePage = 'profile' | 'stats' | 'requests' | 'categories'

export interface HomeAccess {
  profile: Profile
  /** Un compte nommé : profil et statistiques existent, même sans partie sur cet appareil. */
  named: boolean
  /** Un mot proposé attend sur l'appareil, ou vit chez le serveur. */
  requested: boolean
}

/**
 * Un appareil sans partie, sans compte et sans demande n'a rien à lire derrière
 * ces pages : l'accueil ne lui montre que « Jouer ». Six catégories ouvrent la
 * première tuile qu'une partie ne raconte pas déjà.
 */
export function homePageOpen(page: HomePage, { profile, named, requested }: HomeAccess): boolean {
  if (page === 'requests') return requested
  if (page === 'categories') return ownedCategoryIds(profile).length >= CATEGORIES_PAGE_FROM
  return named || profile.runs > 0
}
