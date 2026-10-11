import type { Profile } from './progression'

/** Runs before the game first asks for a five-star rating, and between two asks once put off. */
export const RATING_FIRST_RUNS = 10
export const RATING_EVERY_RUNS = 20

/**
 * Whether the next return home asks for five stars: after the tenth run, then
 * twenty runs after a « Plus tard ». The player who opened the store page —
 * or who already rated — is left alone for good (`ratingDone`).
 */
export function ratingDue(profile: Profile): boolean {
  if (profile.ratingDone > 0) return false
  if (profile.ratingAskedAt === 0) return profile.runs >= RATING_FIRST_RUNS
  return profile.runs - profile.ratingAskedAt >= RATING_EVERY_RUNS
}

export function markRatingAsked(profile: Profile): Profile {
  return profile.ratingAskedAt === profile.runs ? profile : { ...profile, ratingAskedAt: profile.runs }
}

export function markRatingDone(profile: Profile): Profile {
  return profile.ratingDone > 0 ? profile : { ...profile, ratingDone: 1 }
}
