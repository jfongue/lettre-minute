// Walks every scene of the CrazyGames build in the portal's frames and measures
// what a review catches by eye: a scene wider or taller than its frame, a
// button cut by a box that does not scroll, a box that scrolls without a bar.
// The scenes are the debug board's (`src/debug/DebugBoard.tsx`), opened in the
// real build as a super moderator would: the real screens on invented data,
// nothing written to the server.
//
//   npm run crazygames:build && npm run crazygames:harness   (another shell)
//   node crazygames/sweep.mjs [http://localhost:5747] [--size=926x476] [--only=home-news,stats] [--lang=de] [--shots]
//
// Without --size every frame is walked, one Chrome each, side by side. --shots
// keeps a capture of every scene and contact sheets under
// .cache/crazygames-sweep/. Exits 1 when a scene fails.
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SELF = fileURLToPath(import.meta.url)
const ROOT = resolve(dirname(SELF), '..')
const OUT = join(ROOT, '.cache/crazygames-sweep')
const args = process.argv.slice(2)
const option = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
const base = args.find((arg) => arg.startsWith('http')) ?? 'http://localhost:5747'
const shots = args.includes('--shots')
// The portal's frames: its laptop and small windows, a maximised desktop, the
// smallest it lists, a Chromebook's, a tall laptop's, a full-screen monitor, the near-square frame of a narrow
// window (the review's own captures) and a phone held upright.
const SIZES = [[926, 476], [800, 450], [1280, 720], [640, 360], [854, 410], [1100, 575], [1920, 1080], [478, 510], [390, 844]]

// What the portal's build never opens (`closedFeatures`), and the developer's
// own tools: their scenes are another version's.
const CLOSED = /^(premium|challenge-|social-invite|push-offer|update$|feedback-pop|rating-pop|ideas-admin|invite-art|share-news|name-prompt|leaderboards-advanced|features-board|words-board|spy-|game-modes|mode-|categories-premieres|categories-filter|over-hidden-premium|weekly-screen-plus|duel-invite$|achievement-icons)/

if (!option('size')) {
  // One Chrome per frame, a few at a time: a laptop runs out of breath past that.
  rmSync(OUT, { recursive: true, force: true })
  let failed = false
  const queue = [...SIZES]
  const worker = async (slot) => {
    for (let size = queue.shift(); size; size = queue.shift()) {
      const code = await new Promise((done) => {
        const child = spawn(process.execPath, [SELF, ...args, `--size=${size.join('x')}`, `--port=${9440 + slot}`], { stdio: 'inherit' })
        child.on('exit', done)
      })
      if (code !== 0) failed = true
    }
  }
  await Promise.all([0, 1, 2, 3].map(worker))
  console.log(failed ? '\nFAIL: some scenes do not fit their frame' : '\nok: every scene fits every frame')
  process.exit(failed ? 1 : 0)
}

