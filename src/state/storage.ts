import { parseAvatar, type AvatarChoice } from '../domain/avatar'
import type { BoardRow, Boards } from '../domain/boards'
import { parseRecord, type RunRecord } from '../domain/history'
import type { FlagRow, FlagValue, Roles } from '../domain/features'
import type { Leaderboard, PlacedRow } from '../domain/leaderboards'
import { catchUpPerks } from '../domain/bonus'
import { NEW_PROFILE, type Profile } from '../domain/progression'
import type { Account } from '../lib/cloud'

const PROFILE_KEY = 'lettre-minute.profile.v1'
const SUBMISSIONS_KEY = 'lettre-minute.submissions.v1'
const AVATAR_KEY = 'lettre-minute.avatar.v1'
const HISTORY_KEY = 'lettre-minute.history.v1'
const ACCOUNT_KEY = 'lettre-minute.account.v1'
// Kept by clearLocalData: whoever signs out has already learnt to play.
const TUTORIAL_KEY = 'lettre-minute.tutorial.v1'
// Kept by clearLocalData too: a player who signed out chose to, and the quiet
// Play Games sign-in must not sign them straight back in.
const QUIET_SIGN_IN_KEY = 'lettre-minute.quiet-sign-in.v1'
// The day « Mes demandes » was last opened: its « ! » waits for the next one.
const QUEUE_SEEN_KEY = 'lettre-minute.queue-seen.v1'
const SHARE_NEWS_KEY = 'lettre-minute.share-news.v1'
// Les avant-premières déjà annoncées à l'appareil ; gardé par clearLocalData,
// se déconnecter ne fait pas re-annoncer une catégorie déjà livrée.
const PREMIERE_NEWS_KEY = 'lettre-minute.premiere-news.v1'
// Le prix du défi hebdomadaire : le Premium gagné vit au profil (plusSince), ce
// drapeau-ci garde seulement la pop-up de revenir.
const WEEKLY_WIN_KEY = 'lettre-minute.weekly-win.v1'
// Kept by clearLocalData as well: the duel's rules are learnt once, and a
// player who signs out does not want them explained again.
const DUEL_RULES_KEY = 'lettre-minute.duel-rules.v1'
const DUEL_ACTIVE_KEY = 'lettre-minute.duel-active.v1'
// La pastille du bouton « Multijoueur » : gardée par clearLocalData comme le
// tutoriel, celui qui se déconnecte a déjà lancé sa partie à plusieurs.
const MULTIPLAYER_KEY = 'lettre-minute.multiplayer.v1'
// Les tables de duel qui ont déjà payé leur XP sur cet appareil : la fin d'une
// table se relit à chaque battement, et un rechargement la remontre.
const DUEL_PAID_KEY = 'lettre-minute.duel-paid.v1'
const DUEL_PAID_KEPT = 40
// La leçon d'un mode de la réserve : gardée par clearLocalData comme le
// tutoriel, celui qui se déconnecte a déjà appris la règle du mode.

/** A word the player proposed while the dictionary did not know it. */
export interface PendingSubmission {
  word: string
  categoryId: string
  at: number
  /** The dictionary it is missing from; absent on proposals queued before there were several. */
  lang?: string
}

function parsed(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    // A quota error, private mode or a half-written value must not cost a run.
    return null
  }
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const isText = (value: unknown): value is string => typeof value === 'string'
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The stored profile, field by field: what an older build, another tab or a
 * hand in the devtools left there is kept only where it has the right shape.
 * One NaN in `xp` would otherwise poison every level computed after it, and be
 * pushed to the server with the next run.
 */
function profileOf(stored: unknown): Profile {
  if (!isRecord(stored)) return NEW_PROFILE
  const profile: Record<string, unknown> = { ...NEW_PROFILE }
  for (const [field, fallback] of Object.entries(NEW_PROFILE)) {
    const value = stored[field]
    if (typeof fallback === 'string') {
      if (isText(value)) profile[field] = value
    } else if (typeof fallback === 'number') {
      if (isCount(value)) profile[field] = value
    } else if (Array.isArray(fallback)) {
      if (Array.isArray(value)) profile[field] = value.filter(isText)
    } else if (isRecord(value)) {
      profile[field] = Object.fromEntries(Object.entries(value).filter(([, count]) => isCount(count)))
    }
  }
  // A stored profile without the field predates the rules it is caught up to.
  if (!isCount(stored.perksVersion)) profile.perksVersion = 0
  return catchUpPerks(profile as unknown as Profile)
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* nothing to do: the session simply stays in memory */
  }
}

