// Checks a Premium purchase token with the Google Play Developer API
// (purchases.products.get) and marks the row `record_purchase` wrote
// (migration 0063) `verified` or `refused`. Called by the app right after
// the purchase, with the player's own session: the function finds the player
// in the JWT and only touches that player's row.
//
// PLAY_SERVICE_ACCOUNT is the service account's JSON key (see
// store/android/premium.md). Without it the row becomes `unverified`, which
// still counts as Premium: the store, not this function, took the payment.
import { createClient } from 'npm:@supabase/supabase-js@2'

const PACKAGE = 'fr.lettreminute.app'

function base64url(data: ArrayBuffer | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function accessToken(account: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3000,
  }
  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify(claims))}`
  const pem = account.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')
  const key = await crypto.subtle.importKey(
    'pkcs8',
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${base64url(signature)}`,
    }),
  })
  if (!response.ok) throw new Error(`token ${response.status}`)
  return (await response.json()).access_token as string
}

Deno.serve(async (request) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const jwt = (request.headers.get('authorization') ?? '').replace(/^Bearer /i, '')
  const { data: user } = await supabase.auth.getUser(jwt)
  if (!user.user) return new Response('forbidden', { status: 403 })

  const { product, token } = await request.json().catch(() => ({}))
  if (typeof product !== 'string' || typeof token !== 'string') return new Response('invalid', { status: 400 })

  const { data: row } = await supabase
    .from('purchases')
    .select('id, state')
    .eq('account', user.user.id)
    .eq('token', token)
    .eq('product', product)
    .maybeSingle()
  if (!row) return new Response('unknown purchase', { status: 404 })
  if (row.state === 'verified') return Response.json({ state: 'verified' })

  const secret = Deno.env.get('PLAY_SERVICE_ACCOUNT')
  if (!secret) {
    await supabase.from('purchases').update({ state: 'unverified' }).eq('id', row.id)
    return Response.json({ state: 'unverified' })
  }

  try {
    const bearer = await accessToken(JSON.parse(secret))
    const url =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}` +
      `/purchases/products/${encodeURIComponent(product)}/tokens/${encodeURIComponent(token)}`
    const response = await fetch(url, { headers: { authorization: `Bearer ${bearer}` } })
    // Google does not know this token: forged. Any other failure is ours or Google's, left for a retry.
    if (response.status === 404 || response.status === 410 || response.status === 400) {
      await supabase.from('purchases').update({ state: 'refused' }).eq('id', row.id)
      return Response.json({ state: 'refused' })
    }
    if (!response.ok) return Response.json({ state: row.state }, { status: 502 })
    const purchase = await response.json()
    // purchaseState: 0 purchased, 1 canceled, 2 pending.
    const state = purchase.purchaseState === 0 ? 'verified' : purchase.purchaseState === 2 ? 'pending' : 'refused'
    await supabase
      .from('purchases')
      .update({ state, verified_at: state === 'verified' ? new Date().toISOString() : null })
      .eq('id', row.id)
    return Response.json({ state })
  } catch (failure) {
    console.warn(failure instanceof Error ? failure.message : failure)
    return Response.json({ state: row.state }, { status: 502 })
  }
})
