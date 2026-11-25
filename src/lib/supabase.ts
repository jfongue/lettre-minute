import { AuthClient, isAuthRetryableFetchError, type Session } from '@supabase/auth-js'
import { PostgrestClient } from '@supabase/postgrest-js'
import { host, PLATFORM } from '../platform'
import { loadBackend, refreshBackend } from './backend'
import { authStorage } from './native'

const builtUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL
const builtKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY
// A build without a server stays without one: no page can hand it a server.
const moved = builtUrl && builtKey ? loadBackend() : null
/** The server this launch talks to: the build's own, unless the game's page said it moved. */
export const projectUrl = moved?.url ?? builtUrl
export const anonKey = moved?.anonKey ?? builtKey

/**
 * The project the device's session is saved under: the Supabase project the
 * game started on, whatever server it has moved to since, so that a move or
 * a build carrying the new address keeps every player signed in
 * (`VITE_SUPABASE_SESSION_REF`, supabase/README.md).
 */
const sessionRef =
  import.meta.env.VITE_SUPABASE_SESSION_REF || (builtUrl ? new URL(builtUrl).hostname.split('.')[0] : 'local')

/** Says which version of the game speaks: the server tags runs and duel tables with it (0072). */
const CLIENT_INFO = `supabase-js/2.117.0; runtime=web; platform=${PLATFORM}`

/**
 * The two parts of supabase-js the game uses, assembled the way `createClient`
 * does: supabase-js also bundles Realtime, Storage and Functions, a third of
 * the first download for services the game never calls. The storage key is
 * the one `createClient` picks, so a session saved by an older build is read
 * as it is — changing it would sign every player out.
 */
function slimClient(serverUrl: string, key: string) {
  const base = new URL(serverUrl.endsWith('/') ? serverUrl : `${serverUrl}/`)
  const auth = new AuthClient({
    url: new URL('auth/v1', base).href,
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'X-Client-Info': CLIENT_INFO },
    storageKey: `sb-${sessionRef}-auth-token`,
    storage: authStorage(),
    autoRefreshToken: true,
    persistSession: true,
    // Nothing hands a session back through the address: Google returns
    // through the plugin's popup and then `signInWithIdToken`, and a reset
    // is a typed code. Reading a `#access_token=…` link would let anyone
    // make the device adopt the session they crafted.
    detectSessionInUrl: false,
    flowType: 'implicit',
  })
  // As supabase-js does: the player's token when signed in, the anon key otherwise.
  const fetchWithAuth: typeof fetch = async (input, init) => {
    const { data } = await auth.getSession()
    const headers = new Headers(init?.headers)
    if (!headers.has('apikey')) headers.set('apikey', key)
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${data.session?.access_token ?? key}`)
    return fetch(input, { ...init, headers })
  }
  const rest = new PostgrestClient(new URL('rest/v1', base).href, {
    headers: { 'X-Client-Info': CLIENT_INFO },
    schema: 'public',
    fetch: fetchWithAuth,
  })
  return {
    auth,
    rpc: rest.rpc.bind(rest) as PostgrestClient['rpc'],
    from: rest.from.bind(rest) as PostgrestClient['from'],
  }
}

export type Cloud = ReturnType<typeof slimClient>

/**
 * The game is playable without a server: no keys, or a project without the
 * migrations, simply means scores and proposals stay on the device. Nothing
 * below may throw into the run loop.
 */
export const supabase: Cloud | null = projectUrl && anonKey ? slimClient(projectUrl, anonKey) : null

// After the launch's own calls, not in their way.
if (supabase) setTimeout(() => void refreshBackend(), 5000)

interface Identity {
  userId: string
  anonymous: boolean
}

/** The last account the device held a session for, kept while that session lapses. */
let session: Identity | null = null
let probing: Promise<Identity | null> | null = null

/**
 * The server carries the whole game, every player having an account on it.
 * A host whose guests stay without one (CrazyGames) only reads the boards
 * there: what it keeps — the challenge of the moment included — stays local.
 */
export function cloudConfigured(): boolean {
  return supabase !== null && host.anonymousAccounts
}

/**
 * Signs the player in anonymously — a solo game should not open on a form —
 * except on a host whose guests stay without any account (CrazyGames): there
 * only a session already on the device answers.
 *
 * The session is read again at every call, never trusted from the last: a
 * token that expired while the phone slept, and whose renewal failed, leaves
 * the client without one, and every request would then go out under the
 * public key, refused (401). Null while it cannot be renewed: the call falls
 * back instead of sending.
 */
export function connect(): Promise<{ userId: string } | null> {
  const client = supabase
  if (!client) return Promise.resolve(null)
  if (probing) return probing
  const probe = identify(client)
    .catch(() => null)
    .finally(() => {
      if (probing === probe) probing = null
    })
  probing = probe
  return probe
}

async function identify(client: Cloud): Promise<Identity | null> {
  const live = (await client.auth.getSession()).data.session ?? (await renewed(client))
  if (live === 'offline') return null
  if (live) return (session = { userId: live.user.id, anonymous: live.user.is_anonymous === true })
  // No session on the device: it never had one, or the server refused to
  // renew it. A named account is never swapped behind the player's back for
  // a new anonymous one: it waits to be signed in again.
  if (session && !session.anonymous) return null
  const user = host.anonymousAccounts ? (await client.auth.signInAnonymously()).data.user : null
  session = user ? { userId: user.id, anonymous: user.is_anonymous === true } : null
  return session
}

/**
 * One more try at the stored session. 'offline' when the server could not be
 * reached: the session is still there, only not usable yet, and the account
 * must not be replaced for a dropped connection.
 */
async function renewed(client: Cloud): Promise<Session | null | 'offline'> {
  const { data, error } = await client.auth.refreshSession()
  if (data.session) return data.session
  return isAuthRetryableFetchError(error) ? 'offline' : null
}

/** The account a run was played under, even while its session lapses: what it sends waits for it. */
export function heldPlayer(): string | null {
  return session?.userId ?? null
}

/** Drops the cached identity, so the next call signs in as a new player. */
export function forgetSession(): void {
  session = null
  probing = null
}
