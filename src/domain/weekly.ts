import { civilFromDays, daysFromCivil, dayOf, isDay } from './daily'
import type { GameMode } from './modes'
import { runScore, type CreateRunInput, type Run } from './run'
import { MAX_CATEGORIES_PER_RUN, dealLineup } from './unlocks'

/**
 * Le défi du moment : une partie par semaine, la même pour tous, ouverte du
 * dimanche 21 h au dimanche suivant 21 h, heure de Paris. L'heure de Paris se
 * calcule ici en arithmétique pure — le domaine ne construit jamais de `Date`,
 * dont la zone et l'analyse appartiennent à l'appareil — et ne dépend que de
 * l'instant passé par l'interface.
 */

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS

/** Le premier dimanche d'ouverture : la semaine #0 du calendrier. */
export const WEEKLY_EPOCH = '2026-10-11'

/** Le mode de chaque semaine, en boucle ; la première est l'endurance. */
export const WEEKLY_SCHEDULE: readonly GameMode[] = ['endurance', 'delayed', 'reversed']

/** 0 pour un dimanche : les jours depuis 1970-01-01, un jeudi, comptent à partir de 4. */
const sundayIndexOf = (days: number) => (((days + 4) % 7) + 7) % 7

/** Le dernier dimanche d'un mois, en jours depuis 1970-01-01. */
function lastSunday(year: number, month: number): number {
  const last = daysFromCivil(year, month + 1, 1) - 1
  return last - sundayIndexOf(last)
}

/**
 * Heure d'été de l'Union européenne : de 01:00 UTC le dernier dimanche de mars
 * à 01:00 UTC le dernier dimanche d'octobre.
 */
function summerTime(at: number): boolean {
  const [year] = civilFromDays(Math.floor(at / DAY_MS))
  return at >= lastSunday(year, 3) * DAY_MS + HOUR_MS && at < lastSunday(year, 10) * DAY_MS + HOUR_MS
}

function parisOffset(at: number): number {
  return (summerTime(at) ? 2 : 1) * HOUR_MS
}

/**
 * L'instant UTC d'un dimanche 21 h à Paris : loin des deux bascules, qui
 * tombent à 02 h et 03 h, donc sans ambiguïté.
 */
function utcOfParis(local: number): number {
  const summer = local - 2 * HOUR_MS
  return summerTime(summer) ? summer : local - HOUR_MS
}

/** Le jour civil de Paris d'un instant, `YYYY-MM-DD`. */
export function parisDay(at: number): string {
  return dayOf(at + parisOffset(at))
}

export interface Week {
  /** La date du dimanche d'ouverture, `YYYY-MM-DD`. */
  weekId: string
  opensAt: number
  closesAt: number
}

const pad = (value: number, width: number) => String(value).padStart(width, '0')

const daysOfWeekId = (weekId: string) => daysFromCivil(...(weekId.split('-').map(Number) as [number, number, number]))

function weekFromSunday(sunday: number): Week {
  const [year, month, date] = civilFromDays(sunday)
  const opens = sunday * DAY_MS + 21 * HOUR_MS
  return {
    weekId: `${pad(year, 4)}-${pad(month, 2)}-${pad(date, 2)}`,
    opensAt: utcOfParis(opens),
    closesAt: utcOfParis(opens + WEEK_MS),
  }
}

/** La semaine en cours : elle bascule le dimanche à 21 h, heure de Paris. */
export function weekOf(at: number): Week {
  // Reculer de 21 h ramène la bascule à minuit : le dimanche de la semaine est le dernier dimanche passé.
  const shifted = Math.floor((at + parisOffset(at) - 21 * HOUR_MS) / DAY_MS)
  return weekFromSunday(shifted - sundayIndexOf(shifted))
}

/** Les dates et instants d'une semaine nommée par son dimanche. */
export function weekById(weekId: string): Week {
  return weekFromSunday(daysOfWeekId(weekId))
}

/** Le numéro d'une semaine depuis `WEEKLY_EPOCH`, 0 pour la première. */
export function weekNumber(weekId: string): number {
  return Math.round((daysOfWeekId(weekId) - daysOfWeekId(WEEKLY_EPOCH)) / 7)
}

/** Une semaine ne s'ouvre qu'un dimanche : tout autre jour est refusé. */
export function isWeekId(value: unknown): value is string {
  return isDay(value) && sundayIndexOf(daysOfWeekId(value)) === 0
}

/**
 * La fenêtre des tentatives : la semaine et le jour de Paris. Le dimanche de
 * 21 h à minuit appartient déjà à la semaine neuve, d'où une fenêtre neuve.
 */
