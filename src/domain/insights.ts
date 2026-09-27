/**
 * Les classements avancés : le serveur ne rend que des compteurs (0025), et
 * c'est ici qu'ils deviennent des moyennes, des parts et des rangs. Le mode qui
 * les montre est caché — cinq tapes sur « Classement » —, mais son calcul se
 * teste comme le reste du domaine.
 */

/** Une case du graphique : ce que la foule a fait dans l'heure, le jour ou la semaine. */
export interface ActivityBucket {
  /** L'instant d'ouverture de la case, à l'heure de Paris. */
  at: number
  runs: number
  accounts: number
}

/** Ce qu'un pouvoir a coûté et rapporté, sur toutes les parties qui l'ont porté. */
export interface PowerTally {
  power: string
  runs: number
  points: number
  best: number
}

/** Ce qu'un couple lettre + catégorie a rendu, sur toutes les parties qui l'ont tiré. */
export interface PairTally {
  categoryId: string
  letter: string
  dealt: number
  passed: number
  words: number
  points: number
}

export interface Insights {
  hours: readonly ActivityBucket[]
  days: readonly ActivityBucket[]
  weeks: readonly ActivityBucket[]
  powers: readonly PowerTally[]
  pairs: readonly PairTally[]
}

/** En dessous, une moyenne ne dit rien : deux parties ne font pas un pouvoir. */
export const MIN_POWER_RUNS = 5

/** Idem pour un couple : quatre tirages ne font pas une réputation. */
export const MIN_PAIR_DEALT = 5

/** Ce qu'une planche avancée montre avant son « Voir plus ». */
export const INSIGHT_ROWS = 10

/** Les points qu'une partie a rapportés en moyenne sous ce pouvoir. */
export function averagePoints(tally: PowerTally): number {
  return tally.runs > 0 ? tally.points / tally.runs : 0
}

/** Ce qu'un tirage de ce couple rapporte en moyenne, un couple quitté comptant zéro. */
export function pairYield(pair: PairTally): number {
  return pair.dealt > 0 ? pair.points / pair.dealt : 0
}

/** La part des tirages que les joueurs ont quittés sans rien écrire. */
export function passRate(pair: PairTally): number {
  return pair.dealt > 0 ? pair.passed / pair.dealt : 0
}

/** Les pouvoirs les plus portés : les parties d'abord, les points départagent. */
export function mostEquipped(powers: readonly PowerTally[]): PowerTally[] {
  return [...powers].sort((a, b) => b.runs - a.runs || b.points - a.points || a.power.localeCompare(b.power))
}

/** Ceux qui rapportent le plus par partie, parmi ceux qui ont assez joué. */
export function mostProfitable(powers: readonly PowerTally[]): PowerTally[] {
  return powers
    .filter((tally) => tally.runs >= MIN_POWER_RUNS)
    .sort((a, b) => averagePoints(b) - averagePoints(a) || b.runs - a.runs || a.power.localeCompare(b.power))
}

/**
 * Les couples les plus rentables : ce qu'un tirage rapporte en moyenne, jamais
 * un couple qu'on ne tire presque jamais — d'où le seuil de tirages.
 */
export function mostProfitablePairs(pairs: readonly PairTally[]): PairTally[] {
  return pairs
    .filter((pair) => pair.dealt >= MIN_PAIR_DEALT)
    .sort((a, b) => pairYield(b) - pairYield(a) || b.dealt - a.dealt || pairKey(a).localeCompare(pairKey(b)))
}

/** Les couples que les joueurs quittent le plus, en part de leurs tirages. */
export function mostPassedPairs(pairs: readonly PairTally[]): PairTally[] {
  return pairs
    .filter((pair) => pair.dealt >= MIN_PAIR_DEALT)
    .sort((a, b) => passRate(b) - passRate(a) || b.dealt - a.dealt || pairKey(a).localeCompare(pairKey(b)))
}

export function pairKey(pair: Pick<PairTally, 'categoryId' | 'letter'>): string {
  return `${pair.categoryId}:${pair.letter}`
}

/**
 * Le plus grand nombre d'une série, pour dresser les barres les unes contre les
 * autres : au moins un, pour qu'une série vide ne divise pas par zéro.
 */
export function peak(buckets: readonly ActivityBucket[], field: 'runs' | 'accounts'): number {
  return buckets.reduce((most, bucket) => Math.max(most, bucket[field]), 1)
}
