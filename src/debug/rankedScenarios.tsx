/**
 * Les planches du duel classé : la file et son attente, l'adversaire trouvé,
 * la pause après trop d'abandons, le classement, le bilan d'Elo, une place
 * hors ligne en pleine partie et la reprise d'un duel. Des données inventées,
 * des doublures pour chaque appel : rien n'atteint le serveur.
 */
import { useEffect, useState, type ReactNode } from 'react'
import type { AvatarChoice } from '../domain/avatar'
import { createDuel, openDuel, pickCategory, type Duel } from '../domain/duel'
import { NO_USAGE } from '../domain/rarity'
import type { Judge } from '../domain/run'
import { buildWordPack, commonWord, findWord, lettersWithEnough, type WordPack } from '../domain/words'
import type { DuelLadderRow, DuelOpponent, DuelRatingInfo } from '../lib/cloud'
import type { DuelTable, Seat } from '../state/duel'
import type { DuelQueue, QueueState, WaitingInfo } from '../state/duelQueue'
import { DuelLadder, DuelMatchmaking, Over, Play } from '../ui/DuelScreen'
import { MatchFound } from '../ui/MatchFound'
import { DuelResumeCard } from '../ui/PlayTogether'
import { QueuePill } from '../ui/QueuePill'

const noop = () => {}

const ONDINE: AvatarChoice = { design: 21, ground: 'bleu', shape: 'jaune', accent: 'rouge' }
const ME_RATING: DuelRatingInfo = { rating: 1142, games: 23, wins: 13, peak: 1160, rank: 38 }
const OPPONENT: DuelOpponent = { player: 'ondine', name: 'Ondine', avatar: ONDINE, accepted: false, rating: 1188, games: 41, wins: 24, peak: 1230, rank: 27 }

/** Une file de planche : l'état qu'on lui donne, une horloge, et des gestes sans effet ou locaux. */
export function boardQueue(state: QueueState, now: number, over: Partial<DuelQueue> = {}): DuelQueue {
  return { state, now, start: noop, cancel: noop, accept: noop, decline: noop, dismiss: noop, reset: noop, ...over }
}

function waiting(over: Partial<WaitingInfo> = {}): WaitingInfo {
  return { status: 'waiting', now: 0, joined: 0, estimate: 35, searching: 2, playing: 6, publicTable: null, me: ME_RATING, ...over }
}

