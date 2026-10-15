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
  /** `key` et `lang` : absents d'un serveur antérieur à 0084. */
  recent_signups: { key?: string; name: string | null; at: string; runs: number; best: number; lang?: string | null }[]
  top_players: { key?: string; name: string; runs: number; best: number; anonymous: boolean; lang?: string | null }[]
  moderation: { votes: number; submitted: number; accepted: number; rejected: number }
  challenges: { created: number; avg_players: number | null; played_share: number | null }
  /** Absent d'un serveur antérieur à 0036. */
  invites?: Invites

  /** Absent d'un serveur antérieur à 0075. */
  by_platform?: ByPlatform
  /** Absent d'un serveur antérieur à 0077. */
  revenue?: Revenue
  /** Absent d'un serveur antérieur à 0080. */
  moderation_by_lang?: ModerationByLang
  /** Absent d'un serveur antérieur à 0084. */
  insights?: Insights
  /** Absent d'un serveur antérieur à 0084. */
  quality?: Quality
}

/**
 * La qualité du jeu (`analytics_quality`, 0084), session par session. Une
 * fermeture brutale ne se lit que sur les sessions dont l'ouverture le dit
 * (`watched`), un gel que sur celles dont le `hide` le rapporte (`measured`) :
 * deux mesures nées avec 0084, que `since` date.
 */
export interface Quality {
  totals: {
    sessions: number
    error_sessions: number
    errors: number
    watched: number
    unclean: number
    ready_p50: number | null
    ready_p90: number | null
    ready_p99: number | null
    slow_starts: number
    measured: number
    frozen: number
    /** Millisecondes de fil principal bloqué par minute de jeu. */
    long_per_minute: number | null
    long_max_p90: number | null
  }
  since: { unclean: string | null; freezes: string | null }
  daily: {
    day: string
    sessions: number
    error_sessions: number
    errors: number
    watched: number
    unclean: number
    measured: number
    frozen: number
    ready_p50: number | null
    ready_p90: number | null
  }[]
  by_version: {
    platform: PlatformName
    version: string
    sessions: number
    devices: number
    error_sessions: number
    watched: number
    unclean: number
    measured: number
    frozen: number
    ready_p50: number | null
    ready_p90: number | null
  }[]
  errors: {
    message: string
    source: string | null
    screen: string | null
    n: number
    devices: number
    sessions: number
    first: string
    last: string
    versions: string[]
  }[]
  screens: { screen: string; n: number; devices: number }[]
}

/** Une carte d'une offre de niveau : catégorie, pouvoir ou bonus. */
export type ChoiceKind = 'category' | 'power' | 'bonus'

/**
 * Ce que 0084 ajoute au relevé. Les choix portent leur offre depuis 0084 :
 * `picked` ne compte que ceux-là, `chosen` tous. Les arrivés du jour (`split`)
 * se retranchent de `daily` pour donner les revenants. La rétention ne compte
 * qu'un jour fini, sur les arrivés des quatre-vingt-dix derniers jours.
 */
export interface Insights {
  choices: {
    kinds: { kind: ChoiceKind; n: number; with_offer: number; devices: number }[]
    items: { kind: ChoiceKind; item: string; offered: number; chosen: number; picked: number; devices: number }[]
  }
  split: { day: string; runs_new: number; players_new: number }[]
  today_split: { hour: number; runs_new: number; players_new: number }[]
  sessions_by_platform: {
    totals: { platform: PlatformName; total: number; with_run: number; runs_per_session: number | null; median_seconds: number | null }[]
    daily: { day: string; platform: PlatformName; with_run: number; without_run: number }[]
    today_hourly: { hour: number; platform: PlatformName; with_run: number; without_run: number }[]
  }
  retention_curve: { day: number; eligible: number; exact: number; rolling: number }[]
  cohorts: { week: string; size: number; cells: { eligible: number; back: number }[] }[]
  stickiness: { day: string; dau: number; wau: number; mau: number }[]
  retention_by: {
    by: 'platform' | 'lang'
    value: string
    size: number
    d1_eligible: number
    d1: number
    w1_eligible: number
    w1: number
    m1_eligible: number
    m1: number
  }[]
}

/** Une version du jeu, comme les lignes la portent (0072, 0075), ou « inconnu » quand rien ne la dit. */
export type PlatformName = 'android' | 'web' | 'crazygames' | 'reddit' | 'inconnu'

/**
 * Par version : une ligne d'avant l'étiquette prend celle de son joueur
 * (compte CrazyGames, sinon ses événements) ; `tagged` compte les parties qui
 * la portaient vraiment.
 */
export interface ByPlatform {
  rows: {
    platform: PlatformName
    runs: number
    tagged: number
    players: number
    runs_today: number
    players_today: number
    avg_score: number | null
    best: number | null
    new_accounts: number
    duels: number
    weekly_attempts: number
    weekly_players: number
  }[]
  daily: { day: string; platform: PlatformName; runs: number }[]
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
  /** Depuis toujours. `key` et `lang` : absents d'un serveur antérieur à 0084. */
  top: { key?: string; name: string; anonymous: boolean; lang?: string | null; mails: number; shares: number; joins: number; played: number }[]
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
* La part « revenu » du relevé (0077) : ce que le client a vu — les offres
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

/**
 * La modération langue par langue (`analytics_moderation`, 0080). « Sur la
 * période » se lit sur les `days` derniers jours ; `_total`, la réserve qui
 * reste et ce qui attend, depuis toujours.
 */
export interface ModerationByLang {
  days: number
  langs: ModerationLang[]
}

export interface ModerationLang {
  lang: string
  moderators: number
  supers: number
  /** Ont voté sur la période. */
  active: number
  /** Sous dix juges : deux « correct » font entrer un mot (0078). */
  thin: boolean
  reserve_left: number
  reserve_released: number
  pending_add: number
  pending_ban: number
  sessions: number
  sessions_total: number
  votes: number
  added: number
  /** Parmi `added`, ceux que la réserve avait versés. */
  added_reserve: number
  added_total: number
  removed: number
  removed_total: number
  rejected: number
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
  /** Absents d'un serveur antérieur à 0084. */
  lang?: string | null
  platform?: string | null
  sessions_with_run: number
  sessions_without_run: number
}
