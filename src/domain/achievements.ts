import {
  AVATARS,
  FREE_COLOURS,
  FREE_DESIGNS,
  PALETTE,
  type AvatarChoice,
  type AvatarDesign,
  type Colour,
  type Milestone,
  type Stat,
} from './avatar'
import { levelFor, type Profile } from './progression'

/*
 * Les succès du jeu, en deux familles :
 *
 * - Les quinze premiers sont ceux de Google Play Games, publiés depuis la
 *   première version. Un succès Play ne se reprend jamais : leurs
 *   identifiants et leurs points sont figés ici, et `src/lib/playGames.ts`
 *   les renvoie au téléphone. Le jeu seul décide quand ils tombent — Play ne
 *   connaît aucun seuil : c'est `earnedAchievements` qui les accorde. Un seuil
 *   se réajuste donc ici, sans rien changer à la Console.
 * - Les suivants ne vivent que dans le jeu : pas de points à distribuer, le
 *   budget Play (1 000 points) étant entièrement pris. Ils se lisent dans
 *   « Succès », avec leur barre de progression, et se débloquent à la fin
 *   d'une partie par le même chemin.
 *
 * Un succès remplace aussi le vieux jalon d'avatar : chaque case de la grille
 * et chaque couleur de la palette est gagnée par un succès, et réciproquement
 * chaque succès gagne une case ou une couleur. Le récapitulatif de fin de
 * partie n'a donc qu'une liste à montrer.
 *
 * Mots ajoutés et découvertes restent bas (10 et 15) : plus le dictionnaire
 * grossit, moins il reste de mots à y faire entrer ou à écrire le premier.
 * Les découvertes ne sont comptées que par le serveur (`leaderboard_values`,
 * 0024) : la fin de partie les lui demande, et un joueur anonyme n'en a pas.
 */

/** Les quinze succès publiés sur Play Games, dans l'ordre des lignes de la Console. */
export type PlayAchievementId =
  | 'level-4'
  | 'runs-10'
  | 'words-100'
  | 'combo-10'
  | 'discoveries-15'
  | 'added-10'
  | 'level-10'
  | 'runs-100'
  | 'words-1000'
  | 'level-20'
  | 'combo-24'
  | 'score-666'
  | 'runs-400'
  | 'words-2000'
  | 'level-35'

/** Les succès du jeu seul qui racontent un exploit, jamais un barreau. */
export type ExploitId =
  | 'runs-25'
  | 'words-250'
  | 'score-400'
  | 'word-long-10'
  | 'word-long-15'
  | 'speed-25'
  | 'speed-35'
  | 'powers-7'
  | 'powers-all'
  | 'clean-run'
  | 'clean-run-10'
  | 'duel-four'
  | 'duel-round-20'
  | 'day-first'
  | 'categories-12'
  | 'reviews-10'

/**
 * Les trente barreaux qui manquaient aux quarante-cinq cases de la grille :
 * leur identifiant se lit de leur jalon, et leur nom vient de l'i18n de
 * l'avatar — la grille sait déjà nommer un jalon dans les sept langues.
 */
export type LadderId =
  | 'level-6'
  | 'level-8'
  | 'level-13'
  | 'level-16'
  | 'level-25'
  | 'level-30'
  | 'runs-3'
  | 'runs-5'
  | 'runs-7'
  | 'runs-50'
  | 'runs-200'
  | 'words-500'
  | 'words-3500'
  | 'words-5000'
  | 'score-500'
  | 'score-600'
  | 'score-700'
  | 'score-800'
  | 'score-900'
  | 'combo-13'
  | 'combo-16'
  | 'combo-20'
  | 'combo-28'
  | 'added-1'
  | 'added-15'
  | 'added-50'
  | 'added-100'
  | 'added-300'
  | 'added-500'
  | 'added-1000'

export type AchievementId = PlayAchievementId | ExploitId | LadderId

