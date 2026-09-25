import { xpForLevel } from './progression'

/**
 * The thresholds that decide a word — three « correct », two « incorrect »,
 * five clean validations for a super moderator — live in the server
 * (`supabase/migrations/0007_moderation.sql`): changing them needs no release.
 * Only what the interface has to know is here.
 */

/** A session hands out this many words; the next one is started from « Mes demandes ». */
export const MODERATION_SESSION_SIZE = 5

/**
 * Fewer words than this waiting, and moderation is not offered: neither the
 * panel nor the invitation to become a moderator (`moderation_status`, 0013).
 */
export const MODERATION_MIN_QUEUE = 5

/** The level at which a player is offered to moderate. */
export const MODERATOR_LEVEL = 6

/**
 * The same level in XP, as `moderator_offer_due` checks it: SQL cannot call
 * `xpForLevel`, so a test holds the two together.
 */
export const MODERATOR_LEVEL_XP = 2550

/** Clean validations that make a moderator's word enough on its own. */
export const SUPER_MODERATOR_VALIDATIONS = 5

export type Verdict = 'correct' | 'unsure' | 'incorrect' | 'special'

/** Why the game offers a player to moderate. */
export type ModeratorOfferReason = 'level' | 'words' | 'friend'

export function reachesModeratorLevel(xp: number): boolean {
  return xp >= xpForLevel(MODERATOR_LEVEL)
}

/** How far a swipe must travel, as a share of the card's width, to count as a verdict. */
export const SWIPE_THRESHOLD = 0.32

/**
 * The verdict a drag stands for: sideways for yes or no, upwards for « I do
 * not know ». Null while it has not travelled far enough to mean anything.
 */
export function swipeVerdict(dx: number, dy: number, width: number): Exclude<Verdict, 'special'> | null {
  const reach = width * SWIPE_THRESHOLD
  if (-dy > reach && -dy > Math.abs(dx)) return 'unsure'
  if (dx > reach) return 'correct'
  if (dx < -reach) return 'incorrect'
  return null
}
