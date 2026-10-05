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
  forcedPick,
  inspectFor,
  onlyChoice,
  openDuel,
  passTurn,
  pickCategory,
  playWord,
  resume,
  DUEL_PASS_PENALTY_SECONDS,
  DUEL_PICK_SECONDS,
  DUEL_TIME_BONUS,
  type BotProfile,
  type Duel,
} from '../domain/duel'
import { createRng } from '../domain/rng'
import { playableCategoryIds } from '../domain/perks'
import type { RarityTier } from '../domain/rarity'
import type { Judge, Prompt, Verdict } from '../domain/run'
import { ownedCategoryIds } from '../domain/unlocks'
import { setMusic, sound } from '../lib/sound'
import { createJudge } from './judge'
import { loadAccount, loadAvatar, loadProfile } from './storage'

/**
 * Le duel joué contre les joueurs maison, sans serveur : la table, la montre et
 * les robots vivent ici. Le domaine ne connaît ni horloge ni identité — tout ce
 * qui est temps, nom ou avatar vient de ce fichier, ce qui laisse les règles
 * rejouables et testables. Une table en ligne remplacera cette boucle par une
 * lecture du serveur, sans toucher au domaine.
 *
 * Le déroulé : le salon, où l'on invite et se déclare prêt sur le même écran ;
 * l'annonce du draft ; le draft — dix secondes par choix, le sort tranche
 * après, et un choix qui ne laisse qu'une catégorie se prend d'office ; le
 * tirage de l'ouvreur et son compte à rebours ; la partie, et le bilan.
 */

export interface HouseBot extends BotProfile {
  name: string
  avatar: AvatarChoice
  /** Le trait du joueur, lu dans le salon : le texte vient de l'i18n. */
  trait: 'fast' | 'steady' | 'sharp'
}

const avatarOf = (design: number, ground: string, shape: string, accent: string): AvatarChoice => ({ design, ground, shape, accent })

/** Les trois joueurs maison, ceux qui jouent déjà les défis (0024). */
export const HOUSE_BOTS: readonly HouseBot[] = [
  { id: 'maxitoon', name: 'Maxitoon', avatar: avatarOf(47, 'vert', 'creme', 'rose'), trait: 'fast', think: [2.6, 6.5], answerChance: 0.72 },
  { id: 'terretciel', name: 'Terretciel', avatar: avatarOf(12, 'rouge', 'jaune', 'bleu'), trait: 'steady', think: [3.4, 9], answerChance: 0.8 },
  { id: 'demontoon', name: 'Demontoon', avatar: avatarOf(73, 'bleu', 'creme', 'jaune'), trait: 'sharp', think: [2.4, 7.5], answerChance: 0.88 },
]

export const MIN_TABLE = 2
export const MAX_TABLE = 4

export type TablePhase = 'lobby' | 'announcing' | 'draft' | 'opening' | 'play' | 'deaths' | 'over'

/** Un fait de la table : le fil l'affiche, l'écran l'anime et le fait sonner une fois, sur `id`. */
export interface DuelEvent {
  id: number
  kind: 'ready' | 'picked' | 'solved' | 'passed' | 'failed' | 'dead'
  player: number
  word?: string
  tier?: RarityTier
  /** Ce que le fait a changé à la réserve du joueur, en secondes. */
  delta?: number
  /** La catégorie choisie, ou le couple refusé par toute la table. */
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
  ready: Readonly<Record<string, boolean>>
  markReady(): void
  /** Je retire mon « prêt » : le salon redevient modifiable. */
  unready(): void
  duel: Duel | null
  judge: Judge | null
  pool: readonly string[]
  prompt: { categoryId: string; letter: string } | null
  /** À qui le tour de choisir une catégorie, et ce qu'il lui reste de temps. */
  picker: Seat | null
  pickLeft: number
  /** La catégorie que le choix en cours prend d'office : il n'en reste qu'une. */
  forced: string | null
  myIndex: number
  myTurn: boolean
  myPickTurn: boolean
  /** Le tour en cours est tenu par un autre que moi. */
  watching: boolean
  /** Le dernier fait de la table, et les trois derniers, le plus récent en tête. */
  event: DuelEvent | null
  feed: readonly DuelEvent[]
  error: boolean
  /** La mise en scène d'une mort : qui est tombé, et quand la table reprend. */
  fallen: number | null
  stagedAt: number
  /** La seconde montrée par le compte à rebours de reprise, 0 quand il n'a pas commencé. */
  resumeIn: number
  /** Le tirage de l'ouvreur : quand il a commencé, sur l'horloge de la table. */
  openingAt: number
  /** Une revanche est ouverte : la table se reforme autour des restants. */
  rematchOpen: boolean
  /** Les joueurs de la table précédente qui ont quitté la revanche. */
  leavers: readonly string[]
  openRematch(): void
  backToRecap(): void
  /** Retour à la table depuis le rapport, sans refermer la revanche. */
  joinRematch(): void
  inspect(raw: string): Verdict
  pick(categoryId: string): void
  play(raw: string): void
  pass(): void
  leave(): void
}