/**
 * Ceux dont l'i18n écrit le nom et la description. Un barreau de la grille,
 * lui, n'a rien de plus à dire que son jalon : son nom est celui de l'avatar.
 */
export type NamedAchievementId = PlayAchievementId | ExploitId

/** Une statistique du profil qui se compte, telle quelle. */
type CountedStat =
  | 'runs'
  | 'bestScore'
  | 'wordsFound'
  | 'bestCombo'
  | 'wordsAdded'
  | 'longestWord'
  | 'bestSpeed'
  | 'cleanRuns'
  | 'duelRounds4'
  | 'dailyFirst'
  | 'wordsReviewed'
/** Ceux qui se comptent par leur longueur, ou par le niveau, ou par le serveur. */
type ListedStat = 'powersUsed' | 'playedCategories'
export type Counter = CountedStat | ListedStat | 'level' | 'discoveries'

/** Ce qu'un succès demande : un compteur du profil et le nombre qu'il doit atteindre. */
export interface Goal {
  stat: Counter
  at: number
}

/** Le rayon où le succès se range dans la liste : un palier, un exploit, ou une exploration. */
export type Family = 'progress' | 'exploit' | 'explore'

/** Ce que le joueur gagne avec un succès : la case de la grille ou la couleur, ou les deux. */
export interface Reward {
  design?: number
  colour?: string
}

export interface Achievement {
  id: AchievementId
  goal: Goal
  /**
   * La tuile de l'icône : celle que le même jalon débloque quand la grille
   * l'a, sinon une voisine choisie à la main pour ce qu'elle raconte.
   */
  design: number
  family: Family
  /** Points Play Games, quand la Console connaît le succès. Absent des succès du jeu seul. */
  play?: number
  /** Ce qu'il fait gagner — jamais vide : c'est la règle de la maison. */
  reward: Reward
}

/**
 * La grille d'avatar, dans l'ordre de ses cases : `[tuile, statistique, seuil]`.
 * C'est ici, et nulle part ailleurs, que se lit le seuil d'une case ; l'ordre
 * des tuiles ne bouge pas, un joueur en porte une.
 *
 * Un tour de rôle entre les cinq pistes, pour que la grille mêle les niveaux
 * aux exploits au lieu de cacher chaque exploit derrière le dernier niveau.
 * Chaque premier seuil est au-delà d'une première partie — une partie
 * n'approche 1 000 points que lorsqu'elle est énorme —, donc une tuile se
 * gagne, elle ne tombe pas avec le tutoriel.
 *
 * Les sept tuiles du dictionnaire viennent après le tour de rôle : une
 * sixième piste prendrait son tour chez les autres et pousserait d'une case
 * le seuil de toutes les tuiles déjà en place, ce qui redistribuerait les
 * déblocages de tout le monde.
 */
const RUNGS: readonly [design: number, stat: Stat, at: number][] = [
  [5, 'level', 4],
  [6, 'runs', 3],
  [7, 'wordsFound', 100],
  [8, 'bestScore', 400],
  [9, 'bestCombo', 10],
  [10, 'level', 6],
  [11, 'runs', 5],
  [12, 'wordsFound', 250],
  [13, 'bestScore', 500],
  [14, 'bestCombo', 13],
  [15, 'level', 8],
  [16, 'runs', 7],
  [17, 'wordsFound', 500],
  [18, 'bestScore', 600],
  [19, 'bestCombo', 16],
  [20, 'level', 10],
  [21, 'runs', 10],
  [22, 'wordsFound', 1000],
  [23, 'bestScore', 700],
  [24, 'bestCombo', 20],
  [25, 'level', 13],
  [26, 'runs', 25],
  [27, 'wordsFound', 2000],
  [28, 'bestScore', 800],
  [29, 'bestCombo', 24],
  [30, 'level', 16],
  [31, 'runs', 50],
  [32, 'wordsFound', 3500],
  [33, 'bestScore', 900],
  [34, 'bestCombo', 28],
  [35, 'level', 20],
  [36, 'runs', 100],
  [37, 'wordsFound', 5000],
  [38, 'level', 25],
  [39, 'runs', 200],
  [40, 'level', 30],
  [41, 'runs', 400],
  [42, 'level', 35],
  [43, 'wordsAdded', 1],
  [44, 'wordsAdded', 15],
  [45, 'wordsAdded', 50],
  [46, 'wordsAdded', 100],
  [47, 'wordsAdded', 300],
  [48, 'wordsAdded', 500],
  [49, 'wordsAdded', 1000],
]

