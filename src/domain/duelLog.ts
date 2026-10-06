/**
 * Une table de duel se résume à un journal de coups datés : chaque appareil le
 * rejoue par les règles de `duel.ts` et obtient la même partie, qu'il soit en
 * ligne ou seul contre les joueurs maison. Ce fichier dit comment un coup se
 * rejoue, ce qu'il a fait (le fil de la table), et quel coup un appareil doit
 * déclarer de lui-même — pour un joueur maison, un choix que le temps a
 * tranché, ou un absent dont la réserve est vide.
 *
 * Les heures sont celles de l'horloge de la table, en secondes : celle du
 * serveur en ligne, celle de l'appareil seul.
 */
import {
  botMove,
  botPick,
  createDuel,
  draftComplete,
  draftPlayer,
  duelTimeout,
  forcedPick,
  onlyChoice,
  openDuel,
  openingAt,
  passTurn,
  pickCategory,
  pickDeadline,
  playWord,
  reserveSeconds,
  DUEL_GRACE_SECONDS,
  DUEL_PASS_PENALTY_SECONDS,
  DUEL_PICK_SECONDS,
  DUEL_TIME_BONUS,
  type BotProfile,
  type Duel,
} from './duel'
import type { RarityTier } from './rarity'
import type { Judge, Prompt } from './run'

/** Le temps de lire la règle du draft avant le premier choix. */
export const DUEL_ANNOUNCE_SECONDS = 3.2

/** Le silence au-delà duquel un appareil ne relit plus la table : il ne mène plus. */
export const DRIVER_SILENCE = 8

export type DuelMoveKind = 'pick' | 'word' | 'pass' | 'timeout' | 'cheer'

export interface DuelMove {
  seq: number
  /** La place du joueur que le coup concerne. */
  seat: number
  kind: DuelMoveKind
  /** La catégorie choisie, celle du conseil, ou le mot validé. */
  payload: string
  at: number
}

/** Un fait de la table : le fil l'affiche, l'écran le fait sonner une fois. */
export interface DuelFact {
  /** Le numéro du coup qui l'a produit : deux appareils nomment le même fait pareil. */
  id: string
  kind: 'picked' | 'solved' | 'passed' | 'failed' | 'dead' | 'cheered'
  player: number
  at: number
  word?: string
  tier?: RarityTier
  /** Ce que le fait a changé à la réserve du joueur, en secondes. */
  delta?: number
  /** Le mot est arrivé à zéro et a sauvé son joueur. */
  saved?: boolean
  /** La catégorie choisie, ou le couple refusé par toute la table. */
  prompt?: { categoryId: string; letter: string }
 /** La catégorie qu'un joueur conseille à celui qui choisit. */
 cheer?: string
}

export interface DuelSetup {
  seed: number
  /** Les joueurs dans l'ordre des places. */
  playerIds: readonly string[]
  categories: readonly string[]
  /** La taille du catalogue de chacun, place par place : le plus petit ouvre le draft. */
  owned: readonly number[]
  /** L'heure où la table s'est lancée. */
  startedAt: number
}

/** La table au lancement : le draft s'ouvre après l'annonce de sa règle. */
export function startDuel(setup: DuelSetup): Duel {
  const order = setup.playerIds.map((_, index) => index).sort((a, b) => (setup.owned[a] ?? 0) - (setup.owned[b] ?? 0) || a - b)
  return createDuel({
    seed: setup.seed,
    playerIds: setup.playerIds,
    categories: setup.categories,
    order,
    at: setup.startedAt + DUEL_ANNOUNCE_SECONDS,
  })
}

/** La première manche s'ouvre à son heure, dès que les dictionnaires sont là. */
export function settle(duel: Duel, judge: Judge | null, at: number): Duel {
  const opens = openingAt(duel)
  if (!judge || duel.phase !== 'draft' || !draftComplete(duel) || opens === null || at < opens) return duel
  return openDuel(duel, judge, opens)
}

export interface Replayed {
  duel: Duel
  facts: readonly DuelFact[]
  /** Les coups rejoués : les suivants attendent les dictionnaires. */
  applied: number
  /** Le dernier couple qu'un joueur a eu en main : la dernière mort retire le tour, pas l'écran derrière elle. */
  lastPrompt: Prompt | null
}

/**
 * Rejoue le journal dans l'ordre. Un coup qui ne s'applique pas — le mauvais
 * joueur, un mot que le dictionnaire refuse, une réserve encore pleine pour un
 * temps écoulé — ne change rien : deux appareils qui l'ont envoyé en même
 * temps lisent la même partie. Sans dictionnaires, le rejeu s'arrête au
 * premier coup qui en a besoin.
 */
export function replay(setup: DuelSetup, moves: readonly DuelMove[], judge: Judge | null): Replayed {
  let duel = startDuel(setup)
  const facts: DuelFact[] = []
  let applied = 0
  let lastPrompt: Prompt | null = null
  for (const move of moves) {
    if (move.kind !== 'pick' && move.kind !== 'cheer' && !judge) break
    const next = applyMove(duel, move, judge)
    lastPrompt = settle(duel, judge, move.at).turn?.prompt ?? lastPrompt
    facts.push(...next.facts)
    duel = next.duel
    applied += 1
  }
  return { duel, facts, applied, lastPrompt: duel.turn?.prompt ?? lastPrompt }
}

