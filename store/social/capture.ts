// Films one run per language for the social videos, as crazygames/video/capture.mjs
// does for the portal: headless Chrome plays an offline web build (no Supabase,
// see README.md) at a phone's proportions, light theme, in the language asked.
// The words are not planned: each prompt is read off the screen and answered
// with the best-known word its dictionary holds for that letter (`known`), typed at a human pace with one typo put right; a
// prompt with no such word is skipped, as a player would. Out comes
// .cache/social-kit/work/<lang>/gameplay.mp4 and marks.json, the moments
// render-videos.ts cuts on.
//
//   node store/social/capture.ts <lang> [origin]
//
// Chrome's flags are the ones an agent's sandbox needs (CLAUDE.md, « Chrome sans tête »).
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeWord } from '../../src/domain/text.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const lang = process.argv[2] ?? 'fr'
const origin = process.argv[3] ?? 'http://localhost:5761'
const OUT = join(ROOT, '.cache/social-kit/work', lang)
const FRAMES = join(OUT, 'frames')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9391
const FPS = 30
const WORDS = 4

const PROFILE = {
  xp: 2350, runs: 14, bestScore: 412, wordsFound: 186, bestCombo: 9, usage: {},
  unlocked: ['fruits-legumes', 'metiers', 'sports', 'capitales'], offer: [], lastOffer: [],
  powers: ['joker', 'hush', 'divination'], equipped: [],
}
// One seed per language, so that a render made twice films the same run.
const SEED = 5_000_000 + ['fr', 'en', 'de', 'es', 'it', 'nl', 'pt'].indexOf(lang) * 7919

