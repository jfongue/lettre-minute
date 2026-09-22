export interface CategoryMeta {
  id: string
  label: string
  /** Shown under the prompt, to settle what counts before the player types. */
  hint: string
  /** Level at which the category joins the draw. Level 1 opens the game. */
  unlockLevel: number
}

/**
 * Only closed, stable subjects: a word is either a country or it is not, and
 * the answer does not change with the season. Films, séries and celebrities are
 * deliberately absent — live validation cannot arbitrate them.
 */
export const CATALOGUE: readonly CategoryMeta[] = [
  { id: 'pays', label: 'Pays', hint: 'États du monde, actuels ou passés', unlockLevel: 1 },
  { id: 'animaux', label: 'Animaux', hint: 'Noms courants, du moineau au morse', unlockLevel: 1 },
  { id: 'couleurs', label: 'Couleurs', hint: 'Teintes et nuances', unlockLevel: 1 },
  { id: 'fruits-legumes', label: 'Fruits et légumes', hint: 'Ce qui se mange, cru ou cuit', unlockLevel: 2 },
  { id: 'metiers', label: 'Métiers', hint: 'Professions, d’hier et d’aujourd’hui', unlockLevel: 3 },
  { id: 'sports', label: 'Sports', hint: 'Disciplines et pratiques', unlockLevel: 4 },
  { id: 'oiseaux', label: 'Oiseaux', hint: 'Noms d’oiseaux', unlockLevel: 5 },
  { id: 'instruments', label: 'Instruments', hint: 'Instruments de musique', unlockLevel: 6 },
  { id: 'capitales', label: 'Capitales', hint: 'Capitales du monde', unlockLevel: 7 },
  { id: 'poissons', label: 'Poissons', hint: 'Poissons et créatures à nageoires', unlockLevel: 8 },
  { id: 'villes-de-france', label: 'Villes de France', hint: 'Communes de plus de 4 000 habitants', unlockLevel: 9 },
  { id: 'insectes', label: 'Insectes', hint: 'Insectes et petites bêtes', unlockLevel: 10 },
  { id: 'elements-chimiques', label: 'Éléments', hint: 'Éléments du tableau périodique', unlockLevel: 12 },
]

export function categoryMeta(id: string): CategoryMeta | null {
  return CATALOGUE.find((category) => category.id === id) ?? null
}

export function unlockedCategories(level: number): CategoryMeta[] {
  return CATALOGUE.filter((category) => category.unlockLevel <= level)
}

/** What the next level opens, if anything — the carrot shown on the end screen. */
export function unlockedAt(level: number): CategoryMeta[] {
  return CATALOGUE.filter((category) => category.unlockLevel === level)
}
