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
  openDuel,
  passTurn,
  pickCategory,
  playWord,
  resume,
  DUEL_PICK_SECONDS,
  type BotProfile,
  type Duel,
} from '../domain/duel'
import { createRng } from '../domain/rng'
import { playableCategoryIds } from '../domain/perks'
import type { RarityTier } from '../domain/rarity'
import type { Judge, Verdict } from '../domain/run'
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
 * Le déroulé suit celui d'une partie seule : le salon, l'annonce, le draft —
 * dix secondes par choix, le sort tranche après —, puis l'écran des catégories
 * tirées et son compte à rebours (`CountdownScreen`, le même qu'en solo), et
 * enfin la partie.
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

export type TablePhase = 'setup' | 'lobby' | 'announcing' | 'draft' | 'countdown' | 'play' | 'deaths' | 'over'

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
  pool: readonly string[]
  prompt: { categoryId: string; letter: string } | null
  /** À qui le tour de choisir une catégorie, et ce qu'il lui reste de temps. */
  picker: Seat | null
  pickLeft: number
  myIndex: number
  myTurn: boolean
  myPickTurn: boolean
  /** Le tour en cours est tenu par un autre que moi. */
  watching: boolean
  event: DuelEvent | null
  error: boolean
  /** La mise en scène d'une mort : qui est tombé, et quand la table reprend. */
  fallen: number | null
  stagedAt: number
  /** La seconde montrée par le compte à rebours de reprise, 0 quand il n'a pas commencé. */
  resumeIn: number
  /** Une revanche est ouverte : la table se reforme, elle n'attend personne. */
  rematchOpen: boolean
  /** Les joueurs de la table précédente qui ont quitté la revanche. */
  leavers: readonly string[]
  openRematch(): void
  launch(): void
  backToRecap(): void
  /** Retour à la table depuis le rapport, sans refermer la revanche. */
  joinRematch(): void
  closeRematch(): void
  inspect(raw: string): Verdict
  pick(categoryId: string): void
  play(raw: string): void
  pass(): void
  leave(): void
  /** L'écran des catégories tirées a fini son compte à rebours. */
  startPlay(): void
}

const READY_GAP = 0.55
const ANNOUNCE_SECONDS = 2.6
const GAP_AFTER_ANNOUNCE = 0.4
/** La mise en scène d'une mort : le compteur s'arrête le temps de l'animation. */
const DEATH_STAGING_SECONDS = 2.3
const BEAT_SECONDS = 0.8
const BEATS = 3
/** Pendant la mise en scène d'une mort, personne ne brûle de réserve. */
const RESTART_SECONDS = BEATS * BEAT_SECONDS

