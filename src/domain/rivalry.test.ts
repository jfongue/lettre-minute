import { describe, expect, it } from 'vitest'
import type { ChallengeEntry, ChallengeWord } from './challenge'
import { faceOff, rivalry, sharedPlayers, type SharedChallenge } from './rivalry'

function word(key: string, points: number): ChallengeWord {
  return { categoryId: 'animaux', letter: 'C', key, display: key, points, tier: 'courant', approximate: false, seconds: 3, at: 10 }
}

function player(playerId: string, playedAt: number | null, words: ChallengeWord[], me = false) {
  const entry: ChallengeEntry = {
    playerId,
    playedAt,
    score: words.reduce((sum, found) => sum + found.points, 0),
    skips: 0,
    bestCombo: 1,
    words,
  }
  return { ...entry, name: playerId, me }
}

function challenge(id: string, finished: boolean, players: ReturnType<typeof player>[]): SharedChallenge {
  return { id, name: null, ownerName: 'Clara', owned: false, createdAt: 0, finished, players: sharedPlayers(players, finished) }
}

describe('sharedPlayers', () => {
  it('ranks a closed challenge on settled scores, unique words raised', () => {
    const players = sharedPlayers(
      [player('me', 1, [word('chat', 100), word('chien', 50)], true), player('clara', 2, [word('chat', 100), word('cerf', 80)])],
      true,
    )
    expect(players.map(({ playerId, score, rank }) => [playerId, score, rank])).toEqual([
      ['me', 163, 2],
      ['clara', 200, 1],
    ])
  })

  it('keeps raw scores and no rank while the challenge runs', () => {
    const players = sharedPlayers([player('me', 1, [word('chat', 100)], true), player('clara', null, [])], false)
    expect(players.map(({ score, rank, played }) => [score, rank, played])).toEqual([
      [100, null, true],
      [0, null, false],
    ])
  })
})

describe('faceOff', () => {
  it('wins by finishing ahead of the friend, not first', () => {
    const shared = challenge('a', true, [
      player('bot', 1, [word('cerf', 500)]),
      player('me', 2, [word('chat', 200)], true),
      player('clara', 3, [word('chien', 100)]),
    ])
    expect(faceOff(shared, 'clara')).toBe('won')
    expect(faceOff(shared, 'bot')).toBe('lost')
  })

  it('calls a tie on equal settled scores', () => {
    const shared = challenge('a', true, [player('me', 1, [word('chat', 100)], true), player('clara', 2, [word('chien', 100)])])
    expect(faceOff(shared, 'clara')).toBe('tie')
  })

  it('counts nobody while open, or when one of the two did not play', () => {
    expect(faceOff(challenge('a', false, [player('me', 1, [], true), player('clara', 2, [])]), 'clara')).toBe('open')
    expect(faceOff(challenge('a', true, [player('me', 1, [word('chat', 10)], true), player('clara', null, [])]), 'clara')).toBe('void')
  })
})

describe('rivalry', () => {
  it('tallies the counted challenges and every shared one', () => {
    const history = [
      challenge('a', true, [player('me', 1, [word('chat', 200)], true), player('clara', 2, [word('chien', 100)])]),
      challenge('b', true, [player('me', 1, [word('chat', 50)], true), player('clara', 2, [word('chien', 90)])]),
      challenge('c', false, [player('me', 1, [word('chat', 70)], true), player('clara', null, [])]),
    ]
    expect(rivalry(history, 'clara')).toEqual({ challenges: 3, won: 1, tied: 0, lost: 1, mine: 313, theirs: 238 })
  })
})