const READY_GAP = 0.6
const ANNOUNCE_SECONDS = 3.2
/** Une catégorie prise d'office reste un instant à l'écran : le joueur voit ce qui lui arrive. */
const FORCED_SECONDS = 1.1
/** Le draft fini reste à l'écran, le temps de lire ce que le sort a ajouté. */
const DRAFT_HOLD_SECONDS = 1.8
/** Le tirage de l'ouvreur, puis son nom posé, puis trois temps. */
export const OPENING_SPIN_SECONDS = 2.1
export const OPENING_LAND_SECONDS = 1.1
export const BEAT_SECONDS = 0.8
export const BEATS = 3
const OPENING_SECONDS = OPENING_SPIN_SECONDS + OPENING_LAND_SECONDS + BEATS * BEAT_SECONDS
/** La mise en scène d'une mort : le compteur s'arrête le temps de l'animation. */
const DEATH_STAGING_SECONDS = 2.3
/** La dernière mort laisse lire le nom du gagnant avant le bilan. */
const LAST_DEATH_SECONDS = 3.2
const RESTART_SECONDS = BEATS * BEAT_SECONDS
const FEED_SIZE = 3

/** Les joueurs qui quittent une revanche : jamais tous les robots, sinon il n'y a plus de duel. */
function leaversOf(seed: number, seats: readonly Seat[]): readonly string[] {
  const bots = seats.filter((seat) => seat.bot)
  const drawn = bots.filter((_, index) => createRng((seed ^ Math.imul(index + 1, 0x6c656176)) >>> 0).next() < 0.34).map((seat) => seat.id)
  return drawn.length >= bots.length ? drawn.slice(1) : drawn
}

/** Le temps qu'un robot prend pour choisir sa catégorie : jamais ses dix secondes entières. */
function pickBudget(bot: HouseBot | null): number {
  if (!bot) return DUEL_PICK_SECONDS
  const [least, most] = bot.think
  return Math.min(DUEL_PICK_SECONDS - 0.6, least + (most - least) * 0.55)
}

type Action = { kind: 'word'; player: number; word: string; tier: RarityTier } | { kind: 'pass'; player: number } | { kind: 'clock' }

/**
 * Ce qu'une action a fait à la table, lu dans l'écart entre avant et après :
 * le mot, le passe, le couple refusé de tous, la mort. Le même relevé sert aux
 * robots, à l'horloge et à mes gestes — c'est ce qui donne à chaque mort sa
 * mise en scène, qu'elle vienne d'un passe ou du temps.
 */
function factsOf(before: Duel, after: Duel, action: Action): Omit<DuelEvent, 'id'>[] {
  const facts: Omit<DuelEvent, 'id'>[] = []
  const died = after.deaths.slice(before.deaths.length)
  if (action.kind === 'word') {
    facts.push({ kind: 'solved', player: action.player, word: action.word, tier: action.tier, delta: DUEL_TIME_BONUS[action.tier] })
  } else if (action.kind === 'pass' && !died.includes(action.player)) {
    facts.push({ kind: 'passed', player: action.player, delta: -DUEL_PASS_PENALTY_SECONDS })
  }
  if (action.kind !== 'word' && after.dealt.length > before.dealt.length && before.turn) {
    facts.push({ kind: 'failed', player: before.turn.player, prompt: before.turn.prompt })
  }
  for (const player of died) facts.push({ kind: 'dead', player })
  return facts
}

