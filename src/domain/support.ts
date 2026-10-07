import type { Profile } from './progression'

/** Runs between two asks for support: often enough to be seen, rare enough not to nag. */
export const SUPPORT_EVERY_RUNS = 10

/** A run this close to the record is a good one too: past a few dozen runs, records get rare. */
export const GREAT_SCORE_RATIO = 0.8

/**
 * Whether the run's summary asks for a rating. Only at a happy
 * moment — a great score, a category or a power just kept — and only once
 * every ten runs or so: the count starts over at the ask, and waits for the
 * next happy moment past it, which is where the « or so » comes from.
 * A challenge run never asks: its summary is the standings.
 */
export function supportDue(before: Profile, after: Profile, score: number, challenge: boolean): boolean {
  if (challenge || after.runs - after.supportAskedAt < SUPPORT_EVERY_RUNS) return false
  const great = before.runs > 0 && before.bestScore > 0 && score >= before.bestScore * GREAT_SCORE_RATIO
  const kept = after.unlocked.length > before.unlocked.length || after.powers.length > before.powers.length
  return great || kept
}

export function markSupportAsked(profile: Profile): Profile {
  return profile.supportAskedAt === profile.runs ? profile : { ...profile, supportAskedAt: profile.runs }
}
