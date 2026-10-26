// Plays the CrazyGames build the way a person does, in the portal's frames:
// for each frame size and for a newcomer and a regular player, the page is
// loaded in an iframe (the harness's /frame.html). A newcomer lands in the
// first lesson without a click (`host.playFirst`), its answer inside the
// frame. For a regular player « Play » must be on screen and on top
// (document.elementFromPoint at its centre), and a real mouse click
// (Input.dispatchMouseEvent, not a scripted .click()) must start the run —
// through the powers' screen for a player who owns some. A regular player's run must then keep its field, Skip and Enter
// inside the frame. Then the duel, in the portal's instant multiplayer, from
// the rules to the running game — and a page taller than the frame (the
// stats), which must scroll inside the frame instead of being cut. Last, the
// page served from another host than localhost — where the SDK can only end up
// `disabled` — must still show « Play », or a newcomer's lesson, quickly.
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
const SIZES = [[926, 476], [854, 412], [800, 450], [1280, 720], [1920, 1080], [390, 844]]
const LONG_SIZES = [[926, 476], [1920, 1080]]
const REGULAR = {
  xp: 2350, runs: 14, bestScore: 412, wordsFound: 186, bestCombo: 9, usage: {},
  unlocked: ['fruits-legumes', 'metiers', 'sports', 'capitales'], offer: [], lastOffer: [],
  powers: ['joker', 'hush', 'divination'], equipped: [],
}
// Trente parties jouées : la page des statistiques est alors plus haute que
// n'importe quel cadre, et c'est là qu'on vérifie qu'elle défile chez elle.
const HISTORY = Array.from({ length: 30 }, (_, index) => [
  Date.now() - index * 3600_000, 'fr', 180 + index * 7, 3, 1,
  ['animaux', 'pays', 'couleurs'],
  [['animaux', 'chat', 'Chat', 40], ['pays', 'canada', 'Canada', 35], ['couleurs', 'bleu', 'Bleu', 25]],
])
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

/** The scrollbars a player would see in the game: a horizontal one (never wanted: a card sliding
 * out of a box that scrolls vertically) and, on a landscape frame, a scrolling page or home column
 * (the main menu only scrolls its leaderboard's rows, under a hidden bar). */
const scrollbars = (landscape) => evaluate(`(() => {
  const d = ${game}
  const out = []
  const root = d.scrollingElement
  if (${landscape} && root.scrollHeight > root.clientHeight + 1) out.push('page ' + root.scrollHeight + ' > ' + root.clientHeight)
  const column = d.querySelector('.sheet--home:not(.sheet--home-alone) > .home-body')
  if (${landscape} && column && column.scrollHeight > column.clientHeight + 1) out.push('home column ' + column.scrollHeight + ' > ' + column.clientHeight)
  for (const element of d.querySelectorAll('*')) {
    const style = d.defaultView.getComputedStyle(element)
    if (style.display === 'none' || style.scrollbarWidth === 'none') continue
    if (/auto|scroll/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 1) out.push('x ' + element.tagName + '.' + element.className)
  }
  return out
})()`)

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

