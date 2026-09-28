import { designUnlock, PALETTE, reached, type AvatarChoice, type Milestone } from './avatar'
import type { Profile } from './progression'

/*
 * Les succès Google Play Games : quinze jalons de l'avatar, choisis espacés,
 * chacun illustré par la tuile qu'il fait gagner. Un succès PGS ne se reprend
 * jamais, là où une tuile peut redevenir verrouillée si un seuil bouge : ces
 * seuils-ci sont donc figés ici, écrits en dur, et ne suivent pas `TRACKS`.
 * Leurs identifiants Play vivent côté téléphone (`src/lib/playGames.ts`).
 *
 * Mots ajoutés et découvertes restent bas (10 et 15) : plus le dictionnaire
 * grossit, moins il reste de mots à y faire entrer ou à écrire le premier.
 * Les découvertes ne sont comptées que par le serveur (`leaderboard_values`,
 * 0024) : la fin de partie les lui demande, et un joueur anonyme n'en a pas.
 */

export type AchievementId =
  | 'level-4'
  | 'level-10'
  | 'level-20'
  | 'level-35'
  | 'runs-10'
  | 'runs-100'
  | 'runs-400'
  | 'words-100'
  | 'words-1000'
  | 'words-5000'
  | 'score-900'
  | 'combo-10'
  | 'combo-24'
  | 'added-10'
  | 'discoveries-15'

export type Goal = Milestone | { stat: 'discoveries'; at: number }

export interface Achievement {
  id: AchievementId
  goal: Goal
  /** La tuile de l'icône : celle que le même jalon débloque, sinon une voisine choisie à la main. */
  design: number
  /** Points Play Games : 1 000 en tout, par multiples de cinq. */
  points: number
}

const tileOf = (milestone: Milestone): number => {
  for (let id = 0; ; id++) {
    const unlock = designUnlock(id)
    if (unlock && unlock.stat === milestone.stat && unlock.at === milestone.at) return id
  }
}

const reaching = (id: AchievementId, milestone: Milestone, points: number): Achievement => ({
  id,
  goal: milestone,
  design: tileOf(milestone),
  points,
})

export const ACHIEVEMENTS: readonly Achievement[] = [
  reaching('level-4', { stat: 'level', at: 4 }, 15),
  reaching('runs-10', { stat: 'runs', at: 10 }, 20),
  reaching('words-100', { stat: 'wordsFound', at: 100 }, 20),
  reaching('combo-10', { stat: 'bestCombo', at: 10 }, 30),
  // L'étoile du combo 20, qu'aucun autre succès ne montre.
  { id: 'discoveries-15', goal: { stat: 'discoveries', at: 15 }, design: 24, points: 40 },
  // Le jalon de l'avatar est à 15 mots ajoutés ; le succès vient plus tôt, sous la même tuile.
  { id: 'added-10', goal: { stat: 'wordsAdded', at: 10 }, design: tileOf({ stat: 'wordsAdded', at: 15 }), points: 50 },
  reaching('level-10', { stat: 'level', at: 10 }, 50),
  reaching('runs-100', { stat: 'runs', at: 100 }, 60),
  reaching('words-1000', { stat: 'wordsFound', at: 1000 }, 70),
  reaching('level-20', { stat: 'level', at: 20 }, 80),
  reaching('combo-24', { stat: 'bestCombo', at: 24 }, 90),
  reaching('score-900', { stat: 'bestScore', at: 900 }, 100),
  reaching('runs-400', { stat: 'runs', at: 400 }, 110),
  reaching('words-5000', { stat: 'wordsFound', at: 5000 }, 120),
  reaching('level-35', { stat: 'level', at: 35 }, 145),
]

/** `discoveries` : le compte du serveur, s'il a répondu ; sans lui, ce succès attend. */
export function earnedAchievements(profile: Profile, discoveries?: number): AchievementId[] {
  return ACHIEVEMENTS.filter(({ goal }) =>
    goal.stat === 'discoveries' ? (discoveries ?? 0) >= goal.at : reached(profile, goal),
  ).map((achievement) => achievement.id)
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
