/**
 * Les planches du duel classé : la file et son attente, l'adversaire trouvé,
 * la pause après trop d'abandons, le classement, le bilan d'Elo, une place
 * hors ligne en pleine partie et la reprise d'un duel. Des données inventées,
 * des doublures pour chaque appel : rien n'atteint le serveur.
 */
import { useEffect, useState, type ReactNode } from 'react'
import type { AvatarChoice } from '../domain/avatar'
import { createDuel, inspectFor, openDuel, pickCategory, type Duel } from '../domain/duel'
import type { DuelFact } from '../domain/duelLog'
import { NO_USAGE } from '../domain/rarity'
import type { Judge } from '../domain/run'
import { buildWordPack, commonWord, findWord, lettersWithEnough, type WordPack } from '../domain/words'
import type { DuelLadderRow, DuelLadderView, DuelOpponent, DuelRatingInfo } from '../lib/cloud'
import { standing } from '../domain/ranked'
import type { DuelTable, Seat } from '../state/duel'
import type { DuelQueue, QueueState, WaitingInfo } from '../state/duelQueue'
import { DuelMatchmaking, Over, Play } from '../ui/DuelScreen'
import { LeaderboardsScreen } from '../ui/LeaderboardsScreen'
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
  let state: QueueState
  if (stopped) state = { kind: 'idle', notice: kind === 'missed' ? 'missed' : null }
  else if (kind === 'cooldown') state = { kind: 'cooldown', until: 1000 + 3870 }
  else if (kind === 'long') state = { kind: 'searching', since: 1000 - 74, info: waiting({ estimate: 40, searching: 0, playing: 3, publicTable: { id: 'public', seats: 2 } }), offline: false, bounced: true }
  else state = { kind: 'searching', since: 1000 - 12, info: waiting(), offline: false, bounced: false }
  const queue = boardQueue(state, now, { cancel: () => setStopped(true), start: () => setStopped(false) })
  return (
    <>
      <DuelMatchmaking queue={queue} onBots={onBack} onPublic={onBack} onHome={onBack} onLadder={onBack} />
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
  { player: 'p0', name: 'Gaspard', avatar: { design: 12, ground: 'rouge', shape: 'creme', accent: 'jaune' }, rating: 1612, games: 40, wins: 20, peak: 1632, rank: 1 },
  { player: 'p1', name: 'Inès', avatar: { design: 33, ground: 'vert', shape: 'jaune', accent: 'rouge' }, rating: 1571, games: 43, wins: 21, peak: 1591, rank: 2 },
  { player: 'p2', name: 'Ondine', avatar: { design: 21, ground: 'bleu', shape: 'jaune', accent: 'rouge' }, rating: 1544, games: 46, wins: 22, peak: 1564, rank: 3 },
  { player: 'p3', name: 'Lucie', avatar: { design: 47, ground: 'jaune', shape: 'bleu', accent: 'rouge' }, rating: 1503, games: 49, wins: 23, peak: 1523, rank: 4 },
  { player: 'p4', name: 'Bastien', avatar: { design: 2, ground: 'bleu', shape: 'creme', accent: 'jaune' }, rating: 1488, games: 52, wins: 24, peak: 1508, rank: 5 },
  { player: 'p5', name: 'Maëlle', avatar: { design: 40, ground: 'rouge', shape: 'bleu', accent: 'creme' }, rating: 1460, games: 55, wins: 25, peak: 1480, rank: 6 },
  { player: 'p6', name: 'Noé', avatar: { design: 9, ground: 'vert', shape: 'rouge', accent: 'jaune' }, rating: 1441, games: 58, wins: 26, peak: 1461, rank: 7 },
  { player: 'p7', name: 'Yanis', avatar: { design: 15, ground: 'rose', shape: 'bleu', accent: 'jaune' }, rating: 1430, games: 61, wins: 27, peak: 1450, rank: 8 },
  { player: 'p8', name: 'Clémence', avatar: { design: 28, ground: 'jaune', shape: 'vert', accent: 'rouge' }, rating: 1412, games: 64, wins: 28, peak: 1432, rank: 9 },
  { player: 'p9', name: 'Hugo', avatar: { design: 36, ground: 'bleu', shape: 'rouge', accent: 'creme' }, rating: 1398, games: 67, wins: 29, peak: 1418, rank: 10 },
  { player: 'p10', name: 'Salomé', avatar: { design: 7, ground: 'vert', shape: 'creme', accent: 'bleu' }, rating: 1415, games: 70, wins: 30, peak: 1391, rank: 11 },
  { player: 'p11', name: 'Arthur', avatar: { design: 44, ground: 'rouge', shape: 'jaune', accent: 'bleu' }, rating: 1404, games: 73, wins: 31, peak: 1362, rank: 12 },
  { player: 'p12', name: 'Léna', avatar: { design: 19, ground: 'rose', shape: 'vert', accent: 'jaune' }, rating: 1296, games: 76, wins: 32, peak: 1316, rank: 13 },
  { player: 'p13', name: 'Tom', avatar: { design: 3, ground: 'jaune', shape: 'rouge', accent: 'bleu' }, rating: 1251, games: 79, wins: 33, peak: 1271, rank: 14 },
  { player: 'n1', name: 'Rosalie', avatar: { design: 11, ground: 'vert', shape: 'jaune', accent: 'rouge' }, rating: 1160, games: 40, wins: 20, peak: 1180, rank: 36 },
  { player: 'n2', name: 'Victor', avatar: { design: 26, ground: 'rouge', shape: 'creme', accent: 'bleu' }, rating: 1151, games: 22, wins: 11, peak: 1170, rank: 37 },
  { player: 'n3', name: 'Testeur', avatar: { design: 5, ground: 'rose', shape: 'vert', accent: 'creme' }, rating: 1142, games: 23, wins: 13, peak: 1160, rank: 38 },
  { player: 'n4', name: 'Anouk', avatar: { design: 31, ground: 'jaune', shape: 'bleu', accent: 'rouge' }, rating: 1137, games: 18, wins: 9, peak: 1150, rank: 39 },
  { player: 'n5', name: 'Mathis', avatar: { design: 14, ground: 'bleu', shape: 'rouge', accent: 'jaune' }, rating: 1128, games: 51, wins: 25, peak: 1200, rank: 40 },
  { player: 'n6', name: 'Zoé', avatar: { design: 8, ground: 'vert', shape: 'creme', accent: 'rose' }, rating: 1013, games: 12, wins: 5, peak: 1050, rank: 61 },
  { player: 'n7', name: 'Lou', avatar: { design: 45, ground: 'rouge', shape: 'jaune', accent: 'bleu' }, rating: 905, games: 6, wins: 1, peak: 1000, rank: 88 },
]

