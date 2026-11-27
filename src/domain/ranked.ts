/**
 * Le duel classé : l'Elo, ses ligues, et ce que la file dit de l'attente.
 *
 * Le serveur règle seul les classements (`duel_settle`, 0122, 0123) : ce fichier en
 * est le double exact, que l'écran lit pour annoncer l'enjeu avant la partie
 * (« Victoire +14 · Défaite −10 ») et pour nommer une ligue. Les deux calculs
 * doivent rester identiques — `ranked.test.ts` et `supabase/tests/50_ranked_duel.sql`
 * vérifient les mêmes cas.
 */

import { DEFAULT_TUNING as D, TUNING } from './tuning'

/**
 * Le départ d'un compte qui n'a jamais joué : Argent III tant que moins de
 * `BRONZE_START_GOLD` joueurs ont atteint l'Or, Bronze III ensuite
 * (`duel_start_rating`, 0123) — une échelle vide n'envoie pas les premiers au fond.
 */
export const RATING_START = D['ranked.startLate']
export const EARLY_START = D['ranked.startEarly']
export const BRONZE_START_GOLD = D['ranked.bronzeStartGold']
/**
 * Les Maîtres n'existent qu'à partir de dix joueurs Diamant (`duel_masters_open`) ;
 * d'ici là, le pas de chaque partie est doublé (`duel_k_boost`) pour que les
 * premiers y montent vite. Le serveur seul règle, et dit `masters` à chaque lecture.
 */
export const MASTERS_FROM_DIAMONDS = D['ranked.mastersFromDiamonds']
/** Le plancher : on ne descend pas plus bas. */
export const RATING_FLOOR = 100
/** Le top du classement : un rang « Maître » numéroté, au-dessus des ligues. */
export const MASTER_SPOTS = 10
/** Après ce nombre de jours sans partie classée, l'Elo descend chaque jour un peu. */
export const DECAY_GRACE_DAYS = D['ranked.decayGraceDays']
export const DECAY_PER_DAY = D['ranked.decayPerDay']
/** Ce que l'inactivité peut retirer au plus, et le plancher qu'elle ne franchit pas. */
export const DECAY_CAP = D['ranked.decayCap']
export const DECAY_FLOOR = D['ranked.decayFloor']
/** Le temps d'accepter un adversaire trouvé, celui de `duel_offer_seconds()`. */
export const OFFER_SECONDS = D['ranked.offerSeconds']

/**
 * Tout le monde part du Bronze : le pas est grand sur les dix premières
 * parties, pour qu'un bon joueur en sorte vite, moyen jusqu'à la vingtième,
 * puis ordinaire.
 */
export function kFactor(games: number): number {
  return games < TUNING['ranked.kEarlyGames'] ? TUNING['ranked.kEarly'] : games < TUNING['ranked.kMidGames'] ? TUNING['ranked.kMid'] : TUNING['ranked.kLate']
}

/** L'Elo après une partie : jamais sous le plancher. */
export function settledRating(rating: number): number {
  return Math.max(RATING_FLOOR, rating)
}

/**
 * L'Elo qu'un joueur absent garde : rien pendant une semaine, puis cinq points
 * par jour, cent cinquante au plus, et jamais sous 950 s'il était au-dessus.
 * `idleDays` : les jours entiers depuis sa dernière partie classée.
 */
export function decayedRating(rating: number, idleDays: number): number {
  const loss = Math.min(TUNING['ranked.decayCap'], TUNING['ranked.decayPerDay'] * Math.max(0, Math.floor(idleDays) - TUNING['ranked.decayGraceDays']))
  return Math.max(rating - loss, Math.min(rating, TUNING['ranked.decayFloor']))
}

/** La chance de gagner que l'Elo prête à `rating` contre `other`. */
export function expectedScore(rating: number, other: number): number {
  return 1 / (1 + 10 ** ((other - rating) / 400))
}

/**
 * Ce que chaque place gagne ou perd, dans l'ordre d'arrivée : Elo par paires,
 * chaque paire pesant 1/(n−1), arrondi à l'entier comme le fait le serveur.
 */
export function eloDeltas(ratings: readonly number[], games: readonly number[]): number[] {
  const n = ratings.length
  const sums = ratings.map(() => 0)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const expected = expectedScore(ratings[i]!, ratings[j]!)
      sums[i]! += (kFactor(games[i] ?? 0) * (1 - expected)) / (n - 1)
      sums[j]! -= (kFactor(games[j] ?? 0) * (1 - expected)) / (n - 1)
    }
  }
  // Postgres arrondit les numériques loin de zéro : Math.round, lui, vers le haut.
  return sums.map((sum) => Math.sign(sum) * Math.round(Math.abs(sum)))
}

export interface Rating {
  rating: number
  games: number
}

/** L'enjeu d'un duel à deux, vu par `me` : ce que gagner ou perdre lui ferait. */
export function stakes(me: Rating, them: Rating): { win: number; loss: number } {
  const [win] = eloDeltas([me.rating, them.rating], [me.games, them.games])
  const [, loss] = eloDeltas([them.rating, me.rating], [them.games, me.games])
  return { win: win ?? 0, loss: loss ?? 0 }
}

export type LeagueId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

/** Le seuil d'entrée de chaque ligue, de la plus basse à la plus haute. */
export const LEAGUES: readonly { id: LeagueId; from: number }[] = [
  { id: 'bronze', from: 0 },
  { id: 'silver', from: 950 },
  { id: 'gold', from: 1100 },
  { id: 'platinum', from: 1250 },
  { id: 'diamond', from: 1400 },
]

/** Une division d'une ligue : 3 en bas, 1 en haut, comme « Or III » puis « Or I ». */
export type Division = 1 | 2 | 3

