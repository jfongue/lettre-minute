/**
 * The CrazyGames submission's pictures, and a smoke test of the build on the
 * way: the three covers from crazygames/assets/cover.html, then a real run of
 * dist-crazygames/ served by the harness (where the SDK starts in its `local`
 * mode), shot in the light theme at the portal's 16:9 and on a phone. Every
 * console error, page exception and SDK line is printed at the end.
 *
 *   npm run crazygames:build && npm run crazygames:harness   (another shell)
 *   node --experimental-strip-types scripts/crazygames-shots.ts [http://localhost:5747]
 *
 * Chrome headless over the DevTools protocol, as scripts/render-screenshots.ts;
 * its flags are the ones an agent's sandbox needs (CLAUDE.md, « Chrome sans tête »).
 */
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9344
const OUT = 'crazygames/assets'
const origin = process.argv.slice(2).find((arg) => arg.startsWith('http')) ?? 'http://localhost:5747'
const LANG = 'en'

/** A player a few evenings in: level 5, seven categories, three powers, a record worth beating. */
const PROFILE = {
  xp: 2350,
  runs: 14,
  bestScore: 412,
  wordsFound: 186,
  bestCombo: 9,
  usage: {},
  unlocked: ['fruits-legumes', 'metiers', 'sports', 'capitales'],
  offer: [],
  lastOffer: [],
  powers: ['joker', 'hush', 'divination'],
  equipped: [],
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const logs: string[] = []

class Tab {
  private next = 1
  private pending = new Map<number, (value: unknown) => void>()
  private socket: WebSocket
  constructor(socket: WebSocket) {
    this.socket = socket
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number
        result?: unknown
        error?: { message: string }
        method?: string
        params?: Record<string, any>
      }
      if (message.id && this.pending.has(message.id)) {
        if (message.error) console.warn(`  cdp: ${message.error.message}`)
        this.pending.get(message.id)!(message.result)
        this.pending.delete(message.id)
      } else if (message.method === 'Runtime.consoleAPICalled') {
        const text = (message.params!.args as { value?: unknown; description?: string }[])
          .map((arg) => (typeof arg.value === 'string' ? arg.value : (arg.description ?? JSON.stringify(arg.value))))
          .join(' ')
        logs.push(`console.${message.params!.type}: ${text}`)
      } else if (message.method === 'Runtime.exceptionThrown') {
        logs.push(`EXCEPTION: ${message.params!.exceptionDetails?.exception?.description ?? message.params!.exceptionDetails?.text}`)
      } else if (message.method === 'Log.entryAdded') {
        const entry = message.params!.entry as { level: string; text: string; url?: string }
        logs.push(`log.${entry.level}: ${entry.text}${entry.url ? ` (${entry.url})` : ''}`)
      }
    })
  }
  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.next++
    this.socket.send(JSON.stringify({ id, method, params }))
    // A page stuck on a dialog or a script must fail the step, not hang the script.
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${method} timed out`)), 30_000)
      this.pending.set(id, (value) => {
        clearTimeout(timer)
        resolve(value as T)
      })
    })
  }
  async eval<T>(expression: string): Promise<T> {
    const { result } = await this.send<{ result: { value: T } }>('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    return result.value
  }
  async size(width: number, height: number, scale: number, mobile: boolean) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile })
  }
  async shot(name: string) {
    const { data } = await this.send<{ data: string }>('Page.captureScreenshot', { format: 'png' })
    writeFileSync(`${OUT}/${name}`, Buffer.from(data, 'base64'))
    console.log(`· ${OUT}/${name}`)
  }
  async type(text: string) {
    await this.send('Input.insertText', { text })
  }
  async enter() {
    for (const type of ['keyDown', 'keyUp']) await this.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  }
  async click(selector: string) {
    await this.eval(`document.querySelector(${JSON.stringify(selector)})?.click()`)
  }
  async go(url: string, wait = 2500) {
    console.log(`→ ${url}`)
    await this.send('Page.navigate', { url })
    await sleep(wait)
  }
}

async function openTab(): Promise<Tab> {
  const target = (await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()) as { webSocketDebuggerUrl: string }
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve) => socket.addEventListener('open', resolve))
  const tab = new Tab(socket)
  await tab.send('Page.enable')
  await tab.send('Runtime.enable')
  await tab.send('Log.enable')
  await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
  return tab
}

type WordRow = readonly [display: string, sitelinks: number, frequency: number, canonical?: string, views?: number]

// The category names the English interface shows, read from its messages:
// node runs this file without a bundler, so the game's modules stay out of it.
const LABELS = new Map(
  [...readFileSync('src/i18n/en.ts', 'utf8').matchAll(/^ {4}'?([a-z-]+)'?: \['([^']+)',/gm)].map(([, id, label]) => [label!.toUpperCase(), id!]),
)
const plain = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()

/** Well-known base words of the prompt's category on its letter, from the dictionary the build ships. */
function answersFor(label: string, letter: string, used: Set<string>): string[] {
  const id = LABELS.get(label.toUpperCase())
  if (!id) return []
  const rows = JSON.parse(readFileSync(`src/data/words/${LANG}/${id}.json`, 'utf8')) as WordRow[]
  return rows
    .filter(([display, , , canonical]) => !canonical && /^[a-z]{4,12}$/i.test(plain(display)) && plain(display).startsWith(letter) && !used.has(display))
    // Said often and described by many Wikipedias: either alone picks « Blue » for an animal.
    .sort((a, b) => Math.log1p(b[1]) * Math.log1p(b[2]) - Math.log1p(a[1]) * Math.log1p(a[2]))
    .slice(0, 1)
    .map(([display]) => {
      used.add(display)
      return display
    })
}

async function answer(tab: Tab, used: Set<string>, submit: boolean): Promise<boolean> {
  const prompt = await tab.eval<{ label: string; letter: string } | null>(`(() => {
    const label = document.querySelector('.prompt-label')?.textContent
    const letter = document.querySelector('.prompt .mark-letter')?.textContent?.trim()
    return label && letter ? { label, letter: letter.slice(0, 1).toUpperCase() } : null
  })()`)
  if (!prompt) return false
  const [word] = answersFor(prompt.label, prompt.letter, used)
  if (!word) return false
  await tab.eval(`document.querySelector('.answer-field input')?.focus()`)
  await tab.type(word.toLowerCase())
  await sleep(250)
  if (submit) {
    await tab.enter()
    await sleep(500)
  }
  return true
}

async function covers(tab: Tab) {
  const page = pathToFileURL(resolve(`${OUT}/cover.html`)).href
  for (const [format, width, height] of [
    ['landscape', 1920, 1080],
    ['portrait', 800, 1200],
    ['square', 800, 800],
  ] as const) {
    await tab.size(width, height, 1, false)
    await tab.go(`${page}?format=${format}`, 1200)
    await tab.shot(`cover-${format}-${width}x${height}.png`)
  }
}

async function play(tab: Tab, prefix: string, used: Set<string>) {
  await tab.click('.btn--play')
  await sleep(2400)
  await tab.shot(`${prefix}2-announce.png`)
  await sleep(3200 + 3 * 800 + 600)
  for (let found = 0, tries = 0; found < 3 && tries < 10; tries++) {
    if (await answer(tab, used, true)) found++
    else await tab.click('.answer-actions .btn--ghost')
  }
  let typed = false
  for (let tries = 0; !typed && tries < 6; tries++) {
    typed = await answer(tab, used, false)
    if (!typed) await tab.click('.answer-actions .btn--ghost')
  }
  await sleep(400)
  await tab.shot(`${prefix}3-run.png`)
  await tab.enter()
  await sleep(400)
  for (let found = 0, tries = 0; found < 4 && tries < 10; tries++) {
    if (await answer(tab, used, true)) found++
    else await tab.click('.answer-actions .btn--ghost')
  }
  for (let skips = 0; skips < 20; skips++) {
    if (!(await tab.eval<boolean>(`!!document.querySelector('.answer-actions')`))) break
    await tab.click('.answer-actions .btn--ghost')
    await sleep(150)
  }
  await sleep(6500)
  await tab.shot(`${prefix}4-summary.png`)
}

mkdirSync(OUT, { recursive: true })
const chrome = spawn(CHROME, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-crash-reporter',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${resolve('.cache/crazygames-chrome')}`,
  '--hide-scrollbars',
  '--no-first-run',
  '--mute-audio',
  '--autoplay-policy=no-user-gesture-required',
])
await sleep(2000)
try {
  const tab = await openTab()
  await covers(tab)

  // A newcomer, at the portal's 16:9: the game must open in English, on the poster, no form.
  await tab.size(1280, 720, 1.5, false)
  await tab.go(`${origin}/`, 1500)
  await tab.eval(`localStorage.clear(), true`)
  await tab.go(`${origin}/`, 3500)
  const first = await tab.eval<Record<string, unknown>>(`({
    environment: window.CrazyGames?.SDK?.environment ?? null,
    lang: document.documentElement.lang,
    theme: document.documentElement.dataset.theme,
    title: document.title,
    picker: !!document.querySelector('.language-picker'),
    play: !!document.querySelector('.btn--play'),
    scrollable: document.scrollingElement.scrollHeight > innerHeight,
    links: [...document.querySelectorAll('a[href]')].map((a) => a.href),
  })`)
  console.log('newcomer:', JSON.stringify(first))
  await tab.shot('shot-0-first-launch.png')

  // A player a few evenings in, past the lesson.
  await tab.eval(`(() => {
    localStorage.setItem('lettre-minute.tutorial.v1', 'true')
    localStorage.setItem('lettre-minute.profile.v1', ${JSON.stringify(JSON.stringify(PROFILE))})
    return true
  })()`)
  await tab.go(`${origin}/`, 3500)
  await tab.shot('shot-1-home.png')
  const used = new Set<string>()
  await play(tab, 'shot-', used)

  // Past the reveal, « Play again »: the break between runs asks the SDK for a
  // midgame ad, which the local SDK shows as a line of text (see the console).
  await tab.eval(`document.querySelector('.reveal-next')?.click(), true`)
  await sleep(1500)
  await tab.eval(`[...document.querySelectorAll('button.btn--play')].find((b) => /again/i.test(b.textContent))?.click(), true`)
  await sleep(1500)
  await sleep(8000)

  // A phone, portrait.
  await tab.size(390, 844, 3, true)
  await tab.go(`${origin}/`, 3500)
  await tab.shot('shot-mobile-1-home.png')
  await play(tab, 'shot-mobile-', used)
  await tab.send('Page.close').catch(() => undefined)
} finally {
  chrome.kill()
}

console.log('\n— console —')
for (const line of logs) console.log(line)
