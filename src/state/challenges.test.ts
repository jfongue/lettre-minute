import { describe, expect, it } from 'vitest'
import type { ChallengeSummary } from '../lib/cloud'
import { challengeNotice, challengeStatus, hideChallenge, isHidden, loadHiddenChallenges, settledPushTags } from './challenges'

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
    name: null,
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

describe('settledPushTags', () => {
  it('clears an invitation once played or closed, and a recap once read', () => {
    expect(
      settledPushTags([
        summary('open'),
        summary('played', { mePlayed: true }),
        summary('missed', { finished: true }),
        summary('unread', { finished: true, mePlayed: true }),
        summary('read', { finished: true, mePlayed: true, seenRecap: true }),
      ]),
    ).toEqual(['invite:played', 'invite:missed', 'invite:unread', 'invite:read', 'recap:read'])
  })
})

describe('hidden challenges', () => {
  it('stay hidden until something changes, then show again', () => {
    const store = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value) },
      configurable: true,
    })
    const over = summary('over', { finished: true, mePlayed: true, played: 3 })
    const hidden = hideChallenge(loadHiddenChallenges(), over)
    expect(isHidden(loadHiddenChallenges(), over)).toBe(true)
    expect(isHidden(hidden, summary('other'))).toBe(false)
    expect(isHidden(hidden, { ...over, nextId: 'rematch' })).toBe(false)
    Reflect.deleteProperty(globalThis, 'localStorage')
  })
})