export function loadTutorialDone(): boolean {
  return parsed(TUTORIAL_KEY) === true
}

export function saveTutorialDone(): void {
  write(TUTORIAL_KEY, true)
}

/** Whether the game already tried to sign this device in through Play Games: once, never again. */
export function loadQuietSignInTried(): boolean {
  return parsed(QUIET_SIGN_IN_KEY) === true
}

export function saveQuietSignInTried(): void {
  write(QUIET_SIGN_IN_KEY, true)
}

/** Whether the duel's first-launch tutorial already played on this device. */
export function loadDuelRulesSeen(): boolean {
  return parsed(DUEL_RULES_KEY) === true
}

export function saveDuelRulesSeen(): void {
  write(DUEL_RULES_KEY, true)
}

/**
 * La partie de duel en ligne où ce joueur est encore vivant : l'app fermée en
 * plein duel la retrouve à l'accueil (« Ton duel continue »). Elle ne vaut que
 * le temps que sa réserve tienne sans lui, d'où l'heure gardée avec elle.
 */
export function loadActiveDuel(): { table: string; at: number } | null {
  const raw = parsed(DUEL_ACTIVE_KEY) as { table?: unknown; at?: unknown } | null
  return raw && typeof raw.table === 'string' && typeof raw.at === 'number' ? { table: raw.table, at: raw.at } : null
}

export function saveActiveDuel(table: string | null): void {
  if (table) write(DUEL_ACTIVE_KEY, { table, at: Date.now() })
  else {
    try {
      localStorage.removeItem(DUEL_ACTIVE_KEY)
    } catch {
      /* rien de gardé, rien à retirer */
    }
  }
}

/** Whether this duel table already paid its XP on this device. */
export function duelPaid(table: string): boolean {
  const paid = parsed(DUEL_PAID_KEY)
  return Array.isArray(paid) && paid.includes(table)
}

export function markDuelPaid(table: string): void {
  const paid = parsed(DUEL_PAID_KEY)
  const kept = Array.isArray(paid) ? paid.filter((id): id is string => typeof id === 'string' && id !== table) : []
  write(DUEL_PAID_KEY, [...kept, table].slice(-DUEL_PAID_KEPT))
}

/** Vrai tant qu'aucune partie à plusieurs — duel ou défi — n'a été lancée ici. */
export function loadMultiplayerNews(): boolean {
  return parsed(MULTIPLAYER_KEY) !== true
}

export function saveMultiplayerPlayed(): void {
  write(MULTIPLAYER_KEY, true)
}


export function loadQueueSeenOn(): string | null {
  const day = parsed(QUEUE_SEEN_KEY)
  return typeof day === 'string' ? day : null
}

export function saveQueueSeenOn(day: string): void {
  write(QUEUE_SEEN_KEY, day)
}

export function loadShareNewsSeen(): boolean {
  return parsed(SHARE_NEWS_KEY) === true
}

export function saveShareNewsSeen(): void {
  write(SHARE_NEWS_KEY, true)
}

/** Les avant-premières déjà annoncées sur cet appareil : une livraison nouvelle relance la pop-up, jamais deux fois la même. */
export function loadPremiereNewsSeen(): string[] {
  const stored = parsed(PREMIERE_NEWS_KEY)
  return Array.isArray(stored) ? stored.filter(isText) : []
}

export function savePremiereNewsSeen(ids: readonly string[]): void {
  write(PREMIERE_NEWS_KEY, ids)
}

/** Vrai une fois que le défi hebdomadaire a offert Premium ici : la pop-up ne revient pas. */
export function loadWeeklyWinGiven(): boolean {
  return parsed(WEEKLY_WIN_KEY) === true
}

export function saveWeeklyWinGiven(): void {
  write(WEEKLY_WIN_KEY, true)
}

export function loadProfile(): Profile {
  return profileOf(parsed(PROFILE_KEY))
}

export function saveProfile(profile: Profile): void {
  write(PROFILE_KEY, profile)
}

export function loadSubmissions(): PendingSubmission[] {
  const stored = parsed(SUBMISSIONS_KEY)
  if (!Array.isArray(stored)) return []
  return stored.filter(
    (entry): entry is PendingSubmission =>
      isRecord(entry) &&
      isText(entry.word) &&
      isText(entry.categoryId) &&
      isCount(entry.at) &&
      (entry.lang === undefined || isText(entry.lang)),
  )
}