export function applyMove(before: Duel, move: DuelMove, judge: Judge | null): { duel: Duel; facts: DuelFact[] } {
  const id = String(move.seq)
  if (move.kind === 'cheer') {
    // Un conseil ne change rien à la table : il ne vit que dans le fil, et
    // seulement tant que le draft attend un autre que lui.
    if (before.phase !== 'draft' || draftComplete(before) || move.seat === draftPlayer(before)) return { duel: before, facts: [] }
    if (!before.players[move.seat] || !before.categories.includes(move.payload) || before.picks.includes(move.payload)) return { duel: before, facts: [] }
    return { duel: before, facts: [{ id, kind: 'cheered', player: move.seat, at: move.at, cheer: move.payload }] }
  }
  if (move.kind === 'pick') {
    if (before.phase !== 'draft' || draftComplete(before) || draftPlayer(before) !== move.seat) return { duel: before, facts: [] }
    const duel = pickCategory(before, move.payload, move.at)
    if (duel === before) return { duel, facts: [] }
    return { duel, facts: [{ id, kind: 'picked', player: move.seat, at: move.at, prompt: { categoryId: move.payload, letter: '' } }] }
  }

  if (!judge) return { duel: before, facts: [] }
  const duel = settle(before, judge, move.at)
  const turn = duel.turn
  if (duel.phase !== 'play' || !turn || turn.player !== move.seat) return { duel: before, facts: [] }

  if (move.kind === 'word') {
    const played = playWord(duel, move.payload, judge, move.at)
    const found = played.verdict.kind === 'accepted' ? played.verdict.found : null
    if (played.duel === duel) return { duel: before, facts: [] }
    const facts: DuelFact[] = found
      ? [{ id, kind: 'solved', player: move.seat, at: move.at, word: found.display, tier: found.tier, delta: DUEL_TIME_BONUS[found.tier], saved: played.saved }]
      : []
    return { duel: played.duel, facts: [...facts, ...consequences(id, duel, played.duel, move, false)] }
  }
  if (move.kind === 'pass') {
    const next = passTurn(duel, judge, move.at)
    const died = next.deaths.length > duel.deaths.length
    const facts: DuelFact[] = died ? [] : [{ id, kind: 'passed', player: move.seat, at: move.at, delta: -DUEL_PASS_PENALTY_SECONDS }]
    return { duel: next, facts: [...facts, ...consequences(id, duel, next, move, true)] }
  }
  const next = duelTimeout(duel, judge, move.at)
  if (next === duel) return { duel: before, facts: [] }
  return { duel: next, facts: consequences(id, duel, next, move, true) }
}

/** Ce qu'un coup a fait au-delà de lui-même : le couple refusé de tous, les morts. */
function consequences(id: string, before: Duel, after: Duel, move: DuelMove, mayFail: boolean): DuelFact[] {
  const facts: DuelFact[] = []
  if (mayFail && after.dealt.length > before.dealt.length && before.turn) {
    facts.push({ id: `${id}:failed`, kind: 'failed', player: move.seat, at: move.at, prompt: before.turn.prompt })
  }
  for (const player of after.deaths.slice(before.deaths.length)) facts.push({ id: `${id}:dead`, kind: 'dead', player, at: move.at })
  return facts
}

export type DriverMove = Omit<DuelMove, 'seq' | 'at'>

/**
 * Le coup que la table attend de son meneur à cette heure, s'il y en a un : un
 * choix de joueur maison, un choix que le temps a tranché, le coup d'un
 * joueur maison quand il a fini de chercher, ou le temps écoulé d'un joueur
 * qui ne répond plus — après la marge, pour que son propre appareil ait pu
 * valider le mot de son champ. Fonction pure de la table : n'importe quel
 * appareil qui reprend la main de meneur déclare les mêmes coups.
 */
export function driverMove(duel: Duel, judge: Judge | null, at: number, bots: Readonly<Record<number, BotProfile>>): DriverMove | null {
  if (duel.phase === 'draft' && !draftComplete(duel)) {
    const seat = draftPlayer(duel)
    const bot = bots[seat]
    const only = onlyChoice(duel)
    if (only) return at >= pickDeadline(duel) ? { seat, kind: 'pick', payload: only } : null
    if (bot) {
      const [least, most] = bot.think
      const budget = Math.min(DUEL_PICK_SECONDS - 0.6, least + (most - least) * 0.55)
      const picked = botPick(duel, bot)
      return picked && at >= duel.pickSince + budget ? { seat, kind: 'pick', payload: picked } : null
    }
    const forced = forcedPick(duel)
    return forced && at >= pickDeadline(duel) ? { seat, kind: 'pick', payload: forced } : null
  }

  if (!judge) return null
  const live = settle(duel, judge, at)
  const turn = live.turn
  if (live.phase !== 'play' || !turn || at < turn.startedAt) return null
  const bot = bots[turn.player]
  if (bot) {
    const move = botMove(live, judge, bot)
    if (!move || at < turn.startedAt + move.after) return null
    return move.word ? { seat: turn.player, kind: 'word', payload: move.word } : { seat: turn.player, kind: 'pass', payload: '' }
  }
  return reserveSeconds(live, turn.player, at) <= -DUEL_GRACE_SECONDS ? { seat: turn.player, kind: 'timeout', payload: '' } : null
}

