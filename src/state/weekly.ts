/**
 * Ce que l'appareil retient du défi du moment : les tentatives de la fenêtre
 * en cours, faute de serveur, et la dernière semaine dont le récap a été vu.
 * Le serveur compte les tentatives pour de bon (`weekly_start`) ; ce compteur
 * ne sert qu'hors ligne, et n'est jamais effacé par `clearLocalData` — vider
 * ses parties ne rend pas des tentatives.
 */

const ATTEMPTS_KEY = 'lettre-minute.weekly-attempts.v1'
const RECAP_KEY = 'lettre-minute.weekly-recap.v1'

export interface WeeklyWindow {
  weekId: string
  day: string
}

export interface LocalAttempts {
  /** Tentatives lancées dans la fenêtre. */
  used: number
  /** Pubs regardées dans la fenêtre. */
  ads: number
}

interface Stored extends WeeklyWindow, LocalAttempts {}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0

function stored(): Stored | null {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY)
    const value: unknown = raw ? JSON.parse(raw) : null
    if (typeof value !== 'object' || value === null) return null
    const { weekId, day, used, ads } = value as Record<string, unknown>
    if (typeof weekId !== 'string' || typeof day !== 'string' || !isCount(used) || !isCount(ads)) return null
    return { weekId, day, used, ads }
  } catch {
    // Un stockage refusé ou à moitié écrit ne doit pas coûter une partie.
    return null
  }
}

function save(value: Stored): void {
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(value))
  } catch {
    /* le serveur reste la référence */
  }
}

/** Les tentatives de cette fenêtre ; une autre semaine ou un autre jour repart de zéro. */
export function loadLocalAttempts(window: WeeklyWindow): LocalAttempts {
  const found = stored()
  return found && found.weekId === window.weekId && found.day === window.day ? { used: found.used, ads: found.ads } : { used: 0, ads: 0 }
}

export function recordLocalAttempt(window: WeeklyWindow): LocalAttempts {
  const now = loadLocalAttempts(window)
  const next = { ...now, used: now.used + 1 }
  save({ ...window, ...next })
  return next
}

export function recordLocalAd(window: WeeklyWindow): LocalAttempts {
  const now = loadLocalAttempts(window)
  const next = { ...now, ads: now.ads + 1 }
  save({ ...window, ...next })
  return next
}

/** La dernière semaine dont le récap a été montré, null avant le premier. */
export function lastRecapSeen(): string | null {
  try {
    return localStorage.getItem(RECAP_KEY)
  } catch {
    return null
  }
}

export function markRecapSeen(weekId: string): void {
  try {
    localStorage.setItem(RECAP_KEY, weekId)
  } catch {
    /* le récap reviendra à la prochaine ouverture */
  }
}

/**
 * Le récap à montrer : la semaine jouée qui vient de se clore, pas encore
 * vue. `playedWeek` est la dernière semaine où ce joueur a une tentative.
 */
export function recapDue(currentWeekId: string, playedWeek: string | null): boolean {
  if (playedWeek === null || playedWeek >= currentWeekId) return false
  const seen = lastRecapSeen()
  return seen === null || seen < playedWeek
}
