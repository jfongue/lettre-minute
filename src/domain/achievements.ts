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
  | 'weekly-5'
  | 'weekly-30'
  | 'friends-5'
  | 'friends-25'
  | 'moderation-10'
  | 'moderation-30'
  | 'moderation-60'
  | 'short-streak-10'
  | 'no-pass-50'
  | 'word-long-10'
  | 'word-long-15'
  | 'speed-25'
  | 'speed-35'
  | 'powers-7'
  | 'powers-all'
  | 'clean-run-10'
  | 'categories-12'
  | 'reviews-10'

/**
 * Les trente barreaux qui manquaient aux quarante-cinq cases de la grille :
 * leur identifiant se lit de leur jalon, et leur nom vient de l'i18n de
 * l'avatar — la grille sait déjà nommer un jalon dans les sept langues.
 */
export type LadderId =
  | 'level-7'
  | 'level-14'
  | 'level-27'
  | 'level-50'
  | 'runs-3'
  | 'runs-30'
  | 'runs-250'
  | 'runs-1200'
  | 'words-300'
  | 'words-600'
  | 'words-4000'
  | 'words-8000'
  | 'score-350'
  | 'score-450'
  | 'score-550'
  | 'score-750'
  | 'score-900'
  | 'combo-15'
  | 'combo-20'
  | 'combo-30'
  | 'added-5'
  | 'added-40'
  | 'added-150'
  | 'added-500'

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
| 'weeklyAttempts'
| 'challengesFinished'
| 'shortStreak'
| 'noPassStreak'
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
 * Avec `EXPLOIT_TILES`, juste après, c'est ici que se lit le seuil d'une case ;
 * l'ordre des tuiles ne bouge pas, un joueur en porte une.
 *
 * Un tour de rôle entre les six pistes, pour que la grille mêle les niveaux
 * aux exploits au lieu de cacher chaque exploit derrière le dernier niveau :
 * les seuils d'une piste montent avec les tuiles, et les quinze succès Play
 * gardent la case qu'ils avaient.
 *
 * Les seuils se lisent dans ce que les joueurs font vraiment : à l'automne
 * 2026, sur 349 profils et 888 parties, un joueur sur cinq dépassait dix
 * parties, deux seulement les mille mots, et la meilleure partie de tous les
 * temps valait 621 points. Six pistes montent donc bien plus haut qu'avant —
 * la dernière case demande 1 200 parties, 8 000 mots ou le niveau 50 — et le
 * score garde son plafond de 900, son 666 restant au succès Play qui le nomme.
 */
const RUNGS: readonly [design: number, stat: Stat, at: number][] = [
  [5, 'level', 4],
  [6, 'runs', 3],
  [7, 'wordsFound', 100],
  [8, 'level', 7],
  [9, 'bestCombo', 10],
  [10, 'wordsAdded', 5],
  [11, 'wordsFound', 300],
  [13, 'bestCombo', 15],
  [16, 'bestScore', 350],
  [18, 'wordsFound', 600],
  [19, 'bestScore', 450],
  [20, 'level', 10],
  [21, 'runs', 10],
  [22, 'wordsFound', 1000],
  [23, 'bestCombo', 20],
  [25, 'bestScore', 550],
  [27, 'wordsFound', 2000],
  [29, 'bestCombo', 24],
  [30, 'level', 14],
  [31, 'runs', 30],
  [32, 'wordsFound', 4000],
  [34, 'bestScore', 750],
  [35, 'level', 20],
  [36, 'runs', 100],
  [37, 'runs', 250],
  [38, 'level', 27],
  [39, 'bestScore', 900],
  [40, 'wordsFound', 8000],
  [41, 'runs', 400],
  [42, 'level', 35],
  [43, 'bestCombo', 30],
  [44, 'wordsAdded', 10],
  [45, 'wordsAdded', 40],
  [46, 'wordsAdded', 150],
  [47, 'wordsAdded', 500],
  [48, 'level', 50],
  [49, 'runs', 1200],
]

/**
 * Les tuiles que la grille ouvre par un exploit, sans barreau : « Trois six »,
 * « Juste arbitre », « Marathon », et les huit seuils des pistes que la grille
 * ne compte pas — le défi du moment, les défis entre amis, la modération, les
 * mots courts d'affilée et la suite sans passer. Leur jalon n'est pas une
 * piste de `RUNGS`, raison pour laquelle il vit ici — mais chaque tuile a bien
 * son seuil, et un seul.
 */
