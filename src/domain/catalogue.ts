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
  { id: 'corps-humain', label: 'Partie du corps humain', hint: 'De la tête aux pieds', unlockLevel: 5 },
  { id: 'matieres', label: 'Matières et éléments', hint: 'Bois, fer, oxygène, feu…', unlockLevel: 6 },
  { id: 'capitales', label: 'Capitales', hint: 'Capitales du monde', unlockLevel: 7 },
  { id: 'marques', label: 'Marque', hint: 'Marques connues', unlockLevel: 8 },
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
