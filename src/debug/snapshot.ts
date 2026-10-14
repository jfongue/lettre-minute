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
  }
  funnel: { new_players: number; played_1: number; played_3: number; played_10: number; named: number }
  retention: { week: string; size: number; d1: number; w1: number; later: number }[]
  recent_signups: { name: string | null; at: string; runs: number; best: number }[]
  top_players: { name: string; runs: number; best: number; anonymous: boolean }[]
  moderation: { votes: number; submitted: number; accepted: number; rejected: number }
  challenges: { created: number; avg_players: number | null; played_share: number | null }
  /** Absent d'un serveur antérieur à 0036, comme `prompts`. */
  invites?: Invites
  /** Absent d'un serveur antérieur à 0073. */
  revenue?: Revenue
}

/**
 * Un mail vers une adresse qui jouait déjà n'est pas une invitation mais une
 * demande d'ami (`mails_to_players`). Les venues par lien ne se comptent que
 * depuis `links_since`, la première que `invite_accepts` a retenue.
 */
export interface Invites {
  mails: number
  mails_to_players: number
  mail_joins: number
  shares: number
  sharers: number
  link_joins: number
  played: number
  links_since: string | null
  daily: { day: string; mails: number; shares: number; joins: number }[]
  /** Depuis toujours. */
  top: { name: string; anonymous: boolean; mails: number; shares: number; joins: number; played: number }[]
}

/** Une ligne par jour de `revenue.daily` : ce que l'écran filtre et dessine. */
export interface RevenueDay {
  day: string
  offers: number
  activations: number
  ads: number
  subscribed: number
}

/**
* La part « revenu » du relevé (0073) : ce que le client a vu — les offres
* Premium ouvertes avec leur motif, les activations avec leur origine, les
* publicités avec leur emplacement et leur résultat —, et ce que `purchases`
* dit avoir été payé. Les répartitions portent sur toute la fenêtre du relevé,
* les lignes du jour sur ce que l'écran filtre.
*/
export interface Revenue {
  premium: {
    offers: number
    offer_devices: number
    activations: number
    /** Comptes avec un achat `premium_lifetime` non refusé, depuis toujours. */
    subscribers: number
    refused: number
    reasons: { reason: string; n: number; devices: number }[]
    sources: { source: string; n: number; devices: number }[]
    providers: { provider: string; n: number; accounts: number }[]
  }
  ads: {
    shown: number
    devices: number
    unavailable: number
    sources: { source: string; n: number; devices: number; rewarded: number; unavailable: number }[]
    results: { result: string; n: number }[]
  }
  daily: RevenueDay[]
}

/** Qui une barre compte (`admin_slot`, 0036) : un joueur, ou un appareil sans compte. */
export type SlotEntry = SlotPlayer | SlotDevice

export interface SlotPlayer {
  key: string
  name: string
  device?: undefined
  anonymous: boolean
  avatar: unknown
  xp: number
  total_runs: number
  total_best: number
  words_found: number
  created_at: string
  named_at: string | null
  moderator: boolean
  friends: number
  lang: string | null
  platform: string | null
  version: string | null
  runs: number
  best: number | null
  words: number
  active: boolean
  arrived: boolean
  signed: boolean
  sessions_with_run: number
  sessions_without_run: number
  mails: number
  shares: number
  invited_by: string | null
}

export interface SlotDevice {
  key: string
  name: string
  device: true
  sessions_with_run: number
  sessions_without_run: number
}
