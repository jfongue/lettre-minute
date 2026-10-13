// Where Lemon Squeezy's orders land. A signed `order_created` records the
// purchase in `purchases` (0069) for the account the checkout put in its
// custom data; a signed `order_refunded` marks it refused, and the account
// loses Premium on its next read of `my_premium`.
//
// Deployed without JWT verification — the merchant has no session to present
// — so the signature is the only door: HMAC-SHA256 over the raw body with
// LEMONSQUEEZY_WEBHOOK_SECRET, compared in constant time. Anything unsigned is
// refused before a single row is touched.
import { createClient } from 'npm:@supabase/supabase-js@2'

const PRODUCT = 'premium_lifetime'

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function signature(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
}

/** Constant-time enough for two same-length hex strings. */
function same(sent: string, expected: string): boolean {
  if (sent.length !== expected.length) return false
  let diff = 0
  for (let at = 0; at < sent.length; at += 1) diff |= sent.charCodeAt(at) ^ expected.charCodeAt(at)
  return diff === 0
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const secret = Deno.env.get('LEMONSQUEEZY_WEBHOOK_SECRET')
  if (!secret) return new Response('not configured', { status: 503 })

  const body = await request.text()
  const sent = (request.headers.get('x-signature') ?? '').toLowerCase()
  if (!same(sent, await signature(body, secret))) return new Response('bad signature', { status: 401 })

  let event: { meta?: Record<string, unknown>; data?: Record<string, unknown> } | null = null
  try {
    event = JSON.parse(body)
  } catch {
    return new Response('invalid body', { status: 400 })
  }
  const name = (event?.meta as { event_name?: unknown } | undefined)?.event_name
  const account = (event?.meta as { custom_data?: { account?: unknown } } | undefined)?.custom_data?.account
  const order = event?.data as { id?: unknown; attributes?: Record<string, unknown> } | undefined
  const orderId = order?.id
  if (typeof orderId !== 'string' && typeof orderId !== 'number') return Response.json({ ignored: true })
  // An order without our account is one this game did not open: nothing to credit.
  if (typeof account !== 'string' || !account) return Response.json({ ignored: true })
  if (name !== 'order_created' && name !== 'order_refunded') return Response.json({ ignored: true })

  const refunded = name === 'order_refunded'
  const paid = order?.attributes?.status === 'paid'
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { error } = await supabase.from('purchases').upsert(
    {
      account,
      product: PRODUCT,
      provider: 'lemonsqueezy',
      // Prefixed: the merchant's own id is a number, shorter than the token
      // `purchases` accepts, and the prefix keeps the two providers' orders
      // from ever colliding.
      token: `lemonsqueezy:${orderId}`,
      order_id: String(order?.attributes?.order_number ?? ''),
      email: String(order?.attributes?.user_email ?? ''),
      state: refunded ? 'refused' : paid ? 'verified' : 'pending',
      verified_at: !refunded && paid ? new Date().toISOString() : null,
    },
    { onConflict: 'token' },
  )
  if (error) {
    console.warn(error.message)
    return Response.json({ error: 'write failed' }, { status: 502 })
  }
  return Response.json({ ok: true })
})
