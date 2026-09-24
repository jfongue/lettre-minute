/**
 * Firebase Cloud Messaging, HTTP v1, with nothing but WebCrypto: the service
 * account signs a JWT, Google trades it for an hour-long access token.
 */

export interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
  token_uri?: string
}

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
const GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token'

const base64url = (bytes: Uint8Array | string) => {
  const raw = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes
  let binary = ''
  for (const byte of raw) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function signingKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(body), (char) => char.charCodeAt(0))
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
}

export async function accessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const audience = account.token_uri ?? GOOGLE_TOKEN_URI
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: audience, iat: now, exp: now + 3600 }))
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await signingKey(account.private_key), new TextEncoder().encode(`${header}.${claims}`))
  const response = await fetch(audience, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${base64url(new Uint8Array(signature))}`,
    }),
  })
  if (!response.ok) throw new Error(`oauth ${response.status}: ${await response.text()}`)
  return ((await response.json()) as { access_token: string }).access_token
}

export interface Push {
  token: string
  title: string
  body: string
  /** Read by the app when the notification is tapped. */
  data: Record<string, string>
  /** Android replaces a notification with the same tag rather than stacking another. */
  tag: string
}

/** `sent`, `dead` (the phone is gone: forget its token), or `retry`. */
export type Outcome = 'sent' | 'dead' | 'retry'

export async function send(account: ServiceAccount, bearer: string, push: Push): Promise<Outcome> {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token: push.token,
        notification: { title: push.title, body: push.body },
        data: push.data,
        android: { priority: 'high', notification: { channel_id: 'challenges', tag: push.tag } },
      },
    }),
  })
  if (response.ok) return 'sent'
  const text = await response.text()
  // A token FCM no longer knows answers 404 UNREGISTERED, or 400 when it was never valid.
  if (response.status === 404 || text.includes('UNREGISTERED') || (response.status === 400 && text.includes('registration token'))) {
    return 'dead'
  }
  return 'retry'
}
