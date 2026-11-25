/**
 * Where the server lives, movable without a new build: a CrazyGames or Play
 * build in review or on a phone cannot be redirected, its address being
 * written into it. Each launch reads the address the last one was handed,
 * then asks the game's page for the current one, applied at the next launch
 * as the features table is (`loadFeatures`) — never under a running session.
 *
 * `public/backend.json`, published with the web build, holds `{}` while the
 * server is the one the build carries, and `{ "url", "anonKey" }` once it
 * has moved (supabase/README.md, « Changer de serveur »).
 */
export const BACKEND_CONFIG_URL = 'https://jfongue.github.io/lettre-minute/backend.json'

const BACKEND_KEY = 'lettre-minute.backend.v1'
const ASK_TIMEOUT_MS = 8000

export interface Backend {
  url: string
  anonKey: string
}

/** A moved server, `null` for « the build's own », undefined for a page that says nothing usable. */
export function parseBackend(value: unknown): Backend | null | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const { url, anonKey } = value as Record<string, unknown>
  if (url === undefined && anonKey === undefined) return null
  if (typeof url !== 'string' || typeof anonKey !== 'string' || anonKey.length < 20) return undefined
  try {
    // Never a plain-http server: the session's tokens ride on every call.
    if (new URL(url).protocol !== 'https:') return undefined
  } catch {
    return undefined
  }
  return { url: url.replace(/\/+$/, ''), anonKey }
}

export function loadBackend(): Backend | null {
  try {
    const raw = localStorage.getItem(BACKEND_KEY)
    return raw ? (parseBackend(JSON.parse(raw)) ?? null) : null
  } catch {
    return null
  }
}

function saveBackend(backend: Backend | null): void {
  try {
    if (backend) localStorage.setItem(BACKEND_KEY, JSON.stringify(backend))
    else localStorage.removeItem(BACKEND_KEY)
  } catch {
    /* no storage: the build's own server stays */
  }
}

/** Asks the page where the server lives now; a page that does not answer changes nothing. */
export async function refreshBackend(): Promise<void> {
  // Not `AbortSignal.timeout`, which WebViews before Chrome 103 lack.
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), ASK_TIMEOUT_MS)
  try {
    const response = await fetch(BACKEND_CONFIG_URL, { cache: 'no-store', signal: abort.signal })
    if (!response.ok) return
    const next = parseBackend(await response.json())
    if (next !== undefined) saveBackend(next)
  } catch {
    /* offline, or the page is gone: keep what the last launch knew */
  } finally {
    clearTimeout(timer)
  }
}
