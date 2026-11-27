import { describe, expect, it } from 'vitest'
import { parseQueueAnswer, type DuelQueueAnswer } from '../lib/cloud'
import { IDLE, pollEvery, queueStep, type QueueState } from './duelQueue'

const me = { rating: 1000, games: 3, wins: 1, peak: 1010, rank: null, masterRank: null }
const waiting = (over: Partial<Extract<DuelQueueAnswer, { status: 'waiting' }>> = {}): DuelQueueAnswer => ({
  status: 'waiting',
  now: 5000,
  joined: 4990,
  estimate: 30,
  searching: 2,
  playing: 4,
  publicTable: null,
  me,
  ...over,
})
const found: DuelQueueAnswer = {
  status: 'found',
  table: 't1',
  ranked: true,
  deadline: 5020,
  now: 5000,
  accepted: false,
  me,
  opponent: { player: 'p2', name: 'Ondine', avatar: { design: 0, ground: 0, ink: 0 } as never, accepted: false, rating: 1080, games: 12, wins: 7, peak: 1100, rank: 40, masterRank: null },
}

function run(events: Parameters<typeof queueStep>[1][], from: QueueState = IDLE): QueueState {
  return events.reduce(queueStep, from)
}

describe('la file', () => {
  it('part du joueur, et date l’attente selon le serveur', () => {
    const state = run([{ type: 'start', at: 100 }, { type: 'answer', answer: waiting(), at: 103 }])
    expect(state).toMatchObject({ kind: 'searching', offline: false, bounced: false })
    // Le serveur dit dix secondes d'attente : le chrono local recule d'autant.
    expect(state.kind === 'searching' && state.since).toBe(93)
  })

  it('ramène le décompte d’une proposition à l’horloge de l’appareil', () => {
    const state = run([{ type: 'start', at: 100 }, { type: 'answer', answer: found, at: 200 }])
    expect(state).toMatchObject({ kind: 'found', deadline: 220, offer: { table: 't1', ranked: true } })
  })

  it('reprend la recherche, et le dit, quand l’adversaire proposé n’a pas confirmé', () => {
    const state = run([{ type: 'start', at: 100 }, { type: 'answer', answer: found, at: 101 }, { type: 'answer', answer: waiting(), at: 125 }])
    expect(state).toMatchObject({ kind: 'searching', bounced: true })
    expect(run([{ type: 'dismiss' }], state)).toMatchObject({ kind: 'searching', bounced: false })
  })

  it('ouvre la table une fois les deux d’accord', () => {
    expect(run([{ type: 'start', at: 1 }, { type: 'answer', answer: { status: 'matched', table: 't1' }, at: 2 }])).toEqual({ kind: 'matched', table: 't1' })
  })

  it('sort de la file sur une proposition laissée passer, et le dit', () => {
    expect(run([{ type: 'start', at: 1 }, { type: 'answer', answer: found, at: 2 }, { type: 'answer', answer: { status: 'missed' }, at: 30 }])).toEqual({ kind: 'idle', notice: 'missed' })
  })

  it('n’écoute plus une réponse arrivée après « Annuler »', () => {
    const state = run([{ type: 'start', at: 1 }, { type: 'cancel' }, { type: 'answer', answer: found, at: 2 }])
    expect(state).toBe(IDLE)
  })

  it('garde la proposition quand le serveur se tait, et le dit pendant la recherche', () => {
    const offered = run([{ type: 'start', at: 1 }, { type: 'answer', answer: found, at: 2 }, { type: 'sending' }])
    expect(run([{ type: 'answer', answer: null, at: 3 }], offered)).toMatchObject({ kind: 'found', sending: false })
    expect(run([{ type: 'start', at: 1 }, { type: 'answer', answer: null, at: 2 }])).toMatchObject({ kind: 'searching', offline: true })
  })

  it('met en pause après trop d’abandons, à l’heure de l’appareil', () => {
    expect(run([{ type: 'start', at: 50 }, { type: 'answer', answer: { status: 'cooldown', until: 400, now: 100 }, at: 60 }])).toEqual({ kind: 'cooldown', until: 360 })
  })

  it('relit vite pendant une proposition, lentement en partie seule', () => {
    expect(pollEvery(IDLE, false)).toBeNull()
    const searching = run([{ type: 'start', at: 1 }])
    expect(pollEvery(searching, false)).toBe(2000)
    expect(pollEvery(searching, true)).toBe(4000)
    expect(pollEvery(run([{ type: 'answer', answer: found, at: 2 }], searching), false)).toBe(1000)
  })
})

describe('la réponse du serveur', () => {
  it('lit une attente, une proposition et ce qu’elle ignore', () => {
    expect(parseQueueAnswer({ status: 'waiting', now: 10, joined: 4, estimate: null, searching: 1, playing: 0, publicTable: { id: 'x', seats: 2 }, me: { rating: 1040, games: 2 } })).toMatchObject({
      status: 'waiting',
      estimate: null,
      publicTable: { id: 'x', seats: 2 },
      me: { rating: 1040, games: 2, rank: null },
    })
    expect(parseQueueAnswer({ status: 'found', table: 't', ranked: true, deadline: 30, now: 10, accepted: false, me: {}, opponent: { player: 'p', name: 'Ondine', rating: 990, games: 3, accepted: true } })).toMatchObject({
      status: 'found',
      opponent: { name: 'Ondine', rating: 990, accepted: true },
    })
    expect(parseQueueAnswer({ status: 'whatever' })).toBeNull()
    expect(parseQueueAnswer(null)).toBeNull()
  })
})
