import { settleChallenge } from '../domain/challenge'
import type { Messages } from '../i18n'
import type { ChallengeDetail, ChallengeSummary } from '../lib/cloud'

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

export function challengeTitle(t: Messages, challenge: { owned: boolean; ownerName: string; name: string | null }): string {
  if (challenge.name) return challenge.name
  return challenge.owned ? t.challenge.mine : t.challenge.by(challenge.ownerName)
}

const HIDDEN_KEY = 'lettre-minute.hidden-challenges.v1'

/**
 * What a hidden challenge was when it was set aside. Anything new since — a
 * late player, a rematch — changes it, and the challenge shows again.
 */
type Stamped = Pick<ChallengeSummary, 'id' | 'played' | 'players' | 'finished' | 'nextId'>

function stampOf(challenge: Stamped): string {
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

/** Sent on the window each time the hidden set changes: the home list and the statistics both read it. */
export const HIDDEN_CHANGED = 'lettre-minute:hidden-challenges'

function saveHidden(next: Record<string, string>): Record<string, string> {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(next))
  } catch {
    /* hidden until the app closes */
  }
  globalThis.dispatchEvent?.(new Event(HIDDEN_CHANGED))
  return next
}

export function hideChallenge(hidden: Record<string, string>, challenge: Stamped): Record<string, string> {
  return saveHidden({ ...hidden, [challenge.id]: stampOf(challenge) })
}

export function unhideChallenge(hidden: Record<string, string>, id: string): Record<string, string> {
  const next = { ...hidden }
  delete next[id]
  return saveHidden(next)
}

/** A recap once read: the detail stamped as the list will read it. */
export function hideChallengeDetail(detail: {
  id: string
  finished: boolean
  nextId: string | null
  players: readonly { playedAt: number | null }[]
}): void {
  hideChallenge(loadHiddenChallenges(), {
    id: detail.id,
    finished: detail.finished,
    nextId: detail.nextId,
    players: detail.players.length,
    played: detail.players.filter((player) => player.playedAt !== null).length,
  })
}

export function isHidden(hidden: Record<string, string>, challenge: ChallengeSummary): boolean {
  return hidden[challenge.id] === stampOf(challenge)
}

const REVEALED_KEY = 'lettre-minute.revealed-recaps.v1'

function loadRevealed(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(REVEALED_KEY) ?? '[]')
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/** Whether this device has already played the recap's reveal: the suspense is for the first opening only. */
export function recapRevealed(id: string): boolean {
  return loadRevealed().includes(id)
}

// The newest hundred are plenty: a challenge closes within a day, and its recap is opened soon after.
const REVEALED_KEPT = 100

export function markRecapRevealed(id: string): void {
  const revealed = loadRevealed()
  if (revealed.includes(id)) return
  try {
    localStorage.setItem(REVEALED_KEY, JSON.stringify([...revealed, id].slice(-REVEALED_KEPT)))
  } catch {
    /* the reveal plays again next time */
  }
}

/** Who took a closed challenge, or null when nobody played it. */
export interface ChallengeWinner {
  name: string
  me: boolean
  score: number
}

export function winnerOf(detail: Pick<ChallengeDetail, 'players'>): ChallengeWinner | null {
  const top = settleChallenge(detail.players)[0]
  const player = top && detail.players.find((candidate) => candidate.playerId === top.playerId)
  return top && player ? { name: player.name, me: player.me, score: top.score } : null
}

const WINNERS_KEY = 'lettre-minute.challenge-winners.v1'
const WINNERS_KEPT = 200

/**
 * Challenge id → its winner, kept once the recap was read. Only a device can
 * tell: a bot's run exists nowhere but replayed from the seed, so the server's
 * list knows no final standings.
 */
export function loadWinners(): Record<string, ChallengeWinner | null> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(WINNERS_KEY) ?? 'null')
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {}
    return Object.fromEntries(
      Object.entries(stored).filter(
        ([, winner]) =>
          winner === null ||
          (typeof winner === 'object' && typeof winner.name === 'string' && typeof winner.me === 'boolean' && typeof winner.score === 'number'),
      ),
    )
  } catch {
    return {}
  }
}

export function rememberWinner(id: string, winner: ChallengeWinner | null): void {
  const winners = { ...loadWinners(), [id]: winner }
  const kept = Object.entries(winners).slice(-WINNERS_KEPT)
  try {
    localStorage.setItem(WINNERS_KEY, JSON.stringify(Object.fromEntries(kept)))
  } catch {
    /* read again from the server next time */
  }
}
