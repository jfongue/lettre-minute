import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NEW_PROFILE } from '../domain/progression'
import type { Run } from '../domain/run'

/**
 * `cloud.ts` promises the game never sees a server fail: every export answers
 * with a fallback. It is held to that against a client that misbehaves in each
 * way a network and a half-migrated project can — throwing, rejecting,
 * answering errors, or answering rows of the wrong shape.
 */
type Mode = 'throw' | 'reject' | 'error' | 'garbage'
const mode = vi.hoisted(() => ({ current: 'throw' as Mode }))

vi.mock('./supabase', () => {
  const answer = () => {
    switch (mode.current) {
      case 'error':
        return { data: null, error: { message: 'boom', code: 'XX000' } }
      case 'garbage':
        return { data: { session: { user: { id: 7, is_anonymous: 'sure' } }, id: null, length: -1 }, error: null }
      default:
        return null
    }
  }
  // Every property is a call, every call chains, and awaiting any link
  // answers per mode — the whole query builder and auth API at once.
  const hostile: object = new Proxy(function () {}, {
    get(_, property) {
      if (mode.current === 'throw' && property !== 'then') throw new Error('offline')
      if (property === 'then') {
        if (mode.current === 'throw' || mode.current === 'reject') {
          return (_resolve: unknown, reject: (error: Error) => void) => reject(new Error('offline'))
        }
        return (resolve: (value: unknown) => void) => resolve(answer())
      }
      return hostile
    },
    apply: () => hostile,
  })
  return {
    supabase: hostile,
    connect: () => Promise.resolve({ userId: 'player-1' }),
    forgetSession: () => {},
    cloudConfigured: () => true,
  }
})

const cloud = await import('./cloud')

const RUN = {
  seed: 1,
  score: 10,
  bestCombo: 2,
  skips: 0,
  found: [{ word: 'chat', prompt: { categoryId: 'animaux', letter: 'C' }, points: 10 }],
} as unknown as Run

/** Arguments per export; anything not listed is called with a language. */
const ARGS: Record<string, unknown[]> = {
  pushRun: [RUN, NEW_PROFILE, 'de'],
  pushSubmissions: [[{ word: 'dahu', categoryId: 'animaux', at: 1, lang: 'fr' }]],
  castVote: ['review-1', 'correct'],
  answerModeratorOffer: ['level', true],
  inviteModerator: ['ami'],
  cancelSubmission: ['sub-1'],
  correctSubmission: [{ id: 'sub-1', word: 'dahu', display: 'Dahu', categoryId: 'animaux' }, 'Dahut'],
  requestFriend: ['ami'],
  respondFriend: ['ami', true],
  removeFriend: ['ami'],
  register: ['Joueur', 'joueur@example.com', 'secret-password'],
  logIn: ['joueur@example.com', 'secret-password'],
  pushAvatar: [{ design: 0, ground: 'a', shape: 'b', accent: 'c' }],
  fetchChallenge: ['c-1'],
  createChallenge: ['fr', 1, ['pays'], ['ami']],
  inviteToChallenge: ['c-1', ['ami']],
  pushChallengeRun: ['c-1', RUN, NEW_PROFILE],
  markChallengeSeen: ['c-1', 'recap'],
  rematchChallenge: ['c-1', 2, ['pays']],
  savePushToken: ['token', 'fr'],
  forgetPushToken: ['token'],
}

type AnyCall = (...args: unknown[]) => unknown
const exported: [string, AnyCall][] = Object.entries(cloud as Record<string, unknown>).flatMap(([name, value]) =>
  typeof value === 'function' ? [[name, value as AnyCall] as [string, AnyCall]] : [],
)

describe('cloud without a working server', () => {
  beforeEach(() => {
    mode.current = 'throw'
  })

  it('exposes calls to hold to the promise', () => {
    expect(exported.length).toBeGreaterThan(25)
  })

  for (const current of ['throw', 'reject', 'error', 'garbage'] as const) {
    it(`answers every call with a value when the client ${current === 'garbage' ? 'returns garbage' : current + 's'}`, async () => {
      mode.current = current
      for (const [name, call] of exported) {
        const outcome = await Promise.resolve()
          .then((): unknown => call(...(ARGS[name] ?? ['fr'])))
          .then(
            () => 'answered',
            (error: unknown) => `threw ${String(error)}`,
          )
        expect(outcome, `${name} (${current})`).toBe('answered')
      }
    })
  }

  it('refuses bad credentials before reaching the server', async () => {
    expect(await cloud.register(' a ', 'joueur@example.com', 'secret-password')).toEqual({ ok: false, error: 'name-length' })
    expect(await cloud.register('Anonyme', 'joueur@example.com', 'secret-password')).toEqual({ ok: false, error: 'name-reserved' })
    expect(await cloud.register('Joueur', 'pas-un-mail', 'secret-password')).toEqual({ ok: false, error: 'invalid-email' })
    expect(await cloud.logIn('joueur@example.com', '12345')).toEqual({ ok: false, error: 'short-password' })
  })

  it('reports an unreachable server as such when signing up or in', async () => {
    mode.current = 'reject'
    expect(await cloud.register('Joueur', 'joueur@example.com', 'secret-password')).toEqual({ ok: false, error: 'unreachable' })
    expect(await cloud.logIn('joueur@example.com', 'secret-password')).toEqual({ ok: false, error: 'unreachable' })
  })

  it('keeps an unsent proposal queued rather than claiming it went through', async () => {
    mode.current = 'error'
    expect(await cloud.pushSubmissions([{ word: 'dahu', categoryId: 'animaux', at: 1, lang: 'fr' }])).toEqual([])
    expect(await cloud.pushRun(RUN, NEW_PROFILE, 'fr')).toBe(false)
  })
})
