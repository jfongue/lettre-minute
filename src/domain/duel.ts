/**
 * Le duel en direct : deux à quatre joueurs, chacun son tour, une réserve de
 * 30 s qui ne court que pendant le sien. Passer coûte 5 s de plus, un mot
 * validé en rend selon son palier. Le premier dont la réserve tombe à zéro
 * meurt ; le dernier debout gagne, les autres se classent à l'ordre des morts.
 *
 * Le couple appartient à la manche, pas au tour : la main avance d'un cran à
 * chaque fin de tour et le couple est hérité. Il n'est consommé — et remplacé
 * — que s'il est validé, ou refusé par tous les vivants.
 *
 * Deux joueurs ne jouent jamais en même temps : le couple ne se tire que de la
 * graine et du numéro de manche, donc n'importe quel client peut l'afficher
 * sans rien demander. Le domaine ne connaît que des identifiants de
 * catégories : ni mot, ni palier d'une langue, ni horloge.
 */
import { createRng, shuffled } from './rng'
import { createRun, inspect, promptKey, submit, type Judge, type KeptWord, type Prompt, type Run, type Verdict } from './run'
import type { RarityTier } from './rarity'

export const DUEL_MIN_PLAYERS = 2
export const DUEL_MAX_PLAYERS = 4
/** La réserve de chacun, en secondes, la même à deux comme à quatre. */
export const DUEL_RESERVE_SECONDS = 30
/** Passer son tour coûte ça, en plus du temps déjà passé à chercher. */
export const DUEL_PASS_PENALTY_SECONDS = 5
/** Le pool du draft : cinq catégories, les joueurs en choisissent le plus possible. */
export const DUEL_POOL_SIZE = 5
/** Les catégories que les joueurs choisissent eux-mêmes, tout compris. */
export const DUEL_PICKED_SIZE = 4
/** Ce qu'un mot validé rend à la réserve du joueur, selon son palier. */
export const DUEL_TIME_BONUS: Readonly<Record<RarityTier, number>> = {
  courant: 0,
  'peu commun': 1,
  rare: 1.5,
  'très rare': 1.5,
}
/** Le temps qu'un joueur a pour choisir sa catégorie avant que le sort le fasse. */
export const DUEL_PICK_SECONDS = 10

/**
 * Chaque joueur choisit le même nombre de catégories, le plus grand tel que la
 * table en choisisse au plus quatre : à deux, deux chacun ; à trois ou quatre,
 * une chacun. Le reste du pool est tiré au hasard.
 */
export function picksPerPlayer(players: number): number {
  return Math.max(1, Math.floor(DUEL_PICKED_SIZE / Math.max(1, players)))
}

/** Les catégories que les joueurs choisissent eux-mêmes, tout compris. */
export function humanPicks(players: number): number {
  return picksPerPlayer(players) * Math.max(1, players)
}

export type DuelPhase = 'draft' | 'play' | 'over'

export interface DuelPlayer {
  id: string
  /** Secondes de réserve au début de son tour en cours. */
  reserve: number
  alive: boolean
  /** Ce qu'il a encaissé, tous ses tours confondus : le récapitulatif s'en sert. */
  words: readonly KeptWord[]
  /** Ce que son dictionnaire tient déjà pour joué : un mot ne marque pas deux fois. */
  used: readonly string[]
  score: number
  combo: number
}

export interface DuelTurn {
  player: number
  prompt: Prompt
  /** L'horloge du duel quand le tour a commencé : la réserve court depuis là. */
  startedAt: number
  /**
   * Les joueurs qui ont refusé le couple en cours. Quand tous les vivants y
   * sont, la manche est échouée et un couple neuf est tiré.
   */
  declined: readonly number[]
}

