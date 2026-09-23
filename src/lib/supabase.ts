import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * The game is playable without a server: no keys, or a project without the
 * migrations, simply means scores and proposals stay on the device. Nothing
 * below may throw into the run loop.
 */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null

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
