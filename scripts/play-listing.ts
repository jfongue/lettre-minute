/**
 * Replaces the Play Store listing's phone screenshots and feature graphic in
 * every language Play knows, from what scripts/render-store.sh leaves under
 * store/android. Texts are left alone: they are typed in the console.
 *
 *   npm run android:listing              upload and commit
 *   npm run android:listing -- --check   only list what each listing holds
 *
 * Same service account as play-release.ts: PLAY_KEY, or ~/cles/lettre-minute-play.json.
 */
import { createSign } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PACKAGE = 'fr.lettreminute.app'
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`
const STORE = 'store/android'
const SHOTS = [1, 2, 3, 4, 5, 6]

const checkOnly = process.argv.includes('--check')

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

// The images endpoints answer 503 now and then, on a call that works a second later.
async function send(url: string, init: RequestInit): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, init)
    const text = await response.text()
    if (response.ok) return text
    if (response.status < 500 || attempt === 4) {
      throw new Error(`${init.method} ${url.replace(API, '').replace(UPLOAD, '')} → ${response.status}\n${text}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
  }
}

async function call<T>(token: string, method: string, url: string): Promise<T> {
  const text = await send(url, { method, headers: { authorization: `Bearer ${token}` } })
  return (text ? JSON.parse(text) : {}) as T
}

async function upload(token: string, url: string, file: string): Promise<void> {
  await send(`${url}?uploadType=media`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'image/png' },
    body: readFileSync(file),
  })
}

// Play's languages are regional (en-GB, es-419, pt-BR…), the rendered ones are not.
function folder(language: string): string {
  return language.split('-')[0]
}

function featureGraphic(lang: string): string {
  return lang === 'fr' ? join(STORE, 'feature-graphic.png') : join(STORE, lang, 'feature-graphic.png')
}

const keyPath = process.env.PLAY_KEY ?? join(homedir(), 'cles/lettre-minute-play.json')
const key = JSON.parse(readFileSync(keyPath, 'utf8')) as ServiceKey
const token = await accessToken(key)
const edit = await call<{ id: string }>(token, 'POST', `${API}/edits`)
const base = `${API}/edits/${edit.id}/listings`
const uploads = `${UPLOAD}/edits/${edit.id}/listings`

try {
  const { listings = [] } = await call<{ listings?: { language: string }[] }>(token, 'GET', base)
  for (const { language } of listings) {
    const lang = folder(language)
    const shots = SHOTS.map((n) => join(STORE, 'listing', lang, `${n}.png`))
    if (!shots.every(existsSync) || !existsSync(featureGraphic(lang))) {
      console.log(`${language}: nothing rendered under ${lang}, left as is`)
      continue
    }
    if (checkOnly) {
      const held = await call<{ images?: unknown[] }>(token, 'GET', `${base}/${language}/phoneScreenshots`)
      console.log(`${language}: ${held.images?.length ?? 0} screenshots on Play, ${shots.length} rendered`)
      continue
    }
    await call(token, 'DELETE', `${base}/${language}/phoneScreenshots`)
    for (const shot of shots) await upload(token, `${uploads}/${language}/phoneScreenshots`, shot)
    await call(token, 'DELETE', `${base}/${language}/featureGraphic`)
    await upload(token, `${uploads}/${language}/featureGraphic`, featureGraphic(lang))
    console.log(`${language}: ${shots.length} screenshots and the feature graphic from ${lang}`)
  }

  if (checkOnly) {
    await call(token, 'DELETE', `${API}/edits/${edit.id}`)
  } else {
    await call(token, 'POST', `${API}/edits/${edit.id}:commit`)
    console.log('Listing images committed.')
  }
} catch (error) {
  await call(token, 'DELETE', `${API}/edits/${edit.id}`).catch(() => {})
  throw error
}
