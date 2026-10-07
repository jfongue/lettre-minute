import { xpForLevel } from './progression'

/**
 * The thresholds that decide a word — five « correct », two « incorrect », two
 * more « correct » per « not sure » (capped at fifteen) and half a voice more
 * to block (capped at seven), a super moderator's vote weighing two — live in
 * the server (`settle_review`, 0059): changing them needs no release. Only what
 * the interface has to know is here.
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
export const MODERATOR_LEVEL_XP = 1650

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

/**
 * This many words waiting for a moderator, and « Mes demandes » wears a « ! ».
 * The count is the server's own ceiling — `moderation_queue(p_lang, 20)`
 * (0039) — so « more than this » could never be true, and the « ! » never
 * showed.
 */
export const MODERATION_QUEUE_ALERT = 20

/** Whether the « ! » shows: opening « Mes demandes » quiets it until the next day. */
export function queueAlertDue(queue: number, seenOn: string | null, today: string): boolean {
  return queue >= MODERATION_QUEUE_ALERT && seenOn !== today
}
