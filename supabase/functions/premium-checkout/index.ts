// Opens a Lemon Squeezy checkout for the player's own account and hands the
// page its address. The POST is the purchase: the function reads the player in
// the JWT and writes their id into the order's custom data, which
// `premium-webhook` reads back to credit the right account. The GET only says
// whether the merchant is configured, so the web page knows whether it can
// offer a price at all — as `billingSupported` answers on the phone.
//
// Secrets (see docs/premium-web.md): LEMONSQUEEZY_API_KEY,
// LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_VARIANT_ID, and optionally
// PREMIUM_REDIRECT_URL for where the merchant sends the buyer back.
import { createClient } from 'npm:@supabase/supabase-js@2'

const ORDERS_URL = 'https://api.lemonsqueezy.com/v1/checkouts'
const DEFAULT_REDIRECT = 'https://jfongue.github.io/lettre-minute/?premium=paid'

function configured(): boolean {
  return Boolean(
    Deno.env.get('LEMONSQUEEZY_API_KEY') &&
      Deno.env.get('LEMONSQUEEZY_STORE_ID') &&
      Deno.env.get('LEMONSQUEEZY_VARIANT_ID'),
  )
}

Deno.serve(async (request) => {
  if (request.method === 'GET') return Response.json({ ready: configured() })
  if (request.method !== 'POST') return new Response('method not allowed', { status: 405 })
  if (!configured()) return new Response('not configured', { status: 503 })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const jwt = (request.headers.get('authorization') ?? '').replace(/^Bearer /i, '')
  const { data: user } = await supabase.auth.getUser(jwt)
  // No account, no purchase: an order nobody can be credited for is worse than
  // a refused one, and the merchant's webhook has nothing to attach it to.
  if (!user.user) return new Response('forbidden', { status: 403 })

  const email = user.user.email ?? undefined
  const body = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: {
          ...(email ? { email } : {}),
          custom: { account: user.user.id },
        },
        product_options: {
          redirect_url: Deno.env.get('PREMIUM_REDIRECT_URL') ?? DEFAULT_REDIRECT,
          enabled: true,
        },
        checkout_options: { embed: false, media: false, logo: true },
        expires_at: null,
        preview: false,
      },
      relationships: {
        store: { data: { type: 'stores', id: Deno.env.get('LEMONSQUEEZY_STORE_ID')! } },
        variant: { data: { type: 'variants', id: Deno.env.get('LEMONSQUEEZY_VARIANT_ID')! } },
      },
    },
  }

  const response = await fetch(ORDERS_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${Deno.env.get('LEMONSQUEEZY_API_KEY')!}`,
      accept: 'application/vnd.api+json',
      'content-type': 'application/vnd.api+json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    console.warn(`checkout ${response.status}`)
    return Response.json({ error: 'checkout failed' }, { status: 502 })
  }

  const checkout = await response.json().catch(() => null)
  const url = checkout?.data?.attributes?.url
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    return Response.json({ error: 'no checkout url' }, { status: 502 })
  }
  return Response.json({ url })
})
