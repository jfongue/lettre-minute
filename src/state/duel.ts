import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { availableCategoryIds, loadPacks } from '../data/packs'
import type { AvatarChoice } from '../domain/avatar'
import {
  botMove,
  botPick,
  createDuel,
  draftComplete,
  draftChoices,
  draftPlayer,
  duelPrompt,
  duelTimeout,
  inspectFor,
  openDuel,
  passTurn,
  pickCategory,
  playWord,
  DUEL_PASS_PENALTY_SECONDS,
  type BotProfile,
  type Duel,
} from '../domain/duel'
import { playableCategoryIds } from '../domain/perks'
import type { RarityTier } from '../domain/rarity'
import type { Judge, Verdict } from '../domain/run'
import { ownedCategoryIds } from '../domain/unlocks'
import { createJudge } from './judge'
import { loadAccount, loadAvatar, loadProfile } from './storage'

/**
 * Le duel joué contre les joueurs maison, sans serveur : la table, la montre et
 * les robots vivent ici. Le domaine ne connaît ni horloge ni identité — tout ce
 * qui est temps, nom ou avatar vient de ce fichier, ce qui laisse les règles
 * rejouables et testables. Une table en ligne remplacera cette boucle par une
 * lecture du serveur, sans toucher au domaine.
 */

export interface HouseBot extends BotProfile {
  name: string
  avatar: AvatarChoice
  /** Le trait du joueur, affiché dans le salon : le texte vient de l'i18n. */
  trait: 'fast' | 'steady' | 'sharp'
}

const avatarOf = (design: number, ground: string, shape: string, accent: string): AvatarChoice => ({ design, ground, shape, accent })

/** Les trois joueurs maison, ceux qui jouent déjà les défis (0024). */
export const HOUSE_BOTS: readonly HouseBot[] = [
  { id: 'maxitoon', name: 'Maxitoon', avatar: avatarOf(47, 'vert', 'creme', 'rose'), trait: 'fast', think: [1.6, 4.2], answerChance: 0.72 },
  { id: 'terretciel', name: 'Terretciel', avatar: avatarOf(12, 'rouge', 'jaune', 'bleu'), trait: 'steady', think: [2.6, 7], answerChance: 0.8 },
  { id: 'demontoon', name: 'Demontoon', avatar: avatarOf(73, 'bleu', 'creme', 'jaune'), trait: 'sharp', think: [1.2, 5], answerChance: 0.88 },
]

export const MIN_TABLE = 2
export const MAX_TABLE = 4

export type TablePhase = 'setup' | 'lobby' | 'countdown' | 'draft' | 'loading' | 'play' | 'over'

/** Ce qui vient de se passer : l'écran l'anime une fois, sur `id`. */
export interface DuelEvent {
  id: number
  kind: 'ready' | 'picked' | 'solved' | 'failed' | 'dead' | 'over'
  player: number
  word?: string
  tier?: RarityTier
  points?: number
  /** La catégorie choisie ou le couple échoué. */
  prompt?: { categoryId: string; letter: string }
}

export interface Seat {
  id: string
  name: string
  avatar: AvatarChoice
  bot: boolean
  trait?: HouseBot['trait']
  /** Combien de catégories il possède : le plus petit catalogue ouvre le draft. */
  owned: number
}

export interface DuelTable {
  phase: TablePhase
  at: number
  seats: readonly Seat[]
  invited: readonly string[]
  toggleInvite(id: string): void
  open(): void
  ready: Readonly<Record<string, boolean>>
  markReady(): void
  duel: Duel | null
  judge: Judge | null
  /** L'instant où le compte à rebours s'achève : l'écran l'affiche en secondes. */
  countdownEndsAt: number
  pool: readonly string[]
  prompt: { categoryId: string; letter: string } | null
  myIndex: number
  myTurn: boolean
  myPickTurn: boolean
  /** Le tour en cours est-il tenu par un autre que moi ? */
  watching: boolean
  event: DuelEvent | null
  error: boolean
  inspect(raw: string): Verdict
  pick(categoryId: string): void
  play(raw: string): void
  pass(): void
  rematch(): void
  leave(): void
}

/** Le temps que met chaque siège à se déclarer prêt, l'un après l'autre. */
const READY_GAP = 0.55
const COUNTDOWN_SECONDS = 3
const BOT_PICK_GAP = 1.15

