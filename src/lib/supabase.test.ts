import { AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/auth-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const user = (id: string, anonymous = true) => ({ id, is_anonymous: anonymous })
const session = (id: string, anonymous = true) => ({ access_token: `token-${id}`, user: user(id, anonymous) })

/** What the device's auth client answers, set per test. */
const auth = {
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  signInAnonymously: vi.fn(),
}

vi.mock('@supabase/auth-js', async (actual) => ({
  ...(await actual<typeof import('@supabase/auth-js')>()),
  AuthClient: class {
    getSession = () => auth.getSession()
    refreshSession = () => auth.refreshSession()
    signInAnonymously = () => auth.signInAnonymously()
  },
}))
vi.mock('@supabase/postgrest-js', () => ({
  PostgrestClient: class {
    rpc() {}
    from() {}
  },
}))
vi.mock('../platform', () => ({ host: { anonymousAccounts: true }, PLATFORM: 'web' }))
vi.mock('./backend', () => ({ loadBackend: () => null, refreshBackend: () => Promise.resolve() }))
vi.mock('./native', () => ({ authStorage: () => undefined }))

vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
const { connect, forgetSession, heldPlayer } = await import('./supabase')

const none = { data: { session: null }, error: null }

beforeEach(() => {
  forgetSession()
  auth.getSession.mockReset()
  auth.refreshSession.mockReset()
  auth.signInAnonymously.mockReset()
})

describe('connect', () => {
  it('signs a device without a session in anonymously', async () => {
    auth.getSession.mockResolvedValue(none)
    auth.refreshSession.mockResolvedValue({ data: { session: null }, error: new AuthSessionMissingError() })
    auth.signInAnonymously.mockResolvedValue({ data: { user: user('fresh') }, error: null })
    expect(await connect()).toEqual({ userId: 'fresh', anonymous: true })
  })

  it('reads the session again instead of trusting the last call', async () => {
    auth.getSession.mockResolvedValueOnce({ data: { session: session('a') }, error: null })
    expect(await connect()).toEqual(expect.objectContaining({ userId: 'a' }))
    // The token lapsed and its renewal could not reach the server.
    auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: new AuthRetryableFetchError('offline', 0) })
    auth.refreshSession.mockResolvedValue({ data: { session: null }, error: new AuthRetryableFetchError('offline', 0) })
    expect(await connect()).toBeNull()
    expect(auth.signInAnonymously).not.toHaveBeenCalled()
    expect(heldPlayer()).toBe('a')
  })

  it('renews a lapsed session once before giving up', async () => {
    auth.getSession.mockResolvedValue(none)
    auth.refreshSession.mockResolvedValue({ data: { session: session('a') }, error: null })
    expect(await connect()).toEqual(expect.objectContaining({ userId: 'a' }))
    expect(auth.signInAnonymously).not.toHaveBeenCalled()
  })

  it('never swaps a named account for an anonymous one', async () => {
    auth.getSession.mockResolvedValueOnce({ data: { session: session('named', false) }, error: null })
    await connect()
    // The server refused to renew it: the session is gone from the device.
    auth.getSession.mockResolvedValue(none)
    auth.refreshSession.mockResolvedValue({ data: { session: null }, error: new AuthSessionMissingError() })
    expect(await connect()).toBeNull()
    expect(auth.signInAnonymously).not.toHaveBeenCalled()
    expect(heldPlayer()).toBe('named')
  })

  it('gives a dead anonymous session a new anonymous account', async () => {
    auth.getSession.mockResolvedValueOnce({ data: { session: session('old') }, error: null })
    await connect()
    auth.getSession.mockResolvedValue(none)
    auth.refreshSession.mockResolvedValue({ data: { session: null }, error: new AuthSessionMissingError() })
    auth.signInAnonymously.mockResolvedValue({ data: { user: user('new') }, error: null })
    expect(await connect()).toEqual(expect.objectContaining({ userId: 'new' }))
  })

  it('asks the auth client once for calls made together', async () => {
    auth.getSession.mockResolvedValue({ data: { session: session('a') }, error: null })
    await Promise.all([connect(), connect(), connect()])
    expect(auth.getSession).toHaveBeenCalledTimes(1)
  })
})
