// Plays the CrazyGames build the way a person does, in the portal's frames:
// for each frame size and for a newcomer and a regular player, the page is
// loaded in an iframe (the harness's /frame.html), « Play » must be on screen
// and on top (document.elementFromPoint at its centre), and a real mouse click
// (Input.dispatchMouseEvent, not a scripted .click()) must start the lesson
// or the run. A regular player's run must then keep its field, Skip and Enter
// inside the frame. Last, the page served from another host than localhost —
// where the SDK can only end up `disabled` — must still show « Play » quickly.
//
//   npm run crazygames:build && npm run crazygames:harness   (another shell)
//   node crazygames/check.mjs [http://localhost:5747] [http://<LAN address>:5747]
//
// Exits 1 on the first failure. Chrome's flags are the ones an agent's sandbox
// needs (CLAUDE.md, « Chrome sans tête »).
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, '.cache/crazygames-check')
const base = process.argv[2] ?? 'http://localhost:5747'
const elsewhere = process.argv[3]
const PORT = 9433
const SIZES = [[926, 476], [800, 450], [1280, 720], [390, 844]]
const REGULAR = {
  xp: 2350, runs: 14, bestScore: 412, wordsFound: 186, bestCombo: 9, usage: {},
  unlocked: ['fruits-legumes', 'metiers', 'sports', 'capitales'], offer: [], lastOffer: [],
  powers: ['joker', 'hush', 'divination'], equipped: [],
}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

mkdirSync(OUT, { recursive: true })
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(ROOT, '.cache/crazygames-check-chrome')}`,
  '--no-first-run', '--mute-audio', '--hide-scrollbars',
])
await sleep(2000)

const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((done) => socket.addEventListener('open', done))
let next = 0
const pending = new Map()
const errors = []
socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data))
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message.result)
    pending.delete(message.id)
  } else if (message.method === 'Runtime.exceptionThrown') {
    errors.push(message.params.exceptionDetails?.exception?.description ?? message.params.exceptionDetails?.text)
  }
})
const send = (method, params = {}) => new Promise((done) => {
  pending.set(++next, done)
  socket.send(JSON.stringify({ id: next, method, params }))
})
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))?.result?.value
const game = `document.querySelector('iframe').contentDocument`
let failed = false
const check = (ok, label, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed = true
}

/** Where an element of the game sits in the outer page, and whether it is the one a click there reaches. */
const locate = (selector) => evaluate(`(() => {
  const d = ${game}
  const element = d?.querySelector(${JSON.stringify(selector)})
  if (!element) return null
  const box = element.getBoundingClientRect()
  const x = box.left + box.width / 2, y = box.top + box.height / 2
  const hit = d.elementFromPoint(x, y)
  const frame = document.querySelector('iframe').getBoundingClientRect()
  return { x: frame.left + x, y: frame.top + y, top: box.top, bottom: box.bottom, height: d.defaultView.innerHeight, onTop: !!hit && element.contains(hit), hit: hit ? hit.tagName + '.' + hit.className : null }
})()`)

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })

for (const [width, height] of SIZES) {
  for (const player of ['newcomer', 'regular']) {
    const label = `${width}×${height} ${player}`
    await send('Emulation.setDeviceMetricsOverride', { width: width + 80, height: height + 80, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: `${base}/index.html` })
    await sleep(800)
    await evaluate(`localStorage.clear(); ${player === 'regular' ? `localStorage.setItem('lettre-minute.tutorial.v1', 'true'); localStorage.setItem('lettre-minute.profile.v1', ${JSON.stringify(JSON.stringify(REGULAR))});` : ''} true`)
    await send('Page.navigate', { url: `${base}/frame.html?w=${width}&h=${height}` })
    await sleep(3500)
    const play = await locate('.btn--play')
    check(play && play.bottom <= play.height, `${label}: Play inside the frame`, play && `${Math.round(play.top)}..${Math.round(play.bottom)} of ${play.height}`)
    check(play?.onTop, `${label}: Play on top at its centre`, play?.hit)
    if (!play) continue
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type, x: play.x, y: play.y, button: 'left', clickCount: 1 })
    }
    await sleep(1500)
    const stage = await evaluate(`${game}.querySelector('main')?.className ?? ''`)
    check(!/stage--home/.test(stage), `${label}: a real click on Play starts the ${player === 'newcomer' ? 'lesson' : 'run'}`, stage)
    if (player === 'regular') {
      for (let tries = 0; tries < 40 && !(await evaluate(`!!${game}.querySelector('.answer-field input')`)); tries++) await sleep(200)
      for (const selector of ['.answer-field', '.answer-actions']) {
        const part = await locate(selector)
        check(part && part.bottom <= part.height, `${label}: ${selector} inside the frame during the run`, part && `${Math.round(part.top)}..${Math.round(part.bottom)} of ${part.height}`)
      }
    }
    const { data } = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(OUT, `${width}x${height}-${player}.png`), Buffer.from(data, 'base64'))
  }
}

if (elsewhere) {
  await send('Emulation.setDeviceMetricsOverride', { width: 1006, height: 556, deviceScaleFactor: 1, mobile: false })
  const started = Date.now()
  await send('Page.navigate', { url: `${elsewhere}/frame.html?w=926&h=476` })
  let seconds = null
  for (let tries = 0; tries < 40; tries++) {
    await sleep(250)
    if (await evaluate(`!!(${game}?.querySelector('.btn--play'))`)) {
      seconds = (Date.now() - started) / 1000
      break
    }
  }
  check(seconds !== null && seconds < 4, `outside the portal (${elsewhere}): Play shows without the SDK`, seconds === null ? 'never' : `${seconds.toFixed(1)} s`)
}

check(errors.length === 0, 'no exception in the page', errors.join(' | '))
chrome.kill()
process.exit(failed ? 1 : 0)
