// Records a real run of the CrazyGames build for the preview videos: headless
// Chrome plays dist-crazygames/ (served by `npm run crazygames:harness`) in
// English and the light theme, at a phone's proportions (1080 × 1920). The run
// is dealt from a chosen seed and answered from a list of words everybody
// knows (ANSWERS), skipping what the list lacks, typed at a human pace (uneven gaps, a hesitation, one typo put right, a beat before
// Enter, time to watch the score climb); then Tab skips to the end and the
// summary opens. Chrome's screencast frames become capture/gameplay.mp4 at a
// steady 30 fps; capture/marks.json says when each moment happens in it, for
// render.mjs to cut on.
//
//   node crazygames/video/capture.mjs [http://localhost:5747] [--landscape]
//
// `--landscape` films the same run at 16:9 (1920 × 1080) into
// capture-landscape/gameplay.mp4: Y8's gameplay video, one continuous clip
// with no cut (y8/README.md).
//
// Chrome's flags are the ones an agent's sandbox needs (CLAUDE.md, « Chrome sans tête »).
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const LANDSCAPE = process.argv.includes('--landscape')
const OUT = join(HERE, LANDSCAPE ? 'capture-landscape' : 'capture')
const FRAMES = join(OUT, 'frames')
const origin = process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? 'http://localhost:5747'
const VIEW = LANDSCAPE ? { width: 1280, height: 720, deviceScaleFactor: 1.5, out: [1920, 1080] } : { width: 432, height: 768, deviceScaleFactor: 2.5, out: [1080, 1920] }
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9377
const FPS = 30

const PROFILE = {
  xp: 2350, runs: 14, bestScore: 412, wordsFound: 186, bestCombo: 9, usage: {},
  unlocked: ['fruits-legumes', 'metiers', 'sports', 'capitales'], offer: [], lastOffer: [],
  powers: ['joker', 'hush', 'divination'], equipped: [],
}

/**
 * The seed only starts the draw: a solo run also listens to the crowd's
 * counters on the server (`Judge.pull`), so what it deals changes from one
 * capture to the next. Each prompt is answered from this list of obvious
 * words, by its English category and letter, or skipped; the first four
 * answers make the clip, the third one with a typo put right.
 */
const SEED = 1002733
const WORDS = 4
const ANSWERS = {
  Countries: { A: 'Argentina', B: 'Brazil', C: 'Canada', D: 'Denmark', E: 'Egypt', F: 'France', G: 'Germany', H: 'Hungary', I: 'Italy', J: 'Japan', K: 'Kenya', L: 'Lebanon', M: 'Mexico', N: 'Norway', O: 'Oman', P: 'Peru', R: 'Russia', S: 'Spain', T: 'Turkey', U: 'Uganda', V: 'Vietnam', Z: 'Zambia' },
  Mammals: { B: 'Bear', C: 'Camel', D: 'Dolphin', E: 'Elephant', F: 'Fox', G: 'Giraffe', H: 'Horse', K: 'Kangaroo', L: 'Lion', M: 'Monkey', O: 'Otter', P: 'Panda', R: 'Rabbit', S: 'Squirrel', T: 'Tiger', W: 'Wolf', Z: 'Zebra' },
  Animals: { B: 'Bear', C: 'Camel', D: 'Dolphin', E: 'Elephant', F: 'Fox', G: 'Giraffe', H: 'Horse', K: 'Kangaroo', L: 'Lion', M: 'Monkey', O: 'Otter', P: 'Penguin', R: 'Rabbit', S: 'Squirrel', T: 'Tiger', W: 'Wolf', Z: 'Zebra' },
  Sports: { B: 'Basketball', C: 'Cycling', F: 'Football', G: 'Golf', H: 'Hockey', J: 'Judo', K: 'Karate', R: 'Rugby', S: 'Swimming', T: 'Tennis', V: 'Volleyball', W: 'Wrestling' },
  'Large cities': { A: 'Amsterdam', B: 'Berlin', C: 'Chicago', D: 'Dublin', H: 'Hamburg', L: 'London', M: 'Madrid', N: 'Naples', P: 'Paris', R: 'Rome', S: 'Sydney', T: 'Tokyo', V: 'Vienna' },
  Colours: { B: 'Blue', G: 'Green', O: 'Orange', P: 'Pink', R: 'Red', S: 'Silver', T: 'Turquoise', V: 'Violet', W: 'White', Y: 'Yellow' },
  'Fruit and vegetables': { A: 'Apple', B: 'Banana', C: 'Carrot', G: 'Grape', K: 'Kiwi', L: 'Lemon', M: 'Mango', O: 'Orange', P: 'Pear', S: 'Strawberry', T: 'Tomato' },
  Jobs: { B: 'Baker', C: 'Cook', D: 'Doctor', F: 'Farmer', J: 'Judge', L: 'Lawyer', N: 'Nurse', P: 'Pilot', S: 'Singer', T: 'Teacher', W: 'Waiter' },
}

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
await send('Emulation.setDeviceMetricsOverride', { width: VIEW.width, height: VIEW.height, deviceScaleFactor: VIEW.deviceScaleFactor, mobile: false })
await send('Page.navigate', { url: `${origin}/` })
await sleep(1500)
await evaluate(`localStorage.clear(); localStorage.setItem('lettre-minute.tutorial.v1', 'true'); localStorage.setItem('lettre-minute.profile.v1', ${JSON.stringify(JSON.stringify(PROFILE))}); true`)
await send('Page.navigate', { url: `${origin}/` })
await sleep(3500)

