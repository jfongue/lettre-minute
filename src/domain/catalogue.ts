export interface CategoryMeta {
  id: string
  label: string
  /** Shown under the prompt, to settle what counts before the player types. */
  hint: string
  /** Level at which the category joins the draw. Level 1 opens the game. */
  unlockLevel: number
  /**
   * An avant-première: Premium owns it from the start, nobody else is offered
   * it, and challenges, bots and the weekly challenge never deal it.
   */
  premiere?: boolean
}

/**
 * Only closed, stable subjects: a word is either a country or it is not, and
 * the answer does not change with the season. Films, séries and celebrities are
 * deliberately absent — live validation cannot arbitrate them.
 */
export const CATALOGUE: readonly CategoryMeta[] = [
  { id: 'pays', label: 'Pays', hint: 'États de notre monde', unlockLevel: 1 },
  { id: 'animaux', label: 'Animaux', hint: 'Du moineau au morse', unlockLevel: 1 },
  { id: 'couleurs', label: 'Couleurs', hint: 'Teintes et nuances', unlockLevel: 1 },
  { id: 'fruits-legumes', label: 'Fruits et légumes', hint: 'Crus ou cuits', unlockLevel: 2 },
  { id: 'metiers', label: 'Métiers', hint: 'D’hier et d’aujourd’hui', unlockLevel: 3 },
  { id: 'sports', label: 'Sports', hint: 'Disciplines et pratiques', unlockLevel: 4 },
  { id: 'corps-humain', label: 'Parties du corps', hint: 'De la tête aux pieds', unlockLevel: 5 },
  { id: 'matieres', label: 'Matières et éléments', hint: 'Bois, fer, oxygène, feu…', unlockLevel: 6 },
  // The id keeps the name the category was born with: a profile owns its
  // categories under it, and so do the server's prompt_stats.
  { id: 'capitales', label: 'Grandes villes', hint: 'Les plus grandes de leur pays', unlockLevel: 7 },
  { id: 'marques', label: 'Marques', hint: 'Connues de tous', unlockLevel: 8 },
  { id: 'prenoms', label: 'Prénoms', hint: 'D’ici et d’ailleurs', unlockLevel: 9 },
  { id: 'objets', label: 'Objets du quotidien', hint: 'À la maison ou dans le sac', unlockLevel: 10 },
  { id: 'plantes', label: 'Plantes', hint: 'Fleurs, arbres, herbes', unlockLevel: 11 },
  { id: 'ingredients', label: 'Ingrédients', hint: 'Du sel au chocolat noir', unlockLevel: 99, premiere: true },
  { id: 'lieux', label: 'Lieux et bâtiments', hint: 'De la mairie à l’usine', unlockLevel: 99, premiere: true },
]

/** The avant-premières, Premium's alone. */
export function premiereCategoryIds(): string[] {
  return CATALOGUE.filter((category) => category.premiere).map((category) => category.id)
}

/**
 * What every player can be dealt alike — challenges, bots, the weekly
 * challenge: the avant-premières stay out, or Premium would draw other
 * pairs than their opponents. Order kept, so a seed deals what it always did.
 */
export function sharedCategoryIds(available: readonly string[]): string[] {
  const premieres = new Set(premiereCategoryIds())
  return available.filter((id) => !premieres.has(id))
}

export function categoryMeta(id: string): CategoryMeta | null {
  return CATALOGUE.find((category) => category.id === id) ?? null
}

/**
 * A category the menu announces before it can be played: its dictionary is
 * still a draft under `src/data/drafts`, so no build ships it and no run can
 * draw it — `availableCategoryIds` is what the draw asks.
 */
export type SoonCategory = Pick<CategoryMeta, 'id' | 'label' | 'hint'>

/**
 * Written, tested, and waiting for their dictionaries to ship. « Mes
 * catégories » lists them under a « Bientôt… » tag; `src/data/drafts.test.ts`
 * holds them to the answers each of the seven languages will need, and moving
 * one into `CATALOGUE` is what puts it in play.
 */
export const SOON: readonly SoonCategory[] = []

/** Every category the game names, in play or announced — for the menu and the names. */
export function announcedCategories(): readonly (CategoryMeta | SoonCategory)[] {
  return [...CATALOGUE, ...SOON]
}

export function unlockedCategories(level: number): CategoryMeta[] {
  return CATALOGUE.filter((category) => category.unlockLevel <= level)
}

/** What the next level opens, if anything — the carrot shown on the end screen. */
export function unlockedAt(level: number): CategoryMeta[] {
  return CATALOGUE.filter((category) => category.unlockLevel === level)
}
