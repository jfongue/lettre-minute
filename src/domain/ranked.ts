/**
 * Le duel classé : l'Elo, ses ligues, et ce que la file dit de l'attente.
 *
 * Le serveur règle seul les classements (`duel_settle`, 0122) : ce fichier en
 * est le double exact, que l'écran lit pour annoncer l'enjeu avant la partie
 * (« Victoire +14 · Défaite −10 ») et pour nommer une ligue. Les deux calculs
 * doivent rester identiques — `ranked.test.ts` et `supabase/tests/50_ranked_duel.sql`
 * vérifient les mêmes cas.
 */

/** L'Elo d'un compte qui n'a jamais joué de partie classée. */
export const RATING_START = 1000
/** Le plancher : on ne descend pas plus bas. */
export const RATING_FLOOR = 100
/** Les parties de placement : jusque-là, ni ligue ni rang. */
export const PLACEMENT_GAMES = 3
/** Les placements classent entre ces deux Elo : du bas du Bronze au haut de l'Or. */
export const PLACEMENT_FLOOR = 800
export const PLACEMENT_CEILING = 1249
/** Le top du classement : un rang « Maître » numéroté, au-dessus des ligues. */
export const MASTER_SPOTS = 10
/** Après ce nombre de jours sans partie classée, l'Elo descend chaque jour un peu. */
export const DECAY_GRACE_DAYS = 7
export const DECAY_PER_DAY = 5
/** Ce que l'inactivité peut retirer au plus, et le plancher qu'elle ne franchit pas. */
export const DECAY_CAP = 150
export const DECAY_FLOOR = 950
/** Le temps d'accepter un adversaire trouvé, celui de `duel_offer_seconds()`. */
export const OFFER_SECONDS = 20

/**
 * Très grand pendant les placements, grand jusqu'à la dixième partie, pour
 * qu'un nouveau trouve vite sa place ; puis le pas ordinaire.
 */
export function kFactor(games: number): number {
  return games < PLACEMENT_GAMES ? 80 : games < 10 ? 40 : 20
}

/** L'Elo après une partie : les placements finis le ramènent entre Bronze et Or. */
export function settledRating(rating: number, gamesAfter: number): number {
  const floored = Math.max(RATING_FLOOR, rating)
  return gamesAfter === PLACEMENT_GAMES ? Math.min(PLACEMENT_CEILING, Math.max(PLACEMENT_FLOOR, floored)) : floored
}

/**
 * L'Elo qu'un joueur absent garde : rien pendant une semaine, puis cinq points
 * par jour, cent cinquante au plus, et jamais sous 950 s'il était au-dessus.
 * `idleDays` : les jours entiers depuis sa dernière partie classée.
 */
export function decayedRating(rating: number, idleDays: number): number {
  const loss = Math.min(DECAY_CAP, DECAY_PER_DAY * Math.max(0, Math.floor(idleDays) - DECAY_GRACE_DAYS))
  return Math.max(rating - loss, Math.min(rating, DECAY_FLOOR))
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

export type Tier =
  | { kind: 'placement'; placed: number }
  | { kind: 'league'; league: LeagueId; division: Division }
  | { kind: 'master'; spot: number }

export interface Standing {
  tier: Tier
  /** La ligue, null pendant les placements ; celle de l'Elo pour un Maître. */
  league: LeagueId | null
  /** Les placements joués, sur `PLACEMENT_GAMES`. */
  placed: number
  /** La part de la division déjà faite, de 0 à 1 ; 1 en Diamant I et en Maître. */
  progress: number
}

/** La largeur d'une ligue en Elo, pour la couper en trois divisions. */
const LEAGUE_SPAN = 150

/**
 * Le rang d'un joueur : ses placements, puis sa ligue et sa division ; dans les
 * dix premiers du classement, « Maître » et sa place. `rank` : sa place au
 * classement, quand le serveur la connaît.
 */
export function standing({ rating, games }: Rating, rank: number | null = null): Standing {
  const placed = Math.min(games, PLACEMENT_GAMES)
  let index = 0
  for (let i = 0; i < LEAGUES.length; i++) if (rating >= LEAGUES[i]!.from) index = i
  const here = LEAGUES[index]!
  // Le bronze n'a pas de plancher qui se lise : ses divisions partent de 800.
  const floor = index === 0 ? PLACEMENT_FLOOR : here.from
  const into = Math.max(0, rating - floor)
  const step = LEAGUE_SPAN / 3
  const climbed = Math.min(2, Math.floor(into / step))
  const division = (3 - climbed) as Division
  const top = index === LEAGUES.length - 1 && division === 1
  const progress = top ? 1 : Math.max(0, Math.min(1, (into - climbed * step) / step))
  if (games < PLACEMENT_GAMES) return { tier: { kind: 'placement', placed }, league: null, placed, progress: placed / PLACEMENT_GAMES }
  if (rank !== null && rank >= 1 && rank <= MASTER_SPOTS) return { tier: { kind: 'master', spot: rank }, league: here.id, placed, progress: 1 }
  return { tier: { kind: 'league', league: here.id, division }, league: here.id, placed, progress }
}

/** Deux rangs se suivent-ils, du plus bas au plus haut ? Pour dire une promotion. */
export function tierOrder(tier: Tier): number {
  if (tier.kind === 'placement') return -1
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

/** Au-delà de ce temps d'attente annoncé, on propose les joueurs ordinateur tout de suite. */
export const LONG_WAIT_SECONDS = 60

/** Après combien de secondes la file propose les joueurs ordinateur, selon l'attente annoncée. */
export function botsOfferAfter(estimate: number | null): number {
  if (estimate !== null && estimate >= LONG_WAIT_SECONDS) return 0
  return 15
}

/** L'attente a dépassé l'estimation d'assez pour le dire. */
export function overdue(waited: number, estimate: number | null): boolean {
  return estimate !== null && waited > Math.max(estimate * 1.5, estimate + 15)
}
