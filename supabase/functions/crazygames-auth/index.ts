// Opens a session of the game for a player signed in to CrazyGames. The
// CrazyGames build sends the token its SDK hands out (`getUserToken`): an RS256
// JWT whose public key the portal publishes, whose `userId` is the only
// identity it vouches for. The function checks it, finds or creates the
// game's account linked to that id (`crazygames_accounts`, 0073), names it
// after the portal's username, and answers a one-time magic-link hash that the
// client exchanges for a session (`verifyOtp`) — no e-mail is ever sent.
//
// Deployed with `--no-verify-jwt`: a guest of the portal has no session to
// prove, the CrazyGames token is the credential.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { importSPKI, jwtVerify } from 'npm:jose@5'

const PUBLIC_KEY_URL = 'https://sdk.crazygames.com/publicKey.json'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
}

let cachedKey: CryptoKey | null = null

async function portalKey(fresh: boolean): Promise<CryptoKey> {
  if (cachedKey && !fresh) return cachedKey
  const response = await fetch(PUBLIC_KEY_URL)
  if (!response.ok) throw new Error(`public key ${response.status}`)
  const { publicKey } = await response.json()
  cachedKey = await importSPKI(publicKey, 'RS256')
  return cachedKey
}

/** The token's claims, or null; the key may have turned, so a failure fetches it once more. */
async function verify(token: string): Promise<{ userId: string; username: string } | null> {
  for (const fresh of [false, true]) {
    try {
      const { payload } = await jwtVerify(token, await portalKey(fresh), { algorithms: ['RS256'] })
      if (typeof payload.userId !== 'string' || payload.userId === '') return null
      return { userId: payload.userId, username: typeof payload.username === 'string' ? payload.username : '' }
    } catch {
      /* try again with the published key */
    }
  }
  return null
}

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (request.method !== 'POST') return reply({ error: 'method' }, 405)

  const { token } = await request.json().catch(() => ({}))
  if (typeof token !== 'string' || token.length > 8192) return reply({ error: 'invalid' }, 400)
  const claims = await verify(token)
  if (!claims) return reply({ error: 'token' }, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  // An address the account can be found by, on a reserved domain: nothing is
  // ever sent to it, and no invitation can match it.
  const email = `${claims.userId.toLowerCase().replace(/[^a-z0-9]/g, '')}.cg@crazygames.invalid`

  const { data: linked } = await supabase.from('crazygames_accounts').select('player_id').eq('crazygames_id', claims.userId).maybeSingle()
  let player = linked?.player_id as string | undefined
  if (!player) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { crazygames_id: claims.userId },
    })
    if (error || !created.user) {
      // Created a moment ago by a request that raced this one, and not linked yet.
      const { data: found } = await supabase.from('crazygames_accounts').select('player_id').eq('crazygames_id', claims.userId).maybeSingle()
      if (!found) return reply({ error: 'account' }, 500)
      player = found.player_id as string
    } else {
      player = created.user.id
    }
  }
  const { data: kept, error: linkError } = await supabase.rpc('crazygames_link', {
    p_crazygames_id: claims.userId,
    p_player: player,
    p_name: claims.username,
  })
  if (linkError || typeof kept !== 'string') return reply({ error: 'link' }, 500)

  const { data: account } = await supabase.auth.admin.getUserById(kept)
  const address = account.user?.email
  if (!address) return reply({ error: 'account' }, 500)
  const { data: link, error: linkFailed } = await supabase.auth.admin.generateLink({ type: 'magiclink', email: address })
  if (linkFailed || !link.properties?.hashed_token) return reply({ error: 'session' }, 500)
  return reply({ tokenHash: link.properties.hashed_token })
})