/**
 * Les douze couleurs que la palette pose sur le seuil d'un barreau : elles se
 * gagnent avec lui. Les quinze autres n'ont pas de barreau — elles s'attachent
 * à un exploit, et `fuchsia` est arrivée avec cette règle : la palette en
 * comptait trente, il en fallait seize pour les seize exploits.
 */
const RUNG_COLOURS: readonly [colour: string, stat: Stat, at: number][] = [
  ['noir', 'runs', 3],
  ['creme', 'level', 4],
  ['orange', 'level', 6],
  ['brique', 'level', 8],
  ['ciel', 'bestCombo', 10],
  ['sauge', 'level', 10],
  ['rose', 'runs', 10],
  ['marine', 'runs', 25],
  ['corail', 'wordsFound', 250],
  ['prune', 'bestCombo', 24],
  ['sable', 'bestScore', 800],
  ['anthracite', 'level', 30],
]

// Bounded by the grid: a goal no tile unlocks must fail loudly, not hang every
// screen that loads this module (666 points did, before it took 900's tile).
const tileOf = (milestone: Milestone): number => {
  const rung = RUNGS.find(([, stat, at]) => stat === milestone.stat && at === milestone.at)
  if (!rung) throw new Error(`no avatar tile unlocks at ${milestone.stat} ${milestone.at}`)
  return rung[0]
}

const colourAt = (milestone: Milestone): string | null =>
  RUNG_COLOURS.find(([, stat, at]) => stat === milestone.stat && at === milestone.at)?.[0] ?? null

const reaching = (
  id: AchievementId,
  milestone: Milestone,
  play?: number,
  family: Family = 'progress',
): Achievement => {
  const colour = colourAt(milestone)
  return {
    id,
    goal: milestone,
    design: tileOf(milestone),
    family,
    ...(play === undefined ? {} : { play }),
    reward: { design: tileOf(milestone), ...(colour === null ? {} : { colour }) },
  }
}

const PLAY_ACHIEVEMENTS: readonly Achievement[] = [
  reaching('level-4', { stat: 'level', at: 4 }, 15),
  reaching('runs-10', { stat: 'runs', at: 10 }, 20),
  reaching('words-100', { stat: 'wordsFound', at: 100 }, 20),
  reaching('combo-10', { stat: 'bestCombo', at: 10 }, 30),
  // `discoveries-15` et `added-10` prennent une tuile choisie à la main : le
  // premier montre l'étoile du combo 20, qu'aucun autre succès ne montre, le
  // second la tuile du premier mot ajouté, son jalon d'avatar étant à 15.
  { id: 'discoveries-15', goal: { stat: 'discoveries', at: 15 }, design: 24, family: 'explore', play: 40, reward: { colour: 'lavande' } },
  { id: 'added-10', goal: { stat: 'wordsAdded', at: 10 }, design: 44, family: 'explore', play: 50, reward: { colour: 'olive' } },
  reaching('level-10', { stat: 'level', at: 10 }, 50),
  reaching('runs-100', { stat: 'runs', at: 100 }, 60),
  reaching('words-1000', { stat: 'wordsFound', at: 1000 }, 70),
  reaching('level-20', { stat: 'level', at: 20 }, 80),
  reaching('combo-24', { stat: 'bestCombo', at: 24 }, 90),
  // No tile unlocks at 666: the icon Play already shows, 900's, stays.
  { id: 'score-666', goal: { stat: 'bestScore', at: 666 }, design: 33, family: 'progress', play: 100, reward: { colour: 'moutarde' } },
  reaching('runs-400', { stat: 'runs', at: 400 }, 110),
  reaching('words-2000', { stat: 'wordsFound', at: 2000 }, 120),
  reaching('level-35', { stat: 'level', at: 35 }, 145),
]