/** The category's id from the name the run screen shows, read from the i18n source. */
function categoryIds(): Map<string, string> {
  const ids = new Map<string, string>()
  if (lang === 'fr') {
    const source = readFileSync(join(ROOT, 'src/domain/catalogue.ts'), 'utf8')
    for (const [, id, label] of source.matchAll(/\{ id: '([a-z-]+)', label: '([^']+)'/g)) ids.set(label.toLowerCase(), id)
  } else {
    const source = readFileSync(join(ROOT, `src/i18n/${lang}.ts`), 'utf8')
    const block = source.slice(source.indexOf('\n  categories: {'))
    for (const [, id, single, double] of block.matchAll(/^ {4}'?([a-z-]+)'?: \[(?:'([^']+)'|"([^"]+)")/gm)) {
      ids.set((single ?? double).toLowerCase(), id)
    }
  }
  return ids
}

type Row = readonly [string, number, number, string?, number?]
/** Categories of names, where a word's frequency is a homograph's (« Mars » the month). */
const NAMES = new Set(['pays', 'capitales', 'marques', 'prenoms'])
/**
 * The words chosen by hand where `known` picks a valid but odd one (« visitor »
 * as a sport), by letter and category, for the prompts each language's SEED
 * deals; `null` skips the prompt. A dictionary or a draw that moves deals other
 * prompts, which `known` answers alone: watch the log and add them here.
 */
const CHOSEN: Record<string, Record<string, string | null>> = {
  fr: { 'D:pays': 'Danemark', 'G:capitales': 'Genève' },
  en: { 'P:metiers': 'pilot', 'F:fruits-legumes': 'fig', 'V:sports': 'volleyball' },
  de: { 'G:couleurs': 'Grün', 'H:metiers': 'Hebamme', 'S:capitales': 'Stuttgart', 'P:couleurs': 'Pink' },
  es: { 'N:metiers': 'notario', 'O:capitales': 'Oslo' },
  it: { 'P:couleurs': 'porpora', 'P:capitales': 'Parigi', 'U:animaux': null, 'F:fruits-legumes': 'fragola' },
  nl: { 'M:pays': 'Marokko' },
  pt: { 'M:metiers': 'médico', 'L:couleurs': 'laranja', 'J:couleurs': null },
}
const used = new Set<string>()
/**
 * How sure everybody knows the word: for a common noun, both spoken often and
 * looked up (the lesser of the two readings of rawFame, src/domain/words.ts),
 * so that a homograph frequent in another sense stays out; for a name, how
 * much its article is read.
 */
function known([, sitelinks, frequency, , views]: Row, names: boolean): number {
  const read = views === undefined ? Math.log10(1 + sitelinks) / 2.5 : Math.log10(1 + views) / 3.3
  return names ? read : Math.min(read, Math.log10(1 + frequency) / 2.2)
}
/** The best-known headword of the category for the letter, `rank` places down the list. */
function wordFor(categoryId: string, letter: string, rank: number): string | null {
  const chosen = CHOSEN[lang]?.[`${letter.toUpperCase()}:${categoryId}`]
  if (chosen !== undefined) return chosen
  let rows: Row[]
  try {
    rows = JSON.parse(readFileSync(join(ROOT, `src/data/words/${lang}/${categoryId}.json`), 'utf8'))
  } catch {
    return null
  }
  const names = NAMES.has(categoryId)
  const candidates = rows
    .filter(([display, , , canonical]) => !canonical && /^\p{L}{4,9}$/u.test(display))
    .filter(([display]) => normalizeWord(display).startsWith(letter.toLowerCase()) && !used.has(display))
    .map((row) => ({ word: row[0], known: known(row, names) }))
    .filter((candidate) => candidate.known >= 0.25)
    .sort((a, b) => b.known - a.known)
  const pick = candidates[Math.min(rank, candidates.length - 1)]?.word ?? null
  if (pick) used.add(pick)
  return pick
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))
let jitterState = 7
const jitter = (low: number, high: number) => {
  jitterState = (jitterState * 1103515245 + 12345) % 2147483648
  return low + (jitterState / 2147483648) * (high - low)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(FRAMES, { recursive: true })
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(ROOT, '.cache/social-chrome')}`,
  '--hide-scrollbars', '--no-first-run', '--mute-audio', `--lang=${lang}`,
])
await sleep(2000)

const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((done) => socket.addEventListener('open', done))
let next = 1
const pending = new Map<number, (value: any) => void>()
const frames: { file: string; at: number }[] = []
let recording = false
socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data))
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)!(message.result)
    pending.delete(message.id)
  } else if (message.method === 'Page.screencastFrame') {
    const { data, metadata, sessionId } = message.params
    send('Page.screencastFrameAck', { sessionId })
    if (!recording) return
    const file = join(FRAMES, `${String(frames.length).padStart(5, '0')}.jpg`)
    writeFileSync(file, Buffer.from(data, 'base64'))
    frames.push({ file, at: metadata.timestamp })
  }
})
function send(method: string, params: object = {}): Promise<any> {
  const id = next++
  socket.send(JSON.stringify({ id, method, params }))
  return new Promise((done) => pending.set(id, done))
}
const evaluate = async (expression: string) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))?.result?.value
const key = async (name: string, code: string, keyCode: number, commands?: string[]) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code, windowsVirtualKeyCode: keyCode, ...(commands ? { commands } : {}) })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code, windowsVirtualKeyCode: keyCode })
}
const marks: Record<string, number> = {}
const mark = (name: string) => {
  marks[name] = Date.now() / 1000
  console.log(`· ${lang} ${name}`)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')
// Nothing leaves the machine: no server, and no moved-server page to ask (src/lib/backend.ts).
await send('Network.setBlockedURLs', { urls: ['*supabase*', '*github.io*', '*googletagmanager*', '*google-analytics*'] })
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
// A touch screen, as on a phone: no key caps on the buttons, which would widen
// the run's button row past the screen in German.
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await send('Emulation.setDeviceMetricsOverride', { width: 432, height: 768, deviceScaleFactor: 2.5, mobile: true })
await send('Page.navigate', { url: `${origin}/` })
await sleep(1500)
await evaluate(`localStorage.clear();
  localStorage.setItem('lettre-minute.tutorial.v1', 'true');
  localStorage.setItem('lettre-minute.locale.v1', ${JSON.stringify(lang)});
  localStorage.setItem('lettre-minute.profile.v1', ${JSON.stringify(JSON.stringify(PROFILE))}); true`)
await send('Page.navigate', { url: `${origin}/` })
await sleep(4000)
if (!(await evaluate(`!!document.querySelector('.btn--play')`))) throw new Error(`${lang}: the home has no Play button`)

await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 })
await sleep(300)
recording = true
mark('home')
await sleep(1200)
// The run's seed is Date.now() when Play is pressed: the clock reads SEED for that click only.
await evaluate(`(() => {
  const real = Date.now
  Date.now = () => ${SEED}
  document.querySelector('.btn--play').click()
  setTimeout(() => { Date.now = real }, 0)
  return true
})()`)
mark('play')
for (let tries = 0; tries < 60 && !(await evaluate(`!!document.querySelector('.answer-field input')`)); tries++) await sleep(150)
mark('run')
await sleep(600)

const ids = categoryIds()
let played = 0
for (let prompt = 0; played < WORDS && prompt < 10; prompt++) {
  const letter = await evaluate(`document.querySelector('.prompt .mark-letter')?.textContent?.trim().slice(0, 1)`)
  const label = await evaluate(`document.querySelector('.prompt-label')?.textContent?.trim()`)
  const id = ids.get(String(label).toLowerCase())
  // The last word a little less obvious: the cut ends on it.
  const word = id && letter ? wordFor(id, letter, played === WORDS - 1 ? 1 : 0) : null
  console.log(`  ${letter} ${label} (${id}) → ${word ?? 'skip'}`)
  await evaluate(`document.querySelector('.answer-field input')?.focus(), true`)
  if (!word) {
    await sleep(900)
    await key('Tab', 'Tab', 9)
    await sleep(700)
    continue
  }
  for (const [at, char] of [...word].entries()) {
    if (at === 2 && played % 2 === 1) await sleep(jitter(250, 400))
    await send('Input.insertText', { text: char })
    await sleep(jitter(150, 300))
    // One typo put right, on the third word.
    if (played === 2 && at === 2) {
      await send('Input.insertText', { text: 'x' })
      await sleep(jitter(200, 320))
      await key('Backspace', 'Backspace', 8, ['deleteBackward'])
      await sleep(jitter(180, 260))
    }
  }
  await sleep(jitter(320, 450))
  await key('Enter', 'Enter', 13)
  played += 1
  mark(`word${played}`)
  await sleep(jitter(1050, 1300))
}
if (played < WORDS) throw new Error(`${lang}: only ${played} words in ten prompts`)
mark('words')

for (let skips = 0; skips < 40 && (await evaluate(`!!document.querySelector('.answer-field input')`)); skips++) {
  await key('Tab', 'Tab', 9)
  await sleep(120)
}
mark('timeUp')
await sleep(7000)
mark('revealed')
await evaluate(`document.querySelector('.reveal-next')?.click(), true`)
await sleep(3500)
mark('summary')
recording = false
await send('Page.stopScreencast')
chrome.kill()

// A screencast sends a frame only when the page changes: each one lasts until the next.
const start = frames[0].at
const list = frames.map((frame, index) => {
  const until = frames[index + 1]?.at ?? frame.at + 0.5
  return `file '${frame.file}'\nduration ${(until - frame.at).toFixed(4)}`
})
writeFileSync(join(OUT, 'frames.txt'), `${list.join('\n')}\nfile '${frames.at(-1)!.file}'\n`)
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(OUT, 'frames.txt'),
  '-vf', `fps=${FPS},scale=1080:1920:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-an',
  join(OUT, 'gameplay.mp4'),
])
const timeline = Object.fromEntries(Object.entries(marks).map(([name, at]) => [name, Math.max(0, +(at - start).toFixed(2))]))
writeFileSync(join(OUT, 'marks.json'), JSON.stringify({ ...timeline, length: +(frames.at(-1)!.at - start).toFixed(2) }, null, 2))
rmSync(FRAMES, { recursive: true, force: true })
rmSync(join(OUT, 'frames.txt'))
console.log(`${lang}: ${JSON.stringify(timeline)}`)
