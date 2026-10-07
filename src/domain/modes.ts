import type { RarityTier } from './rarity'

/**
 * La réserve des modes de jeu : à terme le défi hebdomadaire, jouable
 * librement par un super modérateur depuis la table des fonctionnalités.
 * Chacun ne change qu'une règle du solo — ce que dure le chrono, ce qu'un mot
 * lui rend, ou la lettre que la question contraint — jamais le barème.
 */
export type GameMode = 'solo' | 'delayed' | 'endurance' | 'reversed'

/** Les trois modes de la réserve, ceux qui ont une leçon et pas de progression. */
export type ArcadeMode = Exclude<GameMode, 'solo'>

/** La réserve, dans l'ordre où l'écran les propose : le solo se choisit à part. */
export const ARCADE_MODES: readonly ArcadeMode[] = ['delayed', 'endurance', 'reversed']

/** Ce dont chaque mode part : l'endurance se joue sur trente secondes. */
export const MODE_SECONDS: Record<GameMode, number> = {
  solo: 60,
  delayed: 60,
  endurance: 30,
  reversed: 60,
}

/**
 * L'endurance paie un mot en secondes, sur les quatre paliers de rareté :
 * un mot courant rend deux secondes, un très rare le double.
 */
export const ENDURANCE_TIME_BONUS: Record<RarityTier, number> = {
  courant: 2,
  'peu commun': 2.5,
  rare: 3,
  'très rare': 4,
}

/** Le retard : revoir la question à remplir une fois masquée coûte ces secondes. */
export const RECALL_SECONDS = 3

/** Sur quelle lettre la question contraint : la première, sauf renversé. */
export function modeEdge(mode: GameMode): 'first' | 'last' {
  return mode === 'reversed' ? 'last' : 'first'
}

/** Seul le solo compte pour la progression : un mode de la réserve ne rapporte rien. */
export function countsForProgress(mode: GameMode): boolean {
  return mode === 'solo'
}