export interface Duel {
  seed: number
  /** Les catégories offertes au draft, dans l'ordre où elles ont été choisies. */
  categories: readonly string[]
  /** Le pool du duel : les choix des joueurs, puis ce que le hasard complète. */
  picks: readonly string[]
  /** Qui choisit, dans l'ordre : le plus petit catalogue ouvre le draft. */
  order: readonly number[]
  /** Les couples consommés : c'est aussi le numéro de la manche à tirer. */
  dealt: readonly string[]
  /** Tours joués, morts comprises. */
  turns: number
  phase: DuelPhase
  players: readonly DuelPlayer[]
  turn: DuelTurn | null
  /** L'ordre des morts : le dernier mort est deuxième, le survivant premier. */
  deaths: readonly number[]
}

export interface CreateDuelInput {
  seed: number
  playerIds: readonly string[]
  /** Les catégories jouables : le vivier du draft. */
  categories: readonly string[]
  /** L'ordre des choix ; celui de la table par défaut. */
  order?: readonly number[]
}

export function createDuel({ seed, playerIds, categories, order }: CreateDuelInput): Duel {
  if (playerIds.length < DUEL_MIN_PLAYERS || playerIds.length > DUEL_MAX_PLAYERS) {
    throw new Error(`duel: ${playerIds.length} players, expected ${DUEL_MIN_PLAYERS} to ${DUEL_MAX_PLAYERS}`)
  }
  return {
    seed,
    categories,
    picks: [],
    order: order ?? playerIds.map((_, index) => index),
    dealt: [],
    turns: 0,
    phase: 'draft',
    players: playerIds.map((id) => ({ id, reserve: DUEL_RESERVE_SECONDS, alive: true, words: [], used: [], score: 0, combo: 0 })),
    turn: null,
    deaths: [],
  }
}

/** À qui le tour de draft : l'ordre des choix tourne avec les prises. */
export function draftPlayer(duel: Duel): number {
  const order = duel.order.length > 0 ? duel.order : duel.players.map((_, index) => index)
  return order[duel.picks.length % order.length] ?? 0
}

/** Ce qu'un joueur peut encore choisir. */
export function draftChoices(duel: Duel): readonly string[] {
  return duel.categories.filter((id) => !duel.picks.includes(id))
}

/**
 * Un choix de catégorie. Quand les joueurs ont fini de choisir, le hasard
 * complète le pool ; `openDuel` ouvre alors la première manche, une fois les
 * dictionnaires du pool chargés — le draft n'en a pas besoin. Un choix hors du
 * vivier, ou déjà pris, ne compte pas.
 */
export function pickCategory(duel: Duel, categoryId: string): Duel {
  if (duel.phase !== 'draft' || duel.picks.includes(categoryId) || !duel.categories.includes(categoryId)) return duel

  const picks = [...duel.picks, categoryId]
  const due = humanPicks(duel.players.length)
  // Un vivier plus court que le pool (catalogue réduit) joue avec ce qu'il a
  // plutôt que de rester bloqué au draft.
  if (picks.length < due && duel.categories.some((id) => !picks.includes(id))) return { ...duel, picks }

  const rest = duel.categories.filter((id) => !picks.includes(id))
  const drawn = shuffled(createRng(mix(duel.seed, 0, 0x64726166)), rest).slice(0, Math.max(0, DUEL_POOL_SIZE - picks.length))
  return { ...duel, picks: [...picks, ...drawn] }
}

/** Le pool est-il complet ? Il ne reste alors qu'à charger ses dictionnaires. */
export function draftComplete(duel: Duel): boolean {
  return duel.phase === 'draft' && duel.picks.length >= Math.min(DUEL_POOL_SIZE, duel.categories.length)
}

/** Ouvre la première manche : le draft est fini et les dictionnaires du pool sont là. */
export function openDuel(duel: Duel, judge: Judge, at = 0): Duel {
  if (!draftComplete(duel)) return duel
  return openRound({ ...duel, phase: 'play' }, judge, at, -1)
}

/**
 * Un flux par manche et par tirage : la catégorie et la lettre ne dépendent
 * que de la graine et du numéro de manche. C'est ce qui laisse chaque client
 * afficher le couple des autres joueurs.
 */
