import { settleChallenge, type ChallengeEntry } from './challenge'

/** One player of a challenge shared with a friend, as its history shows them. */
export interface SharedPlayer {
  playerId: string
  name: string
  me: boolean
  played: boolean
  /** Settled once the challenge is closed; the raw run score while it is open. */
  score: number
  /** 1 for the winner, among those who played; null while the challenge is open. */
  rank: number | null
}

export interface SharedChallenge {
  id: string
  name: string | null
  ownerName: string
  owned: boolean
  createdAt: number
  finished: boolean
  players: readonly SharedPlayer[]
}

/**
 * A closed challenge's standings. An open one keeps its raw scores: rivals'
 * words stay hidden until the player has played, and the unique-word bonus
 * would be settled on blanks.
 */
export function sharedPlayers(
  players: readonly (ChallengeEntry & { name: string; me: boolean })[],
  finished: boolean,
): SharedPlayer[] {
  const standings = finished ? settleChallenge(players) : []
  return players.map((player) => {
    const at = standings.findIndex((standing) => standing.playerId === player.playerId)
    return {
      playerId: player.playerId,
      name: player.name,
      me: player.me,
      played: player.playedAt !== null,
      score: at >= 0 ? standings[at]!.score : player.score,
      rank: at >= 0 ? at + 1 : null,
    }
  })
}

/**
 * Against a friend, a challenge is won by finishing ahead of them, not first.
 * One neither closed nor played by both counts for nobody.
 */
export type FaceOff = 'won' | 'lost' | 'tie' | 'open' | 'void'

export function faceOff(challenge: SharedChallenge, friendId: string): FaceOff {
  if (!challenge.finished) return 'open'
  const me = challenge.players.find((player) => player.me)
  const them = challenge.players.find((player) => player.playerId === friendId)
  if (!me?.played || !them?.played || me.rank === null || them.rank === null) return 'void'
  if (me.score === them.score) return 'tie'
  return me.rank < them.rank ? 'won' : 'lost'
}

export interface Rivalry {
  /** Every challenge shared, counted or not. */
  challenges: number
  won: number
  tied: number
  lost: number
  /** Settled points over the challenges counted. */
  mine: number
  theirs: number
}

export function rivalry(challenges: readonly SharedChallenge[], friendId: string): Rivalry {
  const tally: Rivalry = { challenges: challenges.length, won: 0, tied: 0, lost: 0, mine: 0, theirs: 0 }
  for (const challenge of challenges) {
    const outcome = faceOff(challenge, friendId)
    if (outcome === 'open' || outcome === 'void') continue
    if (outcome === 'won') tally.won++
    else if (outcome === 'lost') tally.lost++
    else tally.tied++
    tally.mine += challenge.players.find((player) => player.me)!.score
    tally.theirs += challenge.players.find((player) => player.playerId === friendId)!.score
  }
  return tally
}
