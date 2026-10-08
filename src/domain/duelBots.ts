/**
 * La réserve des joueurs maison : vingt profils, du premier duel à la table
 * exigeante. Chacun a son allure et sa façon de jouer ; ce fichier ne dit que
 * la leur, c'est `botMove` qui la joue depuis la graine du duel.
 *
 * **L'ordre est la difficulté.** `houseBotsFor` n'ouvre que les premiers à un
 * nouveau venu, puis la réserve s'ouvre par paliers : les tables faciles
 * d'abord, les rudes quand le joueur a déjà des parties derrière lui. Toutes
 * restent battables — un robot ne tape pas plus vite qu'un doigt humain.
 *
 * Les deux leviers de `think` et `answerChance` donnent quatre allures : lent
 * et sûr use la réserve des autres sans jamais se tromper, rapide et fautif
 * parle avant de savoir, rapide et sûr est un tueur, lent et fautif laisse du
 * temps. `passFast` est le cinquième : qui ne sait pas passe tout de suite au
 * lieu de réfléchir pour rien, et garde sa réserve pour la manche suivante.
 */
import type { AvatarChoice } from './avatar'
import type { BotProfile } from './duel'

export interface HouseBot extends BotProfile {
  name: string
  avatar: AvatarChoice
  /** Le trait du joueur, lu dans le salon : le texte vient de l'i18n. */
  trait: 'fast' | 'steady' | 'sharp'
  /** Sans mot, il passe sans réfléchir : sa réserve survit aux manches qu'il rate. */
  passFast?: boolean
}

/** Du plus tendre au plus rude. Les deux premiers noms sont ceux du serveur (0024). */
export const HOUSE_BOTS: readonly HouseBot[] = [
  { id: 'maxitoon', name: 'Maxitoon', avatar: { design: 47, ground: 'vert', shape: 'creme', accent: 'rose' }, trait: 'steady', think: [5.5, 12], answerChance: 0.5 },
  { id: 'terretciel', name: 'Terretciel', avatar: { design: 12, ground: 'rouge', shape: 'jaune', accent: 'bleu' }, trait: 'steady', think: [5, 11], answerChance: 0.58 },
  { id: 'faribole', name: 'Faribole', avatar: { design: 8, ground: 'jaune', shape: 'rose', accent: 'vert' }, trait: 'fast', think: [2.6, 6], answerChance: 0.5, passFast: true },
  { id: 'quenouille', name: 'Quenouille', avatar: { design: 31, ground: 'creme', shape: 'bleu', accent: 'rouge' }, trait: 'steady', think: [4.5, 10], answerChance: 0.64 },
  { id: 'zigomar', name: 'Zigomar', avatar: { design: 19, ground: 'bleu', shape: 'vert', accent: 'jaune' }, trait: 'sharp', think: [3.6, 8], answerChance: 0.66 },
  { id: 'patatras', name: 'Patatras', avatar: { design: 56, ground: 'rose', shape: 'creme', accent: 'bleu' }, trait: 'fast', think: [2.4, 5.5], answerChance: 0.62, passFast: true },
  { id: 'sibylline', name: 'Sibylline', avatar: { design: 3, ground: 'vert', shape: 'rouge', accent: 'creme' }, trait: 'steady', think: [4, 9], answerChance: 0.7 },
  { id: 'roublard', name: 'Roublard', avatar: { design: 68, ground: 'jaune', shape: 'bleu', accent: 'vert' }, trait: 'sharp', think: [3.4, 7.5], answerChance: 0.72 },
  { id: 'petunia', name: 'Pétunia', avatar: { design: 24, ground: 'rouge', shape: 'creme', accent: 'jaune' }, trait: 'steady', think: [3.8, 8.5], answerChance: 0.74 },
  { id: 'turbulence', name: 'Turbulence', avatar: { design: 41, ground: 'bleu', shape: 'jaune', accent: 'rose' }, trait: 'fast', think: [2.2, 5], answerChance: 0.7, passFast: true },
  { id: 'escarboucle', name: 'Escarboucle', avatar: { design: 15, ground: 'creme', shape: 'vert', accent: 'bleu' }, trait: 'sharp', think: [3.2, 7], answerChance: 0.78 },
  { id: 'vasistas', name: 'Vasistas', avatar: { design: 62, ground: 'vert', shape: 'rose', accent: 'jaune' }, trait: 'steady', think: [3.6, 8], answerChance: 0.8 },
  { id: 'turlupin', name: 'Turlupin', avatar: { design: 29, ground: 'rose', shape: 'bleu', accent: 'creme' }, trait: 'fast', think: [2, 4.8], answerChance: 0.76, passFast: true },
  { id: 'nitouche', name: 'Nitouche', avatar: { design: 7, ground: 'jaune', shape: 'rouge', accent: 'bleu' }, trait: 'steady', think: [3.4, 7.5], answerChance: 0.82 },
  { id: 'sarabande', name: 'Sarabande', avatar: { design: 52, ground: 'bleu', shape: 'creme', accent: 'vert' }, trait: 'sharp', think: [2.8, 6.5], answerChance: 0.84 },
  { id: 'velocifere', name: 'Vélocifère', avatar: { design: 36, ground: 'creme', shape: 'jaune', accent: 'rouge' }, trait: 'fast', think: [1.9, 4.4], answerChance: 0.8, passFast: true },
  { id: 'zephyrine', name: 'Zéphyrine', avatar: { design: 11, ground: 'vert', shape: 'bleu', accent: 'rose' }, trait: 'sharp', think: [2.6, 6], answerChance: 0.87 },
  { id: 'babylophone', name: 'Babylophone', avatar: { design: 71, ground: 'rouge', shape: 'vert', accent: 'creme' }, trait: 'steady', think: [3, 6.5], answerChance: 0.9 },
  { id: 'demontoon', name: 'Demontoon', avatar: { design: 73, ground: 'bleu', shape: 'creme', accent: 'jaune' }, trait: 'sharp', think: [2.4, 5.5], answerChance: 0.9 },
  { id: 'cambronne', name: 'Cambronne', avatar: { design: 44, ground: 'jaune', shape: 'vert', accent: 'bleu' }, trait: 'sharp', think: [2.1, 5], answerChance: 0.93, passFast: true },
]

/** Les profils qui tiennent les toutes premières tables. */
const FIRST_TABLE = 4

/**
 * Ce que la réserve ouvre à un joueur, selon ses parties jouées : quatre
 * profils au début, deux de plus toutes les quatre parties, la réserve entière
 * vers la trentième. Un joueur qui n'a jamais joué ne tombe pas sur Cambronne.
 */
export function houseBotsFor(runs: number): readonly HouseBot[] {
  const open = Math.min(HOUSE_BOTS.length, FIRST_TABLE + 2 * Math.floor(Math.max(0, runs) / 4))
  return HOUSE_BOTS.slice(0, open)
}