function mix(seed: number, round: number, salt: number): number {
  return (seed ^ Math.imul(round + 1, salt)) >>> 0
}

/** Le couple d'une manche : la catégorie d'abord, la lettre ensuite. */
function drawPrompt(duel: Duel, judge: Judge, round: number, except?: string): Prompt {
  const playable = duel.picks.filter((id) => judge.letters(id).length > 0)
  const changed = playable.filter((id) => id !== except)
  const candidates = changed.length > 0 ? changed : playable
  const rng = createRng(mix(duel.seed, round, 0x9e3779b9))
  const categoryId = candidates[Math.floor(rng.next() * candidates.length)] ?? duel.picks[0] ?? ''
  // Le même verrou qu'en partie seule : un couple qui n'a pas assez de mots
  // connus ne revient pas dans le duel.
  const letter = createRun({ seed: mix(duel.seed, round, 0x85ebca6b), categoryIds: [categoryId], avoid: duel.dealt }, judge).prompt.letter
  return { categoryId, letter }
}

/** Ouvre la manche suivante, à l'heure dite, au premier vivant après `from`. */
function openRound(duel: Duel, judge: Judge, at: number, from: number, except?: string): Duel {
  const player = nextAlive(duel, from)
  if (player === null) return { ...duel, phase: 'over', turn: null }
  return { ...duel, turn: { player, prompt: drawPrompt(duel, judge, duel.dealt.length, except), startedAt: at, declined: [] } }
}

/** Le premier joueur vivant après `index`, dans l'ordre de la table. */
function nextAlive(duel: Duel, index: number): number | null {
  for (let step = 1; step <= duel.players.length; step++) {
    const candidate = (index + step + duel.players.length) % duel.players.length
    if (duel.players[candidate]?.alive) return candidate
  }
  return null
}

export function aliveIndexes(duel: Duel): readonly number[] {
  return duel.players.map((_, index) => index).filter((index) => duel.players[index]?.alive)
}

/** Ce qu'il reste à un joueur : sa réserve, entamée par le tour en cours si c'est le sien. */
export function reserveSeconds(duel: Duel, index: number, at: number): number {
  const player = duel.players[index]
  if (!player) return 0
  if (duel.turn?.player !== index) return player.reserve
  return player.reserve - Math.max(0, at - duel.turn.startedAt)
}

export function duelPrompt(duel: Duel): Prompt | null {
  return duel.turn?.prompt ?? null
}

export function duelOver(duel: Duel): boolean {
  return duel.phase === 'over'
}

/** Le classement : le survivant, puis les morts du dernier au premier. */
export function duelRanking(duel: Duel): readonly number[] {
  return [...aliveIndexes(duel), ...[...duel.deaths].reverse()]
}

/** Le numéro de la manche en cours : celle que les joueurs sont en train de jouer. */
export function duelRound(duel: Duel): number {
  return duel.dealt.length
}

/**
 * Le tour d'un joueur tel que son dictionnaire le juge : ses mots déjà joués
 * compris. C'est ce que le champ interroge à chaque frappe, pour le joueur en
 * cours comme pour celui qui attend son tour.
 */
function turnRun(duel: Duel, index: number, judge: Judge): Run {
  const player = duel.players[index]!
  const turn = duel.turn!
  const base = createRun({ seed: mix(duel.seed, duel.dealt.length, 0x85ebca6b), categoryIds: [turn.prompt.categoryId] }, judge)
  return { ...base, prompt: turn.prompt, promptAt: 0, found: player.words, used: player.used, score: player.score, combo: player.combo }
}

/**
 * Juge une réponse sans la jouer, contre le couple en cours. Le joueur qui
 * attend son tour peut donc taper et vérifier son orthographe d'avance ;
 * `playWord` rejoue exactement ce verdict avant de l'encaisser.
 */
export function inspectFor(duel: Duel, index: number, raw: string, judge: Judge): Verdict {
  if (duel.phase !== 'play' || !duel.turn || !duel.players[index]) return { kind: 'empty', found: null }
  return inspect(turnRun(duel, index, judge), raw, judge)
}