/** Une horloge qui avance à la seconde, pour que l'attente et le décompte bougent sur la planche. */
function useBoardClock(start: number): number {
  const [now, setNow] = useState(start)
  useEffect(() => {
    const timer = setInterval(() => setNow((current) => current + 1), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export type MatchmakingCase = 'searching' | 'long' | 'cooldown' | 'missed'

/** La recherche, dans l'un de ses états ; « Annuler » et « Relancer » basculent pour de vrai. */
export function MatchmakingScenario({ kind, onBack }: { kind: MatchmakingCase; onBack(): void }) {
  const now = useBoardClock(1000)
  const [stopped, setStopped] = useState(kind === 'missed')
  const [ladder, setLadder] = useState(false)
  let state: QueueState
  if (stopped) state = { kind: 'idle', notice: kind === 'missed' ? 'missed' : null }
  else if (kind === 'cooldown') state = { kind: 'cooldown', until: 1000 + 4 * 60 + 12 }
  else if (kind === 'long') state = { kind: 'searching', since: 1000 - 74, info: waiting({ estimate: 40, searching: 0, playing: 3, publicTable: { id: 'public', seats: 2 } }), offline: false, bounced: true }
  else state = { kind: 'searching', since: 1000 - 12, info: waiting(), offline: false, bounced: false }
  const queue = boardQueue(state, now, { cancel: () => setStopped(true), start: () => setStopped(false) })
  return (
    <>
      <DuelMatchmaking queue={queue} onBots={onBack} onPublic={onBack} onHome={onBack} onLadder={() => setLadder(true)} />
      {ladder ? <DuelLadder onClose={() => setLadder(false)} load={ladderStub} /> : null}
    </>
  )
}

/** L'adversaire trouvé : « Accepter » passe à l'attente de l'autre, qui accepte deux secondes plus tard. */
export function MatchFoundScenario({ ranked = true, onBack }: { ranked?: boolean; onBack(): void }) {
  const now = useBoardClock(1000)
  const [accepted, setAccepted] = useState(false)
  const [theirs, setTheirs] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setTheirs(true), 6000)
    return () => clearTimeout(timer)
  }, [])
  const state: QueueState = {
    kind: 'found',
    since: 960,
    offer: { table: 'board', ranked, accepted, me: ME_RATING, opponent: { ...OPPONENT, accepted: theirs } },
    deadline: 1020,
    sending: false,
  }
  return (
    <div className="stage stage--duel">
      <MatchFound queue={boardQueue(state, Math.min(now, 1020), { accept: () => setAccepted(true), decline: onBack })} />
    </div>
  )
}

/** La pastille de la file, à l'accueil : la recherche continue pendant qu'on fait autre chose. */
export function QueuePillScenario({ onBack, home }: { onBack(): void; home: ReactNode }) {
  const now = useBoardClock(1000)
  const state: QueueState = { kind: 'searching', since: 1000 - 47, info: waiting({ estimate: 50 }), offline: false, bounced: false }
  return (
    <>
      {home}
      <QueuePill queue={boardQueue(state, now, { cancel: onBack })} onOpen={onBack} />
    </>
  )
}

const LADDER: readonly DuelLadderRow[] = [
  { player: 'a', name: 'Gaspard', avatar: { design: 12, ground: 'rouge', shape: 'creme', accent: 'jaune' }, rating: 1486, games: 88, wins: 61, peak: 1502, rank: 1 },
  { player: 'b', name: 'Inès', avatar: { design: 33, ground: 'vert', shape: 'jaune', accent: 'rouge' }, rating: 1412, games: 64, wins: 40, peak: 1420, rank: 2 },
  { player: 'c', name: 'Ondine', avatar: ONDINE, rating: 1188, games: 41, wins: 24, peak: 1230, rank: 3 },
  { player: 'e', name: 'Lucie', avatar: { design: 47, ground: 'jaune', shape: 'bleu', accent: 'rouge' }, rating: 1171, games: 12, wins: 5, peak: 1190, rank: 4 },
  { player: 'f', name: 'Bastien', avatar: { design: 2, ground: 'bleu', shape: 'creme', accent: 'jaune' }, rating: 1158, games: 9, wins: 2, peak: 1160, rank: 5 },
  { player: 'g', name: 'Maëlle', avatar: { design: 40, ground: 'rouge', shape: 'bleu', accent: 'creme' }, rating: 1013, games: 30, wins: 14, peak: 1101, rank: 6 },
  { player: 'h', name: 'Noé', avatar: { design: 9, ground: 'vert', shape: 'rouge', accent: 'jaune' }, rating: 904, games: 7, wins: 2, peak: 1000, rank: 7 },
]

const ladderStub = () => Promise.resolve({ rows: [...LADDER], me: ME_RATING })

export function LadderScenario({ onBack }: { onBack(): void }) {
  return (
    <div className="stage stage--duel">
      <DuelLadder onClose={onBack} load={ladderStub} />
    </div>
  )
}

/** Le bilan d'un duel classé : réglé (une ligue franchie), en cours de règlement, ou annulé. */
export function RankedOverScenario({ base, settle }: { base: DuelTable; settle: 'promoted' | 'lost' | 'settling' | 'voided' }) {
  const rating =
    settle === 'settling'
      ? null
      : settle === 'voided'
        ? { settled: true, voided: true, before: 1093, after: 1093, games: 23 }
        : settle === 'lost'
          ? { settled: true, voided: false, before: 1142, after: 1131, games: 24 }
          : { settled: true, voided: false, before: 1093, after: 1108, games: 24 }
  return <Over table={{ ...base, ranked: true, rating }} />
}

// ------------------------------------------------ une place hors ligne --

const PLAY_IDS = ['animaux', 'pays', 'couleurs', 'metiers', 'sports']

function boardPack(id: string): WordPack {
  return buildWordPack(
    id,
    'ABCDEFGHILMNOPRST'.split('').flatMap((letter) => Array.from({ length: 12 }, (_, i) => [`${letter}${id}${i}`, 50, 1] as const)),
  )
}

const boardPacks = new Map(PLAY_IDS.map((id) => [id, boardPack(id)]))
const BOARD_JUDGE: Judge = {
  find: (id, word) => (boardPacks.get(id) ? findWord(boardPacks.get(id)!, word) : null),
  usage: () => NO_USAGE,
  known: () => 12,
  letters: (id) => (boardPacks.get(id) ? lettersWithEnough(boardPacks.get(id)!, 12) : []),
  common: (id, letter, played) => (boardPacks.get(id) ? commonWord(boardPacks.get(id)!, letter, played) : null),
}

/**
 * Une partie classée où Ondine a perdu sa connexion pendant son tour : sa place
 * pâlit et dit « Hors ligne », sa réserve continue de couler. Le joueur
 * attend son tour.
 */
export function AwayScenario({ base }: { base: DuelTable }) {
  const seats: readonly Seat[] = [
    { id: 'me', name: 'Jérémy', avatar: { design: 5, ground: 'rose', shape: 'vert', accent: 'creme' }, bot: false, owned: 7, ready: true },
    { id: 'ondine', name: 'Ondine', avatar: ONDINE, bot: false, owned: 9, ready: true },
  ]
  let duel: Duel = createDuel({ seed: 11, playerIds: ['me', 'ondine'], categories: PLAY_IDS, opener: 1, at: 0 })
  for (const id of PLAY_IDS.slice(0, 4)) duel = pickCategory(duel, id, 1)
  duel = openDuel(duel, BOARD_JUDGE, 2)
  const at = duel.turn!.startedAt + 11.4
  return (
    <Play
      table={{
        ...base,
        mode: 'online',
        phase: 'play',
        at,
        seats,
        myIndex: 0,
        duel,
        judge: BOARD_JUDGE,
        prompt: duel.turn!.prompt,
        picker: null,
        myTurn: false,
        watching: true,
        ranked: true,
        away: [1],
        event: null,
        feed: [],
        facts: [],
        fallen: null,
      }}
    />
  )
}

export function ResumeScenario({ onBack }: { onBack(): void }) {
  return (
    <div className="stage stage--home">
      <div className="sheet">
        <DuelResumeCard onResume={onBack} onDrop={onBack} />
      </div>
    </div>
  )
}
