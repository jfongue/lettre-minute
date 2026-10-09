import { attemptsAllowed, attemptWindow, weekOf, type Week } from '../domain/weekly'
import { fetchWeeklyRecap, weeklyStart } from '../lib/cloud'
import { loadLocalAttempts, recordLocalAttempt, type WeeklyWindow } from './weekly'

/**
 * Ce que l'écran du défi sait du joueur : ses tentatives du jour, son
 * meilleur résultat et son rang provisoire. Le serveur et le compteur de
 * l'appareil se rejoignent par le plus grand : l'un des deux a pu manquer une
 * tentative (hors ligne, ou serveur injoignable au lancement).
 */
export interface WeeklyStatus {
  week: Week
  window: WeeklyWindow
  used: number
  ads: number
  best: number | null
  rank: number | null
  players: number
  /** Faux hors ligne : les tentatives ne se lisent alors que sur l'appareil. */
  online: boolean
}

export function windowAt(now: number): WeeklyWindow {
  return attemptWindow(now)
}

/** Le plus grand des deux comptes : jamais moins que ce que l'appareil a vu lancer. */
export function mergeUsed(local: number, server: number | null): number {
  return Math.max(local, server ?? 0)
}

export async function loadWeeklyStatus(lang: string, now: number): Promise<WeeklyStatus> {
  const week = weekOf(now)
  const window = windowAt(now)
  const local = loadLocalAttempts(window)
  const recap = await fetchWeeklyRecap(week.weekId, lang)
  const today = recap ? recap.attempts.filter((attempt) => attempt.day === window.day).length : null
  return {
    week,
    window,
    used: mergeUsed(local.used, today),
    ads: local.ads,
    best: recap?.best ?? null,
    rank: recap?.rank ?? null,
    players: recap?.players ?? 0,
    online: recap !== null,
  }
}

export type StartedAttempt = { ok: true; attemptId: string | null; n: number } | { ok: false; reason: 'refused' }

/**
 * Prend une tentative au lancement : le serveur compte, et sa réponse fait
 * foi ; hors ligne, le compteur de l'appareil tient lieu de serveur.
 */
export async function startWeeklyAttempt(
  weekId: string,
  lang: string,
  window: WeeklyWindow,
  perks: { plus: boolean; ads: number },
): Promise<StartedAttempt> {
  const quota = attemptsAllowed({ plus: perks.plus, adsWatched: perks.ads })
  const answer = await weeklyStart(weekId, lang, window.day, quota)
  if (answer === 'refused') return { ok: false, reason: 'refused' }
  if (answer === 'unreachable') {
    if (loadLocalAttempts(window).used >= quota) return { ok: false, reason: 'refused' }
    const next = recordLocalAttempt(window)
    return { ok: true, attemptId: null, n: next.used }
  }
  const next = recordLocalAttempt(window)
  return { ok: true, attemptId: answer.attemptId, n: Math.max(answer.n, next.used) }
}

const INTRO_KEY = 'lettre-minute.weekly-intro.v1'

/** Les modes dont le tutoriel a été vu : il s'ouvre seul au premier lancement de chacun. */
export function weeklyIntroSeen(mode: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(INTRO_KEY) ?? '[]') as unknown[]).includes(mode)
  } catch {
    return false
  }
}

export function markWeeklyIntroSeen(mode: string): void {
  try {
    const seen = JSON.parse(localStorage.getItem(INTRO_KEY) ?? '[]') as string[]
    if (!seen.includes(mode)) localStorage.setItem(INTRO_KEY, JSON.stringify([...seen, mode]))
  } catch {
    /* le tutoriel reviendra au prochain lancement */
  }
}
