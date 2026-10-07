import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { availableCategoryIds, loadPacks } from '../data/packs'
import type { AvatarChoice } from '../domain/avatar'
import {
  draftComplete,
  draftPlayer,
  drawnShownAt,
  duelPrompt,
  duelRound,
  inspectFor,
  onlyChoice,
  openingAt,
  pickDeadline,
  reserveSeconds,
  DUEL_DEATH_PAUSE_SECONDS,
  DUEL_MAX_PLAYERS,
  DUEL_MIN_PLAYERS,
  DUEL_OPENING_SECONDS,
  DUEL_PASS_PENALTY_SECONDS,
  type BotProfile,
  type Duel,
} from '../domain/duel'
import { DUEL_ANNOUNCE_SECONDS, driverMove, driverOf, mergeJournal, postMove, replay, settle, type DuelFact, type DuelMove, type DuelPost, type DuelSetup } from '../domain/duelLog'
import { createRng } from '../domain/rng'
import { playableCategoryIds } from '../domain/perks'
import { onAppActive } from '../lib/native'
import type { Profile } from '../domain/progression'
import type { Judge, Prompt, Verdict } from '../domain/run'
import { ownedCategoryIds } from '../domain/unlocks'
import {
  createDuelTable,
  fetchDuelCandidates,
  fetchPlayerId,
  finishDuel,
  inviteToDuel,
  joinDuel,
  kickFromDuel,
  leaveDuel,
  openDuelRematch,
  postDuelMove,
  setDuelReady,
  syncDuel,
  unstartDuel,
  type DuelSnapshot,
} from '../lib/cloud'
import { setMusic, sound } from '../lib/sound'
import { createJudge } from './judge'
import { loadAccount, loadAvatar, loadProfile, saveProfile } from './storage'

/**
 * La table de duel vue d'un appareil. La partie elle-même n'est qu'un journal
 * de coups que le domaine rejoue (`src/domain/duelLog.ts`) : ce fichier tient
 * ce journal, l'horloge de la table et ce que l'appareil doit déclarer de
 * lui-même — ses propres coups, le temps écoulé de son tour, et, quand il mène
 * la table, les coups des joueurs maison et les choix que le temps tranche.
 *
 * Deux sources pour le même déroulé :
 * - `online` : la table vit sur le serveur (0046), relue plusieurs fois par
 *   seconde, l'horloge est la sienne ;
 * - `local` : la table vit ici, contre les joueurs maison, sans serveur — la
 *   page `duel.html`, et le repli de l'app hors ligne. Le serveur y est
 *   simulé au plus près : les robots se déclarent prêts, partent d'une
 *   revanche, le journal se numérote.
 *
 * Toute phase de l'écran se déduit de la table et de l'heure : deux appareils
 * à la même table montrent le même écran au même moment.
 */

export interface HouseBot extends BotProfile {
  name: string
  avatar: AvatarChoice
  /** Le trait du joueur, lu dans le salon : le texte vient de l'i18n. */
  trait: 'fast' | 'steady' | 'sharp'
}

const avatarOf = (design: number, ground: string, shape: string, accent: string): AvatarChoice => ({ design, ground, shape, accent })

/** Les trois joueurs maison de la table locale ; en ligne, ceux du serveur (`bots`) prennent leur profil par leur nom. */
export const HOUSE_BOTS: readonly HouseBot[] = [
  { id: 'maxitoon', name: 'Maxitoon', avatar: avatarOf(47, 'vert', 'creme', 'rose'), trait: 'fast', think: [2.6, 6.5], answerChance: 0.72 },
  { id: 'terretciel', name: 'Terretciel', avatar: avatarOf(12, 'rouge', 'jaune', 'bleu'), trait: 'steady', think: [3.4, 9], answerChance: 0.8 },
  { id: 'demontoon', name: 'Demontoon', avatar: avatarOf(73, 'bleu', 'creme', 'jaune'), trait: 'sharp', think: [2.4, 7.5], answerChance: 0.88 },
]

/** Un joueur maison du serveur qui n'a pas d'homologue local joue posément. */
const STEADY: Omit<BotProfile, 'id'> = { think: [3, 8], answerChance: 0.8 }

export const MIN_TABLE = DUEL_MIN_PLAYERS
export const MAX_TABLE = DUEL_MAX_PLAYERS

export type TablePhase = 'connecting' | 'lobby' | 'announcing' | 'draft' | 'opening' | 'play' | 'deaths' | 'over' | 'gone'
export type DuelMode = 'local' | 'online'
/** Pourquoi la table a renvoyé le joueur : l'accueil le lui dit. */
export type DuelExit = 'kicked' | 'closed' | null

/** Le draft complet reste à l'écran le temps de lire ce que le sort a ajouté. */
export const DRAFT_HOLD_SECONDS = 1.8
/** Le tirage de l'ouvreur, puis son nom posé, puis trois temps : `DUEL_OPENING_SECONDS` en tout. */
export const OPENING_SPIN_SECONDS = 2.1
export const OPENING_LAND_SECONDS = 1.1
export const BEAT_SECONDS = 0.8
export const BEATS = 3
/** La dernière mort laisse lire le nom du gagnant avant le bilan. */
const LAST_DEATH_SECONDS = 3.2
const READY_GAP = 0.6
const FEED_SIZE = 3
/** Le temps qu'un conseil de draft fait frémir sa catégorie, et combien s'affichent à la fois. */
export const CHEER_SECONDS = 2.4
export const CHEERS_SHOWN = 3

