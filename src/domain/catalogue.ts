export interface CategoryMeta {
  id: string
  label: string
  /** Shown under the prompt, to settle what counts before the player types. */
  hint: string
  /** Level at which the category joins the draw. Level 1 opens the game. */
  unlockLevel: number
  /**
   * The wave of new categories it shipped with, if any — a player who had
   * already unlocked everything else before that wave is offered one of its
   * categories as a gift (`categoryGiftOffer` in `unlocks.ts`), so a level-up
   * pick isn't the only way in for someone with nothing left to pick.
   */
  addedIn?: number
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
  // The id keeps the name the category was born with: a profile owns its
  // categories under it, and so do the server's prompt_stats.
  { id: 'capitales', label: 'Grandes villes', hint: 'Capitales, et villes de plus de 100 000 habitants', unlockLevel: 7 },
  { id: 'marques', label: 'Marque', hint: 'Marques connues', unlockLevel: 8 },
  { id: 'prenoms', label: 'Prénoms', hint: 'D’ici et d’ailleurs, de Léa à Mohammed', unlockLevel: 9, addedIn: 2 },
  { id: 'objets', label: 'Objets du quotidien', hint: 'Ce qu’on trouve à la maison ou dans son sac', unlockLevel: 10, addedIn: 2 },
  { id: 'plantes', label: 'Plantes', hint: 'Fleurs, arbres, herbes et buissons', unlockLevel: 11, addedIn: 2 },
]

/** The most recent wave shipped, or 0 if the catalogue has never been split into waves. */
export const LATEST_WAVE = Math.max(0, ...CATALOGUE.flatMap((category) => (category.addedIn ? [category.addedIn] : [])))

/** The categories the latest wave added, in catalogue order. */
export function latestWaveCategoryIds(): string[] {
  return CATALOGUE.filter((category) => category.addedIn === LATEST_WAVE).map((category) => category.id)
}

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