/** Les joueurs qui quittent une revanche : jamais toute la table, sinon il n'y a plus de duel. */
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
  const [pickEndsAt, setPickEndsAt] = useState(0)
  const [countdownDone, setCountdownDone] = useState(false)
  const [fallen, setFallen] = useState<number | null>(null)
  const [stagedAt, setStagedAt] = useState(0)
  const [rematchOpen, setRematchOpen] = useState(false)
  const [leavers, setLeavers] = useState<readonly string[]>([])

  const zero = useRef(0)
  const marks = useRef<number[]>([])
  const actAt = useRef(0)
  const lastPicker = useRef(-1)
  const flash = useRef(0)
  const [announceEndsAt, setAnnounceEndsAt] = useState(0)
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

  const reset = useCallback(() => {
    zero.current = performance.now()
    marks.current = []
    actAt.current = 0
    lastPicker.current = -1
    setReady({})
    setFailed(false)
    setDuel(null)
    setJudge(null)
    setEvent(null)
    setCountdownDone(false)
    setFallen(null)
    setStagedAt(0)
    setLeavers([])
    setPickEndsAt(0)
    setAnnounceEndsAt(0)
    setAt(0)
  }, [])

  const open = useCallback(() => {
    reset()
    setRematchOpen(false)
    setSeed(Date.now() >>> 0)
    setPhase('lobby')
  }, [reset])

  const markReady = useCallback(() => {
    setReady((current) => ({ ...current, me: true }))
    push({ kind: 'ready', player: myIndex })
  }, [myIndex, push])

  const leave = useCallback(() => {
    reset()
    setRematchOpen(false)
    setPhase('setup')
  }, [reset])

  /**
   * La revanche : la même table se reforme tout de suite, chacun se déclare
   * prêt à son rythme, et personne n'attend les autres — celui qui est parti
   * ne bloque rien, on lance avec les présents.
   */
  const openRematch = useCallback(() => {
    const fresh = Date.now() >>> 0
    reset()
    setSeed(fresh)
    setRematchOpen(true)
    setLeavers(leaversOf(fresh, seats))
    setPhase('lobby')
  }, [reset, seats])

  /** La partie part avec les joueurs confirmés : les autres sont laissés de côté. */
  const launch = useCallback(() => {
    const going = seats.filter((seat) => ready[seat.id]).map((seat) => seat.id)
    if (going.length < MIN_TABLE) return
    setInvited(going.filter((id) => id !== 'me'))
    setAnnounceEndsAt(at + ANNOUNCE_SECONDS + GAP_AFTER_ANNOUNCE)
    setPhase('announcing')
  }, [at, ready, seats])

  /** Retour au rapport sans refermer la revanche : elle reste ouverte pour les autres. */
  const backToRecap = useCallback(() => setPhase('over'), [])
  const joinRematch = useCallback(() => setPhase('lobby'), [])

  const closeRematch = useCallback(() => {
    setRematchOpen(false)
    setLeavers([])
  }, [])

  // La montre : un battement de 100 ms, la finesse de ce que la réserve affiche.
  useEffect(() => {
    if (phase === 'setup' || phase === 'over') return
    const beat = () => setAt((current) => {
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
    const around = phase === 'setup' || phase === 'lobby' || phase === 'announcing' || phase === 'over'
    setMusic(around ? 'menu' : phase === 'play' ? 'pulse' : null)
    if (phase === 'over') sound.timeUp()
  }, [phase])

  // Le salon : les robots se déclarent prêts l'un après l'autre — celui qui a
  // quitté la revanche ne se déclare jamais —, et l'annonce part quand toute
  // la table est prête. Un siège ajouté en route prend son tour à son arrivée.
  useEffect(() => {
    if (phase !== 'lobby') return
    seats.forEach((_, index) => {
      if (index > myIndex && marks.current[index] === undefined) marks.current[index] = at + READY_GAP * index
    })
    const late = seats.filter((seat, index) => {
      if (index <= myIndex || ready[seat.id] || leavers.includes(seat.id)) return false
      return at >= (marks.current[index] ?? Infinity)
    })
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
      setAnnounceEndsAt(at + ANNOUNCE_SECONDS + GAP_AFTER_ANNOUNCE)
      setPhase('announcing')
    }
  }, [at, leavers, myIndex, phase, push, ready, seats])

  // L'annonce, puis le draft : la table est complète, l'ordre des choix va du
  // plus petit catalogue au plus grand.
  useEffect(() => {
    if (phase !== 'announcing' || at < announceEndsAt) return
    const order = seats.map((_, index) => index).sort((a, b) => (seats[a]?.owned ?? 0) - (seats[b]?.owned ?? 0))
    lastPicker.current = -1
    setDuel(createDuel({ seed, playerIds: seats.map((seat) => seat.id), categories: mine, order }))
    setPhase('draft')
  }, [announceEndsAt, at, mine, phase, seats, seed])

  // Le draft : chaque choix a dix secondes, le sort tranche après. Les robots
  // réfléchissent un peu moins longtemps, pour que la table avance.
  useEffect(() => {
    if (phase !== 'draft' || !duel || draftComplete(duel)) return
    const actor = draftPlayer(duel)
    const bot = botOf(seats[actor]?.id ?? '')
    if (lastPicker.current !== actor) {
      lastPicker.current = actor
      const budget = pickBudget(bot)
      actAt.current = at + budget
      setPickEndsAt(actAt.current)
      return
    }
    if (at < actAt.current) return
    const picked = bot ? botPick(duel, bot) : forcedPick(duel)
    if (!picked) return
    setDuel(pickCategory(duel, picked))
    push({ kind: 'picked', player: actor, prompt: { categoryId: picked, letter: '' } })
  }, [at, botOf, duel, phase, push, seats])

  // Les dictionnaires du pool, chargés pendant l'écran des catégories tirées.
  // Le déclenchement ne dépend que du pool — surtout pas de la phase, qu'il
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

  // L'écran des catégories tirées : le même qu'en partie seule, puis la partie
  // commence quand le compte à rebours a sonné et que les dictionnaires sont là.
  useEffect(() => {
    if (phase !== 'draft' || !duel || !draftComplete(duel) || failed) return
    setCountdownDone(false)
    setPhase('countdown')
  }, [duel, failed, phase])

  useEffect(() => {
    if (phase !== 'countdown' || !judge || !countdownDone) return
    setDuel((current) => (current ? openDuel(current, judge, now()) : current))
    setPhase('play')
  }, [countdownDone, judge, now, phase])

  // La partie : la mort sur le temps d'abord, puis le coup du robot dont c'est
  // le tour. Le temps ne s'arrête pas parce que l'onglet est en arrière-plan.
  useEffect(() => {
    if (phase !== 'play' || !duel || !judge) return
    let next = duelTimeout(duel, judge, at)
    if (next.deaths.length > duel.deaths.length && duel.turn) push({ kind: 'dead', player: duel.turn.player })

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
            const couple = next.turn!.prompt
            const before = next.dealt.length
            next = passTurn(next, judge, at)
            if (next.dealt.length > before) push({ kind: 'failed', player: turn.player, prompt: couple })
          }
        }
      }
    }

    if (next !== duel) {
      const died = next.deaths.length > duel.deaths.length
      if (next.phase === 'over' && duel.phase !== 'over') push({ kind: 'over', player: next.deaths[next.deaths.length - 1] ?? 0 })
      setDuel(next)
      // Toute mort a sa mise en scène, la dernière comprise : le compteur
      // s'arrête, l'animation joue, puis un compte à rebours rend la main.
      if (died) {
        setFallen(duel.turn?.player ?? null)
        setStagedAt(at + DEATH_STAGING_SECONDS)
        setPhase('deaths')
      } else if (next.phase === 'over') setPhase('over')
      else setPhase('play')
    }
  }, [at, botOf, duel, judge, phase, push, seats])

  // La mise en scène d'une mort : le compteur reste arrêté, puis trois temps
  // rendent la main aux survivants — leur réserve ne court qu'à partir de là.
  const beatsPlayed = useRef(-1)
  useEffect(() => {
    if (phase !== 'deaths' || !duel) return
    if (at < stagedAt) {
      beatsPlayed.current = -1
      return
    }
    const beat = Math.max(0, Math.ceil((stagedAt + RESTART_SECONDS - at) / BEAT_SECONDS))
    if (beat === 0) {
      beatsPlayed.current = -1
      setFallen(null)
      if (duel.phase === 'over') {
        setPhase('over')
        return
      }
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

  // Le raccourci `#auto` joue la table sans moi, plus bas : il lui faut `play`
  // et `pass`, déclarés après les règles du tour.

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
    const before = duel.dealt.length
    const next = passTurn(duel, judge, now())
    if (next.phase === 'over') push({ kind: 'dead', player: myIndex })
    else if (next.dealt.length > before) push({ kind: 'failed', player: myIndex, prompt: couple })
    setDuel(next)
    setPhase(next.phase === 'over' ? 'over' : 'play')
  }, [duel, judge, myIndex, now, phase, push])

  // Le raccourci `#auto` joue la table sans moi : elle s'ouvre avec les trois
  // joueurs maison, je me déclare prêt, je choisis et je valide comme un robot.
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

  const picker = duel && phase === 'draft' && !draftComplete(duel) ? (seats[draftPlayer(duel)] ?? null) : null
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
    pool: mine,
    prompt: duel ? duelPrompt(duel) : null,
    picker,
    pickLeft: picker ? Math.max(0, pickEndsAt - at) : 0,
    myIndex,
    myTurn,
    myPickTurn: !!picker && picker.id === seats[myIndex]?.id,
    watching,
    event,
    error: failed,
    fallen,
    stagedAt,
    resumeIn: phase === 'deaths' && at >= stagedAt ? Math.max(0, Math.ceil((stagedAt + RESTART_SECONDS - at) / BEAT_SECONDS)) : 0,
    rematchOpen,
    leavers,
    openRematch,
    launch,
    backToRecap,
    joinRematch,
    closeRematch,
    inspect,
    pick,
    play,
    pass,
    leave,
    startPlay: () => setCountdownDone(true),
  }
}