const EXPLOIT_TILES: readonly [design: number, stat: Counter, at: number][] = [
  [12, 'wordsReviewed', 50],
  [14, 'weeklyAttempts', 5],
  [15, 'challengesFinished', 5],
  [17, 'shortStreak', 10],
  [24, 'weeklyAttempts', 30],
  [26, 'challengesFinished', 25],
  [28, 'wordsReviewed', 150],
  [33, 'wordsReviewed', 300],
  [50, 'bestScore', 666],
  [51, 'wordsReviewed', 10],
  [52, 'noPassStreak', 50],
]

/**
 * Les douze couleurs que la palette pose sur le seuil d'un barreau : elles se
 * gagnent avec lui. Les treize autres n'ont pas de barreau — elles
 * s'attachent à un exploit, et trois d'entre elles ont suivi les pistes
 * neuves du défi du moment, des défis entre amis et de la modération.
 */
const RUNG_COLOURS: readonly [colour: string, stat: Stat, at: number][] = [
  ['noir', 'runs', 3],
  ['creme', 'level', 4],
  ['orange', 'level', 7],
  ['brique', 'level', 14],
  ['ciel', 'bestCombo', 10],
  ['sauge', 'level', 10],
  ['rose', 'runs', 10],
  ['marine', 'runs', 30],
  ['corail', 'wordsFound', 300],
  ['prune', 'bestCombo', 24],
  ['sable', 'bestScore', 900],
  ['anthracite', 'level', 50],
]

// Bounded by the grid: a goal no tile unlocks must fail loudly, not hang every
// screen that loads this module.
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
  // `discoveries-15` prend une icône choisie à la main — l'étoile du combo 20,
  // qu'aucun autre succès ne montre — et ne paie qu'une couleur. `added-10`
  // ouvre le barreau des dix mots ajoutés, que son icône montre déjà.
  { id: 'discoveries-15', goal: { stat: 'discoveries', at: 15 }, design: 24, family: 'explore', play: 40, reward: { colour: 'lavande' } },
  { id: 'added-10', goal: { stat: 'wordsAdded', at: 10 }, design: 44, family: 'explore', play: 50, reward: { design: 44, colour: 'olive' } },
  reaching('level-10', { stat: 'level', at: 10 }, 50),
  reaching('runs-100', { stat: 'runs', at: 100 }, 60),
  reaching('words-1000', { stat: 'wordsFound', at: 1000 }, 70),
  reaching('level-20', { stat: 'level', at: 20 }, 80),
  reaching('combo-24', { stat: 'bestCombo', at: 24 }, 90),
  // 666 ouvre sa propre tuile (50, le six) sans que son icône Play bouge : la
  // Console montre déjà celle du barreau de 900, et ne se met jamais à jour.
  { id: 'score-666', goal: { stat: 'bestScore', at: 666 }, design: 33, family: 'progress', play: 100, reward: { design: 50, colour: 'moutarde' } },
  reaching('runs-400', { stat: 'runs', at: 400 }, 110),
  reaching('words-2000', { stat: 'wordsFound', at: 2000 }, 120),
  reaching('level-35', { stat: 'level', at: 35 }, 145),
]

/*
 * Les succès du jeu seul. Leurs seuils se lisent dans ce que les joueurs font
 * vraiment : à l'automne 2026, sur 349 profils et 888 parties, la moitié des
 * parties passées s'arrêtaient sous 95 points, la meilleure de tous les temps
 * valait 621, le plus long mot 25 lettres et la frappe la plus vive 4,17
 * lettres par seconde. Les barreaux comblent les trous de l'échelle Play, les
 * exploits se gagnent en une partie ou sur une piste que la grille ne compte
 * pas, et l'exploration demande d'avoir touché à douze catégories.
 *
 * Dix exploits portent une tuile que `RUNGS` n'ouvre pas — les pistes du défi
 * du moment, des défis entre amis, de la modération, des mots courts d'affilée
 * et de la suite sans passer ; les huit autres n'ont pas de case à eux, et
 * leur récompense est la couleur qu'ils portent.
 */