await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: VIEW.out[0], maxHeight: VIEW.out[1], everyNthFrame: 1 })
await sleep(300)
recording = true
mark('home')
await sleep(1200)
// The run's seed is Date.now() when Play is pressed: the clock reads SEED for
// that click and the microtasks it starts, and is real again right after.
const playSeeded = () =>
  evaluate(`(() => {
  const real = Date.now
  Date.now = () => ${SEED}
  document.querySelector('.btn--play').click()
  setTimeout(() => { Date.now = real }, 0)
  return true
})()`)
await playSeeded()
// A player who owns powers picks them on a screen of their own first
// (`powerLoadout`): the run, and its seed, start from its Play.
await sleep(1500)
if (await evaluate(`!!document.querySelector('.loadout-tile')`)) {
  await sleep(800)
  await playSeeded()
}
mark('play')
// The announcement, then 3, 2, 1.
for (let tries = 0; tries < 120 && !(await evaluate(`!!document.querySelector('.answer-field input')`)); tries++) await sleep(150)
mark('run')
await sleep(600)

const typeLetter = async (letter) => {
  await send('Input.insertText', { text: letter })
  await sleep(jitter(150, 300))
}
for (let index = 0, prompts = 0; index < WORDS && prompts < 30; prompts++) {
  if (!(await evaluate(`!!document.querySelector('.answer-field input')`))) break
  const letter = await evaluate(`document.querySelector('.prompt .mark-letter')?.textContent?.trim().slice(0, 1).toUpperCase()`)
  const category = await evaluate(`document.querySelector('.prompt-label')?.textContent?.trim()`)
  const word = ANSWERS[category]?.[letter]
  if (!word) {
    // A beat to read it, then the next prompt.
    await sleep(jitter(700, 900))
    await key('Tab', 'Tab', 9)
    await sleep(jitter(700, 900))
    continue
  }
  const step = { word, typo: index === 2 && word.length > 4 ? { after: 3, wrong: 'h' } : null }
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
  index += 1
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
  '-vf', `fps=${FPS},scale=${VIEW.out[0]}:${VIEW.out[1]}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-crf', '14', '-an',
  join(OUT, 'gameplay.mp4'),
])
// Marks in the video's own seconds; the wall clock and Chrome's frame stamps share an epoch.
const timeline = Object.fromEntries(Object.entries(marks).map(([name, at]) => [name, Math.max(0, +(at - start).toFixed(2))]))
writeFileSync(join(OUT, 'marks.json'), JSON.stringify({ ...timeline, frames: frames.length, length: +(frames.at(-1).at - start).toFixed(2) }, null, 2))
rmSync(FRAMES, { recursive: true, force: true })
console.log(JSON.stringify(timeline))