/*
 * Les succès du jeu seul. Leurs seuils se lisent dans ce que les joueurs font
 * vraiment : à l'automne 2026, sur 301 profils, la moitié des parties passées
 * s'arrêtaient sous 95 points, la meilleure de tous les temps valait 621, le
 * plus long mot 18 lettres et la frappe la plus vive 4,17 lettres par seconde.
 * Les paliers « barre à remplir » et les trente barreaux comblent les trous de
 * l'échelle Play, les exploits se gagnent en une partie, et l'exploration
 * demande d'avoir touché à douze catégories.
 *
 * Un exploit ne se borne à aucune statistique d'avatar : il n'a pas de case à
 * lui, et sa récompense est la couleur qu'il porte.
 */
const INGAME_ACHIEVEMENTS: readonly Achievement[] = [
  reaching('runs-25', { stat: 'runs', at: 25 }),
  reaching('words-250', { stat: 'wordsFound', at: 250 }),
  reaching('score-400', { stat: 'bestScore', at: 400 }),
  { id: 'word-long-10', goal: { stat: 'longestWord', at: 10 }, design: 14, family: 'exploit', reward: { colour: 'vert' } },
  { id: 'word-long-15', goal: { stat: 'longestWord', at: 15 }, design: 45, family: 'exploit', reward: { colour: 'canard' } },
  { id: 'speed-25', goal: { stat: 'bestSpeed', at: 25 }, design: 19, family: 'exploit', reward: { colour: 'ocre' } },
  { id: 'speed-35', goal: { stat: 'bestSpeed', at: 35 }, design: 49, family: 'exploit', reward: { colour: 'saumon' } },
  { id: 'powers-7', goal: { stat: 'powersUsed', at: 7 }, design: 40, family: 'explore', reward: { colour: 'violet' } },
  { id: 'powers-all', goal: { stat: 'powersUsed', at: 14 }, design: 47, family: 'explore', reward: { colour: 'fuchsia' } },
  // 27 went to words-2000 when its goal came down to the 2000-word tile.
  { id: 'clean-run', goal: { stat: 'cleanRuns', at: 1 }, design: 16, family: 'exploit', reward: { colour: 'menthe' } },
  { id: 'clean-run-10', goal: { stat: 'cleanRuns', at: 10 }, design: 10, family: 'exploit', reward: { colour: 'emeraude' } },
  // Aucune table de quatre n'a encore été jouée (`duel_seats` : trois places au
  // plus) : le premier barreau est de s'y asseoir, le second d'y tenir vingt
  // manches, ce qu'aucune table n'a jamais approché.
  { id: 'duel-four', goal: { stat: 'duelRounds4', at: 1 }, design: 43, family: 'exploit', reward: { colour: 'bordeaux' } },
  { id: 'duel-round-20', goal: { stat: 'duelRounds4', at: 20 }, design: 38, family: 'exploit', reward: { colour: 'gris' } },
  { id: 'day-first', goal: { stat: 'dailyFirst', at: 1 }, design: 46, family: 'exploit', reward: { colour: 'citron' } },
  { id: 'categories-12', goal: { stat: 'playedCategories', at: 12 }, design: 23, family: 'explore', reward: { colour: 'turquoise' } },
  // La modération n'est pas une partie : le compte monte quand un verdict part
  // (`src/ui/ModerationScreen.tsx`), jamais à la fin d'un run.
  { id: 'reviews-10', goal: { stat: 'wordsReviewed', at: 10 }, design: 31, family: 'progress', reward: { colour: 'outremer' } },
]