export function saveSubmissions(submissions: readonly PendingSubmission[]): void {
  write(SUBMISSIONS_KEY, submissions)
}

export function loadAvatar(): AvatarChoice {
  return parseAvatar(parsed(AVATAR_KEY))
}

export function saveAvatar(avatar: AvatarChoice): void {
  write(AVATAR_KEY, avatar)
}

/**
 * The account last seen on the server, shown from the first paint and offline:
 * the session is still there, only the server is not, and the player must not
 * read « anonyme » for it.
 */
export function loadAccount(): Account | null {
  const stored = parsed(ACCOUNT_KEY)
  if (!isRecord(stored) || !isText(stored.name) || typeof stored.anonymous !== 'boolean') return null
  const stats = isRecord(stored.stats) ? stored.stats : {}
  const count = (field: string) => (isCount(stats[field]) ? stats[field] : 0)
  return {
    name: stored.name,
    email: isText(stored.email) ? stored.email : null,
    anonymous: stored.anonymous,
    needsName: stored.needsName === true,
    stats: {
      xp: count('xp'),
      runs: count('runs'),
      bestScore: count('bestScore'),
      wordsFound: count('wordsFound'),
      bestCombo: count('bestCombo'),
    },
    avatar: stored.avatar ? parseAvatar(stored.avatar) : null,
  }
}

export function saveAccount(account: Account | null): void {
  if (account) write(ACCOUNT_KEY, account)
  else {
    try {
      localStorage.removeItem(ACCOUNT_KEY)
    } catch {
      /* nothing stored, nothing to clear */
    }
  }
}

// Two thousand runs of fifteen words each: written as objects, the repeated
// keys alone would take a good part of the browser's five megabytes.
type StoredWord = [categoryId: string, word: string, display: string, points: number]
type StoredRun = [at: number, lang: string, score: number, bestCombo: number, skips: number, categoryIds: string[], words: StoredWord[]]

/**
 * One malformed run is dropped, not the history: the next save writes back
 * whatever was read, so failing on the whole list would erase it for good.
 */
function runOf(stored: unknown): RunRecord | null {
  if (!Array.isArray(stored)) return null
  const [at, lang, score, bestCombo, skips, categoryIds, words] = stored as unknown[]
  if (!isCount(at) || !isText(lang) || !isCount(score) || !isCount(bestCombo) || !isCount(skips)) return null
  if (!Array.isArray(categoryIds) || !Array.isArray(words)) return null
  return {
    at,
    lang,
    score,
    bestCombo,
    skips,
    categoryIds: categoryIds.filter(isText),
    words: words.flatMap((word: unknown) => {
      if (!Array.isArray(word)) return []
      const [categoryId, played, display, points] = word as unknown[]
      return isText(categoryId) && isText(played) && isText(display) && typeof points === 'number' && Number.isFinite(points)
        ? [{ categoryId, word: played, display, points }]
        : []
    }),
  }
}

export function loadHistory(): RunRecord[] {
  flushHistory()
  const stored = parsed(HISTORY_KEY)
  if (!Array.isArray(stored)) return []
  return stored.flatMap((run) => runOf(run) ?? [])
}

export function saveHistory(history: readonly RunRecord[]): void {
  write(
    HISTORY_KEY,
    history.map((run): StoredRun => [
      run.at,
      run.lang,
      run.score,
      run.bestCombo,
      run.skips,
      [...run.categoryIds],
      run.words.map((played): StoredWord => [played.categoryId, played.word, played.display, played.points]),
    ]),
  )
}

// Up to two thousand runs and their words make a long JSON string: written
// as a run ends, it cost the end screen its first frames on an old phone.
const HISTORY_SAVE_DELAY = 1500
let pendingHistory: readonly RunRecord[] | null = null
let pendingTimer: ReturnType<typeof setTimeout> | undefined
let flushOnLeave = false

/** Saves the history once the end screen has settled, or as soon as the app leaves the foreground. */
export function saveHistorySoon(history: readonly RunRecord[]): void {
  pendingHistory = history
  if (!flushOnLeave && typeof document !== 'undefined') {
    flushOnLeave = true
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushHistory())
    addEventListener('pagehide', flushHistory)
  }
  if (pendingTimer === undefined) pendingTimer = setTimeout(flushHistory, HISTORY_SAVE_DELAY)
}

