import { describe, expect, it } from 'vitest'
import type { ChallengeSummary } from '../lib/cloud'
import { challengeNotice, challengeStatus } from './challenges'

function summary(id: string, extra: Partial<ChallengeSummary> = {}): ChallengeSummary {
  return {
    id,
    ownerName: 'Ana',
    owned: false,
    lang: 'fr',
    categoryIds: ['animaux'],
    createdAt: 0,
    players: 3,
    played: 1,
    mePlayed: false,
    myScore: null,
    finished: false,
    expiresAt: 0,
    seenInvite: false,
    seenRecap: false,
    nextId: null,
    ...extra,
  }
}

describe('challengeNotice', () => {
  it('raises a fresh invitation before a recap, and skips what was put off', () => {
    const recap = summary('done', { finished: true, mePlayed: true })
    const invite = summary('new')

    expect(challengeNotice([recap, invite], [])).toEqual({ challenge: invite, kind: 'invite' })
    expect(challengeNotice([recap, invite], ['new'])).toEqual({ challenge: recap, kind: 'recap' })
  })

  it('stays quiet about seen invitations, missed challenges and recaps already read', () => {
    expect(
      challengeNotice(
        [
          summary('seen', { seenInvite: true }),
          summary('missed', { finished: true }),
          summary('read', { finished: true, mePlayed: true, seenRecap: true }),
        ],
        [],
      ),
    ).toBeNull()
    expect(challengeStatus(summary('missed', { finished: true }))).toBe('missed')
  })
})
