import type { Messages } from '../i18n'
import type { ChallengeSummary } from '../lib/cloud'

/** Whole hours before the challenge closes, one at least while it runs. */
export function hoursLeft(expiresAt: number): number {
  return Math.max(1, Math.ceil((expiresAt - Date.now()) / 3_600_000))
}

export type ChallengeStatus = 'to-play' | 'waiting' | 'finished' | 'missed'

export function challengeStatus(challenge: ChallengeSummary): ChallengeStatus {
  if (challenge.finished) return challenge.mePlayed ? 'finished' : 'missed'
  return challenge.mePlayed ? 'waiting' : 'to-play'
}

/** What the home screen raises on its own: a fresh invitation first, then a recap nobody has opened. */
export function challengeNotice(
  challenges: readonly ChallengeSummary[] | null,
  held: readonly string[],
): { challenge: ChallengeSummary; kind: 'invite' | 'recap' } | null {
  const open = (challenges ?? []).filter((challenge) => !held.includes(challenge.id))
  const invite = open.find((challenge) => !challenge.seenInvite && challengeStatus(challenge) === 'to-play')
  if (invite) return { challenge: invite, kind: 'invite' }
  const recap = open.find((challenge) => !challenge.seenRecap && challengeStatus(challenge) === 'finished')
  return recap ? { challenge: recap, kind: 'recap' } : null
}

export function challengeTitle(t: Messages, challenge: { owned: boolean; ownerName: string }): string {
  return challenge.owned ? t.challenge.mine : t.challenge.by(challenge.ownerName)
}

const HIDDEN_KEY = 'lettre-minute.hidden-challenges.v1'

/**
 * What a hidden challenge was when it was set aside. Anything new since — a
 * late player, a rematch — changes it, and the challenge shows again.
 */
function stampOf(challenge: ChallengeSummary): string {
  return `${challenge.played}/${challenge.players}/${challenge.finished}/${challenge.nextId ?? ''}`
}

/** Challenge id → its stamp when hidden. On this device only: hiding is a matter of tidiness, not of record. */
export function loadHiddenChallenges(): Record<string, string> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? 'null')
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {}
    return Object.fromEntries(Object.entries(stored).filter(([, stamp]) => typeof stamp === 'string'))
  } catch {
    return {}
  }
}

export function hideChallenge(hidden: Record<string, string>, challenge: ChallengeSummary): Record<string, string> {
  const next = { ...hidden, [challenge.id]: stampOf(challenge) }
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(next))
  } catch {
    /* hidden until the app closes */
  }
  return next
}

export function isHidden(hidden: Record<string, string>, challenge: ChallengeSummary): boolean {
  return hidden[challenge.id] === stampOf(challenge)
}
