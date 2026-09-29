/**
 * Photographs, in every language, what the invitation mail and the chat
 * preview show of the game: the debug board's « Images du mail
 * d’invitation » — the home poster and its title.
 *
 *   npx vite --port 5299 --strictPort   (with VITE_SUPABASE_URL= so nothing is asked of a server)
 *   npm run render:invite [-- http://localhost:5299]
 *
 * Writes public/invite/header-<lang>.png, twice the
 * size they are shown at, for the next `npm run web:publish`.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9336
const OUT = 'public/invite'
const LOCALES = ['fr', 'en', 'de', 'es', 'it', 'nl', 'pt']
const origin = process.argv.slice(2).find((arg) => arg.startsWith('http')) ?? 'http://localhost:5299'
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'lettre-minute-invite-art-'))}`,
  '--hide-scrollbars',
  '--no-first-run',
  'about:blank',
])

try {
  let target: { type: string; webSocketDebuggerUrl: string } | undefined
  for (let attempt = 0; attempt < 20 && !target; attempt++) {
    await sleep(500)
    try {
      const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()) as (typeof target & {})[]
      target = pages.find((page) => page.type === 'page')
    } catch {
      // Chrome is still starting.
    }
  }
  if (!target) throw new Error('Chrome ne répond pas.')
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve) => socket.addEventListener('open', resolve))
  let next = 1
  const pending = new Map<number, (value: unknown) => void>()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown }
    if (message.id && pending.has(message.id)) pending.get(message.id)!(message.result)
  })
  const send = <T = unknown>(method: string, params: Record<string, unknown> = {}) =>
    new Promise<T>((resolve) => {
      const id = next++
      pending.set(id, resolve as (value: unknown) => void)
      socket.send(JSON.stringify({ id, method, params }))
    })
  const evaluate = async <T>(expression: string) =>
    (await send<{ result: { value: T } }>('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value

  // Light theme, the width of a mail, twice the pixels.
  await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 900, deviceScaleFactor: 2, mobile: false })
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
  mkdirSync(OUT, { recursive: true })

  for (const locale of LOCALES) {
    await send('Page.navigate', { url: `${origin}/` })
    await sleep(1500)
    await evaluate(`localStorage.setItem('lettre-minute.locale.v1', '${locale}'); localStorage.setItem('lettre-minute.theme.v1', 'light'); true`)
    // A new query, so the page loads again and reads #debug at start.
    await send('Page.navigate', { url: `${origin}/?art=${locale}#debug` })
    await sleep(2500)
    await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.startsWith('Images du mail'))?.click(); true`)
    await sleep(1500)
    // Still pictures: every tile at rest, every letter landed, and no grid
    // paper, which would stop at the edge of the picture in a mail.
    await evaluate(`(() => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;background-image:none!important}'; document.head.append(s); return true })()`)
    await sleep(500)
    for (const art of ['header']) {
      const box = await evaluate<{ x: number; y: number; width: number; height: number }>(
        `(() => { const r = document.querySelector('[data-art=${art}]').getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height } })()`,
      )
      const shot = await send<{ data: string }>('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: { ...box, scale: 1 },
      })
      writeFileSync(join(OUT, `${art}-${locale}.png`), Buffer.from(shot.data, 'base64'))
    }
    console.log(`${locale} : ${OUT}/header-${locale}.png`)
  }
  socket.close()
} finally {
  chrome.kill()
}