/** Ceux dont l'i18n écrit le nom, dans l'ordre du catalogue. */
const NAMED: readonly Achievement[] = [...PLAY_ACHIEVEMENTS, ...INGAME_ACHIEVEMENTS]

const ID_PREFIX: Record<Stat, string> = {
  level: 'level',
  runs: 'runs',
  bestScore: 'score',
  wordsFound: 'words',
  bestCombo: 'combo',
  wordsAdded: 'added',
}

const rungId = (stat: Stat, at: number): LadderId => `${ID_PREFIX[stat]}-${at}` as LadderId

const NAMED_GOALS = new Set(NAMED.map((achievement) => `${achievement.goal.stat}:${achievement.goal.at}`))

/** Les cases de la grille qu'aucun succès nommé ne couvrait encore. */
const LADDER_ACHIEVEMENTS: readonly Achievement[] = RUNGS.filter(
  ([, stat, at]) => !NAMED_GOALS.has(`${stat}:${at}`),
).map(([, stat, at]) => reaching(rungId(stat, at), { stat, at }))

/** Les quinze publiés d'abord : leur rang fixe la couleur de leur icône, déjà dans la Console. */
export const ACHIEVEMENTS: readonly Achievement[] = [...NAMED, ...LADDER_ACHIEVEMENTS]

/** Ceux que le téléphone renvoie à Play Games. */
export const PLAY_ACHIEVEMENTS_ONLY: readonly Achievement[] = PLAY_ACHIEVEMENTS

const BY_ID = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]))

const NAMED_IDS: ReadonlySet<string> = new Set(NAMED.map((achievement) => achievement.id))

/** Un succès nommé porte son nom dans l'i18n ; un barreau porte son jalon. */
export function isNamed(id: AchievementId): id is NamedAchievementId {
  return NAMED_IDS.has(id)
}

/** Ce qu'un succès compte aujourd'hui : le serveur seul sait les découvertes. */
export function achievementCount(profile: Profile, goal: Goal, discoveries?: number): number {
  switch (goal.stat) {
    case 'level':
      return levelFor(profile.xp)
    case 'discoveries':
      return discoveries ?? 0
    case 'powersUsed':
      return profile.powersUsed.length
    case 'playedCategories':
      return profile.playedCategories.length
    default:
      return profile[goal.stat]
  }
}

/** Où en est le joueur : ce qu'il a compté, ce qu'il faut, et la part remplie. */
export interface AchievementProgress {
  achievement: Achievement
  value: number
  ratio: number
}

export function achievementProgress(profile: Profile, discoveries?: number): AchievementProgress[] {
  return ACHIEVEMENTS.map((achievement) => {
    const value = achievementCount(profile, achievement.goal, discoveries)
    return { achievement, value, ratio: Math.min(1, value / achievement.goal.at) }
  })
}

/** Ce qu'un succès fait gagner : la tuile et la couleur que son jalon débloque. */
export interface AchievementReward {
  /** La tuile d'avatar du jalon, quand la grille en a une. */
  design: number | null
  /** La couleur du même jalon, quand la palette en a une. */
  colour: Colour | null
}

export function achievementReward(achievement: Achievement): AchievementReward {
  const { design, colour } = achievement.reward
  return {
    design: design ?? null,
    colour: colour === undefined ? null : (PALETTE.find((entry) => entry.id === colour) ?? null),
  }
}

/** Les tuiles que le joueur porte : les cinq de départ et celles de ses succès. */
export function ownedDesigns(profile: Profile, discoveries?: number): AvatarDesign[] {
  const won = new Set(earnedAchievements(profile, discoveries).map((id) => BY_ID.get(id)!.reward.design))
  return AVATARS.filter((design) => design.id < FREE_DESIGNS || won.has(design.id))
}

