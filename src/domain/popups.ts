/**
 * The pop-ups the home screen may raise, most pressing first. The store update
 * leads: an outdated build may play a dictionary or rules the others no longer
 * share, and every pop-up after it would be asked again once updated.
 */
export const POP_ORDER = [
  'update',
  'challenge',
  'weeklyRecap',
  'weeklyPrize',
  'name',
  'push',
  'moderator',
  'wordsNews',
  'gift',
  'thanks',
  'feedback',
  'shareNews',
  'premieres',
  'rating',
] as const

export type PopId = (typeof POP_ORDER)[number]

/** The pause between one pop-up closing and the next one opening, so they never chain on top of each other. */
export const POP_GAP_MS = 700

/** How long the other pop-ups wait for the store to say whether an update is out, before going ahead without it. */
export const UPDATE_WAIT_MS = 4000

/**
 * The pop-up to show, one at a time. Nothing opens before the store has
 * answered about an update (`updateKnown`), so the update is never preceded
 * by another; a pop-up already open stays until answered, even when a more
 * pressing one becomes due behind it — that one comes next.
 */
export function nextPop(due: ReadonlySet<PopId>, shown: PopId | null, updateKnown: boolean): PopId | null {
  if (shown !== null && due.has(shown)) return shown
  if (!updateKnown) return null
  return POP_ORDER.find((id) => due.has(id)) ?? null
}
