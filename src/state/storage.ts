import { parseAvatar, type AvatarChoice } from '../domain/avatar'
import { NEW_PROFILE, type Profile } from '../domain/progression'

const PROFILE_KEY = 'lettre-minute.profile.v1'
const SUBMISSIONS_KEY = 'lettre-minute.submissions.v1'
const AVATAR_KEY = 'lettre-minute.avatar.v1'

/** A word the player proposed while the dictionary did not know it. */
export interface PendingSubmission {
  word: string
  categoryId: string
  at: number
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

export function clearLocalData(): void {
  try {
    localStorage.removeItem(PROFILE_KEY)
    localStorage.removeItem(SUBMISSIONS_KEY)
    localStorage.removeItem(AVATAR_KEY)
  } catch {
    /* nothing stored, nothing to clear */
  }
}
