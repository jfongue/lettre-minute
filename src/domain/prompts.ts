/**
 * Ce que les parties des joueurs disent d'un couple lettre + catégorie : un
 * couple qu'on quitte sans rien écrire s'efface peu à peu du tirage, un couple
 * qu'on réussit y revient. Le serveur ne rend que deux compteurs — combien de
 * parties l'ont tiré, combien l'ont laissé vide —, jamais l'identité de qui a
 * joué : la règle ne lit que la foule.
 */

/** Le carnet d'un couple : les parties qui l'ont tiré, celles qui l'ont laissé vide. */
export interface PromptRecord {
  dealt: number
  passed: number
}

/** Parties qu'un couple doit accumuler pour que sa réussite pèse autant que celle de sa catégorie. */
export const PULL_EVIDENCE = 12

/** Ce qu'un couple peut gagner, au plus, quand les joueurs le réussissent. */
export const PULL_MAX = 1.8

/** Et ce qu'il peut perdre, au plus, quand ils le laissent vide : jamais zéro, il revient toujours. */
export const PULL_MIN = 0.4

/**
 * Les couples que le mainteneur freine à la main, par langue : leur cote est
 * multipliée par ce facteur, en plus de ce qu'en dit la foule. Jamais zéro,
 * comme la foule. Parties seules seulement : un défi, rejoué sur chaque
 * appareil, ne tire que selon la graine et les dictionnaires.
 */
export const DAMPED_PROMPTS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  // Couleurs : peu de teintes évidentes, et la plupart des joueurs passent.
  fr: { 'couleurs:H': 0.25, 'couleurs:P': 0.25, 'couleurs:T': 0.25 },
}

/** L'écart à la moyenne de la catégorie qui vaut déjà le maximum : au-delà, la cote ne bouge plus. */
const FULL_SWING = 0.5

/**
 * La cote d'un couple, à multiplier à son poids habituel. Elle se juge contre
 * sa propre catégorie — une catégorie entière de mots obscurs se passe plus
 * qu'une catégorie de pays, et cela ne dit rien d'un couple —, et elle se
 * méfie des petits nombres : trois parties ne font pas une réputation.
 */
export function promptPull(record: PromptRecord | undefined, baseline: number): number {
  if (!record || record.dealt <= 0) return 1
  const rate = Math.min(1, Math.max(0, record.passed / record.dealt))
  const edge = Math.max(-1, Math.min(1, (baseline - rate) / FULL_SWING))
  const swing = edge * (record.dealt / (record.dealt + PULL_EVIDENCE))
  return swing >= 0 ? 1 + (PULL_MAX - 1) * swing : 1 - (1 - PULL_MIN) * -swing
}

/** Ce à quoi chaque couple d'une catégorie se compare : la part de ses tirages restés vides. */
export function baselinePass(records: readonly (PromptRecord | undefined)[]): number {
  let dealt = 0
  let passed = 0
  for (const record of records) {
    if (!record) continue
    dealt += record.dealt
    passed += record.passed
  }
  return dealt > 0 ? passed / dealt : 0
}