export interface Seat {
  id: string
  name: string
  avatar: AvatarChoice
  bot: boolean
  trait?: HouseBot['trait']
  /** Combien de catégories il possède : le plus petit catalogue ouvre le draft. */
  owned: number
  ready: boolean
  /** Invité, pas encore assis. */
  pending?: boolean
}

export interface Candidate {
  id: string
  name: string
  avatar: AvatarChoice
  bot: boolean
  trait?: HouseBot['trait']
}

export interface DuelTable {
  mode: DuelMode
  phase: TablePhase
  at: number
  /** Les joueurs de la partie, dans l'ordre des places ; au salon, ceux qui sont assis, puis les invités. */
  seats: readonly Seat[]
  myIndex: number
  host: boolean
  /** Qui l'hôte peut encore inviter. */
  candidates: readonly Candidate[]
  invite(id: string): void
  /** L'hôte retire quelqu'un du salon : joueur, joueur maison ou invitation. */
  kick(id: string): void
  ready: Readonly<Record<string, boolean>>
  markReady(): void
  unready(): void
  /** Renoncer au départ : la table revient au salon tant que personne n'a choisi. */
  cancelStart(): void
  duel: Duel | null
  judge: Judge | null
  pool: readonly string[]
  prompt: Prompt | null
  picker: Seat | null
  pickLeft: number
  forced: string | null
  myTurn: boolean
  myPickTurn: boolean
  /** Le draft se regarde depuis le salon : un aller-retour, pas un départ. */
  draftLobby: boolean
  showLobby(): void
  hideLobby(): void
  watching: boolean
  event: DuelFact | null
  feed: readonly DuelFact[]
  facts: readonly DuelFact[]
  /** Les catégories que d'autres conseillent au draft, la plus fraîche en tête. */
  cheers: readonly DuelFact[]
  error: boolean
  /** La table en ligne n'a pas pu s'ouvrir : pas de compte nommé, ou pas de serveur. */
  offline: boolean
  /** La table est prise sur le serveur : une coupure se dit alors sans quitter la partie. */
  joined: boolean
  /** Dans l'app : quitter la table rend l'accueil, au lieu d'en rouvrir une. */
  embedded: boolean
  /** La mise en scène d'une mort : qui est tombé, et quand elle a commencé. */
  fallen: number | null
  fallenAt: number
  /** L'heure où le tirage de l'ouvreur commence. */
  openingAt: number
  /** Combien des catégories tirées au sort sont déjà posées sur le draft. */
  drawnShown: number
  rematchOpen: boolean
  leavers: readonly string[]
  openRematch(): void
  joinRematch(): void
  backToRecap(): void
  inspect(raw: string): Verdict
  /** Ce que mon champ tient : à zéro, il se valide tout seul s'il est juste. */
  hold(raw: string): void
  pick(categoryId: string): void
  /** Conseiller une catégorie à celui qui choisit, quand ce n'est pas mon tour. */
  cheer(categoryId: string): void
  play(raw: string): void
  pass(): void
  leave(): void
}

interface TableData {
  id: string | null
  hostId: string
  seed: number
  lang: string
  categories: readonly string[]
  status: 'lobby' | 'playing' | 'over' | 'closed'
  startedAt: number | null
  rematch: string | null
  seats: readonly (Seat & { seat: number | null; gone: boolean; kicked: boolean; seen: number })[]
  invites: readonly Seat[]
  moves: readonly DuelMove[]
}

const wall = () => Date.now() / 1000

/**
 * Les conseils encore frais d'un journal : le dernier reçu par catégorie, le
 * plus récent en tête, trois au plus. Le journal les garde tous ; c'est ici
 * que l'écran choisit ce qu'il montre.
 */
export function activeCheers(facts: readonly DuelFact[], at: number): readonly DuelFact[] {
  const byCategory = new Map<string, DuelFact>()
  for (const fact of facts) {
    if (fact.kind !== 'cheered' || !fact.cheer || at - fact.at >= CHEER_SECONDS) continue
    byCategory.set(fact.cheer, fact)
  }
  return [...byCategory.values()].sort((a, b) => b.at - a.at).slice(0, CHEERS_SHOWN)
}

const botByName = (name: string): HouseBot | undefined => HOUSE_BOTS.find((bot) => bot.name.toLowerCase() === name.toLowerCase())

/** Les joueurs qui quittent une revanche locale : jamais tous les robots, sinon il n'y a plus de duel. */
function leaversOf(seed: number, bots: readonly string[]): readonly string[] {
  const drawn = bots.filter((_, index) => createRng((seed ^ Math.imul(index + 1, 0x6c656176)) >>> 0).next() < 0.34)
  return drawn.length >= bots.length ? drawn.slice(1) : drawn
}

