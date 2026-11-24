// Opens a session of the game for a player signed in to Playgama, as
// `crazygames-auth` does for CrazyGames. The Playgama build sends, as one JSON
// token, what its Bridge hands out about the player (`bridge.player.extra`),
// the platform it runs on and the player's name. Playgama's own API checks the first
// (`/api/bridge/v1/verify`) and answers the only identity it vouches for; the
// function then finds or creates the game's account linked to it
// (`playgama_accounts`, 0114), names it after the portal's name, and answers a
// one-time magic-link hash that the client exchanges for a session
// (`verifyOtp`) — no e-mail is ever sent.
//
// Deployed with `--no-verify-jwt`: a guest of the portal has no session to
// prove, the Bridge's data is the credential.
import { createClient } from 'npm:@supabase/supabase-js@2'

const VERIFY_URL = 'https://playgama.com/api/bridge/v1/verify'
/** The platforms whose authorization Playgama's API can verify. */
const VERIFIABLE = new Set(['playgama', 'msn', 'microsoft_store'])
const VERIFY_TIMEOUT_MS = 8000

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
}

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })

/** The player id Playgama vouches for, null when it does not; throws when it cannot be asked. */
async function verify(platform: string, extra: unknown): Promise<string | null> {
  const response = await fetch(VERIFY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ platform, type: 'authorization', data: extra }),
    signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
  })
  if (response.status >= 500) throw new Error(`verify ${response.status}`)
  const answer = await response.json().catch(() => null)
  if (!answer?.success) return null
  const id = answer.playerId ?? answer.publisherPlayerId
  return typeof id === 'string' && id !== '' ? id : typeof id === 'number' ? String(id) : null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (request.method !== 'POST') return reply({ error: 'method' }, 405)

  const { token } = await request.json().catch(() => ({}))
  if (typeof token !== 'string' || token.length > 16384) return reply({ error: 'invalid' }, 400)
  let claimed: { platform?: unknown; extra?: unknown; name?: unknown }
  try {
    claimed = JSON.parse(token)
  } catch {
    return reply({ error: 'invalid' }, 400)
  }
  const { platform, extra, name } = claimed ?? {}
  if (typeof platform !== 'string' || !VERIFIABLE.has(platform)) return reply({ error: 'platform' }, 401)
  if (extra === null || typeof extra !== 'object') return reply({ error: 'invalid' }, 400)

  let playerId: string | null
  try {
    playerId = await verify(platform, extra)
  } catch {
    return reply({ error: 'verify' }, 502)
  }
  if (!playerId) return reply({ error: 'token' }, 401)
  const playgamaId = `${platform}:${playerId}`.slice(0, 200)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  // An address the account can be found by, on a reserved domain: nothing is
  // ever sent to it, and no invitation can match it.
  const local = playgamaId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)
  const email = `${local}.pg@playgama.invalid`

  const { data: linked } = await supabase.from('playgama_accounts').select('player_id').eq('playgama_id', playgamaId).maybeSingle()
  let player = linked?.player_id as string | undefined
  if (!player) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { playgama_id: playgamaId },
    })
    if (error || !created.user) {
      // Created a moment ago by a request that raced this one, and not linked yet.
      const { data: found } = await supabase.from('playgama_accounts').select('player_id').eq('playgama_id', playgamaId).maybeSingle()
      if (!found) return reply({ error: 'account' }, 500)
      player = found.player_id as string
    } else {
      player = created.user.id
    }
  }
  const { data: kept, error: linkError } = await supabase.rpc('playgama_link', {
    p_playgama_id: playgamaId,
    p_player: player,
    p_name: typeof name === 'string' ? name.slice(0, 64) : '',
  })
  if (linkError || typeof kept !== 'string') return reply({ error: 'link' }, 500)

  const { data: account } = await supabase.auth.admin.getUserById(kept)
  const address = account.user?.email
  if (!address) return reply({ error: 'account' }, 500)
  const { data: link, error: linkFailed } = await supabase.auth.admin.generateLink({ type: 'magiclink', email: address })
  if (linkFailed || !link.properties?.hashed_token) return reply({ error: 'session' }, 500)
  return reply({ tokenHash: link.properties.hashed_token })
})
