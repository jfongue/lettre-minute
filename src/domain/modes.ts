import type { RarityTier } from './rarity'
import { DEFAULT_TUNING as D, TUNING, type RunTuning } from './tuning'

/**
 * La réserve des modes de jeu : à terme le défi hebdomadaire, jouable
 * librement par un super modérateur depuis la table des fonctionnalités.
 * Chacun ne change qu'une règle du solo — ce que dure le chrono, ce qu'un mot
 * lui rend, la lettre que la question contraint, ou ce qui arrête la partie —
 * jamais le barème.
 */
export type GameMode = 'solo' | 'delayed' | 'endurance' | 'reversed' | 'race'

/** Les modes de la réserve, ceux qui ont une leçon et pas de progression. */
export type ArcadeMode = Exclude<GameMode, 'solo'>

/** La réserve, dans l'ordre où l'écran les propose : le solo se choisit à part. */
export const ARCADE_MODES: readonly ArcadeMode[] = ['delayed', 'endurance', 'reversed', 'race']

/**
 * Ce dont chaque mode part : l'endurance se joue sur trente secondes ; la
 * course n'a qu'un plafond, au-delà duquel elle s'arrête sans arrivée.
 */
export const MODE_SECONDS: Record<GameMode, number> = {
  solo: D['run.seconds.solo'],
  delayed: D['run.seconds.delayed'],
  endurance: D['run.seconds.endurance'],
  reversed: D['run.seconds.reversed'],
  race: D['run.seconds.race'],
}

/** La course s'arrête au dixième mot juste : c'est l'arrivée. */
export const RACE_WORDS = D['run.raceWords']

/**
 * L'endurance paie un mot en secondes, sur les quatre paliers de rareté :
 * un mot courant rend deux secondes, un très rare le double.
 */
export const ENDURANCE_TIME_BONUS: Record<RarityTier, number> = {
  courant: D['run.endurance.courant'],
  'peu commun': D['run.endurance.peuCommun'],
  rare: D['run.endurance.rare'],
  'très rare': D['run.endurance.tresRare'],
}

const ENDURANCE_KEYS = { courant: 'run.endurance.courant', 'peu commun': 'run.endurance.peuCommun', rare: 'run.endurance.rare', 'très rare': 'run.endurance.tresRare' } as const

/** Ce qu'un mot rend en endurance, selon les réglages d'une partie, ceux de l'appareil sinon. */
export function enduranceBonus(tier: RarityTier, tuning: Pick<RunTuning, (typeof ENDURANCE_KEYS)[RarityTier]> = TUNING): number {
  return tuning[ENDURANCE_KEYS[tier]]
}

/** Ce que dure un mode, selon les réglages d'une partie, ceux de l'appareil sinon. */
export function secondsOf(mode: GameMode, tuning: Pick<RunTuning, `run.seconds.${GameMode}`> = TUNING): number {
  return tuning[`run.seconds.${mode}`]
}

/** Combien de mots arrêtent la course, selon les réglages d'une partie, ceux de l'appareil sinon. */
export function raceWordsOf(tuning: Pick<RunTuning, 'run.raceWords'> = TUNING): number {
  return tuning['run.raceWords']
}

/** Le retard : revoir la question à remplir une fois masquée coûte ces secondes. */
export const RECALL_SECONDS = D['run.recallSeconds']

/** Sur quelle lettre la question contraint : la première, sauf renversé. */
export function modeEdge(mode: GameMode): 'first' | 'last' {
  return mode === 'reversed' ? 'last' : 'first'
}

/** Seul le solo compte pour la progression : un mode de la réserve ne rapporte rien. */
export function countsForProgress(mode: GameMode): boolean {
  return mode === 'solo'
}