/** Writes a history still waiting in `saveHistorySoon`, now. */
export function flushHistory(): void {
  clearTimeout(pendingTimer)
  pendingTimer = undefined
  const history = pendingHistory
  pendingHistory = null
  if (history) saveHistory(history)
}

// Les parties que le serveur n'a pas reçues : elles attendent ici, chacune
// avec le compte qui l'a jouée, qu'il réponde. Gardées par l'appareil comme
// l'historique, et effacées avec lui.
const UNSENT_RUNS_KEY = 'lettre-minute.unsent-runs.v1'
// Fait une fois par appareil : le rattrapage des parties perdues pendant les
// pannes des 23 et 24 novembre 2026.
const RUNS_BACKFILL_KEY = 'lettre-minute.runs-backfill.v1'
/** Beyond this, the oldest wait no more: the server refuses a run two weeks old anyway. */
export const UNSENT_RUNS_KEPT = 300

export interface UnsentRun {
  player: string
  seed: number
  powers: readonly string[]
  record: RunRecord
}

export function loadUnsentRuns(): UnsentRun[] {
  const stored = parsed(UNSENT_RUNS_KEY)
  if (!Array.isArray(stored)) return []
  return stored.flatMap((raw: unknown): UnsentRun[] => {
    if (!raw || typeof raw !== 'object') return []
    const entry = raw as Record<string, unknown>
    const record = parseRecord(entry.record)
    if (!record || typeof entry.player !== 'string' || typeof entry.seed !== 'number' || !Number.isFinite(entry.seed)) return []
    const powers = Array.isArray(entry.powers) ? entry.powers.filter((power): power is string => typeof power === 'string') : []
    return [{ player: entry.player, seed: entry.seed, powers, record }]
  })
}

export function saveUnsentRuns(runs: readonly UnsentRun[]): void {
  write(UNSENT_RUNS_KEY, runs.slice(-UNSENT_RUNS_KEPT))
}

export function loadRunsBackfilled(): boolean {
  return parsed(RUNS_BACKFILL_KEY) === true
}

export function saveRunsBackfilled(): void {
  write(RUNS_BACKFILL_KEY, true)
}

// Le dernier classement lu, avec son heure : ce que l'accueil montre quand le
// serveur ne répond pas au lancement (`boardsStillValid` écarte un jour passé).
const BOARDS_KEY = 'lettre-minute.boards.v1'

export function loadBoardsMemory(): { at: number; boards: Boards } | null {
  const raw = parsed(BOARDS_KEY) as { at?: unknown; boards?: Record<string, unknown> } | null
  if (!raw || typeof raw.at !== 'number' || !raw.boards) return null
  const rows = (value: unknown): BoardRow[] =>
    Array.isArray(value)
      ? value.flatMap((row: unknown) => {
          if (!row || typeof row !== 'object') return []
          const line = row as Record<string, unknown>
          return typeof line.name === 'string' && typeof line.value === 'number'
            ? [{ name: line.name, avatar: parseAvatar(line.avatar), value: line.value }]
            : []
        })
      : []
  return { at: raw.at, boards: { day: rows(raw.boards.day), week: rows(raw.boards.week), discoveries: rows(raw.boards.discoveries) } }
}

export function saveBoardsMemory(boards: Boards, at: number): void {
  write(BOARDS_KEY, { at, boards })
}

// Le dernier état de chaque tableau de la page des classements, mesure et
// période, avec son heure : ce que la page montre quand le serveur se tait.
const LEADERBOARDS_KEY = 'lettre-minute.leaderboards.v1'

type LeaderboardMemory = Record<string, { at: number; board: Leaderboard }>

function placedRow(value: unknown): PlacedRow | null {
  if (!value || typeof value !== 'object') return null
  const line = value as Record<string, unknown>
  if (typeof line.name !== 'string' || typeof line.value !== 'number' || typeof line.place !== 'number') return null
  return { name: line.name, avatar: parseAvatar(line.avatar), value: line.value, place: line.place, mine: line.mine === true }
}

export function loadLeaderboardMemory(key: string): { at: number; board: Leaderboard } | null {
  const all = parsed(LEADERBOARDS_KEY) as Record<string, { at?: unknown; board?: { rows?: unknown; me?: unknown } }> | null
  const kept = all?.[key]
  if (!kept || typeof kept.at !== 'number' || !kept.board || !Array.isArray(kept.board.rows)) return null
  const rows = kept.board.rows.flatMap((row) => placedRow(row) ?? [])
  return { at: kept.at, board: { rows, me: placedRow(kept.board.me) } }
}