// -------------------------------------------------------- l'envoi d'un coup --

/** Ce que le serveur répond d'un coup : le reste n'est pas de son ressort. */
export type DuelPostOutcome = 'ok' | 'stale' | 'closed' | 'forbidden' | 'unreachable'

export interface DuelPoster {
  /** Le dernier numéro du journal que cet appareil connaît. */
  lastSeq(): number
  /** Ce qui est inscrit après ce numéro : ce qui dit si un envoi sans réponse est passé. */
  movesAfter(seq: number): readonly DuelMove[]
  post(move: DuelMove): Promise<DuelPostOutcome>
  /** Relit la table : c'est elle qui donne le numéro suivant. */
  read(): Promise<void>
}

export interface DuelPost {
  /** Le coup, sans son numéro ni son heure : le serveur les pose. */
  move: Omit<DuelMove, 'seq' | 'at'>
  /** Le dernier numéro connu avant le premier envoi : ce qui vient après lui vient de cet envoi. */
  mark: number
}

export interface DuelPosted {
  outcome: DuelPostOutcome
  /** Le numéro visé par le dernier essai. */
  seq: number
}

/** Combien de fois un coup perdu à la course au numéro se renvoie. */
export const DUEL_POST_TRIES = 3

/**
 * Un coup part au numéro que la table attend, et deux appareils peuvent viser
 * le même : le second répond `stale` — le serveur n'a rien écrit —, on relit et
 * on renvoie au numéro suivant. Une réponse perdue en chemin, elle, laisse le
 * coup inscrit : la relecture le retrouve après la marque, et on ne le rejoue
 * pas. Un `unreachable` rend la main sans rien jeter : c'est à l'appelant de
 * garder le coup et de le renvoyer avec la même marque.
 */
export async function postMove(poster: DuelPoster, post: DuelPost, tries = DUEL_POST_TRIES): Promise<DuelPosted> {
  let seq = poster.lastSeq() + 1
  for (let attempt = 0; attempt < tries; attempt += 1) {
    seq = poster.lastSeq() + 1
    const outcome = await poster.post({ ...post.move, seq, at: 0 })
    if (outcome !== 'stale' && outcome !== 'unreachable') return { outcome, seq }
    await poster.read()
    if (poster.movesAfter(post.mark).some((one) => sameMove(one, post.move))) return { outcome: 'ok', seq }
    if (outcome === 'unreachable') return { outcome, seq }
  }
  return { outcome: 'stale', seq }
}

/** Deux coups du même siège, de même sorte et de même charge : le même coup. */
function sameMove(one: DuelMove, move: Omit<DuelMove, 'seq' | 'at'>): boolean {
  return one.seat === move.seat && one.kind === move.kind && one.payload === move.payload
}

/**
 * Le meneur : le premier joueur présent, dans l'ordre des places, qui relit
 * encore la table. La main passe au suivant dès que celui-ci part (`gone`) ou se
 * tait depuis `DRIVER_SILENCE` — donc dès que le meneur quitte la table. Un
 * onglet caché ne mène pas non plus : personne ne le regarde, il ne déclarerait
 * rien tant que le joueur est ailleurs.
 */
export function driverOf(
  seats: readonly { id: string; bot: boolean; gone: boolean; seen: number }[],
  at: number,
  mine: { id: string; hidden: boolean },
): string | null {
  const awake = seats.filter(
    (seat) => !seat.bot && !seat.gone && at - seat.seen < DRIVER_SILENCE && !(mine.hidden && seat.id === mine.id),
  )
  return awake[0]?.id ?? null
}

/**
 * Le journal d'un appareil après une relecture : les coups nouveaux à la suite,
 * sans doublon de numéro, et la même référence quand rien n'est nouveau — c'est
 * ce qui évite de rejouer la partie à chaque battement de la relecture. Une
 * autre table (une revanche) rend son journal entier : ses numéros repartent
 * de un.
 */
export function mergeJournal(
  known: { id: string | null; moves: readonly DuelMove[] },
  fresh: { id: string | null; moves: readonly DuelMove[] },
): { id: string | null; moves: readonly DuelMove[] } {
  const same = known.id === fresh.id
  const seqs = new Set((same ? known.moves : []).map((move) => move.seq))
  const added = fresh.moves.filter((move) => !seqs.has(move.seq))
  if (added.length === 0 && same) return { id: fresh.id, moves: known.moves }
  return { id: fresh.id, moves: [...(same ? known.moves : []), ...added].sort((a, b) => a.seq - b.seq) }
}
