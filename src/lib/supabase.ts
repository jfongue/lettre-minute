import { AuthClient } from '@supabase/auth-js'
import { PostgrestClient } from '@supabase/postgrest-js'
import { authStorage } from './native'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * The two parts of supabase-js the game uses, assembled the way `createClient`
 * does: supabase-js also bundles Realtime, Storage and Functions, a third of
 * the first download for services the game never calls. The storage key is
 * the one `createClient` picks, so a session saved by an older build is read
 * as it is — changing it would sign every player out.
 */
function slimClient(projectUrl: string, key: string) {
  const base = new URL(projectUrl.endsWith('/') ? projectUrl : `${projectUrl}/`)
  const auth = new AuthClient({
    url: new URL('auth/v1', base).href,
    headers: { Authorization: `Bearer ${key}`, apikey: key, 'X-Client-Info': 'supabase-js/2.117.0; runtime=web' },
    storageKey: `sb-${base.hostname.split('.')[0]}-auth-token`,
    storage: authStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
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
    headers: { 'X-Client-Info': 'supabase-js/2.117.0; runtime=web' },
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
export const supabase: Cloud | null = url && anonKey ? slimClient(url, anonKey) : null

let session: { userId: string } | null = null
let probing: Promise<{ userId: string } | null> | null = null

export function cloudConfigured(): boolean {
  return supabase !== null
}

/** Signs the player in anonymously — a solo game should not open on a form. */
export function connect(): Promise<{ userId: string } | null> {
  if (!supabase) return Promise.resolve(null)
  if (session) return Promise.resolve(session)
  if (probing) return probing

  probing = (async () => {
    const existing = await supabase.auth.getSession()
    const user = existing.data.session?.user ?? (await supabase.auth.signInAnonymously()).data.user
    session = user ? { userId: user.id } : null
    return session
  })().catch(() => null)

  return probing
}

/** Drops the cached identity, so the next call signs in as a new player. */
export function forgetSession(): void {
  session = null
  probing = null
}