export function useDuelTable(lang: string): DuelTable {
  const [phase, setPhase] = useState<TablePhase>('lobby')
  const [invited, setInvited] = useState<readonly string[]>([HOUSE_BOTS[0]!.id])
  const [ready, setReady] = useState<Readonly<Record<string, boolean>>>({})
  const [duel, setDuel] = useState<Duel | null>(null)
  const [judge, setJudge] = useState<Judge | null>(null)
  const [feed, setFeed] = useState<readonly DuelEvent[]>([])
  const [failed, setFailed] = useState(false)
  const [at, setAt] = useState(0)
  const [seed, setSeed] = useState(() => Date.now() >>> 0)
  const [pickEndsAt, setPickEndsAt] = useState(0)
  const [draftDoneAt, setDraftDoneAt] = useState(0)
  const [openingAt, setOpeningAt] = useState(0)
  const [fallen, setFallen] = useState<number | null>(null)
  const [stagedAt, setStagedAt] = useState(0)
  const [rematchOpen, setRematchOpen] = useState(false)
  const [leavers, setLeavers] = useState<readonly string[]>([])
  const [announceEndsAt, setAnnounceEndsAt] = useState(0)
  /** Le dernier couple à l'écran : la dernière mort retire le tour, pas l'écran. */
  const [lastPrompt, setLastPrompt] = useState<Prompt | null>(null)

  const zero = useRef(0)
  /** L'heure où chaque robot se déclare prêt, une fois qu'il a de quoi l'être. */
  const marks = useRef<Record<string, number>>({})
  const actAt = useRef(0)
  const lastPicker = useRef(-1)
  const flash = useRef(0)
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

  const record = useCallback((facts: readonly Omit<DuelEvent, 'id'>[]) => {
    if (facts.length === 0) return
    const stamped = facts.map((fact) => {
      flash.current += 1
      return { ...fact, id: flash.current }
    })
    setFeed((current) => [...[...stamped].reverse(), ...current].slice(0, FEED_SIZE))
  }, [])

  /**
   * Encaisse une action de la partie : le fil, puis la mise en scène d'une
   * mort s'il y en a une, sinon la suite. Toute mort passe par ici, la
   * dernière comprise : le compteur s'arrête, l'animation joue, puis la main
   * revient — ou le bilan arrive.
   */
  const commit = useCallback(
    (before: Duel, after: Duel, action: Action, clock: number) => {
      if (after === before) return
      record(factsOf(before, after, action))
      setDuel(after)
      const died = after.deaths.slice(before.deaths.length)
      if (died.length > 0) {
        setFallen(died[died.length - 1]!)
        setStagedAt(clock + (after.phase === 'over' ? LAST_DEATH_SECONDS : DEATH_STAGING_SECONDS))
        setPhase('deaths')
      } else setPhase(after.phase === 'over' ? 'over' : 'play')
    },
    [record],
  )

  const toggleInvite = useCallback(
    (id: string) => {
      if (ready.me || leavers.includes(id) || phase !== 'lobby') return
      setInvited((current) => {
        if (current.includes(id)) return current.length > MIN_TABLE - 1 ? current.filter((one) => one !== id) : current
        return current.length >= MAX_TABLE - 1 ? current : [...current, id]
      })
      delete marks.current[id]
      setReady((current) => {
        if (!current[id]) return current
        const next = { ...current }
        delete next[id]
        return next
      })
    },
    [leavers, phase, ready.me],
  )

  const reset = useCallback(() => {
    marks.current = {}
    actAt.current = 0
    lastPicker.current = -1
    setReady({})
    setFailed(false)
    setDuel(null)
    setJudge(null)
    setFeed([])
    setFallen(null)
    setStagedAt(0)
    setPickEndsAt(0)
    setDraftDoneAt(0)
    setOpeningAt(0)
    setAnnounceEndsAt(0)
    setLastPrompt(null)
  }, [])

  const markReady = useCallback(() => {
    setReady((current) => ({ ...current, me: true }))
    record([{ kind: 'ready', player: myIndex }])
  }, [myIndex, record])

  const unready = useCallback(() => {
    if (phase !== 'lobby') return
    setReady((current) => {
      const next: Record<string, boolean> = {}
      // Une revanche garde les robots qui l'attendaient déjà : seul mon « prêt » tombe.
      if (rematchOpen) for (const id of Object.keys(current)) if (id !== 'me') next[id] = current[id]!
      return next
    })
    if (!rematchOpen) marks.current = {}
  }, [phase, rematchOpen])

  const leave = useCallback(() => {
    reset()
    setRematchOpen(false)
    setLeavers([])
    setSeed(Date.now() >>> 0)
    setPhase('lobby')
  }, [reset])

  /**
   * La revanche : la table se reforme autour de ceux qui restent, qui se
   * déclarent prêts à leur rythme. Une place laissée vide s'offre à un autre
   * joueur maison ; la partie part quand toute la table présente est prête.
   */
  const openRematch = useCallback(() => {
    const fresh = Date.now() >>> 0
    const gone = leaversOf(fresh, seats)
    reset()
    setSeed(fresh)
    setRematchOpen(true)
    setLeavers(gone)
    setInvited((current) => current.filter((id) => !gone.includes(id)))
    setPhase('lobby')
  }, [reset, seats])

  /** Retour au rapport sans refermer la revanche : elle reste ouverte pour les autres. */
  const backToRecap = useCallback(() => {
    if (phase === 'lobby' && !ready.me) setPhase('over')
  }, [phase, ready.me])
  const joinRematch = useCallback(() => setPhase('lobby'), [])

  // L'horloge de la table part de l'ouverture de la page.
  useEffect(() => {
    zero.current = performance.now()
  }, [])

  // La montre : un battement de 100 ms, la finesse de ce que la réserve affiche.
  useEffect(() => {
    if (phase === 'over') return
    const beat = () =>
      setAt((current) => {
        const next = now()
        return Math.abs(next - current) < 0.04 ? current : next
      })
    beat()
    const timer = setInterval(beat, 100)
    return () => clearInterval(timer)
  }, [now, phase])

  // La musique suit les écrans, comme autour d'une partie seule : le menu
  // autour, le pouls pendant la partie, et l'heure sonne à la fin.
  useEffect(() => {
    const around = phase === 'lobby' || phase === 'announcing' || phase === 'over'
    setMusic(around ? 'menu' : phase === 'play' || phase === 'deaths' ? 'pulse' : null)
    if (phase === 'over') sound.timeUp()
  }, [phase])

  // Le salon : un robot se déclare prêt un moment après avoir de quoi l'être —
  // mon « prêt » pour une table neuve, l'ouverture de la revanche ou son
  // invitation pour une table qui se reforme. Ils arrivent l'un après l'autre,
  // et l'annonce part quand toute la table présente est prête.
  useEffect(() => {
    if (phase !== 'lobby') return
    const due = rematchOpen || !!ready.me
    if (due) {
      let last = Math.max(at, ...Object.values(marks.current))
      for (const seat of seats) {
        if (!seat.bot || marks.current[seat.id] !== undefined) continue
        last += READY_GAP
        marks.current[seat.id] = last
      }
    }
    const late = seats.filter((seat) => seat.bot && !ready[seat.id] && at >= (marks.current[seat.id] ?? Infinity))
    if (late.length > 0) {
      setReady((current) => ({ ...current, [late[0]!.id]: true }))
      record([{ kind: 'ready', player: seats.findIndex((seat) => seat.id === late[0]!.id) }])
      return
    }
    if (seats.length >= MIN_TABLE && seats.every((seat) => ready[seat.id])) {
      setAnnounceEndsAt(at + ANNOUNCE_SECONDS)
      setPhase('announcing')
    }
  }, [at, phase, ready, rematchOpen, record, seats])

  // L'annonce, puis le draft : l'ordre des choix va du plus petit catalogue au plus grand.
  useEffect(() => {
    if (phase !== 'announcing' || at < announceEndsAt) return
    const order = seats.map((_, index) => index).sort((a, b) => (seats[a]?.owned ?? 0) - (seats[b]?.owned ?? 0))
    lastPicker.current = -1
    setFeed([])
    setDuel(createDuel({ seed, playerIds: seats.map((seat) => seat.id), categories: mine, order }))
    setPhase('draft')
  }, [announceEndsAt, at, mine, phase, seats, seed])

  // Le draft : chaque choix a dix secondes, le sort tranche après. Les robots
  // réfléchissent un peu moins longtemps, pour que la table avance ; un choix
  // qui ne laisse qu'une catégorie la prend d'office, sans faire attendre.
  useEffect(() => {
    if (phase !== 'draft' || !duel) return
    if (draftComplete(duel)) {
      if (draftDoneAt === 0) setDraftDoneAt(at + DRAFT_HOLD_SECONDS)
      else if (at >= draftDoneAt && !failed) {
        setOpeningAt(at)
        setPhase('opening')
      }
      return
    }
    const actor = draftPlayer(duel)
    const bot = botOf(seats[actor]?.id ?? '')
    const only = onlyChoice(duel)
    if (lastPicker.current !== duel.picks.length) {
      lastPicker.current = duel.picks.length
      actAt.current = at + (only ? FORCED_SECONDS : pickBudget(bot))
      setPickEndsAt(only ? at : actAt.current)
      return
    }
    if (at < actAt.current) return
    const picked = only ?? (bot ? botPick(duel, bot) : forcedPick(duel))
    if (!picked) return
    setDuel(pickCategory(duel, picked))
    record([{ kind: 'picked', player: actor, prompt: { categoryId: picked, letter: '' } }])
  }, [at, botOf, draftDoneAt, duel, failed, phase, record, seats])

  // Les dictionnaires du pool, chargés pendant le tirage de l'ouvreur. Le
  // déclenchement ne dépend que du pool — surtout pas de la phase, qu'il
  // change lui-même : un effet qui s'annule en changeant d'état ne charge rien.
  const poolKey = duel && draftComplete(duel) ? duel.picks.join(',') : ''
  const loadingFor = useRef('')
  useEffect(() => {
    if (!poolKey || loadingFor.current === poolKey) return
    loadingFor.current = poolKey
    let live = true
    loadPacks(lang, poolKey.split(','))
      .then((packs) => {
        if (live) setJudge(createJudge(packs, { own: {}, crowd: {} }))
      })
      .catch(() => {
        if (!live) return
        loadingFor.current = ''
        setFailed(true)
      })
    return () => {
      live = false
    }
  }, [lang, poolKey])

  // L'ouvreur tiré, son nom posé, trois temps : la partie part, dictionnaires chargés.
  useEffect(() => {
    if (phase !== 'opening' || !judge || at < openingAt + OPENING_SECONDS) return
    setFeed([])
    setDuel((current) => (current ? openDuel(current, judge, now()) : current))
    setPhase('play')
  }, [at, judge, now, openingAt, phase])

  // La partie : la mort sur le temps d'abord, puis le coup du robot dont c'est
  // le tour. Le temps ne s'arrête pas parce que l'onglet est en arrière-plan.
  useEffect(() => {
    if (phase !== 'play' || !duel || !judge) return
    const timed = duelTimeout(duel, judge, at)
    if (timed !== duel) return commit(duel, timed, { kind: 'clock' }, at)

    const turn = duel.turn
    if (!turn || turn.startedAt + 0.05 > at) return
    const bot = botOf(seats[turn.player]?.id ?? '')
    if (!bot) return
    const move = botMove(duel, judge, bot)
    if (!move || at < turn.startedAt + move.after) return
    const played = move.word ? playWord(duel, move.word, judge, at) : null
    if (played?.verdict.kind === 'accepted' && played.verdict.found) {
      const found = played.verdict.found
      commit(duel, played.duel, { kind: 'word', player: turn.player, word: found.display, tier: found.tier }, at)
    } else commit(duel, passTurn(duel, judge, at), { kind: 'pass', player: turn.player }, at)
  }, [at, botOf, commit, duel, judge, phase, seats])

  // La mise en scène d'une mort : le compteur reste arrêté, puis trois temps
  // rendent la main aux survivants — leur réserve ne court qu'à partir de là.
  // La dernière mort laisse lire le gagnant, puis ouvre le bilan.
  const beatsPlayed = useRef(-1)
  useEffect(() => {
    if (phase !== 'deaths' || !duel) return
    if (at < stagedAt) {
      beatsPlayed.current = -1
      return
    }
    if (duel.phase === 'over') {
      setFallen(null)
      setPhase('over')
      return
    }
    const beat = Math.max(0, Math.ceil((stagedAt + RESTART_SECONDS - at) / BEAT_SECONDS))
    if (beat === 0) {
      beatsPlayed.current = -1
      setFallen(null)
      setDuel((current) => (current ? resume(current, now()) : current))
      setPhase('play')
      sound.go()
      return
    }
    if (beatsPlayed.current !== beat) {
      beatsPlayed.current = beat
      sound.beat()
    }
  }, [at, duel, now, phase, stagedAt])

  const pick = useCallback(
    (categoryId: string) => {
      if (!duel || phase !== 'draft' || draftPlayer(duel) !== myIndex || draftComplete(duel)) return
      if (!duel.categories.includes(categoryId) || duel.picks.includes(categoryId)) return
      setDuel(pickCategory(duel, categoryId))
      record([{ kind: 'picked', player: myIndex, prompt: { categoryId, letter: '' } }])
    },
    [duel, myIndex, phase, record],
  )

  const inspect = useCallback(
    (raw: string): Verdict => (duel && judge ? inspectFor(duel, myIndex, raw, judge) : { kind: 'empty', found: null }),
    [duel, judge, myIndex],
  )

  const play = useCallback(
    (raw: string) => {
      if (!duel || !judge || phase !== 'play' || duel.turn?.player !== myIndex) return
      const clock = now()
      const played = playWord(duel, raw, judge, clock)
      const found = played.verdict.found
      if (played.verdict.kind === 'accepted' && found) {
        commit(duel, played.duel, { kind: 'word', player: myIndex, word: found.display, tier: found.tier }, clock)
      } else commit(duel, played.duel, { kind: 'clock' }, clock)
    },
    [commit, duel, judge, myIndex, now, phase],
  )

  const pass = useCallback(() => {
    if (!duel || !judge || phase !== 'play' || duel.turn?.player !== myIndex) return
    const clock = now()
    commit(duel, passTurn(duel, judge, clock), { kind: 'pass', player: myIndex }, clock)
  }, [commit, duel, judge, myIndex, now, phase])

  // Le raccourci `#auto` joue la table sans moi : elle s'ouvre avec les trois
  // joueurs maison, je me déclare prêt, je choisis et je valide comme un robot.
  useEffect(() => {
    if (!auto) return
    if (phase === 'lobby' && !ready.me) {
      if (!rematchOpen && invited.length < HOUSE_BOTS.length) setInvited(HOUSE_BOTS.map((bot) => bot.id))
      else if (at > 0.8) markReady()
      return
    }
    if (phase === 'draft' && duel && !draftComplete(duel) && draftPlayer(duel) === myIndex && !onlyChoice(duel) && at > actAt.current - DUEL_PICK_SECONDS + 1.2) {
      const choice = draftChoices(duel)[0]
      if (choice) pick(choice)
      return
    }
    if (phase === 'play' && duel && judge && duel.turn?.player === myIndex && at >= duel.turn.startedAt + 1.4) {
      const turn = duel.turn
      const word = judge.common?.(turn.prompt.categoryId, turn.prompt.letter, duel.players[myIndex]?.used ?? [])
      if (word) play(word)
      else pass()
    }
  }, [at, auto, duel, invited.length, judge, markReady, myIndex, pass, phase, pick, play, ready.me, rematchOpen])

  // Le couple en cours, gardé pour la mise en scène : la dernière mort ferme le
  // duel (`turn` passe à null) et l'écran de partie doit rester derrière elle.
  useEffect(() => {
    const turned = duel ? duelPrompt(duel) : null
    if (turned) setLastPrompt(turned)
  }, [duel])

  const drafting = duel && phase === 'draft' && !draftComplete(duel)
  const picker = drafting ? (seats[draftPlayer(duel)] ?? null) : null
  const myTurn = phase === 'play' && duel?.turn?.player === myIndex
  const watching = phase === 'play' && !!duel?.turn && duel.turn.player !== myIndex

  return {
    phase,
    at,
    seats,
    invited,
    toggleInvite,
    ready,
    markReady,
    unready,
    duel,
    judge,
    pool: mine,
    prompt: (duel ? duelPrompt(duel) : null) ?? lastPrompt,
    picker,
    pickLeft: picker ? Math.max(0, pickEndsAt - at) : 0,
    forced: drafting ? onlyChoice(duel) : null,
    myIndex,
    myTurn,
    myPickTurn: !!picker && picker.id === seats[myIndex]?.id,
    watching,
    event: feed[0] ?? null,
    feed,
    error: failed,
    fallen,
    stagedAt,
    resumeIn:
      phase === 'deaths' && duel?.phase !== 'over' && at >= stagedAt ? Math.max(0, Math.ceil((stagedAt + RESTART_SECONDS - at) / BEAT_SECONDS)) : 0,
    openingAt,
    rematchOpen,
    leavers,
    openRematch,
    backToRecap,
    joinRematch,
    inspect,
    pick,
    play,
    pass,
    leave,
  }
}