const [width, height] = option('size').split('x').map(Number)
const PORT = Number(option('port') ?? 9440)
const only = option('only')?.split(',')
const lang = option('lang') ?? 'en'
const label = `${width}×${height}${option('lang') ? ` ${option('lang')}` : ''}`
const dir = join(OUT, `${width}x${height}`)
mkdirSync(dir, { recursive: true })
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(ROOT, `.cache/crazygames-sweep-chrome-${PORT}`)}`,
  '--no-first-run', '--mute-audio',
])
// Several Chromes start at once: each answers when it can.
let target = null
for (let tries = 0; tries < 60 && !target; tries++) {
  await sleep(500)
  target = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((response) => response.json(), () => null)
}
if (!target) {
  console.log(`FAIL ${label}: Chrome did not start`)
  chrome.kill()
  process.exit(1)
}
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
const evaluate = async (expression) => {
  const answer = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  // A measure that throws must never read as a scene that passes.
  if (answer?.exceptionDetails) throw new Error(answer.exceptionDetails.exception?.description ?? answer.exceptionDetails.text)
  return answer?.result?.value
}
const inGame = (body) => evaluate(`(() => { const w = document.querySelector('iframe').contentWindow, d = w.document; ${body} })()`)

const PLAYER = {
  xp: 2350, runs: 14, bestScore: 412, wordsFound: 186, bestCombo: 9, usage: {},
  unlocked: ['fruits-legumes', 'metiers', 'sports', 'capitales'], offer: [], lastOffer: [],
  powers: ['joker', 'hush', 'divination'], equipped: [],
}

// Runs in the game's frame. A scene is measured once its entrance has settled.
const MEASURE = `
  const W = w.innerWidth, H = w.innerHeight, landscape = W > H
  const fails = [], scrollers = [], cut = {}
  const name = (el) => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '')
  const page = d.scrollingElement
  if (page.scrollWidth > W + 1) fails.push('the page scrolls sideways: ' + page.scrollWidth + ' > ' + W)
  // A landscape frame is the window: the page never scrolls, its boxes do.
  if (landscape && page.scrollHeight > H + 1) fails.push('the page is taller than its frame: ' + page.scrollHeight + ' > ' + H)
  if (!landscape && page.scrollHeight > H + 1 && W - d.documentElement.clientWidth < 3) fails.push('the page scrolls without a bar')
  for (const el of d.querySelectorAll('body *')) {
    if (el.closest('.debug-bar')) continue
    const style = w.getComputedStyle(el)
    if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0) {
      const bar = el.offsetWidth - el.clientWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth)
      scrollers.push(name(el))
      if (bar < 3) fails.push('scrolls without a bar: ' + name(el))
    }
  }
  // A control is in reach when it shows, or when the box that hides it scrolls.
  for (const el of d.querySelectorAll('button, a[href], input, textarea, [role="tab"]')) {
    if (el.closest('.debug-bar')) continue
    const box = el.getBoundingClientRect(), style = w.getComputedStyle(el)
    if (box.width < 2 || box.height < 2 || style.visibility === 'hidden' || Number(style.opacity) === 0 || el.closest('[aria-hidden="true"], [inert]')) continue
    let verdict = null
    for (let parent = el.parentElement; parent && !verdict; parent = parent.parentElement) {
      if (parent === d.body || parent === d.documentElement) break
      const clip = w.getComputedStyle(parent), frame = parent.getBoundingClientRect()
      const below = box.bottom > frame.bottom + 2 || box.top < frame.top - 2
      const aside = box.right > frame.right + 2 || box.left < frame.left - 2
      // A carousel's other pages are a swipe away, however tall they are.
      if (aside && (clip.overflowX === 'auto' || clip.overflowX === 'scroll')) verdict = 'reach'
      else if (below && clip.overflowY !== 'visible') verdict = clip.overflowY === 'auto' || clip.overflowY === 'scroll' ? 'reach' : 'cut by ' + name(parent)
      else if (aside && clip.overflowX !== 'visible') verdict = 'cut by ' + name(parent)
    }
    if (!verdict && (box.right > W + 2 || box.left < -2)) verdict = 'off the side of the frame'
    if (!verdict && landscape && (box.bottom > H + 2 || box.top < -2)) verdict = 'off the frame'
    if (verdict && verdict !== 'reach') (cut[verdict] ??= []).push((el.textContent || el.getAttribute('aria-label') || name(el)).trim().slice(0, 24))
  }
  // A word broken in the middle of a line (« STATISTI / CS ») is a box too
  // narrow for its text: words wrap between themselves, never inside.
  const broken = new Set()
  const walker = d.createTreeWalker(d.body, 4)
  const range = d.createRange()
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const holder = node.parentElement
    if (!holder || holder.closest('.debug-bar, [aria-hidden="true"], input, textarea') || !node.data.trim()) continue
    const style = w.getComputedStyle(holder)
    if (style.visibility === 'hidden' || Number(style.opacity) === 0) continue
    for (const match of node.data.matchAll(/[\\p{L}\\p{N}’']{3,}/gu)) {
      range.setStart(node, match.index)
      range.setEnd(node, match.index + match[0].length)
      const lines = new Set([...range.getClientRects()].filter((box) => box.width > 0).map((box) => Math.round(box.top)))
      if (lines.size > 1) broken.add(match[0])
    }
  }
  if (broken.size) fails.push('words broken across lines: « ' + [...broken].slice(0, 6).join(' », « ') + ' »' + (broken.size > 6 ? '…' : ''))
  // One line per box that cuts, however many controls it cuts.
  for (const [verdict, controls] of Object.entries(cut)) fails.push(controls.length + ' control' + (controls.length > 1 ? 's ' : ' ') + verdict + ': « ' + controls.slice(0, 3).join(' », « ') + ' »' + (controls.length > 3 ? '…' : ''))
  return { fails: [...new Set(fails)], scrollers: [...new Set(scrollers)] }
`

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] })
await send('Emulation.setDeviceMetricsOverride', { width: width + 40, height: height + 40, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: `${base}/index.html` })
await sleep(1500)
await evaluate(`localStorage.clear()
  localStorage.setItem('lettre-minute.tutorial.v1', 'true')
  localStorage.setItem('lettre-minute.locale.v1', '${lang}')
  localStorage.setItem('lettre-minute.profile.v1', ${JSON.stringify(JSON.stringify(PLAYER))})
  localStorage.setItem('lettre-minute.features.v1', JSON.stringify({ flags: {}, roles: { moderator: true, superModerator: true } }))
  true`)
await send('Page.navigate', { url: `${base}/frame.html?w=${width}&h=${height}&at=%23debug` })
let scenes = []
for (let tries = 0; tries < 40 && scenes.length === 0; tries++) {
  await sleep(250)
  scenes = (await inGame(`return [...d.querySelectorAll('[data-scenario]')].map((button) => button.dataset.scenario)`).catch(() => [])) ?? []
}
if (scenes.length === 0) {
  console.log(`FAIL ${label}: the debug board did not open`)
  chrome.kill()
  process.exit(1)
}
// The entrances are for players: a scene is measured where it comes to rest.
await inGame(`const style = d.createElement('style'); style.textContent = '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important } .debug-bar { opacity: 0 }'; d.head.append(style)`)
await evaluate(`document.querySelector('nav').remove()`)
const frame = await evaluate(`(() => { const box = document.querySelector('iframe').getBoundingClientRect(); return { x: box.left, y: box.top, width: box.width, height: box.height } })()`)

let failed = 0
const walked = []
for (const id of scenes) {
  if (CLOSED.test(id) || (only && !only.includes(id))) continue
  await inGame(`d.querySelector('[data-scenario="${id}"]').click()`)
  await sleep(1100)
  // An end of run is two scenes: the words' recap, then what « Continue » brings.
  for (const scene of [id, `${id}+`]) {
    if (scene !== id) {
      if (!(await inGame(`const next = d.querySelector('.reveal .reveal-next'); next?.click(); return !!next`))) break
      await sleep(1100)
    }
    const found = await inGame(MEASURE)
    walked.push(scene)
    if (shots) {
      const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70, clip: { ...frame, scale: 1 } })
      writeFileSync(join(dir, `${scene}.jpg`), Buffer.from(data, 'base64'))
    }
    if (found?.fails.length) {
      failed++
      console.log(`FAIL ${label} ${scene}\n       ${found.fails.join('\n       ')}`)
    }
  }
  await inGame(`d.querySelector('.debug-bar button').click()`)
  await sleep(150)
}

if (shots) {
  // Contact sheets: the scenes of this frame side by side, a few dozen a page.
  const scale = Math.min(1, 300 / width)
  const per = 24
  for (let page = 0; page * per < walked.length; page++) {
    const cells = walked.slice(page * per, (page + 1) * per).map((id) => `<figure><img src="${pathToFileURL(join(dir, `${id}.jpg`))}" width="${Math.round(width * scale)}" height="${Math.round(height * scale)}"><figcaption>${id}</figcaption></figure>`)
    const html = `<!doctype html><meta charset="utf-8"><style>body{margin:8px;background:#222;color:#eee;font:11px system-ui;display:flex;flex-wrap:wrap;gap:8px}figure{margin:0}img{display:block}</style>${cells.join('')}`
    writeFileSync(join(dir, `sheet-${page}.html`), html)
    await send('Emulation.setDeviceMetricsOverride', { width: 1900, height: 1200, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: String(pathToFileURL(join(dir, `sheet-${page}.html`))) })
    await sleep(900)
    const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80, captureBeyondViewport: true })
    writeFileSync(join(OUT, `sheet-${width}x${height}-${page}.jpg`), Buffer.from(data, 'base64'))
  }
}

if (errors.length) console.log(`FAIL ${label}: exceptions in the page — ${[...new Set(errors)].join(' | ')}`)
console.log(`${failed || errors.length ? 'FAIL' : 'ok  '} ${label}: ${walked.length} scenes, ${failed} failing`)
chrome.kill()
process.exit(failed || errors.length ? 1 : 0)
