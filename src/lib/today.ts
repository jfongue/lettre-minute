import { parisDay } from '../domain/weekly'

/** The calendar day in Paris, `YYYY-MM-DD`: the day the daily reveals count by (`revealsLeft`). */
export function todayKey(now: number = Date.now()): string {
  return parisDay(now)
}
