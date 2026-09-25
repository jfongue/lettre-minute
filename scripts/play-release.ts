/**
 * Sends the release bundle to a Play testing track, through the Play Developer
 * API and a service account (its setup: README, « Publier sur Play »).
 *
 *   npm run android:release              build, upload to closed testing, notes from android/whatsnew/
 *   npm run android:release -- --check   only prove the key works and list the tracks
 *
 * The key never enters the repository: PLAY_KEY, or ~/cles/lettre-minute-play.json.
 */
import { createSign } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PACKAGE = 'fr.lettreminute.app'
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`
const BUNDLE = 'android/app/build/outputs/bundle/release/app-release.aab'
const NOTES = 'android/whatsnew'

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
// Closed testing is the track Play calls « alpha ».
const track = args.find((arg) => arg.startsWith('--track='))?.slice('--track='.length) ?? 'alpha'

interface ServiceKey {
  client_email: string
  private_key: string
  token_uri: string
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url')
}

async function accessToken(key: ServiceKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: key.token_uri,
      iat: now,
      exp: now + 3600,
    }),
  )
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(key.private_key)
  const response = await fetch(key.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${base64url(signature)}`,
    }),
  })
  const body = (await response.json()) as { access_token?: string; error_description?: string }
  if (!body.access_token) throw new Error(`Google refused the key: ${body.error_description ?? response.status}`)
  return body.access_token
}

async function call<T>(token: string, method: string, url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${method} ${url.replace(API, '')} → ${response.status}\n${text}`)
  return (text ? JSON.parse(text) : {}) as T
}

function releaseNotes(): { language: string; text: string }[] {
  if (!existsSync(NOTES)) return []
  return readdirSync(NOTES)
    .filter((file) => file.endsWith('.txt'))
    .map((file) => ({ language: file.slice(0, -4), text: readFileSync(join(NOTES, file), 'utf8').trim() }))
    .filter((note) => note.text.length > 0)
}

const gradle = readFileSync('android/app/build.gradle', 'utf8')
const versionName = /versionName\s+"([^"]+)"/.exec(gradle)?.[1]

function localVersionCode(): number {
  return Number(/versionCode\s+(\d+)/.exec(gradle)?.[1])
}

interface Track {
  track: string
  releases?: { name?: string; status: string; versionCodes?: string[] }[]
}

const keyPath = process.env.PLAY_KEY ?? join(homedir(), 'cles/lettre-minute-play.json')
const key = JSON.parse(readFileSync(keyPath, 'utf8')) as ServiceKey
const token = await accessToken(key)
const edit = await call<{ id: string }>(token, 'POST', `${API}/edits`)

try {
  const { tracks } = await call<{ tracks: Track[] }>(token, 'GET', `${API}/edits/${edit.id}/tracks`)
  for (const { track: name, releases = [] } of tracks) {
    const summary = releases.map((release) => `${release.name ?? '?'} [${release.versionCodes?.join(',') ?? '-'}] ${release.status}`)
    console.log(`${name}: ${summary.join(' · ') || 'vide'}`)
  }

  if (checkOnly) {
    await call(token, 'DELETE', `${API}/edits/${edit.id}`)
    process.exit(0)
  }

  const shipped = tracks.flatMap((t) => (t.releases ?? []).flatMap((release) => release.versionCodes ?? []).map(Number))
  const versionCode = localVersionCode()
  if (shipped.some((code) => code >= versionCode)) {
    throw new Error(`versionCode ${versionCode} is not above what Play already has (${Math.max(...shipped)}): raise it in android/app/build.gradle`)
  }

  console.log(`Uploading ${BUNDLE} (${(statSync(BUNDLE).size / 1e6).toFixed(1)} MB)…`)
  const uploaded = await fetch(`${UPLOAD}/edits/${edit.id}/bundles?uploadType=media`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
    body: readFileSync(BUNDLE),
  })
  const bundle = (await uploaded.json()) as { versionCode?: number; error?: { message: string } }
  if (!bundle.versionCode) throw new Error(`Upload refused: ${bundle.error?.message ?? uploaded.status}`)

  const release = (status: string) =>
    call(token, 'PUT', `${API}/edits/${edit.id}/tracks/${track}`, {
      track,
      releases: [
        { name: `${bundle.versionCode} (${versionName})`, versionCodes: [String(bundle.versionCode)], status, releaseNotes: releaseNotes() },
      ],
    })
  await release('completed')
  try {
    await call(token, 'POST', `${API}/edits/${edit.id}:commit`)
    console.log(`versionCode ${bundle.versionCode} is out on ${track}, in review.`)
  } catch (error) {
    // Until its first release is sent for review from the console, Play calls
    // the app a draft and takes nothing but draft releases.
    if (!String(error).includes('draft app')) throw error
    await release('draft')
    await call(token, 'POST', `${API}/edits/${edit.id}:commit`)
    console.log(`versionCode ${bundle.versionCode} is a draft on ${track}: send it for review from the Play Console.`)
  }
} catch (error) {
  await call(token, 'DELETE', `${API}/edits/${edit.id}`).catch(() => {})
  throw error
}