/** Le classement inventé, vu d'un rang : les vues filtrent les mêmes joueurs que le serveur. */
const ladderStub = (view: DuelLadderView) => {
  const league = (row: DuelLadderRow) => standing(row, row.rank).tier
  const rows = LADDER.filter((row) => {
    const tier = league(row)
    if (view === 'top') return true
    if (view === 'master') return tier.kind === 'master'
    if (view === 'me') return (row.rank ?? 0) >= 31 && (row.rank ?? 0) <= 45
    return tier.kind === 'league' && tier.league === view
  })
  return Promise.resolve({ rows, me: ME_RATING })
}

/** Les rangs inventés des noms des tableaux de la planche (`fakeLeaderboard`) : un par nom, de tout. */
export const badgesStub = (names: readonly string[]) =>
  Promise.resolve(
    new Map(
      names.map((name, index) => {
        const rating = [1640, 1560, 1470, 1420, 1330, 1290, 1180, 1120, 1060, 990, 900, 820][index % 12]!
        return [name, { rating, games: index === 5 ? 2 : 30, wins: 10, peak: rating, rank: index < 2 ? index + 1 : 20 + index }] as const
      }),
    ),
  )

/** Les classements en pleine page, ouverts sur le duel classé. */
export function LadderScenario({ onBack, load, initial = 'duel' }: { onBack(): void; load: Parameters<typeof LeaderboardsScreen>[0]['load']; initial?: 'runs' | 'duel' }) {
  return <LeaderboardsScreen named duel initial={initial} load={load} loadLadder={ladderStub} badges={badgesStub} onBack={onBack} />
}

