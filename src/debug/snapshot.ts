/*
 * Le relevé du tableau de bord, tel que `analytics_snapshot` (0029) le rend :
 * un seul document, calculé sur le serveur, que la vue ne fait que mettre en
 * page. Dates en ISO, jours à l'heure de Paris.
 */

export interface DayRow {
  day: string
  new_players: number
  signups: number
  runs: number
  players: number
  opens: number
  sessions_with_run: number
  sessions_without_run: number
  challenges: number
  submissions: number
  ideas: number
}

/** Une heure d'aujourd'hui (0–23, heure de Paris), jusqu'à l'heure en cours. */
export type HourRow = DayRow & { hour: number }

export interface Counted {
  n: number
  devices: number
}

export interface Snapshot {
  generated_at: string
  days: number
  tracking_since: string | null
  totals: {
    players: number
    named: number
    anonymous: number
    runs: number
    words: number
    challenges: number
    moderators: number
    friendships: number
    submissions_pending: number
    submissions_accepted: number
    ideas_open: number
    push_devices: number
    devices: number
    events: number
  }
  today: { runs: number; players: number; new_players: number; signups: number; opens: number }
  active: { dau: number; wau: number; mau: number }
  daily: DayRow[]
  /** Absent d'un serveur antérieur à 0031. */
  today_hourly?: HourRow[]
  hourly: { dow: number; hour: number; runs: number }[]
  sessions: {
    total: number
    with_run: number
    without_run: number
    runs_per_session: number | null
    median_seconds: number | null
    ready_p50_ms: number | null
    ready_p90_ms: number | null
    cold_opens: number
    resumes: number
  }
  kinds: (Counted & { kind: string })[]
  taps: (Counted & { screen: string; label: string })[]
  screens: (Counted & { name: string })[]
  features: (Counted & { name: string })[]
  platforms: { platform: string; version: string; devices: number }[]
  langs: { lang: string; devices: number }[]
  errors: (Counted & { message: string; last: string })[]
  runs: {
    count: number
    challenge_runs: number
    avg_score: number | null
    median_score: number | null
    avg_words: number | null
    avg_skips: number | null
    scores: { from: number; n: number }[]
    powers: { power: string; runs: number; avg_score: number }[]
    categories: { category: string; words: number; points: number }[]
    top_words: { word: string; category: string; n: number }[]
  }
  funnel: { new_players: number; played_1: number; played_3: number; played_10: number; named: number }
  retention: { week: string; size: number; d1: number; w1: number; later: number }[]
  recent_signups: { name: string | null; at: string; runs: number; best: number }[]
  top_players: { name: string; runs: number; best: number; anonymous: boolean }[]
  moderation: { votes: number; submitted: number; accepted: number; rejected: number }
  challenges: { created: number; avg_players: number | null; played_share: number | null }
}
