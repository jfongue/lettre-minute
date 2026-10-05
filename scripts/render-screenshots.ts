/**
 * Renders the Play Store screenshots, 1080 × 1920, light and dark, in every
 * language: the home screen, the announcement, a run and its reveal, the
 * power picker, and a finished challenge from the debug board.
 *
 *   npx vite --port 5299 --strictPort   (with VITE_SUPABASE_URL= so no account or board shows)
 *   npx tsx scripts/render-screenshots.ts [http://localhost:5299] [fr en …]
 *
 * Drives Google Chrome headless over the DevTools protocol, with no
 * dependency: Node's own WebSocket speaks it well enough. The answers are
 * picked from the language's own dictionary, so each run finds real words.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildWordPack, type WordRow } from '../src/domain/words.ts'
import { categoryText, LOCALES, messagesFor, type Locale } from '../src/i18n/index.ts'
import { CATALOGUE } from '../src/domain/catalogue.ts'
import { compactWord } from '../src/domain/text.ts'
import { loadFrequencies } from './wordfreq.ts'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9333
const OUT = 'store/android/screenshots'

const args = process.argv.slice(2)
const origin = args.find((arg) => arg.startsWith('http')) ?? 'http://localhost:5299'
const langs = (args.filter((arg) => !arg.startsWith('http')) as Locale[]).length
  ? (args.filter((arg) => !arg.startsWith('http')) as Locale[])
  : LOCALES.map((entry) => entry.id)

/** A player a few evenings in: level 5, seven categories, three powers, records worth showing. */
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
  equipped: ['hush', 'divination'],
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

class Tab {
  private next = 1
  private pending = new Map<number, (value: unknown) => void>()
  constructor(private socket: WebSocket) {
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown; error?: { message: string } }
      if (message.id && this.pending.has(message.id)) {
        if (message.error) console.warn(`  cdp: ${message.error.message}`)
        this.pending.get(message.id)!(message.result)
        this.pending.delete(message.id)
      }
    })
  }
  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.next++
    this.socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve) => this.pending.set(id, resolve as (value: unknown) => void))
  }
  async eval<T>(expression: string): Promise<T> {
    const { result } = await this.send<{ result: { value: T } }>('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    return result.value
  }
  async shot(path: string) {
    const { data } = await this.send<{ data: string }>('Page.captureScreenshot', { format: 'png' })
    writeFileSync(path, Buffer.from(data, 'base64'))
    console.log(`· ${path}`)
  }
  async type(text: string) {
    await this.send('Input.insertText', { text })
  }
  async enter() {
    for (const type of ['keyDown', 'keyUp']) {
      await this.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    }
  }
  async click(selector: string) {
    await this.eval(`document.querySelector(${JSON.stringify(selector)})?.click()`)
  }
}

async function openTab(): Promise<Tab> {
  const target = (await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()) as {
    webSocketDebuggerUrl: string
  }
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve) => socket.addEventListener('open', resolve))
  const tab = new Tab(socket)
  await tab.send('Page.enable')
  await tab.send('Runtime.enable')
  await tab.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 3, mobile: true })
  return tab
}

const frequencies = new Map<Locale, Map<string, number>>()

/** Words the dictionary accepts but a store page should not put forward: a ninja is no Dutch trade. */
const AVOID = new Set(['ninja', 'kunst', 'feminisme', 'féminisme'])

/**
 * The words of the prompt's category on its letter that any player would
 * give: both said often in the language and described by many Wikipedias.
 * Either signal alone lies — an alias carries its country's sitelinks ("RF",
 * "States"), and a homonym its everyday frequency ("Group" as a sport).
 */
function answersFor(lang: Locale, label: string, letter: string, used: Set<string>): { display: string; key: string }[] {
  const spoken = frequencies.get(lang)!
  const said = (display: string) => spoken.get(display.normalize('NFC').toLowerCase()) ?? 0
  const t = messagesFor(lang)
  const category = CATALOGUE.find((entry) => categoryText(t, entry.id).label.toUpperCase() === label.toUpperCase())
  if (!category) return []
  const rows = JSON.parse(readFileSync(`src/data/words/${lang}/${category.id}.json`, 'utf8')) as WordRow[]
  const pack = buildWordPack(category.id, rows)
  return [...pack.entries.values()]
    .filter((entry) => entry.display.length >= 4 && entry.display.length <= 14 && !entry.display.includes(' '))
    .filter((entry) => /[a-zà-ÿ]/.test(entry.display))
    .filter((entry) => !AVOID.has(entry.display.toLowerCase()))
    .filter((entry) => compactWord(entry.display).toUpperCase().startsWith(letter) && !used.has(entry.key))
    .filter((entry) => pack.entries.get(compactWord(entry.key))?.display === entry.display)
    .map((entry) => ({ entry, score: Math.log1p(entry.sitelinks) * Math.log1p(said(entry.display) * 1e6) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ entry }) => entry)
}

