import { parseAvatar, type AvatarChoice } from '../domain/avatar'
import type { RunRecord } from '../domain/history'
import { NEW_PROFILE, type Profile } from '../domain/progression'
import type { Account } from '../lib/cloud'

const PROFILE_KEY = 'lettre-minute.profile.v1'
const SUBMISSIONS_KEY = 'lettre-minute.submissions.v1'
const AVATAR_KEY = 'lettre-minute.avatar.v1'
const HISTORY_KEY = 'lettre-minute.history.v1'
const ACCOUNT_KEY = 'lettre-minute.account.v1'

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
    if (typeof fallback === 'number') {
      if (isCount(value)) profile[field] = value
    } else if (Array.isArray(fallback)) {
      if (Array.isArray(value)) profile[field] = value.filter(isText)
    } else if (isRecord(value)) {
      profile[field] = Object.fromEntries(Object.entries(value).filter(([, count]) => isCount(count)))
    }
  }
  return profile as unknown as Profile
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* nothing to do: the session simply stays in memory */
  }
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
