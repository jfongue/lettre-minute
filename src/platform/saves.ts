/**
 * What the game keeps between visits: the profile (level, categories, powers,
 * records), its history, avatar and settings, mirrored to a portal's own save
 * (CrazyGames' Data module, Playgama's Bridge storage). The rest of
 * localStorage — caches, the device's queues — is left alone.
 */
export const SAVED_KEYS = [
  'lettre-minute.profile.v1',
  'lettre-minute.history.v1',
  'lettre-minute.avatar.v1',
  'lettre-minute.tutorial.v1',
  'lettre-minute.revealed-recaps.v1',
  'lettre-minute.theme.v1',
  'lettre-minute.sound.v1',
  'lettre-minute.locale.v1',
  'lettre-minute.weekly-attempts.v1',
  'lettre-minute.weekly-intro.v1',
]
export const HISTORY_KEY = 'lettre-minute.history.v1'
// CrazyGames' Data module refuses past 1 MiB, all keys together: the history, the one
// key that grows with every run, is cut to its latest runs to stay well under.
const DATA_BUDGET = 900_000

export function fitHistory(value: string, others: number): string {
  if (value.length + others <= DATA_BUDGET) return value
  try {
    const runs: unknown = JSON.parse(value)
    if (!Array.isArray(runs)) return '[]'
    let kept = runs
    let text = value
    while (kept.length > 0 && text.length + others > DATA_BUDGET) {
      kept = kept.slice(0, Math.floor(kept.length * 0.8))
      text = JSON.stringify(kept)
    }
    return text
  } catch {
    return '[]'
  }
}