export function attemptWindow(at: number): { weekId: string; day: string } {
  return { weekId: weekOf(at).weekId, day: parisDay(at) }
}

export type WeeklyMetric = 'score' | 'survival'

export interface WeeklyChallenge {
  weekId: string
  mode: GameMode
  seed: number
  lineup: string[]
  metric: WeeklyMetric
}

export function weeklyMode(weekId: string): GameMode {
  const length = WEEKLY_SCHEDULE.length
  return WEEKLY_SCHEDULE[((weekNumber(weekId) % length) + length) % length]!
}

/** L'endurance se classe en secondes tenues, les autres en points. */
export function metricOf(mode: GameMode): WeeklyMetric {
  return mode === 'endurance' ? 'survival' : 'score'
}

/** FNV-1a sur la semaine et la langue : un défi français et un anglais sont deux parties. */
export function weeklySeed(weekId: string, lang: string): number {
  const text = `lettre-minute:weekly:${lang}:${weekId}`
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  return hash >>> 0
}

/**
 * Le défi d'une semaine. `available` est la liste que l'appelant tient pour
 * jouable par tous — sans les avant-premières, que seul un Premium possède —,
 * triée ici : l'ordre d'un bundler ne doit pas changer la partie.
 */
export function weeklyChallenge(weekId: string, lang: string, available: readonly string[]): WeeklyChallenge {
  const mode = weeklyMode(weekId)
  const seed = weeklySeed(weekId, lang)
  return {
    weekId,
    mode,
    seed,
    lineup: [...dealLineup(seed, [...available].sort()).dealt].slice(0, MAX_CATEGORIES_PER_RUN),
    metric: metricOf(mode),
  }
}

/**
 * Ce qui rend la partie la même pour tous : aucun pouvoir, aucune question à
 * éviter, et `shared` pour que la foule ne pèse pas. Le `Judge` qui la joue ne
 * doit porter ni mots de la communauté ni compteurs d'usage.
 */
export function weeklyRunOptions(challenge: WeeklyChallenge): CreateRunInput {
  return { seed: challenge.seed, mode: challenge.mode, categoryIds: challenge.lineup, avoid: [], powers: [], shared: true }
}

/** Ce que la partie rapporte au classement : des points, ou des secondes tenues, au dixième. */
export function weeklyValue(run: Run, metric: WeeklyMetric): number {
  return metric === 'survival' ? Math.round(runScore(run) * 10) / 10 : run.score
}

// ---------------------------------------------------------------- tentatives

export const WEEKLY_FREE_ATTEMPTS = 2
export const WEEKLY_AD_ATTEMPTS = 1
export const WEEKLY_PLUS_ATTEMPTS = 5
/** Le plafond dur que le serveur applique, quoi que le client lui dise de Premium. */
export const WEEKLY_MAX_ATTEMPTS = WEEKLY_PLUS_ATTEMPTS

export interface AttemptPerks {
  plus: boolean
  /** Pubs regardées dans la fenêtre : une seule compte. */
  adsWatched: number
}

export function attemptsAllowed({ plus, adsWatched }: AttemptPerks): number {
  if (plus) return WEEKLY_PLUS_ATTEMPTS
  return WEEKLY_FREE_ATTEMPTS + Math.min(Math.max(0, Math.floor(adsWatched)), WEEKLY_AD_ATTEMPTS)
}

export type AttemptSlot = 'used' | 'free' | 'ad' | 'plus' | 'locked'

/**
 * Les cinq places du jour. `free` se joue d'un tap ; `ad` se débloque par une
 * pub ; `plus` est une place de Premium, jouable ; `locked` en est une qu'un
 * joueur sans Premium voit verrouillée.
 */
export function attemptState(used: number, plus: boolean, adsWatched: number): AttemptSlot[] {
  const taken = Math.max(0, Math.floor(used))
  const allowed = attemptsAllowed({ plus, adsWatched })
  return Array.from({ length: WEEKLY_MAX_ATTEMPTS }, (_, place): AttemptSlot => {
    if (place < taken) return 'used'
    if (place < WEEKLY_FREE_ATTEMPTS) return 'free'
    if (plus) return 'plus'
    if (place < allowed) return 'free'
    return place < WEEKLY_FREE_ATTEMPTS + WEEKLY_AD_ATTEMPTS ? 'ad' : 'locked'
  })
}

export function attemptsLeft(used: number, perks: AttemptPerks): number {
  return Math.max(0, attemptsAllowed(perks) - Math.max(0, Math.floor(used)))
}

/**
 * Le record au fil des tentatives, pour la courbe du récap : une tentative
 * non terminée (null) ne change rien, et 0 vaut tant qu'aucune n'a rendu de valeur.
 */
