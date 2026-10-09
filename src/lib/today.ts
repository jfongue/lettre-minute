/** The calendar day in Paris, `YYYY-MM-DD`: the day the daily reveals count by (`revealsLeft`). */
export function todayKey(now: number = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
