import { NO_DAILY, parseDailyRecord, recordDaily, type DailyRecord } from '../domain/daily'

/**
 * Ce que l'appareil retient du défi du jour : le dernier jour joué et sa
 * série. CrazyGames le recopie dans son module Data (`SAVED_KEYS`). Jamais
 * effacé par `clearLocalData`, comme les tentatives du défi du moment :
 * vider ses parties ne rend pas la partie du jour, ni son XP.
 */

const DAILY_KEY = 'lettre-minute.daily.v1'

export function loadDaily(): DailyRecord {
  try {
    const raw = localStorage.getItem(DAILY_KEY)
    return raw ? parseDailyRecord(JSON.parse(raw)) : NO_DAILY
  } catch {
    // Un stockage refusé ou à moitié écrit ne doit pas coûter la partie du jour.
    return NO_DAILY
  }
}

export function saveDailyRun(day: string, score: number): DailyRecord {
  const next = recordDaily(loadDaily(), day, score)
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(next))
  } catch {
    /* la série tient le temps de la session */
  }
  return next
}

const pad = (value: number) => String(value).padStart(2, '0')

/** Le jour du calendrier du joueur, `YYYY-MM-DD` : c'est à son minuit que la partie change. */
export function localDay(at: number): string {
  const date = new Date(at)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Le prochain minuit du joueur, quand la partie suivante s'ouvre. */
export function nextLocalMidnight(at: number): number {
  const date = new Date(at)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime()
}