/** Answers the current prompt with a real word; true when one was found. */
async function answer(tab: Tab, lang: Locale, used: Set<string>, submit: boolean): Promise<boolean> {
  const prompt = await tab.eval<{ label: string; letter: string } | null>(`(() => {
    const label = document.querySelector('.prompt-label')?.textContent
    const letter = document.querySelector('.prompt .mark-letter')?.textContent?.trim()
    return label && letter ? { label, letter: letter.slice(0, 1).toUpperCase() } : null
  })()`)
  if (!prompt) return false
  const [word] = answersFor(lang, prompt.label, prompt.letter, used)
  if (!word) return false
  used.add(word.key)
  await tab.eval(`document.querySelector('.answer-field input')?.focus()`)
  await tab.type(word.display.toLowerCase())
  await sleep(250)
  if (submit) {
    await tab.enter()
    await sleep(500)
  }
  return true
}

async function render(lang: Locale, dark: boolean) {
  if (!frequencies.has(lang)) frequencies.set(lang, await loadFrequencies(lang))
  const tab = await openTab()
  await tab.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] })
  const suffix = dark ? '-sombre' : ''
  const dir = `${OUT}/${lang}`
  mkdirSync(dir, { recursive: true })

  await tab.send('Page.navigate', { url: origin })
  await sleep(1500)
  await tab.eval(`(() => {
    localStorage.clear()
    localStorage.setItem('lettre-minute.locale.v1', ${JSON.stringify(lang)})
    localStorage.setItem('lettre-minute.profile.v1', ${JSON.stringify(JSON.stringify(PROFILE))})
    return true
  })()`)
  await tab.send('Page.reload')
  await sleep(2500)
  await tab.shot(`${dir}/1-accueil${suffix}.png`)

  await tab.click('.power-slot')
  await sleep(1200)
  await tab.shot(`${dir}/5-pouvoirs${suffix}.png`)
  await tab.click('.offer-pop-scrim')
  await sleep(800)

  // The run itself goes without powers: their badges and previews crowd a
  // screen that must read at a glance on the store.
  await tab.eval(`(() => {
    localStorage.setItem('lettre-minute.profile.v1', ${JSON.stringify(JSON.stringify({ ...PROFILE, equipped: [] }))})
    return true
  })()`)
  await tab.send('Page.reload')
  await sleep(2500)
  await tab.click('.btn--play')
  await sleep(2400)
  await tab.shot(`${dir}/2-annonce${suffix}.png`)

  // The rest of the announcement, then 3, 2, 1.
  await sleep(3200 + 3 * 800 + 600)
  const used = new Set<string>()
  // Two words validated, a third on its way: the field lights up and the streak shows.
  for (let found = 0, tries = 0; found < 2 && tries < 8; tries++) {
    if (await answer(tab, lang, used, true)) found++
    else await tab.click('.answer-actions .btn--ghost')
  }
  let typed = false
  for (let tries = 0; !typed && tries < 6; tries++) {
    typed = await answer(tab, lang, used, false)
    if (!typed) await tab.click('.answer-actions .btn--ghost')
  }
  await sleep(400)
  await tab.shot(`${dir}/3-partie${suffix}.png`)

  // A few more finds for the reveal, then the clock is run out by skipping.
  await tab.enter()
  await sleep(400)
  for (let found = 0, tries = 0; found < 4 && tries < 10; tries++) {
    if (await answer(tab, lang, used, true)) found++
    else await tab.click('.answer-actions .btn--ghost')
  }
  for (let skips = 0; skips < 14; skips++) {
    const playing = await tab.eval<boolean>(`!!document.querySelector('.answer-actions')`)
    if (!playing) break
    await tab.click('.answer-actions .btn--ghost')
    await sleep(150)
  }
  await sleep(6500)
  await tab.shot(`${dir}/4-bilan${suffix}.png`)

  // A challenge needs friends and a server: the debug board shows the real screen with made-up players.
  await tab.send('Page.navigate', { url: 'about:blank' })
  await sleep(300)
  await tab.send('Page.navigate', { url: `${origin}/#debug` })
  await sleep(3000)
  await tab.eval(`[...document.querySelectorAll('.debug-item')].find((item) => item.querySelector('strong')?.textContent === 'Défi clos : bilan')?.click()`)
  await sleep(2500)
  await tab.eval(`document.head.append(Object.assign(document.createElement('style'), { textContent: '.debug-bar { display: none !important }' }))`)
  await sleep(300)
  await tab.shot(`${dir}/6-defi${suffix}.png`)
  await tab.send('Page.close').catch(() => undefined)
}

const chrome = spawn(CHROME, [
  '--headless=new',
  // Chrome's own process sandbox cannot nest inside the harness file sandbox:
  // macOS refuses sandbox_init there, and the GPU process takes Chrome down
  // with it. Crashpad's default dump directory is outside the workspace too.
  '--no-sandbox',
  '--disable-gpu',
  '--disable-crash-reporter',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'lettre-minute-shots-'))}`,
  '--hide-scrollbars',
  '--no-first-run',
  '--mute-audio',
])
await sleep(2000)
try {
  for (const lang of langs) {
    for (const dark of [false, true]) await render(lang, dark)
  }
} finally {
  chrome.kill()
}