/** Le bilan d'un duel classé : réglé (une ligue franchie), en cours de règlement, ou annulé. */
export function RankedOverScenario({ base, settle }: { base: DuelTable; settle: 'promoted' | 'lost' | 'settling' | 'voided' | 'placed' | 'demoted' | 'master' }) {
  const rating =
    settle === 'placed'
      ? { settled: true, voided: false, before: 1062, after: 1131, games: 3, rank: null }
      : settle === 'demoted'
        ? { settled: true, voided: false, before: 1104, after: 1093, games: 31, rank: null }
        : settle === 'master'
          ? { settled: true, voided: false, before: 1468, after: 1479, games: 88, rank: 7 }
          : settle === 'settling'
      ? null
      : settle === 'voided'
        ? { settled: true, voided: true, before: 1093, after: 1093, games: 23, rank: null }
        : settle === 'lost'
          ? { settled: true, voided: false, before: 1142, after: 1131, games: 24, rank: null }
          : { settled: true, voided: false, before: 1093, after: 1108, games: 24, rank: null }
  if (settle === 'demoted') return <Over table={{ ...base, myIndex: 1, ranked: true, rating }} />
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

// ------------------------------------------- le parcours, vu des deux joueurs --

const JEREMY: AvatarChoice = { design: 5, ground: 'rose', shape: 'vert', accent: 'creme' }
const JEREMY_RATING: DuelRatingInfo = { rating: 1093, games: 23, wins: 12, peak: 1110, rank: 54 }
const ONDINE_RATING: DuelRatingInfo = { rating: 1121, games: 41, wins: 22, peak: 1160, rank: 47 }

export type Side = 'a' | 'b'

/** La recherche de chacun : Jérémy cherche depuis un moment, Ondine vient d'arriver. */
export function FlowSearchScenario({ side, onBack }: { side: Side; onBack(): void }) {
  const now = useBoardClock(1000)
  const state: QueueState =
    side === 'a'
      ? { kind: 'searching', since: 1000 - 21, info: waiting({ estimate: 25, searching: 0, playing: 4, me: JEREMY_RATING }), offline: false, bounced: false }
      : { kind: 'searching', since: 1000 - 2, info: waiting({ estimate: 25, searching: 1, playing: 4, me: ONDINE_RATING }), offline: false, bounced: false }
  return <DuelMatchmaking queue={boardQueue(state, now)} onBots={onBack} onPublic={onBack} onHome={onBack} onLadder={noop} />
}

/** L'adversaire trouvé, de chaque côté : Jérémy a accepté et attend, Ondine décide. */
export function FlowFoundScenario({ side, behind }: { side: Side; behind?: ReactNode }) {
  const now = useBoardClock(1006)
  const mine = side === 'a' ? JEREMY_RATING : ONDINE_RATING
  const opponent: DuelOpponent =
    side === 'a'
      ? { player: 'ondine', name: 'Ondine', avatar: ONDINE, accepted: false, ...ONDINE_RATING }
      : { player: 'jeremy', name: 'Jérémy', avatar: JEREMY, accepted: true, ...JEREMY_RATING }
  const state: QueueState = { kind: 'found', since: 960, offer: { table: `flow-${side}`, ranked: true, accepted: side === 'a', me: mine, opponent }, deadline: 1020, sending: false }
  return (
    <div className="stage stage--duel">
      {behind}
      <MatchFound queue={boardQueue(state, Math.min(now, 1020))} />
    </div>
  )
}

/** Pendant la recherche, la table des joueurs ordinateur : la pastille de la file en haut. */
export function BotsWhileQueueScenario({ table }: { table: ReactNode }) {
  const now = useBoardClock(1000)
  const state: QueueState = { kind: 'searching', since: 1000 - 38, info: waiting({ estimate: 45, me: JEREMY_RATING }), offline: false, bounced: false }
  return (
    <>
      {table}
      <QueuePill queue={boardQueue(state, now)} place="top" onOpen={noop} />
    </>
  )
}

function flowSeats(): readonly Seat[] {
  return [
    { id: 'jeremy', name: 'Jérémy', avatar: JEREMY, bot: false, owned: 7, ready: true, rating: JEREMY_RATING.rating, games: JEREMY_RATING.games },
    { id: 'ondine', name: 'Ondine', avatar: ONDINE, bot: false, owned: 9, ready: true, rating: ONDINE_RATING.rating, games: ONDINE_RATING.games },
  ]
}

/**
 * La partie classée, vue de chaque place. `away` : Ondine a perdu sa connexion
 * — Jérémy voit sa place pâlir, Ondine voit « connexion perdue » chez elle.
 */
export function FlowPlayScenario({ base, side, away = false, echo = false }: { base: DuelTable; side: Side; away?: boolean; echo?: boolean }) {
  let duel: Duel = createDuel({ seed: 11, playerIds: ['jeremy', 'ondine'], categories: PLAY_IDS, opener: 1, at: 0 })
  for (const id of PLAY_IDS.slice(0, 4)) duel = pickCategory(duel, id, 1)
  duel = openDuel(duel, BOARD_JUDGE, 2)
  const myIndex = side === 'a' ? 0 : 1
  const holder = duel.turn!.player
  const at = duel.turn!.startedAt + (away ? 11.4 : 4.2)
  const prompt = duel.turn!.prompt
  // Jérémy a déjà trouvé un mot pendant le tour d'Ondine : le fil le dit chez elle.
  const echoed: DuelFact[] = echo && side === 'b' ? [{ id: '6', kind: 'echoed', player: 0, at: at - 1, word: `${prompt.letter}${prompt.categoryId}1`, tier: 'courant', delta: 1 }] : []
  if (echo && side === 'b') duel = { ...duel, players: duel.players.map((player, index) => (index === 0 ? { ...player, reserve: player.reserve + 1 } : player)), turn: { ...duel.turn!, echoes: [0] } }
  return (
    <>
    {/* La réponse que le script des captures tape dans le champ : un mot du juge de planche. */}
    <span hidden data-board-answer={`${prompt.letter}${prompt.categoryId}2`} />
    <Play
      table={{
        ...base,
        mode: 'online',
        phase: 'play',
        at,
        seats: flowSeats(),
        myIndex,
        duel,
        judge: BOARD_JUDGE,
        prompt: duel.turn!.prompt,
        picker: null,
        myTurn: holder === myIndex,
        watching: holder !== myIndex,
        ranked: true,
        away: away && side === 'a' ? [1] : [],
        offline: away && side === 'b',
        joined: true,
        event: echoed[0] ?? null,
        feed: echoed,
        facts: echoed,
        fallen: null,
        echoes: true,
        echoesLeft: 3,
        inspect: (raw) => inspectFor(duel, myIndex, raw, BOARD_JUDGE),
      }}
    />
    </>
  )
}

/** La fin, de chaque côté : la réserve d'Ondine est tombée, Jérémy gagne et monte en Or, Ondine perd des points. */
export function FlowOverScenario({ base, side }: { base: DuelTable; side: Side }) {
  const duel = base.duel!
  const players = [
    { ...duel.players[0]!, id: 'jeremy', alive: true },
    { ...duel.players[1]!, id: 'ondine', alive: false },
  ]
  const twoPlayers: Duel = { ...duel, players, deaths: [1] }
  const rating =
    side === 'a'
      ? { settled: true, voided: false, before: 1093, after: 1104, games: 24, rank: null }
      : { settled: true, voided: false, before: 1121, after: 1110, games: 42, rank: null }
  return (
    <Over
      table={{
        ...base,
        seats: flowSeats(),
        myIndex: side === 'a' ? 0 : 1,
        duel: twoPlayers,
        ranked: true,
        rating,
        payout: side === 'a' ? base.payout : null,
      }}
    />
  )
}