/** Un vrai clic de souris, à l'endroit où l'élément se trouve dans le cadre. */
const click = async (selector) => {
const spot = await locate(selector)
if (!spot) return false
for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
await send('Input.dispatchMouseEvent', { type, x: spot.x, y: spot.y, button: 'left', clickCount: 1 })
}
return true
}

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
    if (player === 'newcomer') {
      const lesson = await locate('.tutorial-answer')
      check(lesson && lesson.bottom <= lesson.height, `${label}: the first lesson opens by itself, its answer inside the frame`, lesson ? `${Math.round(lesson.top)}..${Math.round(lesson.bottom)} of ${lesson.height}` : 'no lesson')
      const { data } = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(join(OUT, `${width}x${height}-${player}.png`), Buffer.from(data, 'base64'))
      continue
    }
    const home = await scrollbars(width > height)
    check(home?.length === 0, `${label}: the home page shows no scrollbar but the leaderboard's`, home?.join(' | '))
    const play = await locate('.btn--play')
    check(play && play.bottom <= play.height, `${label}: Play inside the frame`, play && `${Math.round(play.top)}..${Math.round(play.bottom)} of ${play.height}`)
    check(play?.onTop, `${label}: Play on top at its centre`, play?.hit)
    if (!play) continue
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', { type, x: play.x, y: play.y, button: 'left', clickCount: 1 })
    }
    await sleep(1500)
    // A player who owns powers picks them first (`PowerLoadout`): its « Play »
    // must sit in the frame too, and one more real click starts the run.
    if (await evaluate(`!!${game}.querySelector('.loadout')`)) {
      const go = await locate('.loadout .btn--play')
      check(go && go.bottom <= go.height, `${label}: the powers' Play inside the frame`, go && `${Math.round(go.top)}..${Math.round(go.bottom)} of ${go.height}`)
      check(go?.onTop, `${label}: the powers' Play on top at its centre`, go?.hit)
      if (go) {
        for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
          await send('Input.dispatchMouseEvent', { type, x: go.x, y: go.y, button: 'left', clickCount: 1 })
        }
        await sleep(1500)
      }
    }
    const stage = await evaluate(`${game}.querySelector('main')?.className ?? ''`)
    check(!/stage--home/.test(stage), `${label}: a real click on Play starts the run`, stage)
    if (/countdown/.test(stage)) {
      const deck = await scrollbars(width > height)
      check(deck?.length === 0, `${label}: the « Coming up » deck shows no scrollbar`, deck?.join(' | '))
    }
    for (let tries = 0; tries < 40 && !(await evaluate(`!!${game}.querySelector('.answer-field input')`)); tries++) await sleep(200)
    for (const selector of ['.answer-field', '.answer-actions']) {
      const part = await locate(selector)
      check(part && part.bottom <= part.height, `${label}: ${selector} inside the frame during the run`, part && `${Math.round(part.top)}..${Math.round(part.bottom)} of ${part.height}`)
    }
    const running = await scrollbars(width > height)
    check(running?.length === 0, `${label}: the run shows no scrollbar`, running?.join(' | '))
    const { data } = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(OUT, `${width}x${height}-${player}.png`), Buffer.from(data, 'base64'))
  }
}

// Le duel, jusqu'à la partie : le portail l'ouvre en instant multiplayer pour
// un invité sans compte. Les règles, le salon, le draft et la partie elle-même
// — ce que la revue du multijoueur a trouvé hors du cadre — doivent tenir dans
// le cadre sans rien faire défiler, « Leave the table » compris.
for (const [width, height] of [[640, 360], [926, 476], [1920, 1080]]) {
const label = `${width}×${height} duel`
await send('Emulation.setDeviceMetricsOverride', { width: width + 80, height: height + 80, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: `${base}/index.html` })
await sleep(800)
await evaluate('localStorage.clear(); true')
await send('Page.navigate', { url: `${base}/frame.html?w=${width}&h=${height}&instantJoin=true` })
await sleep(4500)
const rules = await locate('.duel-rules')
check(rules && rules.bottom <= rules.height, `${label}: the rules open the duel, inside the frame`, rules ? `${Math.round(rules.top)}..${Math.round(rules.bottom)} of ${rules.height}` : 'no rules')
await click('.duel-rules .btn--quiet')
await sleep(1500)
const lobby = await locate('.duel-lobby')
check(lobby && lobby.bottom <= lobby.height, `${label}: the lobby inside the frame`, lobby && `${Math.round(lobby.top)}..${Math.round(lobby.bottom)} of ${lobby.height}`)
for (let invited = 0; invited < 2; invited++) {
if (!(await click('.duel-lobby__side button'))) break
await sleep(1000)
}
const ready = await locate('.duel-cta')
check(ready?.onTop, `${label}: the ready button on top at its centre`, ready?.hit)
await click('.duel-cta')
let measuredDraft = false
for (let tries = 0; tries < 70; tries++) {
await sleep(500)
if (await evaluate(`!!${game}?.querySelector('.dealt--pick')`)) {
if (!measuredDraft) {
measuredDraft = true
const tiles = await locate('.dealt--pick')
check(tiles && tiles.bottom <= tiles.height, `${label}: the draft's tiles inside the frame`, tiles && `${Math.round(tiles.top)}..${Math.round(tiles.bottom)} of ${tiles.height}`)
}
await click('.dealt--pick .dealt-tile--open')
}
if (await evaluate(`!!${game}?.querySelector('.stage--duel-play')`)) break
}
const quit = await locate('.duel-quit')
const scrolls = await evaluate(`(() => { const d = ${game}; return d ? d.documentElement.scrollHeight - d.defaultView.innerHeight : 0 })()`)
check(quit && quit.bottom <= quit.height, `${label}: the quit button inside the frame once the game runs`, quit && `${Math.round(quit.top)}..${Math.round(quit.bottom)} of ${quit.height}`)
check(scrolls <= 1, `${label}: nothing scrolls under the frame`, `${scrolls} px`)
const { data } = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(join(OUT, `${width}x${height}-duel.png`), Buffer.from(data, 'base64'))
}

