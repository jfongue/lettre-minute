import { parseAvatar, type AvatarChoice } from '../domain/avatar'
import type { RunRecord } from '../domain/history'
import type { FlagRow, FlagValue, Roles } from '../domain/features'
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
// Kept by clearLocalData as well: the duel's rules are learnt once, and a
// player who signs out does not want them explained again.
const DUEL_RULES_KEY = 'lettre-minute.duel-rules.v1'
// La pastille du bouton « Multijoueur » : gardée par clearLocalData comme le
// tutoriel, celui qui se déconnecte a déjà lancé sa partie à plusieurs.
const MULTIPLAYER_KEY = 'lettre-minute.multiplayer.v1'
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

export function clearLocalData(): void {
  try {
    localStorage.removeItem(PROFILE_KEY)
    localStorage.removeItem(HISTORY_KEY)
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