export function recordCurve(attempts: readonly (number | null)[]): number[] {
  let best = 0
  return attempts.map((value) => {
    if (value !== null && value > best) best = value
    return best
  })
}

// ------------------------------------------------------------------ trophées

/** Ce que le serveur mesure d'un joueur sur la semaine : une ligne, jamais ses mots. */
export interface WeeklyMeasures {
  playerId: string
  /** Quand sa meilleure tentative s'est terminée : départage un ex aequo, le premier gagne. */
  reachedAt: number
  attempts: number
  /** Sa meilleure valeur moins celle de sa première tentative. */
  climb: number
  bestCombo: number
  /** Mots que personne d'autre n'a écrits. */
  original: number
  /** Mots que d'autres ont écrits aussi. */
  sheep: number
  /** Palier du mot le plus rare, 0 courant à 3 très rare, et ses points. */
  rarestTier: number
  rarestPoints: number
  rarestWord: string | null
  /** La réponse la plus rapide, en secondes ; null sans mot exact. */
  fastest: number | null
  fastestWord: string | null
  /** Le mot le plus long, en lettres. */
  longest: number
  longestWord: string | null
}

/** Dans l'ordre de prestige : le premier choisit, un joueur déjà titré est sauté. */
export const WEEKLY_TROPHY_IDS = [
  'weekly-rarest',
  'weekly-original',
  'weekly-climber',
  'weekly-streak',
  'weekly-fastest',
  'weekly-persistent',
  'weekly-longest',
  'weekly-sheep',
] as const
export type WeeklyTrophyId = (typeof WEEKLY_TROPHY_IDS)[number]

export interface WeeklyTrophy {
  id: WeeklyTrophyId
  playerId: string
  value: number
  word?: string
}

interface Criterion {
  /** Plus grand gagne ; null écarte le joueur du trophée. */
  score: (measures: WeeklyMeasures) => number | null
  value: (measures: WeeklyMeasures) => number
  word?: (measures: WeeklyMeasures) => string | null
}

const positive = (count: number) => (count > 0 ? count : null)

const CRITERIA: Record<WeeklyTrophyId, Criterion> = {
  'weekly-rarest': {
    score: (m) => (m.rarestTier > 0 ? m.rarestTier * 1_000_000 + m.rarestPoints : null),
    value: (m) => m.rarestTier,
    word: (m) => m.rarestWord,
  },
  'weekly-original': { score: (m) => positive(m.original), value: (m) => m.original },
  'weekly-climber': { score: (m) => positive(m.climb), value: (m) => m.climb },
  'weekly-streak': { score: (m) => (m.bestCombo > 1 ? m.bestCombo : null), value: (m) => m.bestCombo },
  'weekly-fastest': {
    score: (m) => (m.fastest !== null && m.fastest > 0 ? -m.fastest : null),
    value: (m) => m.fastest ?? 0,
    word: (m) => m.fastestWord,
  },
  'weekly-persistent': { score: (m) => (m.attempts > 1 ? m.attempts : null), value: (m) => m.attempts },
  'weekly-longest': { score: (m) => positive(m.longest), value: (m) => m.longest, word: (m) => m.longestWord },
  'weekly-sheep': { score: (m) => positive(m.sheep), value: (m) => m.sheep },
}

/**
 * Les huit trophées de la semaine, exclusifs : un joueur n'en porte jamais deux.
 * Attribution gloutonne dans l'ordre de prestige ; un joueur déjà titré est
 * sauté et le trophée passe au suivant du critère. À égalité, celui qui a
 * atteint sa valeur le premier ; un trophée sans candidat est omis.
 */
export function awardWeeklyTrophies(measures: readonly WeeklyMeasures[]): WeeklyTrophy[] {
  const taken = new Set<string>()
  const awards: WeeklyTrophy[] = []
  for (const id of WEEKLY_TROPHY_IDS) {
    const criterion = CRITERIA[id]
    let winner: { measures: WeeklyMeasures; score: number } | null = null
    for (const candidate of measures) {
      if (taken.has(candidate.playerId)) continue
      const score = criterion.score(candidate)
      if (score === null) continue
      const better =
        winner === null ||
        score > winner.score ||
        (score === winner.score &&
          (candidate.reachedAt < winner.measures.reachedAt ||
            (candidate.reachedAt === winner.measures.reachedAt && candidate.playerId < winner.measures.playerId)))
      if (better) winner = { measures: candidate, score }
    }
    if (winner === null) continue
    taken.add(winner.measures.playerId)
    const word = criterion.word?.(winner.measures)
    awards.push({ id, playerId: winner.measures.playerId, value: criterion.value(winner.measures), ...(word ? { word } : {}) })
  }
  return awards
}
