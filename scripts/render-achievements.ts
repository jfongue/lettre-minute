/**
 * Renders the Play Games achievement icons, 512 × 512, from the debug board's
 * « Icônes des succès Play Games »: the tile each goal unlocks, still.
 *
 *   npx vite --port 5299 --strictPort   (with VITE_SUPABASE_URL= so nothing is asked of a server)
 *   npm run render:achievements [-- http://localhost:5299]
 *
 * Writes store/android/play-games/<id>.png, to upload in the Play Console.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9335
const OUT = 'store/android/play-games'
const origin = process.argv.slice(2).find((arg) => arg.startsWith('http')) ?? 'http://localhost:5299'
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const chrome = spawn(CHROME, [
  '--headless=new',
  // Chrome's own process sandbox cannot nest inside the harness file sandbox:
  // macOS refuses sandbox_init there, and the GPU process takes Chrome down
  // with it. Crashpad's default dump directory is outside the workspace too.
  '--no-sandbox',
  '--disable-gpu',
  '--disable-crash-reporter',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'lettre-minute-achievements-'))}`,
  '--hide-scrollbars',
  '--no-first-run',
  '--window-size=700,1000',
  'about:blank',
])

try {
  let target: { webSocketDebuggerUrl: string } | undefined
  for (let attempt = 0; attempt < 20 && !target; attempt++) {
    await sleep(500)
    try {
      const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()) as { type: string; webSocketDebuggerUrl: string }[]
      target = pages.find((page) => page.type === 'page')
    } catch {
      // Chrome is still starting.
    }
  }
  if (!target) throw new Error('Chrome ne répond pas sur le port de débogage.')
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve) => socket.addEventListener('open', resolve))
  let next = 1
  const pending = new Map<number, (value: unknown) => void>()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown }
    if (message.id && pending.has(message.id)) pending.get(message.id)!(message.result)
  })
  const send = <T,>(method: string, params: Record<string, unknown> = {}) =>
    new Promise<T>((resolve) => {
      const id = next++
      pending.set(id, resolve as (value: unknown) => void)
      socket.send(JSON.stringify({ id, method, params }))
    })
  const evaluate = async <T,>(expression: string) =>
    (await send<{ result: { value: T } }>('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value

  await send('Page.navigate', { url: `${origin}/#debug` })
  await sleep(3000)
  await evaluate(`[...document.querySelectorAll('.debug-item')].find((item) => item.querySelector('strong')?.textContent === 'Icônes des succès Play Games')?.click()`)
  await sleep(2000)
  await evaluate(`document.head.append(Object.assign(document.createElement('style'), { textContent: '.debug-bar { display: none !important }' }))`)
  const boxes = await evaluate<{ id: string; x: number; y: number }[]>(`[...document.querySelectorAll('[data-achievement]')].map((element) => {
    const box = element.getBoundingClientRect()
    return { id: element.dataset.achievement, x: box.x + scrollX, y: box.y + scrollY }
  })`)
  if (boxes.length === 0) throw new Error('Planche des icônes introuvable.')
  mkdirSync(OUT, { recursive: true })
  for (const box of boxes) {
    const { data } = await send<{ data: string }>('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: box.x, y: box.y, width: 512, height: 512, scale: 1 },
    })
    writeFileSync(`${OUT}/${box.id}.png`, Buffer.from(data, 'base64'))
    console.log(`· ${OUT}/${box.id}.png`)
  }
  socket.close()
} finally {
  chrome.kill()
}
