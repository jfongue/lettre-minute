import { AVATARS, colourUnlock, designUnlock, PALETTE, type AvatarChoice, type Colour, type Milestone } from './avatar'
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
* Mots ajoutés et découvertes restent bas (10 et 15) : plus le dictionnaire
* grossit, moins il reste de mots à y faire entrer ou à écrire le premier.
* Les découvertes ne sont comptées que par le serveur (`leaderboard_values`,
* 0024) : la fin de partie les lui demande, et un joueur anonyme n'en a pas.
*/

export type AchievementId =
  // Les quinze succès Play Games publiés.
  | 'level-4'
  | 'level-10'
  | 'level-20'
  | 'level-35'
  | 'runs-10'
  | 'runs-100'
  | 'runs-400'
  | 'words-100'
  | 'words-1000'
  | 'words-2000'
  | 'score-666'
  | 'combo-10'
  | 'combo-24'
  | 'added-10'
  | 'discoveries-15'
  // Les succès du jeu, sans Play Games.
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
}

// Bounded by the grid: a goal no tile unlocks must fail loudly, not hang every
// screen that loads this module (666 points did, before it took 900's tile).
const tileOf = (milestone: Milestone): number => {
  for (let id = 0; id < AVATARS.length; id++) {
    const unlock = designUnlock(id)
    if (unlock && unlock.stat === milestone.stat && unlock.at === milestone.at) return id
  }
  throw new Error(`no avatar tile unlocks at ${milestone.stat} ${milestone.at}`)
}

const reaching = (id: AchievementId, milestone: Milestone, play?: number, family: Family = 'progress'): Achievement => ({
  id,
  goal: milestone,
  design: tileOf(milestone),
  family,
  ...(play === undefined ? {} : { play }),
})

/**
 * Les quinze succès publiés sur Play Games, dans l'ordre des lignes de la
 * Console. Points et seuils ne bougent plus : les identifiants vivent dans
 * `src/lib/playGames.ts`, les textes dans `scripts/play-games-achievements.ts`
 * — et nulle part ailleurs, pour qu'une ligne de la Console ne mente jamais
 * sur ce que le jeu accorde.
 *
 * `discoveries-15` et `added-10` prennent une tuile choisie à la main : le
 * premier montre l'étoile du combo 20, qu'aucun autre succès ne montre, le
 * second la tuile du premier mot ajouté, son jalon d'avatar étant à 15.
 */
const PLAY_ACHIEVEMENTS: readonly Achievement[] = [
  reaching('level-4', { stat: 'level', at: 4 }, 15),
  reaching('runs-10', { stat: 'runs', at: 10 }, 20),
  reaching('words-100', { stat: 'wordsFound', at: 100 }, 20),
  reaching('combo-10', { stat: 'bestCombo', at: 10 }, 30),
  { id: 'discoveries-15', goal: { stat: 'discoveries', at: 15 }, design: 24, family: 'explore', play: 40 },
  { id: 'added-10', goal: { stat: 'wordsAdded', at: 10 }, design: tileOf({ stat: 'wordsAdded', at: 15 }), family: 'explore', play: 50 },
  reaching('level-10', { stat: 'level', at: 10 }, 50),
  reaching('runs-100', { stat: 'runs', at: 100 }, 60),
  reaching('words-1000', { stat: 'wordsFound', at: 1000 }, 70),
  reaching('level-20', { stat: 'level', at: 20 }, 80),
  reaching('combo-24', { stat: 'bestCombo', at: 24 }, 90),
  // No tile unlocks at 666: the icon Play already shows, 900's, stays.
  { id: 'score-666', goal: { stat: 'bestScore', at: 666 }, design: tileOf({ stat: 'bestScore', at: 900 }), family: 'progress', play: 100 },
  reaching('runs-400', { stat: 'runs', at: 400 }, 110),
  reaching('words-2000', { stat: 'wordsFound', at: 2000 }, 120),
  reaching('level-35', { stat: 'level', at: 35 }, 145),
]

