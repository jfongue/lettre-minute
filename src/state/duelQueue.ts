import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { answerDuelOffer, duelQueuePoll, leaveDuelQueue, type DuelOpponent, type DuelQueueAnswer, type DuelRatingInfo } from '../lib/cloud'
import { duelPool } from './duelPool'

/**
 * La file du duel classé, tenue au niveau de l'app : elle continue pendant la
 * table des joueurs ordinateur et à l'accueil, se met en veille pendant une
 * partie seule (`busy`), et ne s'arrête que sur « Annuler », un adversaire
 * accepté, ou une proposition laissée passer.
 *
 * Les heures sont celles de l'appareil, en secondes : chaque réponse du
 * serveur y est ramenée par l'écart entre son horloge et la nôtre, pour que le
 * décompte d'une proposition tombe à zéro au même instant des deux côtés.
 */

export type WaitingInfo = Extract<DuelQueueAnswer, { status: 'waiting' }>

export interface FoundOffer {
  table: string
  ranked: boolean
  accepted: boolean
  me: DuelRatingInfo
  opponent: DuelOpponent | null
}

export type QueueState =
  | { kind: 'idle'; notice: 'missed' | null }
  | {
      kind: 'searching'
      /** L'heure locale d'entrée dans la file : le chrono de l'attente part d'elle. */
      since: number
      info: WaitingInfo | null
      offline: boolean
      /** Un adversaire proposé n'a pas confirmé : on le dit, et on continue. */
      bounced: boolean
    }
  | { kind: 'found'; since: number; offer: FoundOffer; deadline: number; sending: boolean }
  | { kind: 'matched'; table: string }
  | { kind: 'cooldown'; until: number }

export type QueueEvent =
  | { type: 'start'; at: number }
  | { type: 'answer'; answer: DuelQueueAnswer | null; at: number }
  | { type: 'sending' }
  | { type: 'cancel' }
  | { type: 'dismiss' }

export const IDLE: QueueState = { kind: 'idle', notice: null }

export function queueStep(state: QueueState, event: QueueEvent): QueueState {
  switch (event.type) {
    case 'start':
      if (state.kind === 'searching' || state.kind === 'found') return state
      return { kind: 'searching', since: event.at, info: null, offline: false, bounced: false }
    case 'cancel':
      return IDLE
    case 'dismiss':
      return state.kind === 'idle' ? IDLE : state.kind === 'searching' ? { ...state, bounced: false } : state
    case 'sending':
      return state.kind === 'found' ? { ...state, sending: true } : state
    case 'answer':
      return onAnswer(state, event.answer, event.at)
  }
}

function onAnswer(state: QueueState, answer: DuelQueueAnswer | null, at: number): QueueState {
  // Une réponse arrivée après « Annuler » ou un appariement ne rouvre rien.
  if (state.kind !== 'searching' && state.kind !== 'found') return state
  if (!answer) return state.kind === 'searching' ? { ...state, offline: true } : { ...state, sending: false }
  const since = state.since
  switch (answer.status) {
    case 'waiting': {
      const joined = answer.joined === null ? since : at - (answer.now - answer.joined)
      return { kind: 'searching', since: Math.min(since, joined), info: answer, offline: false, bounced: state.kind === 'found' || (state.kind === 'searching' && state.bounced) }
    }
    case 'found':
      return {
        kind: 'found',
        since,
        offer: { table: answer.table, ranked: answer.ranked, accepted: answer.accepted, me: answer.me, opponent: answer.opponent },
        deadline: at + Math.max(0, answer.deadline - answer.now),
        sending: false,
      }
    case 'matched':
      return { kind: 'matched', table: answer.table }
    case 'missed':
      return { kind: 'idle', notice: 'missed' }
    case 'declined':
      return IDLE
    case 'gone':
      return state.kind === 'found' ? { kind: 'searching', since, info: null, offline: false, bounced: true } : state
    case 'cooldown':
      return { kind: 'cooldown', until: at + Math.max(0, answer.until - answer.now) }
  }
}

/** Le rythme des relectures : vite pendant une proposition, plus lentement en partie seule. */
export function pollEvery(state: QueueState, busy: boolean): number | null {
  if (state.kind === 'found') return 1000
  if (state.kind === 'searching') return busy ? 4000 : 2000
  return null
}

const wall = () => Date.now() / 1000

export interface DuelQueue {
  state: QueueState
  /** L'horloge locale, au battement de la seconde : de quoi lire l'attente et le décompte. */
  now: number
  start(): void
  cancel(): void
  accept(): void
  decline(): void
  dismiss(): void
  /** La table trouvée est ouverte : la file revient au repos, sans rien dire au serveur. */
  reset(): void
}

export interface DuelQueueOptions {
  lang: string
  /** Une partie seule en cours : la place se garde sans être appariée. */
  busy: boolean
  /** La planche debug passe des doublures : elle n'écrit jamais dans la file du serveur. */
  poll?: typeof duelQueuePoll
  answer?: typeof answerDuelOffer
  leave?: typeof leaveDuelQueue
}

export function useDuelQueue({ lang, busy, poll = duelQueuePoll, answer = answerDuelOffer, leave = leaveDuelQueue }: DuelQueueOptions): DuelQueue {
  const [state, dispatch] = useReducer(queueStep, IDLE)
  const [now, setNow] = useState(wall)
  const current = useRef(state)
  current.current = state
  const calls = useRef({ poll, answer, leave })
  calls.current = { poll, answer, leave }
  const active = state.kind === 'searching' || state.kind === 'found'

  const read = useCallback(async () => {
    const pool = duelPool(lang)
    if (pool.length === 0) return
    const reply = await calls.current.poll(lang, pool, pool.length, busy)
    dispatch({ type: 'answer', answer: reply, at: wall() })
  }, [busy, lang])

  // La relecture : à son rythme, tant que la file vit.
  const every = pollEvery(state, busy)
  useEffect(() => {
    if (every === null) return
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const loop = async () => {
      await read()
      if (live) timer = setTimeout(() => void loop(), every)
    }
    timer = setTimeout(() => void loop(), current.current.kind === 'searching' && !current.current.info ? 0 : every)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [every, read])

  useEffect(() => {
    if (!active && state.kind !== 'cooldown') return
    const timer = setInterval(() => setNow(wall()), 1000)
    setNow(wall())
    return () => clearInterval(timer)
  }, [active, state.kind])

  // La page s'en va pour de bon : la place se libère tout de suite.
  useEffect(() => {
    if (!active) return
    const gone = (event: PageTransitionEvent) => {
      if (!event.persisted) void calls.current.leave()
    }
    window.addEventListener('pagehide', gone)
    return () => window.removeEventListener('pagehide', gone)
  }, [active])

  const start = useCallback(() => dispatch({ type: 'start', at: wall() }), [])
  const cancel = useCallback(() => {
    if (current.current.kind === 'searching' || current.current.kind === 'found') void calls.current.leave()
    dispatch({ type: 'cancel' })
  }, [])
  const respond = useCallback((accept: boolean) => {
    if (current.current.kind !== 'found' || current.current.sending) return
    dispatch({ type: 'sending' })
    void calls.current.answer(accept).then((reply) => dispatch({ type: 'answer', answer: reply, at: wall() }))
  }, [])
  const accept = useCallback(() => respond(true), [respond])
  const decline = useCallback(() => respond(false), [respond])
  const dismiss = useCallback(() => dispatch({ type: 'dismiss' }), [])
  const reset = useCallback(() => dispatch({ type: 'cancel' }), [])

  return { state, now, start, cancel, accept, decline, dismiss, reset }
}
