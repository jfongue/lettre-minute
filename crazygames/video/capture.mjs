// Records a real run of the CrazyGames build for the preview videos: headless
// Chrome plays dist-crazygames/ (served by `npm run crazygames:harness`) in
// English and the light theme, at a phone's proportions (1080 × 1920). The run
// is dealt from a chosen seed whose first prompts all take a word everybody
// knows — Football, Italy, Penguin, then Kiwi, rare yet familiar — typed at a
// human pace (uneven gaps, a hesitation, one typo put right, a beat before
// Enter, time to watch the score climb); then Tab skips to the end and the
// summary opens. Chrome's screencast frames become capture/gameplay.mp4 at a
// steady 30 fps; capture/marks.json says when each moment happens in it, for
// render.mjs to cut on.
//
//   node crazygames/video/capture.mjs [http://localhost:5747]
//
// Chrome's flags are the ones an agent's sandbox needs (CLAUDE.md, « Chrome sans tête »).
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
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

/**
 * The seed and what it deals for PROFILE in English (Sports F, Countries I,
 * Animals P, Fruit and vegetables K, then Jobs N), found by replaying the
 * domain's draw over a range of seeds against a list of obvious answers. The
 * run is checked prompt by prompt: a dictionary or a draw that changed stops
 * the capture rather than filming a skip.
 */
const SEED = 1002733
const PLAN = [
  { letter: 'F', word: 'Football' },
  { letter: 'I', word: 'Italy' },
  { letter: 'P', word: 'Penguin', typo: { after: 3, wrong: 'h' } },
  { letter: 'K', word: 'Kiwi' },
]

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
// A seeded jitter: the same capture every time, never the same gap twice in a row.
let jitterState = 7
const jitter = (low, high) => {
  jitterState = (jitterState * 1103515245 + 12345) % 2147483648
  return low + (jitterState / 2147483648) * (high - low)
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
const key = async (keyName, code, keyCode, commands) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code, windowsVirtualKeyCode: keyCode, ...(commands ? { commands } : {}) })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: keyCode })
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
// The run's seed is Date.now() when Play is pressed: the clock reads SEED for
// that click and the microtasks it starts, and is real again right after.
await evaluate(`(() => {
  const real = Date.now
  Date.now = () => ${SEED}
  document.querySelector('.btn--play').click()
  setTimeout(() => { Date.now = real }, 0)
  return true
})()`)
mark('play')
// The announcement, then 3, 2, 1.
for (let tries = 0; tries < 40 && !(await evaluate(`!!document.querySelector('.answer-field input')`)); tries++) await sleep(150)
mark('run')
await sleep(600)

const typeLetter = async (letter) => {
  await send('Input.insertText', { text: letter })
  await sleep(jitter(150, 300))
}
for (const [index, step] of PLAN.entries()) {
  const letter = await evaluate(`document.querySelector('.prompt .mark-letter')?.textContent?.trim().slice(0, 1).toUpperCase()`)
  if (letter !== step.letter) {
    chrome.kill()
    throw new Error(`prompt ${index + 1} is ${letter}, not ${step.letter}: the draw changed, search a new SEED`)
  }
  await evaluate(`document.querySelector('.answer-field input')?.focus(), true`)
  for (const [at, char] of [...step.word.toLowerCase()].entries()) {
    // Now and then a hesitation in the middle of a word.
    if (at === 2 && index % 2 === 1) await sleep(jitter(250, 400))
    await typeLetter(char)
    if (step.typo && at === step.typo.after - 1) {
      await typeLetter(step.typo.wrong)
      await sleep(jitter(200, 320))
      await key('Backspace', 'Backspace', 8, ['deleteBackward'])
      await sleep(jitter(180, 260))
    }
  }
  await sleep(jitter(320, 450))
  await key('Enter', 'Enter', 13)
  mark(`word${index + 1}`)
  // Time to read the cheer and watch the score climb.
  await sleep(jitter(1050, 1300))
}
mark('words')

// The rest of the minute goes by in skips.
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