export interface DuelPlay {
  duel: Duel
  verdict: Verdict
}

/**
 * Un mot validé : il entre au récapitulatif, rend son temps au palier, et la
 * manche est consommée — la main passe avec un couple neuf. Un mot refusé ne
 * coûte que du temps, le tour continue.
 */
export function playWord(duel: Duel, raw: string, judge: Judge, at: number): DuelPlay {
  const turn = duel.turn
  if (duel.phase !== 'play' || !turn) return { duel, verdict: { kind: 'empty', found: null } }
  const player = duel.players[turn.player]
  if (!player?.alive || reserveSeconds(duel, turn.player, at) <= 0) return { duel: eliminate(duel, judge, at), verdict: { kind: 'empty', found: null } }

  const played = submit(turnRun(duel, turn.player, judge), raw, judge)
  if (played.verdict.kind !== 'accepted' || !played.verdict.found) return { duel, verdict: played.verdict }

  const banked: DuelPlayer = {
    ...player,
    reserve: reserveSeconds(duel, turn.player, at) + DUEL_TIME_BONUS[played.verdict.found.tier],
    words: played.run.found,
    used: played.run.used,
    score: played.run.score,
    combo: played.run.combo,
  }
  const next = advance({ ...duel, players: replace(duel.players, turn.player, banked) }, judge, at, true)
  return { duel: next, verdict: played.verdict }
}

/**
 * Passer : 5 s de réserve en moins, et la main s'en va avec le même couple.
 * Quand tous les vivants l'ont refusé, la manche est échouée et la main
 * revient à l'ouvreur avec un couple neuf. Une réserve qui n'y survit pas
 * emporte le joueur.
 */
export function passTurn(duel: Duel, judge: Judge, at: number): Duel {
  const turn = duel.turn
  if (duel.phase !== 'play' || !turn) return duel
  const player = duel.players[turn.player]
  if (!player) return duel
  const left = reserveSeconds(duel, turn.player, at) - DUEL_PASS_PENALTY_SECONDS
  const declined = [...turn.declined, turn.player]
  if (left <= 0) return eliminate(duel, judge, at, declined)
  const players = replace(duel.players, turn.player, { ...player, reserve: left, combo: 0 })
  return advance({ ...duel, players, turn: { ...turn, declined } }, judge, at, false)
}

/**
 * Le tour en cours a dépassé sa réserve : le joueur meurt et la partie reprend
 * avec les survivants, le couple étant hérité comme après un passe. Le client
 * l'appelle à chaque battement, le serveur par sa passe de nettoyage : la
 * montre ne s'arrête pas parce qu'une app est fermée.
 */
export function duelTimeout(duel: Duel, judge: Judge, at: number): Duel {
  const turn = duel.turn
  if (duel.phase !== 'play' || !turn) return duel
  if (reserveSeconds(duel, turn.player, at) > 0) return duel
  return eliminate(duel, judge, at)
}

/**
 * La partie reprend à l'heure dite : le tour en cours est re-daté, donc la
 * réserve du joueur qui a la main ne court pas pendant la mise en scène d'une
 * mort. Sans ça, l'animation d'élimination mangerait le temps du survivant.
 */
export function resume(duel: Duel, at: number): Duel {
  if (!duel.turn) return duel
  return { ...duel, turn: { ...duel.turn, startedAt: at } }
}

/** Fin de tour : la main avance ; le couple neuf n'arrive qu'une manche consommée. */function advance(duel: Duel, judge: Judge, at: number, consumed: boolean): Duel {
  const turn = duel.turn
  if (!turn) return duel
  const player = nextAlive(duel, turn.player)
  if (player === null) return { ...duel, phase: 'over', turn: null }
  const turns = duel.turns + 1
  const spent = consumed || aliveIndexes(duel).every((index) => turn.declined.includes(index))
  if (!spent) return { ...duel, turns, turn: { ...turn, player, startedAt: at } }
  return openRound({ ...duel, turns, dealt: [...duel.dealt, promptKey(turn.prompt)] }, judge, at, turn.player, turn.prompt.categoryId)
}