export function saveLeaderboardMemory(key: string, board: Leaderboard, at: number): void {
  const all = (parsed(LEADERBOARDS_KEY) ?? {}) as LeaderboardMemory
  write(LEADERBOARDS_KEY, { ...all, [key]: { at, board } })
}

export function clearLocalData(): void {
  pendingHistory = null
  try {
    localStorage.removeItem(PROFILE_KEY)
    localStorage.removeItem(HISTORY_KEY)
    localStorage.removeItem(UNSENT_RUNS_KEY)
    localStorage.removeItem(BOARDS_KEY)
    localStorage.removeItem(LEADERBOARDS_KEY)
    localStorage.removeItem(SUBMISSIONS_KEY)
    localStorage.removeItem(AVATAR_KEY)
    localStorage.removeItem(ACCOUNT_KEY)
  } catch {
    /* nothing stored, nothing to clear */
  }
}

// Ce que la table des fonctionnalités disait au dernier démarrage, et les
// rôles qu'on connaissait au joueur : appliqués au démarrage suivant, pour
// qu'un réglage ne change jamais un écran sous ses doigts. Gardé par
// `clearLocalData` : effacer ses parties ne rouvre pas un outil fermé.
const FEATURES_KEY = 'lettre-minute.features.v1'

export interface StoredFeatures {
  flags: Record<string, FlagRow>
  roles: Pick<Roles, 'moderator' | 'superModerator'>
}

const FLAG_VALUES: readonly FlagValue[] = ['on', 'off', 'neutral']

export function loadFeatures(): StoredFeatures {
  const raw = parsed(FEATURES_KEY) as { flags?: unknown; roles?: unknown } | null
  const flags: Record<string, FlagRow> = {}
  if (raw?.flags && typeof raw.flags === 'object') {
    for (const [id, row] of Object.entries(raw.flags as Record<string, unknown>)) {
      if (!row || typeof row !== 'object') continue
      const cells = row as Record<string, unknown>
      const cell = (key: string): FlagValue => (FLAG_VALUES.includes(cells[key] as FlagValue) ? (cells[key] as FlagValue) : 'neutral')
      flags[id] = { everyone: cell('everyone'), moderator: cell('moderator'), premium: cell('premium'), superModerator: cell('superModerator') }
    }
  }
  const roles = (raw?.roles ?? {}) as Record<string, unknown>
  return { flags, roles: { moderator: roles.moderator === true, superModerator: roles.superModerator === true } }
}

export function saveFeatureFlags(flags: Record<string, FlagRow>): void {
  write(FEATURES_KEY, { ...loadFeatures(), flags })
}

export function saveFeatureRoles(roles: StoredFeatures['roles']): void {
  write(FEATURES_KEY, { ...loadFeatures(), roles })
}

// Les designs d'avatar que l'éditeur a déjà montrés : la tuile d'un gagné
// porte un cadre rouge tant qu'on ne l'a pas vue, et sortir de la page les
// range toutes — un cadre vu, même sans être touché, ne revient pas.
const AVATAR_SEEN_KEY = 'lettre-minute.avatar-seen.v1'

export function loadSeenDesigns(): number[] {
  const raw = parsed(AVATAR_SEEN_KEY)
  return Array.isArray(raw) ? raw.filter((id): id is number => typeof id === 'number') : []
}

/** Null tant que l'éditeur n'a jamais été ouvert : la première tuile gagnée suffit alors à l'annoncer. */
export function loadSeenDesignsOrNull(): number[] | null {
  return parsed(AVATAR_SEEN_KEY) === null ? null : loadSeenDesigns()
}

export function saveSeenDesigns(designs: readonly number[]): void {
  write(AVATAR_SEEN_KEY, [...designs])
}

// Les couleurs gagnées que l'éditeur a déjà montrées, sous la même règle.
const AVATAR_SEEN_COLOURS_KEY = 'lettre-minute.avatar-seen-colours.v1'

export function loadSeenColours(): string[] {
  const raw = parsed(AVATAR_SEEN_COLOURS_KEY)
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : []
}

export function saveSeenColours(colours: readonly string[]): void {
  write(AVATAR_SEEN_COLOURS_KEY, [...colours])
}
