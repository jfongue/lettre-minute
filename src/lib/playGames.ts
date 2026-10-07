import { earnedAchievements, type AchievementId } from '../domain/achievements'
import type { Profile } from '../domain/progression'
import type { Run } from '../domain/run'
import { playGamesIncrement, playGamesUnlock } from './native'

/*
 * Ce que le jeu dit à Google Play Games : les succès que le profil a atteints,
 * et trois compteurs de fin de partie (les « événements », d'où Play tire ses
 * statistiques de jeu). Les identifiants viennent de la Play Console
 * (Services de jeux Play › Réussites / Événements › Récupérer les ressources) ;
 * un succès ajouté là-bas s'ajoute ici, avec ses points dans
 * `src/domain/achievements.ts`.
 *
 * Les succès du jeu seul n'ont pas d'identifiant : Play ne les connaît pas,
 * faute de points à leur donner (le budget de 1 000 est pris). Ils s'arrêtent
 * donc ici, et `src/ui/AchievementsScreen.tsx` les montre seul.
 */
const ACHIEVEMENT_IDS: Readonly<Partial<Record<AchievementId, string>>> = {
  'level-4': 'CgkIpenjuL4GEAIQCA',
  'runs-10': 'CgkIpenjuL4GEAIQCQ',
  'words-100': 'CgkIpenjuL4GEAIQBA',
  'combo-10': 'CgkIpenjuL4GEAIQCw',
  'discoveries-15': 'CgkIpenjuL4GEAIQAg',
  'added-10': 'CgkIpenjuL4GEAIQCg',
  'level-10': 'CgkIpenjuL4GEAIQAQ',
  'runs-100': 'CgkIpenjuL4GEAIQBQ',
  'words-1000': 'CgkIpenjuL4GEAIQBg',
  'level-20': 'CgkIpenjuL4GEAIQDg',
  'combo-24': 'CgkIpenjuL4GEAIQAA',
  'score-900': 'CgkIpenjuL4GEAIQAw',
  'runs-400': 'CgkIpenjuL4GEAIQDA',
  'words-5000': 'CgkIpenjuL4GEAIQBw',
  'level-35': 'CgkIpenjuL4GEAIQDQ',
}

const EVENTS = {
  gamesPlayed: 'CgkIpenjuL4GEAIQDw',
  wordsFound: 'CgkIpenjuL4GEAIQEA',
  pointsScored: 'CgkIpenjuL4GEAIQEQ',
}

/**
 * Tout ce que le profil a atteint, à chaque fois : Play ignore un succès déjà
 * débloqué, et un joueur qui n'était pas connecté à Play Games au moment du
 * palier le reçoit ainsi à la partie suivante.
 */
export function reportAchievements(profile: Profile, discoveries?: number): void {
  const ids = earnedAchievements(profile, discoveries).flatMap((id) => {
    const play = ACHIEVEMENT_IDS[id]
    return play === undefined ? [] : [play]
  })
  playGamesUnlock(ids)
}

/** Les compteurs d'une partie finie, défi compris : c'est du jeu, pas un classement. */
export function reportRun(run: Run): void {
  playGamesIncrement(EVENTS.gamesPlayed, 1)
  playGamesIncrement(EVENTS.wordsFound, run.found.length)
  playGamesIncrement(EVENTS.pointsScored, run.score)
}