export type Tier = { kind: 'league'; league: LeagueId; division: Division } | { kind: 'master'; spot: number }

export interface Standing {
  tier: Tier
  /** La ligue de l'Elo, celle d'un Maître comprise. */
  league: LeagueId
  /** La part de la division déjà faite, de 0 à 1 ; 1 en Diamant I et en Maître. */
  progress: number
}

/** La largeur d'une ligue en Elo, pour la couper en trois divisions. */
const LEAGUE_SPAN = 150
/** Le bas du Bronze : ses divisions se comptent depuis là, et tout le monde y commence. */
const BRONZE_FLOOR = 800

/**
 * Le rang d'un joueur : sa ligue et sa division ; dans les dix premiers du
 * classement, « Maître » et sa place. `rank` : sa place au classement, quand
 * le serveur la connaît — seul un joueur qui a joué une partie classée en a une.
 */
export function standing({ rating, games }: Rating, rank: number | null = null): Standing {
  let index = 0
  for (let i = 0; i < LEAGUES.length; i++) if (rating >= LEAGUES[i]!.from) index = i
  const here = LEAGUES[index]!
  const floor = index === 0 ? BRONZE_FLOOR : here.from
  const into = Math.max(0, rating - floor)
  const step = LEAGUE_SPAN / 3
  const climbed = Math.min(2, Math.floor(into / step))
  const division = (3 - climbed) as Division
  const top = index === LEAGUES.length - 1 && division === 1
  const progress = top ? 1 : Math.max(0, Math.min(1, (into - climbed * step) / step))
  if (games > 0 && rank !== null && rank >= 1 && rank <= MASTER_SPOTS) return { tier: { kind: 'master', spot: rank }, league: here.id, progress: 1 }
  return { tier: { kind: 'league', league: here.id, division }, league: here.id, progress }
}

/** La marche du Maître dans `leagueReached`, juste au-dessus du Diamant. */
export const MASTER_STEP = LEAGUES.length + 1

/**
 * La plus haute marche qu'un joueur a touchée au classé, pour les tuiles
 * d'avatar : 0 tant qu'il n'a pas joué, puis sa ligue au pic d'Elo que garde
 * le serveur (1 Bronze… 5 Diamant), et `MASTER_STEP` quand il est Maître.
 */
export function leagueReached({ peak, games }: { peak: number; games: number }, master: boolean): number {
  if (games <= 0) return 0
  if (master) return MASTER_STEP
  return LEAGUES.findIndex((league) => league.id === standing({ rating: peak, games }).league) + 1
}

/** Deux rangs se suivent-ils, du plus bas au plus haut ? Pour dire une promotion. */
export function tierOrder(tier: Tier): number {
  if (tier.kind === 'master') return 1000 - tier.spot
  return LEAGUES.findIndex((league) => league.id === tier.league) * 3 + (3 - tier.division)
}

/** L'écart d'Elo qu'on accepte après `seconds` d'attente, celui de `duel_rating_window`. */
export function ratingWindow(seconds: number): number {
  return seconds >= 30 ? Infinity : 100 + 50 * Math.floor(Math.max(0, seconds) / 5)
}

/**
 * Comment dire une attente estimée : un chiffre rond qu'on ne lit pas comme une
 * promesse à la seconde. Sous la minute, par cinq secondes (dix au moins) ;
 * au-delà, par minute ; au-delà de cinq, « longue ».
 */
export type WaitHint =
  | { kind: 'unknown' }
  | { kind: 'seconds'; value: number }
  | { kind: 'minutes'; value: number }
  | { kind: 'long' }

export function waitHint(estimate: number | null): WaitHint {
  if (estimate === null || !Number.isFinite(estimate) || estimate < 0) return { kind: 'unknown' }
  if (estimate < 55) return { kind: 'seconds', value: Math.max(10, Math.round(estimate / 5) * 5) }
  if (estimate < 5 * 60) return { kind: 'minutes', value: Math.max(1, Math.round(estimate / 60)) }
  return { kind: 'long' }
}

/**
 * Le duel classé se présente une fois, à l'accueil, à qui a déjà joué : un
 * joueur tout neuf a d'abord son tutoriel et ses premières parties.
 */
export function rankedNewsDue(runs: number, seen: boolean): boolean {
  return !seen && runs >= 1
}

/**
 * Sans adversaire, la file lance une vraie partie contre un bot de ton niveau
 * dix secondes après l'attente annoncée — 20 s quand rien ne l'annonce —, et
 * jamais après trois minutes.
 */
export const BOT_MATCH_GRACE = D['ranked.botGrace']
export function botMatchAfter(estimate: number | null): number {
  return Math.min(TUNING['ranked.botMaxWait'], (estimate ?? TUNING['ranked.botDefaultWait']) + TUNING['ranked.botGrace'])
}

/**
 * Le bot de la file joue au niveau du joueur : lent et hésitant au bas du
 * Bronze, vif et presque sans faute au Diamant.
 */
export function botLevel(rating: number): { think: readonly [number, number]; answerChance: number } {
  const level = Math.max(0, Math.min(1, (rating - 800) / 800))
  const round = (value: number) => Math.round(value * 100) / 100
  return { think: [round(6 - level * 4), round(11 - level * 6)], answerChance: round(TUNING['ranked.botAnswerMin'] + level * Math.max(0, TUNING['ranked.botAnswerMax'] - TUNING['ranked.botAnswerMin'])) }
}

/** L'attente a dépassé l'estimation d'assez pour le dire. */
export function overdue(waited: number, estimate: number | null): boolean {
  return estimate !== null && waited > Math.max(estimate * 1.5, estimate + 15)
}