function freshLocal(lang: string, me: Seat, bots: readonly string[], categories: readonly string[]): TableData {
  return {
    id: null,
    hostId: me.id,
    seed: Date.now() >>> 0,
    lang,
    categories,
    status: 'lobby',
    startedAt: null,
    rematch: null,
    seats: [
      { ...me, ready: false, seat: null, gone: false, kicked: false, seen: wall() },
      ...bots.map((id) => {
        const bot = HOUSE_BOTS.find((one) => one.id === id)!
        return { id, name: bot.name, avatar: bot.avatar, bot: true, trait: bot.trait, owned: 999, ready: false, seat: null, gone: false, kicked: false, seen: wall() }
      }),
    ],
    invites: [],
    moves: [],
  }
}

function fromSnapshot(snapshot: DuelSnapshot): TableData {
  return {
    id: snapshot.table.id,
    hostId: snapshot.table.host,
    seed: snapshot.table.seed,
    lang: snapshot.table.lang,
    categories: snapshot.table.categories,
    status: snapshot.table.status,
    startedAt: snapshot.table.startedAt,
    rematch: snapshot.table.rematch,
    seats: snapshot.seats.map((row) => {
      const house = row.bot && row.name ? botByName(row.name) : undefined
      return {
        id: row.player ?? '',
        name: row.name ?? '',
        avatar: row.avatar,
        bot: row.bot,
        trait: house?.trait,
        // Un joueur maison n'a pas de catalogue : il choisit après les joueurs.
        owned: row.bot ? 999 : row.owned,
        ready: row.ready,
        seat: row.seat,
        // La place d'un compte effacé reste à son rang : elle est partie, pas disparue.
        gone: row.left || row.kicked || row.player === null,
        kicked: row.kicked,
        seen: row.seen,
      }
    }),
    invites: snapshot.invites.map((invite) => ({ id: invite.player, name: invite.name, avatar: invite.avatar, bot: false, owned: 0, ready: false, pending: true })),
    moves: snapshot.moves,
  }
}

export interface DuelTableOptions {
  lang: string
  mode: DuelMode
  /** Une table où l'on a été invité ; sans elle, l'appareil en ouvre une dont il est l'hôte. */
  join?: string | null
  /** La table renvoie le joueur : expulsé, table fermée, ou départ de lui-même. */
  onExit?(reason: DuelExit): void
  /** Le profil vient de gagner un compteur de duel : l'appelant le range à l'écran. */
  onProfile?(profile: Profile): void
}