const INGAME_ACHIEVEMENTS: readonly Achievement[] = [
  // Les pistes que la grille ne compte pas : chacune sur sa tuile, hors du tour
  // de rôle de `RUNGS`, et son nom vient de l'i18n comme celui d'un exploit.
  { id: 'weekly-5', goal: { stat: 'weeklyAttempts', at: 5 }, design: 14, family: 'exploit', reward: { design: 14 } },
  { id: 'weekly-30', goal: { stat: 'weeklyAttempts', at: 30 }, design: 24, family: 'exploit', reward: { design: 24, colour: 'citron' } },
  { id: 'friends-5', goal: { stat: 'challengesFinished', at: 5 }, design: 15, family: 'exploit', reward: { design: 15 } },
  { id: 'friends-25', goal: { stat: 'challengesFinished', at: 25 }, design: 26, family: 'exploit', reward: { design: 26, colour: 'bordeaux' } },
  { id: 'moderation-10', goal: { stat: 'wordsReviewed', at: 50 }, design: 12, family: 'exploit', reward: { design: 12 } },
  { id: 'moderation-30', goal: { stat: 'wordsReviewed', at: 150 }, design: 28, family: 'exploit', reward: { design: 28 } },
  { id: 'moderation-60', goal: { stat: 'wordsReviewed', at: 300 }, design: 33, family: 'exploit', reward: { design: 33, colour: 'gris' } },
  { id: 'short-streak-10', goal: { stat: 'shortStreak', at: 10 }, design: 17, family: 'exploit', reward: { design: 17 } },
  { id: 'no-pass-50', goal: { stat: 'noPassStreak', at: 50 }, design: 52, family: 'exploit', reward: { design: 52, colour: 'menthe' } },
  { id: 'word-long-10', goal: { stat: 'longestWord', at: 10 }, design: 6, family: 'exploit', reward: { colour: 'vert' } },
  { id: 'word-long-15', goal: { stat: 'longestWord', at: 15 }, design: 45, family: 'exploit', reward: { colour: 'canard' } },
  { id: 'speed-25', goal: { stat: 'bestSpeed', at: 25 }, design: 19, family: 'exploit', reward: { colour: 'ocre' } },
  { id: 'speed-35', goal: { stat: 'bestSpeed', at: 35 }, design: 49, family: 'exploit', reward: { colour: 'saumon' } },
  { id: 'clean-run-10', goal: { stat: 'cleanRuns', at: 10 }, design: 10, family: 'exploit', reward: { colour: 'emeraude' } },
  { id: 'powers-7', goal: { stat: 'powersUsed', at: 7 }, design: 40, family: 'explore', reward: { colour: 'violet' } },
  { id: 'powers-all', goal: { stat: 'powersUsed', at: 14 }, design: 47, family: 'explore', reward: { colour: 'fuchsia' } },
  { id: 'categories-12', goal: { stat: 'playedCategories', at: 12 }, design: 23, family: 'explore', reward: { colour: 'turquoise' } },
  // La modération n'est pas une partie : le compte monte quand un verdict part
  // (`src/ui/ModerationScreen.tsx`), jamais à la fin d'un run.
  { id: 'reviews-10', goal: { stat: 'wordsReviewed', at: 10 }, design: 31, family: 'progress', reward: { design: 51, colour: 'outremer' } },
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

/** Les couleurs gagnées que l'éditeur n'a pas encore montrées, comme les tuiles. */
export function unseenColours(profile: Profile, seen: readonly string[], discoveries?: number): string[] {
  const known = new Set(seen)
  return ownedColours(profile, discoveries)
    .map((colour) => colour.id)
    .filter((id) => !known.has(id))
}

/** Le succès qui ouvre cette case de la grille, pour dire au joueur comment elle se gagne. */
export function designWinner(design: number): Achievement | null {
  return ACHIEVEMENTS.find((achievement) => achievement.reward.design === design) ?? null
}

/** Le jalon d'une case de la grille : ce que son succès demande, et rien d'autre. */
export function designGoal(design: number): Goal | null {
  const rung = [...RUNGS, ...EXPLOIT_TILES].find(([tile]) => tile === design)
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