function eliminate(duel: Duel, judge: Judge, at: number, declined?: readonly number[]): Duel {
  const turn = duel.turn
  if (!turn) return duel
  const player = duel.players[turn.player]
  if (!player) return duel
  const players = replace(duel.players, turn.player, { ...player, reserve: 0, alive: false })
  const deaths = [...duel.deaths, turn.player]
  const mid = { ...duel, players, deaths, turn: { ...turn, declined: declined ?? turn.declined } }
  if (aliveIndexes(mid).length <= 1) return { ...mid, phase: 'over', turn: null }
  return advance(mid, judge, at, false)
}

function replace(players: readonly DuelPlayer[], index: number, player: DuelPlayer): readonly DuelPlayer[] {
  return players.map((one, at) => (at === index ? player : one))
}

/** Ce qui fait qu'un joueur maison ne joue pas comme un autre. */
export interface BotProfile {
  id: string
  /** Secondes qu'il met à répondre, au plus et au moins. */
  think: readonly [number, number]
  /** Sa part de couples où il trouve un mot ; les autres, il passe. */
  answerChance: number
}

export interface BotMove {
  /** Secondes après le début de son tour où il agit. */
  after: number
  /** Le mot qu'il valide, ou null s'il passe. */
  word: string | null
}

/** Un id comme graine, FNV-1a : deux robots ne jouent pas la même partie. */
function hashId(id: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193)
  return hash >>> 0
}

/**
 * Le coup d'un joueur maison : quand il agit, et avec quoi. Fonction pure de
 * la graine, de la manche et de son profil, donc rejouable à l'identique —
 * c'est ce qui laisse un duel tenir sans serveur.
 */
export function botMove(duel: Duel, judge: Judge, bot: BotProfile): BotMove | null {
  const turn = duel.turn
  if (duel.phase !== 'play' || !turn) return null
  const player = duel.players[turn.player]
  if (!player || player.id !== bot.id || !player.alive) return null

  const rng = createRng((duel.seed ^ hashId(bot.id) ^ Math.imul(duel.dealt.length + 1, 0x27d4eb2f)) >>> 0)
  const [least, most] = bot.think
  // Jamais plus de temps qu'il n'en a : un robot à bout de réserve agit ou
  // meurt, comme un joueur.
  const reserve = reserveSeconds(duel, turn.player, turn.startedAt)
  const after = Math.min(least + rng.next() * Math.max(0, most - least), Math.max(0.2, reserve - 0.2))
  const found = rng.next() < bot.answerChance ? judge.common?.(turn.prompt.categoryId, turn.prompt.letter, player.used) : null
  return { after, word: found ?? null }
}

/** La catégorie qu'un joueur maison choisit au draft : une des restantes, au hasard. */
export function botPick(duel: Duel, bot: BotProfile): string | null {
  if (duel.phase !== 'draft' || duel.players[draftPlayer(duel)]?.id !== bot.id) return null
  const choices = draftChoices(duel)
  if (choices.length === 0) return null
  const rng = createRng((duel.seed ^ hashId(`${bot.id}:${duel.picks.length}`)) >>> 0)
  return choices[Math.floor(rng.next() * choices.length)] ?? null
}

/**
 * Le choix du sort quand le joueur n'a pas choisi dans ses dix secondes : une
 * des catégories restantes, tirée de la graine et du rang du choix. Déterministe
 * comme le reste du duel, donc rejouable et identique sur chaque appareil.
 */
export function forcedPick(duel: Duel): string | null {
  if (duel.phase !== 'draft') return null
  const choices = draftChoices(duel)
  if (choices.length === 0) return null
  const rng = createRng((duel.seed ^ Math.imul(duel.picks.length + 1, 0x666f7263)) >>> 0)
  return choices[Math.floor(rng.next() * choices.length)] ?? null
}

export { promptKey }