export function useDuelTable({ lang, mode, join = null, onExit, onProfile }: DuelTableOptions): DuelTable {
  const profile = useMemo(() => loadProfile(), [])
  const account = useMemo(() => loadAccount(), [])
  const shipped = useMemo(() => availableCategoryIds(lang), [lang])
  const mine = useMemo(() => playableCategoryIds(profile, ownedCategoryIds(profile)).filter((id) => shipped.includes(id)), [profile, shipped])
  const [playerId, setPlayerId] = useState<string | null>(null)
  useEffect(() => {
    if (mode === 'online') void fetchPlayerId().then(setPlayerId)
  }, [mode])
  const meSeat: Seat = useMemo(
    () => ({ id: mode === 'local' ? 'me' : (playerId ?? 'me'), name: account?.name?.trim() || '', avatar: account?.avatar ?? loadAvatar(), bot: false, owned: mine.length, ready: false }),
    [account, mine.length, mode, playerId],
  )
  const myId = meSeat.id
  const exit = useRef(onExit)
  useEffect(() => {
    exit.current = onExit
  })

  const [table, setTable] = useState<TableData | null>(() => (mode === 'local' ? freshLocal(lang, meSeat, [HOUSE_BOTS[0]!.id], mine) : null))
  const [failed, setFailed] = useState(false)
  const [offline, setOffline] = useState(false)
  /** L'onglet est passé derrière : il ne mène plus la table tant qu'on ne le regarde pas. */
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  const [leavers, setLeavers] = useState<readonly string[]>([])
  const [candidates, setCandidates] = useState<readonly Candidate[]>([])
  const [judge, setJudge] = useState<Judge | null>(null)
  const [at, setAt] = useState(wall)
  /** L'écart entre l'horloge du serveur et celle de l'appareil, mesuré sur l'aller-retour le plus court. */
  const offset = useRef({ value: 0, rtt: Infinity })
  const now = useCallback(() => wall() + (mode === 'online' ? offset.current.value : 0), [mode])
  const pending = useRef('')
  const readyMarks = useRef<Record<string, number>>({})
  /** Le salon de revanche local garde la table finie pour y revenir. */
  const finished = useRef<TableData | null>(null)
  /** Le draft se regarde depuis le salon : un aller-retour, pas un départ. */
  const [draftLobby, setDraftLobby] = useState(false)

  // -------------------------------------------------- la source en ligne --

  const [tableId, setTableId] = useState<string | null>(null)
  const syncing = useRef(false)
  /** Un renoncement au départ périme la relecture en vol : sa réponse décrit une table qui n'existe plus. */
  const epoch = useRef(0)
  const lastSeq = table?.moves.at(-1)?.seq ?? 0
  // Le journal que l'appareil connaît, lisible hors du rendu : un coup renvoyé
  // après un `stale` doit partir du journal que la relecture vient d'inscrire,
  // pas de la copie d'où l'envoi est parti.
  const journal = useRef<{ id: string | null; moves: readonly DuelMove[] }>({ id: table?.id ?? null, moves: table?.moves ?? [] })
  useEffect(() => {
    journal.current = { id: table?.id ?? null, moves: table?.moves ?? [] }
  }, [table?.id, table?.moves])

  const sync = useCallback(async () => {
    if (mode !== 'online' || !tableId || syncing.current) return
    syncing.current = true
    const sent = wall()
    const after = table?.id === tableId ? lastSeq : 0
    const seen = epoch.current
    const snapshot = await syncDuel(tableId, after)
    const back = wall()
    syncing.current = false
    if (seen !== epoch.current) return
    if (snapshot === 'unreachable') {
      setOffline(true)
      return
    }
    setOffline(false)
    if (snapshot === null) {
      exit.current?.('closed')
      return
    }
    const rtt = back - sent
    if (rtt < offset.current.rtt * 1.5 || offset.current.rtt === Infinity) {
      offset.current = { value: snapshot.now - (sent + back) / 2, rtt: Math.min(rtt, offset.current.rtt) }
    }
    const fresh = fromSnapshot(snapshot)
    const merged = mergeJournal(journal.current, fresh)
    journal.current = merged
    setTable((current) => (!current || current.id !== fresh.id ? fresh : { ...fresh, moves: merged.moves }))
  }, [lastSeq, mode, table?.id, tableId])

  // Les coups que la table n'a pas encore pris : une coupure les garde au lieu
  // de les jeter, et le retour du serveur les emporte dans l'ordre.
  const outbox = useRef<DuelPost[]>([])
  const flushing = useRef(false)

  const flush = useCallback(async () => {
    if (flushing.current || mode !== 'online' || !tableId || outbox.current.length === 0) return
    flushing.current = true
    const poster = {
      lastSeq: () => journal.current.moves.at(-1)?.seq ?? 0,
      movesAfter: (seq: number) => journal.current.moves.filter((one) => one.seq > seq),
      post: (one: DuelMove) => postDuelMove(tableId, one),
      read: () => sync(),
    }
    while (outbox.current.length > 0) {
      const { outcome } = await postMove(poster, outbox.current[0]!)
      if (outcome === 'unreachable') {
        setOffline(true)
        break
      }
      outbox.current.shift()
      if (outcome === 'closed') break
    }
    flushing.current = false
  }, [mode, sync, tableId])

  useEffect(() => {
    if (!offline) void flush()
  }, [flush, offline])

  // Revenir à l'onglet, c'est reprendre la table : ce qu'on a manqué se relit
  // tout de suite, sans attendre le prochain battement — qui, onglet caché, est
  // étalé par le navigateur.
  useEffect(() => {
    if (mode !== 'online') return
    const look = () => {
      setHidden(document.hidden)
      if (!document.hidden) void sync()
    }
    document.addEventListener('visibilitychange', look)
    return () => document.removeEventListener('visibilitychange', look)
  }, [mode, sync])

  // Sur téléphone, l'app dit elle-même qu'elle passe derrière : la WebView ne
  // transmet pas toujours la page cachée (`onAppActive`). C'est ce qui rend la
  // règle du meneur vraie sur la plateforme du jeu, pas seulement au navigateur.
  useEffect(() => {
    if (mode !== 'online') return
    onAppActive((active) => setHidden(!active))
  }, [mode])

  // La page s'en va pour de bon : la place se libère tout de suite, et le meneur
  // suivant n'attend pas huit secondes. Une page mise de côté (bfcache) n'est
  // pas un départ.
  useEffect(() => {
    if (mode !== 'online' || !tableId) return
    const gone = (event: PageTransitionEvent) => {
      if (!event.persisted) void leaveDuel(tableId)
    }
    window.addEventListener('pagehide', gone)
    return () => window.removeEventListener('pagehide', gone)
  }, [mode, tableId])

  // Une table neuve dont je suis l'hôte, ou celle où l'on m'a invité.
  const opened = useRef(false)
  useEffect(() => {
    if (mode !== 'online' || opened.current) return
    opened.current = true
    if (join) {
      // Une invitation : la place se prend d'abord, la table se lit ensuite.
      void joinDuel(join, mine.length).then((outcome) => {
        if (outcome === 'joined') setTableId(join)
        else if (outcome === 'unreachable') setOffline(true)
        else exit.current?.(outcome === 'kicked' ? 'kicked' : 'closed')
      })
      return
    }
    void createDuelTable(lang, mine, mine.length).then((id) => {
      if (id) setTableId(id)
      else setOffline(true)
    })
  }, [join, lang, mine, mode])

  useEffect(() => {
    if (mode !== 'online') return
    void fetchDuelCandidates().then((rows) => {
      if (rows) setCandidates(rows.map((row) => ({ ...row, trait: row.bot ? botByName(row.name)?.trait : undefined })))
    })
  }, [mode])

  const status = table?.status ?? 'lobby'
  useEffect(() => {
    if (mode !== 'online' || !tableId) return
    void sync()
    const every = status === 'playing' ? 450 : status === 'over' ? 2500 : 1000
    // Rien à relire quand l'écran est caché : le retour relit la table lui-même.
    const timer = setInterval(() => {
      if (!document.hidden) void sync()
    }, every)
    return () => clearInterval(timer)
  }, [mode, status, sync, tableId])

  // L'horloge de l'écran : un battement de 100 ms, la finesse de ce que la réserve affiche.
  useEffect(() => {
    const beat = () => {
      // Ce battement ne nourrit que l'affichage : caché, ce ne sont que des réveils.
      if (!document.hidden) setAt(now())
    }
    beat()
    const timer = setInterval(beat, 100)
    return () => clearInterval(timer)
  }, [now])

  // ------------------------------------------------------- le salon --

  const me = table?.seats.find((seat) => seat.id === myId)
  const isHost = !!table && table.hostId === myId
  const present = useMemo(() => (table?.seats ?? []).filter((seat) => !seat.gone), [table?.seats])

  // Expulsé, ou table fermée par son hôte : l'appareil rentre à l'accueil.
  useEffect(() => {
    if (mode !== 'online' || !table) return
    if (me?.kicked) exit.current?.('kicked')
    else if (table.status === 'closed') exit.current?.('closed')
  }, [me?.kicked, mode, table])

  // Le serveur local : les joueurs maison se déclarent prêts l'un après
  // l'autre — après mon « prêt » à une table neuve, dès l'ouverture d'une
  // revanche —, et la partie part quand toute la table présente est prête.
  useEffect(() => {
    if (mode !== 'local' || !table || table.status !== 'lobby') return
    const due = !!table.rematch || !!me?.ready
    if (due) {
      let last = Math.max(at, ...Object.values(readyMarks.current))
      for (const seat of present) {
        if (!seat.bot || readyMarks.current[seat.id] !== undefined) continue
        last += READY_GAP
        readyMarks.current[seat.id] = last
      }
    }
    const late = present.find((seat) => seat.bot && !seat.ready && at >= (readyMarks.current[seat.id] ?? Infinity))
    if (late) {
      setTable((current) => current && { ...current, seats: current.seats.map((seat) => (seat.id === late.id ? { ...seat, ready: true } : seat)) })
      return
    }
    if (present.length >= MIN_TABLE && present.every((seat) => seat.ready)) {
      setTable((current) => {
        if (!current) return current
        let place = 0
        const seats = current.seats.filter((seat) => !seat.gone).map((seat) => ({ ...seat, seat: place++ }))
        return { ...current, status: 'playing', startedAt: at, rematch: null, seats }
      })
    }
  }, [at, me?.ready, mode, present, table])

  const invite = useCallback(
    (id: string) => {
      if (!table || !isHost || table.status !== 'lobby' || me?.ready || present.length + table.invites.length >= MAX_TABLE) return
      if (mode === 'local') {
        const bot = HOUSE_BOTS.find((one) => one.id === id)
        if (!bot || leavers.includes(id) || present.some((seat) => seat.id === id)) return
        delete readyMarks.current[id]
        setTable(
          (current) =>
            current && {
              ...current,
              seats: [
                ...current.seats.filter((seat) => seat.id !== id),
                { id, name: bot.name, avatar: bot.avatar, bot: true, trait: bot.trait, owned: 999, ready: false, seat: null, gone: false, kicked: false, seen: wall() },
              ],
            },
        )
        return
      }
      if (!table.id) return
      void inviteToDuel(table.id, id).then(() => void sync())
    },
    [isHost, leavers, me?.ready, mode, present, sync, table],
  )

  const kick = useCallback(
    (id: string) => {
      if (!table || !isHost || table.status !== 'lobby' || id === myId) return
      if (mode === 'local') {
        if (present.filter((seat) => seat.bot).length <= 1) return
        setTable((current) => current && { ...current, seats: current.seats.filter((seat) => seat.id !== id) })
        return
      }
      if (!table.id) return
      void kickFromDuel(table.id, id).then(() => void sync())
    },
    [isHost, mode, myId, present, sync, table],
  )

  const setMyReady = useCallback(
    (ready: boolean) => {
      if (!table || table.status !== 'lobby') return
      setTable((current) => current && { ...current, seats: current.seats.map((seat) => (seat.id === myId ? { ...seat, ready } : seat)) })
      if (mode === 'local') {
        // Une table neuve rend leur liberté aux robots ; une revanche garde ceux qui attendaient.
        if (!ready && !table.rematch) {
          readyMarks.current = {}
          setTable((current) => current && { ...current, seats: current.seats.map((seat) => (seat.bot ? { ...seat, ready: false } : seat)) })
        }
        return
      }
      if (table.id) void setDuelReady(table.id, ready).then(() => void sync())
    },
    [mode, myId, sync, table],
  )

  /**
   * Renoncer au départ : la table revient au salon, personne n'a encore choisi.
   * Le serveur efface alors son journal (`duel_unstart`), et l'appareil doit
   * oublier le sien du même coup — une relecture numérotée au-delà des coups
   * neufs attendrait indéfiniment des choix qui repartent de un.
   */
  const cancelStart = useCallback(() => {
    if (!table || table.status !== 'playing') return
    if (mode === 'local') {
      readyMarks.current = {}
      setTable((current) =>
        current && { ...current, status: 'lobby', startedAt: null, moves: [], seats: current.seats.map((seat) => ({ ...seat, ready: false, seat: null })) },
      )
      return
    }
    if (!table.id) return
    const id = table.id
    void unstartDuel(id).then((outcome) => {
      if (outcome !== 'back') {
        sound.refused()
        return
      }
      epoch.current += 1
      journal.current = { id, moves: [] }
      setTable((current) => (current && current.id === id ? { ...current, moves: [] } : current))
      void sync()
    })
  }, [mode, sync, table])

  // -------------------------------------------------------- la partie --

  const players = useMemo(
    () => (table?.status === 'lobby' ? [] : (table?.seats ?? []).filter((seat) => seat.seat !== null).sort((a, b) => a.seat! - b.seat!)),
    [table?.seats, table?.status],
  )
  const setup: DuelSetup | null = useMemo(() => {
    if (!table || table.startedAt === null || players.length < MIN_TABLE) return null
    return { seed: table.seed, playerIds: players.map((seat) => seat.id), categories: table.categories, owned: players.map((seat) => seat.owned), startedAt: table.startedAt }
  }, [players, table])
  const moves = table?.moves
  const replayed = useMemo(() => (setup && moves ? replay(setup, moves, judge) : null), [judge, moves, setup])
  const myIndex = players.findIndex((seat) => seat.id === myId)
  const bots = useMemo(() => {
    const map: Record<number, BotProfile> = {}
    players.forEach((seat, index) => {
      if (!seat.bot) return
      const house = mode === 'local' ? HOUSE_BOTS.find((bot) => bot.id === seat.id) : botByName(seat.name)
      map[index] = { ...(house ?? STEADY), id: seat.id }
    })
    return map
  }, [mode, players])

  // Les dictionnaires du pool, chargés dès qu'il est complet : le tirage de
  // l'ouvreur leur laisse le temps d'arriver.
  const picks = replayed && draftComplete(replayed.duel) ? replayed.duel.picks.join(',') : replayed && replayed.duel.phase !== 'draft' ? replayed.duel.picks.join(',') : ''
  const loadingFor = useRef('')
  useEffect(() => {
    if (!picks || !table || loadingFor.current === picks) return
    loadingFor.current = picks
    let live = true
    loadPacks(table.lang, picks.split(','))
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
  }, [picks, table])

  const duel = replayed ? settle(replayed.duel, judge, at) : null
  const facts = replayed?.facts ?? []

  // Les conseils encore frais : le journal les garde tous, l'écran n'en montre
  // que les derniers, une catégorie une seule fois — c'est le dernier reçu qui
  // la fait frémir.
  const cheers = useMemo(() => activeCheers(replayed?.facts ?? [], at), [at, replayed])

  const post = useCallback(
    async (move: Omit<DuelMove, 'seq' | 'at'>) => {
      if (!table) return
      if (mode === 'local') {
        setTable((current) => current && { ...current, moves: [...current.moves, { ...move, seq: (current.moves.at(-1)?.seq ?? 0) + 1, at: wall() }] })
        return
      }
      // Le coup part par la file : une table injoignable le garde au lieu de le
      // jeter, et la relecture suivante l'emporte.
      outbox.current.push({ move, mark: table.moves.at(-1)?.seq ?? 0 })
      await flush()
    },
    [flush, mode, table],
  )

  // Celui qui mène la table déclare ce que personne d'autre ne déclarera : le
  // premier joueur présent, dans l'ordre des places, qui relit encore la table.
  const driver = useMemo(
    () => (mode === 'local' ? true : driverOf(players, at, { id: myId, hidden }) === myId),
    [at, hidden, mode, myId, players],
  )

  useEffect(() => {
    if (!replayed || !duel || table?.status !== 'playing') return
    // Mon tour vide : mon mot s'il est juste, sinon ma mort, déclarés par moi.
    const turn = duel.turn
    if (judge && duel.phase === 'play' && turn && turn.player === myIndex && at >= turn.startedAt && reserveSeconds(duel, myIndex, at) <= 0) {
      const verdict = inspectFor(duel, myIndex, pending.current, judge)
      void post(verdict.kind === 'accepted' ? { seat: myIndex, kind: 'word', payload: pending.current } : { seat: myIndex, kind: 'timeout', payload: '' })
      return
    }
    if (!driver) return
    const due = driverMove(duel, judge, at, bots)
    if (due) void post(due)
  }, [at, bots, driver, duel, judge, myIndex, post, replayed, table?.status])

  // La partie rejouée est finie : la table le sait, et ne se relit plus qu'au ralenti.
  const ended = duel?.phase === 'over'
  useEffect(() => {
    if (!ended || !table || table.status !== 'playing') return
    if (mode === 'local') setTable((current) => current && { ...current, status: 'over' })
    else if (table.id) void finishDuel(table.id)
  }, [ended, mode, table])

  // Un duel à quatre qui va loin se garde au profil : la table est la seule à
  // savoir combien de manches elle a tenues, et c'est le plus grand nombre qui
  // reste. Aucune table de quatre n'a encore été jouée — le barreau est là pour
  // le jour où la fonctionnalité s'ouvre.
  useEffect(() => {
    if (!ended || !duel || !table || table.seats.length < 4) return
    const rounds = duelRound(duel)
    const before = loadProfile()
    if (rounds <= before.duelRounds4) return
    const after = { ...before, duelRounds4: rounds }
    saveProfile(after)
    onProfile?.(after)
  }, [ended, duel, table, onProfile])

  // ------------------------------------------------------ les phases --

  const lastDeath = [...facts].reverse().find((fact) => fact.kind === 'dead')
  const phase: TablePhase = (() => {
    if (!table) return failed || offline ? 'gone' : 'connecting'
    if (table.status === 'closed') return 'gone'
    if (table.status === 'lobby') return 'lobby'
    if (!duel || table.startedAt === null) return 'connecting'
    if (at < table.startedAt + DUEL_ANNOUNCE_SECONDS) return 'announcing'
    if (duel.phase === 'draft') {
      if (!draftComplete(duel) || duel.draftedAt === null || at < duel.draftedAt + DRAFT_HOLD_SECONDS) return 'draft'
      return 'opening'
    }
    if (lastDeath) {
      const until = lastDeath.at + (duel.phase === 'over' ? LAST_DEATH_SECONDS : DUEL_DEATH_PAUSE_SECONDS)
      if (at < until) return 'deaths'
    }
    return duel.phase === 'over' ? 'over' : 'play'
  })()

  // La musique suit les écrans, comme autour d'une partie seule : le menu
  // autour, le pouls pendant la partie, et l'heure sonne à la fin.
  useEffect(() => {
    const around = phase === 'lobby' || phase === 'announcing' || phase === 'over' || phase === 'connecting'
    setMusic(around ? 'menu' : phase === 'play' || phase === 'deaths' ? 'pulse' : null)
    if (phase === 'over') sound.timeUp()
  }, [phase])

  // ------------------------------------------------------ la revanche --

  const openRematch = useCallback(() => {
    if (!table) return
    if (mode === 'local') {
      const fresh = Date.now() >>> 0
      const stayed = present.filter((seat) => seat.bot).map((seat) => seat.id)
      const gone = leaversOf(fresh, stayed)
      finished.current = table
      readyMarks.current = {}
      setLeavers(gone)
      setJudge(null)
      loadingFor.current = ''
      setTable({ ...freshLocal(lang, meSeat, stayed.filter((id) => !gone.includes(id)), mine), seed: fresh, rematch: 'open' })
      return
    }
    if (!table.id) return
    // Une seule revanche par table : qui la demande après un autre la rejoint.
    void openDuelRematch(table.id, mine.length).then(async (id) => {
      if (!id || (await joinDuel(id, mine.length)) !== 'joined') return
      setJudge(null)
      loadingFor.current = ''
      setTableId(id)
    })
  }, [lang, meSeat, mine, mode, present, table])

  const joinRematch = useCallback(() => {
    if (!table) return
    if (mode === 'local') return
    const next = table.rematch
    if (!next) return
    void joinDuel(next, mine.length).then((outcome) => {
      if (outcome !== 'joined') return
      setJudge(null)
      loadingFor.current = ''
      setTableId(next)
    })
  }, [mine.length, mode, table])

  /** Le salon de revanche locale rend la table finie, telle qu'elle était. */
  const backToRecap = useCallback(() => {
    if (mode !== 'local' || !finished.current || me?.ready) return
    setTable(finished.current)
    finished.current = null
  }, [me?.ready, mode])

  const currentId = table?.id ?? null
  const leave = useCallback(() => {
    if (mode === 'online') {
      if (currentId) void leaveDuel(currentId)
      exit.current?.(null)
      return
    }
    if (exit.current) {
      exit.current(null)
      return
    }
    finished.current = null
    readyMarks.current = {}
    setLeavers([])
    setJudge(null)
    loadingFor.current = ''
    setTable(freshLocal(lang, meSeat, [HOUSE_BOTS[0]!.id], mine))
  }, [currentId, lang, meSeat, mine, mode])

  // ------------------------------------------------------ mes gestes --

  const myTurn = phase === 'play' && duel?.turn?.player === myIndex
  const pick = useCallback(
    (categoryId: string) => {
      if (!duel || duel.phase !== 'draft' || draftComplete(duel) || draftPlayer(duel) !== myIndex) return
      if (!duel.categories.includes(categoryId) || duel.picks.includes(categoryId)) return
      void post({ seat: myIndex, kind: 'pick', payload: categoryId })
    },
    [duel, myIndex, post],
  )

  const lastCheer = useRef({ categoryId: '', at: 0 })
  const cheer = useCallback(
    (categoryId: string) => {
      if (!duel || duel.phase !== 'draft' || draftComplete(duel) || draftPlayer(duel) === myIndex) return
      if (!duel.categories.includes(categoryId) || duel.picks.includes(categoryId)) return
      // Le même conseil répété sous le doigt ne part qu'une fois par seconde :
      // c'est un geste, pas un vote.
      if (lastCheer.current.categoryId === categoryId && at - lastCheer.current.at < 1) return
      lastCheer.current = { categoryId, at }
      void post({ seat: myIndex, kind: 'cheer', payload: categoryId })
    },
    [at, duel, myIndex, post],
  )

  const inspect = useCallback(
    (raw: string): Verdict => (duel && judge && myIndex >= 0 ? inspectFor(duel, myIndex, raw, judge) : { kind: 'empty', found: null }),
    [duel, judge, myIndex],
  )

  const play = useCallback(
    (raw: string) => {
      if (!duel || !judge || !myTurn) return
      if (inspectFor(duel, myIndex, raw, judge).kind !== 'accepted') return
      void post({ seat: myIndex, kind: 'word', payload: raw })
    },
    [duel, judge, myIndex, myTurn, post],
  )

  const pass = useCallback(() => {
    if (!duel || !myTurn) return
    if (reserveSeconds(duel, myIndex, at) < DUEL_PASS_PENALTY_SECONDS) return
    void post({ seat: myIndex, kind: 'pass', payload: '' })
  }, [at, duel, myIndex, myTurn, post])

  const hold = useCallback((raw: string) => {
    pending.current = raw
  }, [])

  // Le raccourci de développement `#auto` (table locale) : la table s'ouvre
  // avec les trois joueurs maison, je me déclare prêt, je choisis et je valide
  // comme un robot — de quoi regarder chaque écran sans jouer trois minutes.
  const auto = useMemo(() => mode === 'local' && typeof location !== 'undefined' && /auto/.test(location.hash), [mode])
  useEffect(() => {
    if (!auto || !table) return
    if (table.status === 'lobby' && !me?.ready) {
      const missing = HOUSE_BOTS.find((bot) => !present.some((seat) => seat.id === bot.id) && !leavers.includes(bot.id))
      if (missing && !table.rematch) invite(missing.id)
      else setMyReady(true)
      return
    }
    if (!duel || myIndex < 0) return
    if (duel.phase === 'draft' && !draftComplete(duel) && draftPlayer(duel) === myIndex && !onlyChoice(duel) && at > duel.pickSince + 1.2) {
      const choice = duel.categories.find((id) => !duel.picks.includes(id))
      if (choice) pick(choice)
      return
    }
    const turn = duel.turn
    if (judge && duel.phase === 'play' && turn?.player === myIndex && at >= turn.startedAt + 1.4) {
      const word = judge.common?.(turn.prompt.categoryId, turn.prompt.letter, duel.players[myIndex]?.used ?? [])
      if (word) play(word)
      else pass()
    }
  }, [at, auto, duel, invite, judge, leavers, me?.ready, myIndex, pass, pick, play, present, setMyReady, table])

  // ------------------------------------------------------ ce que l'écran lit --

  const lobbySeats: readonly Seat[] = table?.status === 'lobby' ? [...present, ...(table.invites ?? [])] : players
  const drafting = duel && duel.phase === 'draft' && !draftComplete(duel)
  const picker = drafting && phase === 'draft' ? (players[draftPlayer(duel)] ?? null) : null
  // Le salon ne retient personne : dès que c'est à moi de choisir, le draft
  // reprend l'écran — et un draft qui n'est plus là referme la vue.
  useEffect(() => {
  if (!draftLobby) return
  if (phase !== 'draft' || (picker && picker.id === myId)) setDraftLobby(false)
  }, [draftLobby, myId, phase, picker])
  const showLobby = useCallback(() => setDraftLobby(true), [])
  const hideLobby = useCallback(() => setDraftLobby(false), [])
  const feed = facts.filter((fact) => fact.kind !== 'picked' && fact.kind !== 'cheered').slice(-FEED_SIZE).reverse()
  const ready: Record<string, boolean> = {}
  for (const seat of present) ready[seat.id] = seat.ready
  const takenIds = new Set([...present.map((seat) => seat.id), ...(table?.invites ?? []).map((seat) => seat.id)])
  const offered: readonly Candidate[] =
    mode === 'local'
      ? HOUSE_BOTS.filter((bot) => !takenIds.has(bot.id) && !leavers.includes(bot.id)).map((bot) => ({ id: bot.id, name: bot.name, avatar: bot.avatar, bot: true, trait: bot.trait }))
      : candidates.filter((candidate) => !takenIds.has(candidate.id))
  const opensAt = duel ? openingAt(duel) : null
  const drawnShown = duel ? drawnShownAt(duel, at) : 0

  return {
    mode,
    phase,
    at,
    seats: lobbySeats,
    myIndex: table?.status === 'lobby' ? lobbySeats.findIndex((seat) => seat.id === myId) : myIndex,
    host: isHost,
    candidates: offered,
    invite,
    kick,
    ready,
    markReady: () => setMyReady(true),
    unready: () => setMyReady(false),
    cancelStart,
    draftLobby,
    showLobby,
    hideLobby,
    duel,
    judge,
    pool: table?.categories ?? mine,
    prompt: (duel ? duelPrompt(duel) : null) ?? replayed?.lastPrompt ?? null,
    picker,
    pickLeft: picker && duel ? Math.max(0, pickDeadline(duel) - at) : 0,
    forced: drafting ? onlyChoice(duel) : null,
    myTurn,
    myPickTurn: !!picker && picker.id === myId,
    watching: phase === 'play' && !!duel?.turn && duel.turn.player !== myIndex,
    event: feed[0] ?? null,
    feed,
    facts,
    cheers,
    error: failed,
    offline,
    joined: tableId !== null,
    embedded: !!onExit,
    fallen: phase === 'deaths' && lastDeath ? lastDeath.player : null,
    fallenAt: lastDeath?.at ?? 0,
    openingAt: opensAt === null ? 0 : opensAt - DUEL_OPENING_SECONDS + DRAFT_HOLD_SECONDS,
    drawnShown,
    rematchOpen: mode === 'local' ? table?.rematch === 'open' : !!table?.rematch,
    leavers,
    openRematch,
    joinRematch,
    backToRecap,
    inspect,
    hold,
    pick,
    cheer,
    play,
    pass,
    leave,
  }
}