/** Les couleurs que le joueur peut porter : les trois primaires et celles de ses succès. */
export function ownedColours(profile: Profile, discoveries?: number): Colour[] {
  const won = new Set(earnedAchievements(profile, discoveries).map((id) => BY_ID.get(id)!.reward.colour))
  return PALETTE.filter((colour, index) => index < FREE_COLOURS || won.has(colour.id))
}

/**
 * Les designs gagnés que l'éditeur n'a pas encore montrés : ce sont les tuiles
 * à badger « nouveau ». La liste des vus vit sur l'appareil, pas au profil.
 */
export function unseenDesigns(profile: Profile, seen: readonly number[], discoveries?: number): number[] {
  const known = new Set(seen)
  return ownedDesigns(profile, discoveries)
    .map((design) => design.id)
    .filter((id) => !known.has(id))
}

/** Le succès qui ouvre cette case de la grille, pour dire au joueur comment elle se gagne. */
export function designWinner(design: number): Achievement | null {
  return ACHIEVEMENTS.find((achievement) => achievement.reward.design === design) ?? null
}

/** Le jalon d'une case de la grille : ce que son succès demande, et rien d'autre. */
export function designGoal(design: number): Milestone | null {
  const rung = RUNGS.find(([tile]) => tile === design)
  return rung === undefined ? null : { stat: rung[1], at: rung[2] }
}

/** Le succès qui ouvre cette couleur, pour dire au joueur comment elle se gagne. */
export function colourWinner(colour: string): Achievement | null {
  return ACHIEVEMENTS.find((achievement) => achievement.reward.colour === colour) ?? null
}

export function hasEarned(profile: Profile, achievement: Achievement, discoveries?: number): boolean {
  return achievementCount(profile, achievement.goal, discoveries) >= achievement.goal.at
}

/** `discoveries` : le compte du serveur, s'il a répondu ; sans lui, ce succès attend. */
export function earnedAchievements(profile: Profile, discoveries?: number): AchievementId[] {
  return ACHIEVEMENTS.filter((achievement) => hasEarned(profile, achievement, discoveries)).map(
    (achievement) => achievement.id,
  )
}

/** Ce que la partie qui vient de finir a fait tomber, dans l'ordre du catalogue. */
export function newlyEarnedAchievements(before: Profile, after: Profile, discoveries?: number): Achievement[] {
  return ACHIEVEMENTS.filter(
    (achievement) => hasEarned(after, achievement, discoveries) && !hasEarned(before, achievement, discoveries),
  )
}

const hexOf = (id: string) => PALETTE.find((colour) => colour.id === id)!.hex

/** Luminance relative, de 0 (noir) à 1 (blanc). */
function lightness(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

/**
 * L'icône d'un succès : sa tuile, dans trois couleurs
 * de la palette tirées d'après son rang — au hasard, mais les mêmes à chaque
 * rendu, pour qu'une icône publiée se refasse à l'identique.
 */
export function achievementIcon(id: AchievementId): AvatarChoice {
  const index = ACHIEVEMENTS.findIndex((achievement) => achievement.id === id)
  const { design } = ACHIEVEMENTS[index]!
  let seed = 7919 * (index + 1)
  const next = () => {
    seed = (seed * 48271) % 2147483647
    return seed
  }
  // Au hasard, mais lisible : la forme et le détail tranchent sur le fond,
  // sans quoi une petite icône de la liste Play n'est plus qu'un aplat.
  const pick = (taken: readonly string[], against?: string) => {
    const free = PALETTE.filter(
      (colour) => !taken.includes(colour.id) && (against === undefined || Math.abs(lightness(colour.hex) - lightness(hexOf(against))) >= 0.3),
    )
    return free[next() % free.length]!.id
  }
  const ground = pick([])
  const shape = pick([ground], ground)
  const accent = pick([ground, shape], ground)
  return { design, ground, shape, accent }
}