// Un écran plus haut que le cadre — les statistiques, les classements, les
// succès, les bilans — défile dans le cadre : le portail ne fait jamais
// défiler la page, et une page coupée sous le bord ne se lit plus du tout.
for (const [width, height] of LONG_SIZES) {
const label = `${width}×${height} long page`
await send('Emulation.setDeviceMetricsOverride', { width: width + 80, height: height + 80, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: `${base}/index.html` })
await sleep(800)
await evaluate(`localStorage.clear()
localStorage.setItem('lettre-minute.tutorial.v1', 'true')
localStorage.setItem('lettre-minute.profile.v1', ${JSON.stringify(JSON.stringify(REGULAR))})
localStorage.setItem('lettre-minute.history.v1', ${JSON.stringify(JSON.stringify(HISTORY))})
true`)
await send('Page.navigate', { url: `${base}/frame.html?w=${width}&h=${height}` })
await sleep(3500)
await click('.poster-menu')
await sleep(1200)
const link = await evaluate(`!!${game}?.querySelector('.menu .page-link--stats')`)
check(link, `${label}: the menu tile opens the drawer`, link ? undefined : 'no page link in the drawer')
const opened = link ? await click('.menu .page-link--stats') : false
check(opened, `${label}: the stats page opens from the drawer`, opened ? undefined : 'no page link')
await sleep(2000)
const page = await evaluate(`(() => {
const d = ${game}
if (!d) return null
// La page vit dans le tiroir : c'est son corps qui défile, pas le document.
const pane = d.querySelector('.menu-body') ?? d.querySelector('.stage .sheet:not(.sheet--home)')
if (!pane) return null
const frame = d.defaultView.innerHeight
const box = pane.getBoundingClientRect()
const overflows = pane.scrollHeight > pane.clientHeight + 2
const last = [...pane.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().height).pop()
pane.scrollTop = pane.scrollHeight
return {
frame,
document: d.documentElement.scrollHeight - frame,
box: [Math.round(box.top), Math.round(box.bottom)],
overflows,
scrolled: Math.round(pane.scrollTop),
lastBottom: last ? Math.round(last.getBoundingClientRect().bottom) : null,
rows: pane.querySelectorAll('li, tr, .run-line').length,
}
})()`)
check(page, `${label}: the stats page shows`, page ? undefined : 'no sheet')
if (page) {
check(page.document <= 1, `${label}: the frame itself never scrolls`, `${page.document} px`)
check(page.box[0] >= -1 && page.box[1] <= page.frame + 1, `${label}: the page stays inside the frame`, `${page.box.join('..')} of ${page.frame}`)
check(page.overflows && page.scrolled > 0, `${label}: a page taller than the frame scrolls inside it`, page.overflows ? `${page.scrolled} px scrolled, ${page.rows} rows` : `nothing to scroll — ${page.rows} rows`)
check(page.lastBottom === null || page.lastBottom <= page.frame + 1, `${label}: its end is reachable`, `the last row ends at ${page.lastBottom} of ${page.frame}`)
}
const { data } = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(join(OUT, `${width}x${height}-stats.png`), Buffer.from(data, 'base64'))
}

if (elsewhere) {
  await send('Emulation.setDeviceMetricsOverride', { width: 1006, height: 556, deviceScaleFactor: 1, mobile: false })
  const started = Date.now()
  await send('Page.navigate', { url: `${elsewhere}/frame.html?w=926&h=476` })
  let seconds = null
  for (let tries = 0; tries < 40; tries++) {
    await sleep(250)
    if (await evaluate(`!!(${game}?.querySelector('.btn--play, .tutorial-answer'))`)) {
      seconds = (Date.now() - started) / 1000
      break
    }
  }
  check(seconds !== null && seconds < 4, `outside the portal (${elsewhere}): Play or the lesson shows without the SDK`, seconds === null ? 'never' : `${seconds.toFixed(1)} s`)
}

check(errors.length === 0, 'no exception in the page', errors.join(' | '))
chrome.kill()
process.exit(failed ? 1 : 0)
