// Records a real run of the CrazyGames build for the preview videos: headless
// Chrome plays dist-crazygames/ (served by `npm run crazygames:harness`) in
// English and the light theme, at a phone's proportions (1080 × 1920), types
// well-known words letter by letter, keeps a streak going, skips to the end
// with Tab and opens the summary. Chrome's screencast frames become
// capture/gameplay.mp4 at a steady 30 fps; capture/marks.json says when each
// moment happens in it, for the montage (index-*.html) to cut on.
//
//   node crazygames/video/capture.mjs [http://localhost:5747]
//
// Chrome's flags are the ones an agent's sandbox needs (CLAUDE.md, « Chrome sans tête »).
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const OUT = join(HERE, 'capture')
const FRAMES = join(OUT, 'frames')
const origin = process.argv[2] ?? 'http://localhost:5747'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9377
const FPS = 30

const PROFILE = {
  xp: 2350, runs: 14, bestScore: 412, wordsFound: 186, bestCombo: 9, usage: {},
  unlocked: ['fruits-legumes', 'metiers', 'sports', 'capitales'], offer: [], lastOffer: [],
  powers: ['joker', 'hush', 'divination'], equipped: [],
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

// The category names the English interface shows, read from its messages.
const LABELS = new Map(
  [...readFileSync(join(ROOT, 'src/i18n/en.ts'), 'utf8').matchAll(/^ {4}'?([a-z-]+)'?: \['([^']+)',/gm)].map(([, id, label]) => [label.toUpperCase(), id]),
)
const plain = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
const used = new Set()

/** A well-known base word of the prompt's category on its letter: said often and described by many Wikipedias. */
function answerFor(label, letter) {
  const id = LABELS.get(label.toUpperCase())
  if (!id) return null
  const rows = JSON.parse(readFileSync(join(ROOT, `src/data/words/en/${id}.json`), 'utf8'))
  const [best] = rows
    .filter(([display, , , canonical]) => !canonical && /^[a-z]{4,10}$/i.test(plain(display)) && plain(display).startsWith(letter) && !used.has(display))
    .sort((a, b) => Math.log1p(b[1]) * Math.log1p(b[2]) - Math.log1p(a[1]) * Math.log1p(a[2]))
  if (best) used.add(best[0])
  return best?.[0] ?? null
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(FRAMES, { recursive: true })
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(ROOT, '.cache/crazygames-video-chrome')}`,
  '--hide-scrollbars', '--no-first-run', '--mute-audio',
])
await sleep(2000)

const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((done) => socket.addEventListener('open', done))
let next = 1
const pending = new Map()
const frames = []
let recording = false
socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data))
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message.result)
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
function send(method, params = {}) {
  const id = next++
  socket.send(JSON.stringify({ id, method, params }))
  return new Promise((done) => pending.set(id, done))
}
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))?.result?.value
const key = async (keyName, code, keyCode) => {
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: keyName, code, windowsVirtualKeyCode: keyCode })
}
const marks = {}
const mark = (name) => {
  marks[name] = Date.now() / 1000
  console.log(`· ${name}`)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
await send('Emulation.setDeviceMetricsOverride', { width: 432, height: 768, deviceScaleFactor: 2.5, mobile: false })
await send('Page.navigate', { url: `${origin}/` })
await sleep(1500)
await evaluate(`localStorage.clear(); localStorage.setItem('lettre-minute.tutorial.v1', 'true'); localStorage.setItem('lettre-minute.profile.v1', ${JSON.stringify(JSON.stringify(PROFILE))}); true`)
await send('Page.navigate', { url: `${origin}/` })
await sleep(3500)

await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 })
await sleep(300)
recording = true
mark('home')
await sleep(1200)
await evaluate(`document.querySelector('.btn--play').click()`)
mark('play')
// The announcement, then 3, 2, 1.
for (let tries = 0; tries < 40 && !(await evaluate(`!!document.querySelector('.answer-field input')`)); tries++) await sleep(150)
mark('run')

// Eight words at a human pace: typed letter by letter, a breath on each cheer.
let found = 0
for (let tries = 0; found < 8 && tries < 16; tries++) {
  const prompt = await evaluate(`(() => {
    const label = document.querySelector('.prompt-label')?.textContent
    const letter = document.querySelector('.prompt .mark-letter')?.textContent?.trim()
    return label && letter ? { label, letter: letter.slice(0, 1).toUpperCase() } : null
  })()`)
  const word = prompt && answerFor(prompt.label, prompt.letter)
  await evaluate(`document.querySelector('.answer-field input')?.focus(), true`)
  if (!word) {
    await key('Tab', 'Tab', 9)
    await sleep(500)
    continue
  }
  for (const letter of word.toLowerCase()) {
    await send('Input.insertText', { text: letter })
    await sleep(70)
  }
  await sleep(250)
  await key('Enter', 'Enter', 13)
  found++
  await sleep(650)
}
mark('words')

// The rest of the minute goes by in skips.
for (let skips = 0; skips < 30 && (await evaluate(`!!document.querySelector('.answer-field input')`)); skips++) {
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
writeFileSync(join(OUT, 'frames.txt'), `${list.join('\n')}\nfile '${frames.at(-1).file}'\n`)
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(OUT, 'frames.txt'),
  '-vf', `fps=${FPS},scale=1080:1920:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-an',
  join(OUT, 'gameplay.mp4'),
])
// Marks in the video's own seconds; the wall clock and Chrome's frame stamps share an epoch.
const timeline = Object.fromEntries(Object.entries(marks).map(([name, at]) => [name, Math.max(0, +(at - start).toFixed(2))]))
writeFileSync(join(OUT, 'marks.json'), JSON.stringify({ ...timeline, frames: frames.length, length: +(frames.at(-1).at - start).toFixed(2) }, null, 2))
rmSync(FRAMES, { recursive: true, force: true })
console.log(JSON.stringify(timeline))
