import { parseAvatar, type AvatarChoice } from '../domain/avatar'
import type { RunRecord } from '../domain/history'
import { NEW_PROFILE, type Profile } from '../domain/progression'

const PROFILE_KEY = 'lettre-minute.profile.v1'
const SUBMISSIONS_KEY = 'lettre-minute.submissions.v1'
const AVATAR_KEY = 'lettre-minute.avatar.v1'
const HISTORY_KEY = 'lettre-minute.history.v1'

/** A word the player proposed while the dictionary did not know it. */
export interface PendingSubmission {
  word: string
  categoryId: string
  at: number
  /** The dictionary it is missing from; absent on proposals queued before there were several. */
  lang?: string
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback
  } catch {
    // A quota error, private mode or a half-written value must not cost a run.
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* nothing to do: the session simply stays in memory */
  }
}

export function loadProfile(): Profile {
  return read<Profile>(PROFILE_KEY, NEW_PROFILE)
}

export function saveProfile(profile: Profile): void {
  write(PROFILE_KEY, profile)
}

export function loadSubmissions(): PendingSubmission[] {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_KEY)
    const parsed = raw ? (JSON.parse(raw) as PendingSubmission[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveSubmissions(submissions: readonly PendingSubmission[]): void {
  write(SUBMISSIONS_KEY, submissions)
}

export function loadAvatar(): AvatarChoice {
  try {
    const raw = localStorage.getItem(AVATAR_KEY)
    return parseAvatar(raw ? JSON.parse(raw) : null)
  } catch {
    return parseAvatar(null)
  }
}

export function saveAvatar(avatar: AvatarChoice): void {
  write(AVATAR_KEY, avatar)
}

// Two thousand runs of fifteen words each: written as objects, the repeated
// keys alone would take a good part of the browser's five megabytes.
type StoredWord = [categoryId: string, word: string, display: string, points: number]
type StoredRun = [at: number, lang: string, score: number, bestCombo: number, skips: number, categoryIds: string[], words: StoredWord[]]

export function loadHistory(): RunRecord[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return (parsed as StoredRun[]).map(([at, lang, score, bestCombo, skips, categoryIds, words]) => ({
      at,
      lang,
      score,
      bestCombo,
      skips,
      categoryIds,
      words: words.map(([categoryId, word, display, points]) => ({ categoryId, word, display, points })),
    }))
  } catch {
    return []
  }
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
  } catch {
    /* nothing stored, nothing to clear */
  }
}
