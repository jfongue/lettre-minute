import { isNamed, type Achievement } from '../domain/achievements'
import type { Milestone } from '../domain/avatar'
import { capitalized } from '../domain/text'
import type { Messages } from '../i18n'

/**
 * Le nom d'un succès, et sa description. Les succès publiés sur Play Games et
 * les exploits ont les leurs dans l'i18n ; un barreau de la grille n'a rien de
 * plus à dire que son jalon, que `fr.ts` nomme déjà dans les sept langues pour
 * les info-bulles de l'avatar.
 */
export function achievementText(t: Messages, achievement: Achievement): { name: string; desc: string } {
  if (isNamed(achievement.id)) return t.ach[achievement.id]
  return { name: capitalized(t.avatar.milestone(achievement.goal as Milestone)), desc: '' }
}