/** Quand chaque siège se déclare prêt : moi tout de suite, les autres à la file. */
function readyMarks(seats: readonly Seat[], me: number, at: number): number[] {
  return seats.map((_, index) => at + (index === me ? 0 : READY_GAP * index))
}

export function useDuelTable(lang: string): DuelTable {
  const [phase, setPhase] = useState<TablePhase>('setup')
  const [invited, setInvited] = useState<readonly string[]>([HOUSE_BOTS[0]!.id])
  const [ready, setReady] = useState<Readonly<Record<string, boolean>>>({})
  const [duel, setDuel] = useState<Duel | null>(null)
  const [judge, setJudge] = useState<Judge | null>(null)
  const [event, setEvent] = useState<DuelEvent | null>(null)
  const [failed, setFailed] = useState(false)
  const [at, setAt] = useState(0)
  const [seed, setSeed] = useState(1)

  const zero = useRef(0)
  const marks = useRef<number[]>([])
  const actAt = useRef(0)
  const flash = useRef(0)
  const [until, setUntil] = useState(0)
  const now = useCallback(() => (performance.now() - zero.current) / 1000, [])

  const profile = useMemo(() => loadProfile(), [])
  const account = useMemo(() => loadAccount(), [])
  const shipped = useMemo(() => availableCategoryIds(lang), [lang])
  const mine = useMemo(() => playableCategoryIds(profile, ownedCategoryIds(profile)).filter((id) => shipped.includes(id)), [profile, shipped])

  const seats: readonly Seat[] = useMemo(() => {
    const me: Seat = { id: 'me', name: account?.name?.trim() || '', avatar: account?.avatar ?? loadAvatar(), bot: false, owned: mine.length }
    const bots = HOUSE_BOTS.filter((bot) => invited.includes(bot.id)).map<Seat>((bot) => ({
      id: bot.id,
      name: bot.name,
      avatar: bot.avatar,
      bot: true,
      trait: bot.trait,
      owned: shipped.length,
    }))
    return [me, ...bots]
  }, [account, invited, mine.length, shipped.length])
  const myIndex = 0

  const botOf = useCallback((id: string) => HOUSE_BOTS.find((bot) => bot.id === id) ?? null, [])
  /** Le raccourci de développement, `#auto` : la table joue seule, pour regarder. */
  const auto = useMemo(() => typeof location !== 'undefined' && /auto/.test(location.hash), [])

  const push = useCallback((next: Omit<DuelEvent, 'id'>) => {
    flash.current += 1
    setEvent({ ...next, id: flash.current })
  }, [])

  const toggleInvite = useCallback((id: string) => {
    setInvited((current) => {
      if (current.includes(id)) return current.length > MIN_TABLE - 1 ? current.filter((one) => one !== id) : current
      return current.length >= MAX_TABLE - 1 ? current : [...current, id]
    })
  }, [])

  const open = useCallback(() => {
    zero.current = performance.now()
    marks.current = []
    setUntil(0)
    setReady({})
    setFailed(false)
    setDuel(null)
    setJudge(null)
    setEvent(null)
    setSeed(Date.now() >>> 0)
    setAt(0)
    setPhase('lobby')
  }, [])

  const markReady = useCallback(() => {
    marks.current = readyMarks(seats, myIndex, now())
    setUntil(0)
    setReady({ me: true })
    push({ kind: 'ready', player: myIndex })
  }, [myIndex, now, push, seats])

  const leave = useCallback(() => {
    setPhase('setup')
    setDuel(null)
    setJudge(null)
    setEvent(null)
    setReady({})
    setFailed(false)
  }, [])

  const rematch = useCallback(() => {
    zero.current = performance.now()
    marks.current = readyMarks(seats, myIndex, now())
    setUntil(0)
    setDuel(null)
    setJudge(null)
    setReady({ me: true })
    setFailed(false)
    setSeed(Date.now() >>> 0)
    setAt(0)
    setPhase('lobby')
  }, [now, seats])

  // La montre : un battement de 100 ms, la finesse de ce que la réserve affiche.
  useEffect(() => {
    if (phase === 'setup' || phase === 'loading' || phase === 'over') return
    const beat = () => setAt((current) => {
      const next = now()
      return Math.abs(next - current) < 0.05 ? current : next
    })
    beat()
    const timer = setInterval(beat, 100)
    return () => clearInterval(timer)
  }, [now, phase])

  // Le salon : les robots se déclarent prêts l'un après l'autre, puis le
  // compte à rebours part quand toute la table l'est.
  useEffect(() => {
    if (phase !== 'lobby') return
    const late = seats.filter((seat, index) => index > myIndex && at >= (marks.current[index] ?? Infinity) && !ready[seat.id])
    if (late.length > 0) {
      setReady((current) => {
        const next = { ...current }
        for (const seat of late) next[seat.id] = true
        return next
      })
      push({ kind: 'ready', player: seats.findIndex((seat) => seat.id === late[0]!.id) })
      return
    }
    if (seats.length > 0 && seats.every((seat) => ready[seat.id])) {
      setUntil(at + COUNTDOWN_SECONDS)
      setPhase('countdown')
    }
  }, [at, myIndex, phase, push, ready, seats])

  // Le compte à rebours, puis le draft : la table est complète, l'ordre des
  // choix va du plus petit catalogue au plus grand.
  useEffect(() => {
    if (phase !== 'countdown' || at < until) return
    const order = seats.map((_, index) => index).sort((a, b) => (seats[a]?.owned ?? 0) - (seats[b]?.owned ?? 0))
    setDuel(createDuel({ seed, playerIds: seats.map((seat) => seat.id), categories: mine, order }))
    actAt.current = 0
    setPhase('draft')
  }, [at, mine, phase, seats, seed])

  // Le draft : les robots choisissent l'un après l'autre, en montrant lequel.
  useEffect(() => {
    if (phase !== 'draft' || !duel || draftComplete(duel)) return
    const actor = draftPlayer(duel)
    const bot = botOf(seats[actor]?.id ?? '')
    if (!bot || at < actAt.current) return
    const picked = botPick(duel, bot)
    if (!picked) return
    actAt.current = at + BOT_PICK_GAP
    setDuel(pickCategory(duel, picked))
    push({ kind: 'picked', player: actor, prompt: { categoryId: picked, letter: '' } })
  }, [at, botOf, duel, phase, push, seats])

  // Les dictionnaires du pool : cinq au plus, ceux-là seulement. Le
  // déclenchement ne dépend que du pool — surtout pas de la phase, qu'il
  // change lui-même : un effet qui s'annule en changeant d'état ne charge rien.
  const poolKey = duel && draftComplete(duel) ? duel.picks.join(',') : ''
  const loadingFor = useRef('')
  useEffect(() => {
    if (!poolKey || loadingFor.current === poolKey) return
    loadingFor.current = poolKey
    let live = true
    setPhase('loading')
    loadPacks(lang, poolKey.split(','))
      .then((packs) => {
        if (!live) return
        const built = createJudge(packs, { own: {}, crowd: {} })
        setJudge(built)
        setDuel((current) => (current ? openDuel(current, built, now()) : current))
        setPhase('play')
      })
      .catch(() => {
        if (!live) return
        loadingFor.current = ''
        setFailed(true)
        setPhase('draft')
      })
    return () => {
      live = false
    }
  }, [lang, now, poolKey])

  // La partie : la mort sur le temps d'abord, puis le coup du robot dont c'est
  // le tour. Le temps ne s'arrête pas parce que l'onglet est en arrière-plan.
  useEffect(() => {
    if (phase !== 'play' || !duel || !judge) return
    let next = duelTimeout(duel, judge, at)
    if (next.deaths.length > duel.deaths.length && duel.turn) {
      push({ kind: 'dead', player: duel.turn.player })
    }

    const turn = next.turn
    if (turn && turn.startedAt + 0.05 <= at) {
      const bot = botOf(seats[turn.player]?.id ?? '')
      if (bot) {
        const move = botMove(next, judge, bot)
        if (move && at >= turn.startedAt + move.after) {
          const played = move.word ? playWord(next, move.word, judge, at) : { duel: next, verdict: { kind: 'empty' as const, found: null } }
          if (played.verdict.kind === 'accepted' && played.verdict.found) {
            push({
              kind: 'solved',
              player: turn.player,
              word: played.verdict.found.display,
              tier: played.verdict.found.tier,
              points: played.verdict.found.points,
            })
            next = played.duel
          } else {
            const failed = next.turn!.prompt
            next = passTurn(next, judge, at)
            if (next.dealt.length > played.duel.dealt.length) push({ kind: 'failed', player: turn.player, prompt: failed })
          }
        }
      }
    }

    if (next !== duel) {
      if (next.phase === 'over' && duel.phase !== 'over') push({ kind: 'over', player: next.deaths[next.deaths.length - 1] ?? 0 })
      setDuel(next)
      setPhase(next.phase === 'over' ? 'over' : 'play')
    }
  }, [at, botOf, duel, judge, phase, push, seats])

  const pick = useCallback(
    (categoryId: string) => {
      if (!duel || phase !== 'draft' || draftPlayer(duel) !== myIndex) return
      if (!duel.categories.includes(categoryId) || duel.picks.includes(categoryId)) return
      setDuel(pickCategory(duel, categoryId))
      push({ kind: 'picked', player: myIndex, prompt: { categoryId, letter: '' } })
    },
    [duel, myIndex, phase, push],
  )

  const inspect = useCallback(
    (raw: string): Verdict => (duel && judge ? inspectFor(duel, myIndex, raw, judge) : { kind: 'empty', found: null }),
    [duel, judge, myIndex],
  )

  const play = useCallback(
    (raw: string) => {
      if (!duel || !judge || phase !== 'play' || duel.turn?.player !== myIndex) return
      const played = playWord(duel, raw, judge, now())
      if (played.verdict.kind === 'accepted' && played.verdict.found) {
        push({
          kind: 'solved',
          player: myIndex,
          word: played.verdict.found.display,
          tier: played.verdict.found.tier,
          points: played.verdict.found.points,
        })
      }
      setDuel(played.duel)
      setPhase(played.duel.phase === 'over' ? 'over' : 'play')
    },
    [duel, judge, myIndex, now, phase, push],
  )

  const pass = useCallback(() => {
    if (!duel || !judge || phase !== 'play' || duel.turn?.player !== myIndex) return
    const couple = duel.turn.prompt
    const next = passTurn(duel, judge, now())
    if (next.phase === 'over') push({ kind: 'dead', player: myIndex })
    else if (next.dealt.length > duel.dealt.length) push({ kind: 'failed', player: myIndex, prompt: couple })
    setDuel(next)
    setPhase(next.phase === 'over' ? 'over' : 'play')
  }, [duel, judge, myIndex, now, phase, push])

  // Le raccourci `#auto` joue la table sans moi : la table s'ouvre avec les
  // trois joueurs maison, je me déclare prêt, je choisis et je valide comme un
  // robot. De quoi regarder chaque écran sans jouer trois minutes.
  useEffect(() => {
    if (!auto) return
    if (phase === 'setup') {
      setInvited(HOUSE_BOTS.map((bot) => bot.id))
      open()
      return
    }
    if (phase === 'lobby' && !ready.me) {
      markReady()
      return
    }
    if (phase === 'draft' && duel && draftPlayer(duel) === myIndex) {
      const choice = draftChoices(duel)[0]
      if (choice) setDuel(pickCategory(duel, choice))
      return
    }
    if (phase === 'play' && duel && judge && duel.turn?.player === myIndex && at >= duel.turn.startedAt + 1.4) {
      const turn = duel.turn
      const word = judge.common?.(turn.prompt.categoryId, turn.prompt.letter, duel.players[myIndex]?.used ?? [])
      if (word) play(word)
      else pass()
    }
  }, [at, auto, duel, judge, markReady, myIndex, open, pass, phase, play, ready.me])

  const myTurn = phase === 'play' && duel?.turn?.player === myIndex
  const watching = phase === 'play' && !!duel?.turn && duel.turn.player !== myIndex

  return {
    phase,
    at,
    seats,
    invited,
    toggleInvite,
    open,
    ready,
    markReady,
    duel,
    judge,
    countdownEndsAt: until,
    pool: mine,
    prompt: duel ? duelPrompt(duel) : null,
    myIndex,
    myTurn,
    myPickTurn: phase === 'draft' && !!duel && draftPlayer(duel) === myIndex,
    watching,
    event,
    error: failed,
    inspect,
    pick,
    play,
    pass,
    rematch,
    leave,
  }
}

export { DUEL_PASS_PENALTY_SECONDS }