/*
* Les succès du jeu seul. Leurs seuils se lisent dans ce que les joueurs font
* vraiment : à l'automne 2026, sur 301 profils, la moitié des parties passées
* s'arrêtaient sous 95 points, la meilleure de tous les temps valait 621, le
* plus long mot 18 lettres et la frappe la plus vive 4,17 lettres par seconde.
* Les paliers « barre à remplir » comblent les trous de l'échelle Play
* (25 parties, 250 mots, 400 points), les exploits se gagnent en une partie,
* et l'exploration demande d'avoir touché à douze catégories.
*/
const INGAME_ACHIEVEMENTS: readonly Achievement[] = [
  reaching('runs-25', { stat: 'runs', at: 25 }),
  reaching('words-250', { stat: 'wordsFound', at: 250 }),
  reaching('score-400', { stat: 'bestScore', at: 400 }),
  { id: 'word-long-10', goal: { stat: 'longestWord', at: 10 }, design: 14, family: 'exploit' },
  { id: 'word-long-15', goal: { stat: 'longestWord', at: 15 }, design: 45, family: 'exploit' },
  { id: 'speed-25', goal: { stat: 'bestSpeed', at: 25 }, design: 19, family: 'exploit' },
  { id: 'speed-35', goal: { stat: 'bestSpeed', at: 35 }, design: 49, family: 'exploit' },
  { id: 'powers-7', goal: { stat: 'powersUsed', at: 7 }, design: 40, family: 'explore' },
  { id: 'powers-all', goal: { stat: 'powersUsed', at: 14 }, design: 47, family: 'explore' },
  // 27 went to words-2000 when its goal came down to the 2000-word tile.
  { id: 'clean-run', goal: { stat: 'cleanRuns', at: 1 }, design: 16, family: 'exploit' },
  { id: 'clean-run-10', goal: { stat: 'cleanRuns', at: 10 }, design: 10, family: 'exploit' },
  // Aucune table de quatre n'a encore été jouée (`duel_seats` : trois places au
  // plus) : le premier barreau est de s'y asseoir, le second d'y tenir vingt
  // manches, ce qu'aucune table n'a jamais approché.
  { id: 'duel-four', goal: { stat: 'duelRounds4', at: 1 }, design: 43, family: 'exploit' },
  { id: 'duel-round-20', goal: { stat: 'duelRounds4', at: 20 }, design: 38, family: 'exploit' },
  { id: 'day-first', goal: { stat: 'dailyFirst', at: 1 }, design: 46, family: 'exploit' },
  { id: 'categories-12', goal: { stat: 'playedCategories', at: 12 }, design: 23, family: 'explore' },
  // La modération n'est pas une partie : le compte monte quand un verdict part
  // (`src/ui/ModerationScreen.tsx`), jamais à la fin d'un run.
  { id: 'reviews-10', goal: { stat: 'wordsReviewed', at: 10 }, design: 31, family: 'progress' },
]

/** Les quinze publiés d'abord : leur rang fixe la couleur de leur icône, déjà dans la Console. */
export const ACHIEVEMENTS: readonly Achievement[] = [...PLAY_ACHIEVEMENTS, ...INGAME_ACHIEVEMENTS]

/** Ceux que le téléphone renvoie à Play Games. */
export const PLAY_ACHIEVEMENTS_ONLY: readonly Achievement[] = PLAY_ACHIEVEMENTS

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

/**
 * Un succès de palier offre exactement ce que son jalon débloque : la tuile de
 * la grille, et la couleur quand la palette pose la même borne. Les exploits
 * qui se gagnent en une partie ne sont bornés par aucune statistique d'avatar
 * (`longestWord`, `bestSpeed`, les tables…) : ils n'offrent rien de plus que
 * leur propre icône, et le rendent ici par deux `null`.
 */
export function achievementReward(achievement: Achievement): AchievementReward {
  const { stat, at } = achievement.goal
  const same = (milestone: Milestone | null) => milestone !== null && milestone.stat === stat && milestone.at === at
  return {
    design: AVATARS.find((design) => same(designUnlock(design.id)))?.id ?? null,
    colour: PALETTE.find((colour) => same(colourUnlock(colour.id))) ?? null,
  }
}

export function hasEarned(profile: Profile, achievement: Achievement, discoveries?: number): boolean {
  return achievementCount(profile, achievement.goal, discoveries) >= achievement.goal.at
}

/** `discoveries` : le compte du serveur, s'il a répondu ; sans lui, ce succès attend. */
export function earnedAchievements(profile: Profile, discoveries?: number): AchievementId[] {
  return ACHIEVEMENTS.filter((achievement) => hasEarned(profile, achievement, discoveries)).map((achievement) => achievement.id)
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
