import { xpForLevel } from './progression'

/**
* The thresholds that decide a word — five « correct » (two in a language with
* fewer than ten moderators, 0078), two « incorrect », two more « correct » per
* « not sure » (capped at fifteen) and half a voice more to block (capped at
* seven), a super moderator's vote weighing two but never settling a word
* alone — live in the server (`settle_review`, 0059): changing them needs no
* release. Only what the interface has to know is here.
 */

/** A session hands out this many words; the next one is started from « Mes demandes ». */
export const MODERATION_SESSION_SIZE = 5

/**
 * Fewer words than this waiting, and moderation is not offered: neither the
 * panel nor the invitation to become a moderator (`moderation_status`, 0013).
 * Waiting counts what the queue holds for that language plus what the reserve
 * still has to pour into it (0082): a language with two words to judge and a
 * hundred in reserve has a session's worth.
 */
export const MODERATION_MIN_QUEUE = 5

/** The level at which a player is offered to moderate. */
export const MODERATOR_LEVEL = 6

/**
 * The same level in XP, as `moderator_offer_due` checks it (0083: the profile's
 * XP, or the runs' sum plus 150 per accepted word, reaching 1650; 0082 undid
 * the stale 2550 that 0055 had put back): SQL cannot call `xpForLevel`,
 * so a test holds the two together.
 */
export const MODERATOR_LEVEL_XP = 1650

export type Verdict = 'correct' | 'unsure' | 'incorrect' | 'special'

/**
 * Why the game offers a player to moderate. « bonus » is the card won at a
 * bonus level: the client sends it, the server never lists it as due.
 */
export type ModeratorOfferReason = 'level' | 'words' | 'friend' | 'bonus'

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

/**
 * Whether « Mes demandes » wears its « ! »: a moderator has words to judge, or
 * the server could pour some in (`moderation_status.topup`, 0100: queue under
 * five, the hourly top-up open, a reserve left in their language). Opening the
 * page quiets it until the next day.
 */
export function queueAlertDue(queue: number, topUpOpen: boolean, seenOn: string | null, today: string): boolean {
  return (queue > 0 || topUpOpen) && seenOn !== today
}
