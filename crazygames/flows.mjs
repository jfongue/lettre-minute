// Four portal-review points that must never regress unnoticed, played in the
// real CrazyGames build inside the harness's frame (see check.mjs):
//   1. gameplayStart only when a hand / a run is really played (duel and solo);
//   2. a portal sign-out leaves a fresh guest, not the account's progress;
//   3. no blank under the home leaderboard's carousel;
//   4. a bar on every scrollable scene (challenge of the moment and ranking).
//
//   node crazygames/flows.mjs [http://localhost:5747] [--only=1,3]
//
// Exits 1 when a check fails. Chrome's flags are the sandbox's (CLAUDE.md).
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, '.cache/crazygames-check')
const args = process.argv.slice(2)
const base = args.find((arg) => arg.startsWith('http')) ?? 'http://localhost:5747'
const only = args.find((arg) => arg.startsWith('--only='))?.slice(7).split(',')
const PORT = Number(args.find((arg) => arg.startsWith('--port='))?.slice(7) ?? 9460)
const REGULAR = {
  xp: 2350, runs: 14, bestScore: 412, wordsFound: 186, bestCombo: 9, usage: {},
  unlocked: ['fruits-legumes', 'metiers', 'sports', 'capitales'], offer: [], lastOffer: [],
  powers: ['joker', 'hush', 'divination'], equipped: [],
}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

mkdirSync(OUT, { recursive: true })
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(ROOT, `.cache/crazygames-flows-chrome-${PORT}`)}`,
  '--no-first-run', '--mute-audio',
])
let target = null
for (let tries = 0; tries < 60 && !target; tries++) {
  await sleep(500)
  target = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((response) => response.json(), () => null)
}
if (!target) {
  console.log('FAIL Chrome did not start')
  chrome.kill()
  process.exit(1)
}
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((done) => socket.addEventListener('open', done))
let next = 0
const pending = new Map()
const errors = []
/** Every SDK call the page logs, in order, with the time it was heard. */
const sdkLog = []
const started = Date.now()
socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data))
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message.result)
    pending.delete(message.id)
  } else if (message.method === 'Runtime.exceptionThrown') {
    errors.push(message.params.exceptionDetails?.exception?.description ?? message.params.exceptionDetails?.text)
  } else if (message.method === 'Runtime.consoleAPICalled') {
    const text = message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ')
    if (/gameplay/i.test(text)) sdkLog.push({ at: Date.now() - started, text })
    if (process.env.RAW && new RegExp(process.env.RAW).test(text)) console.log('console:', text.replace(/background-color[^;]*;[^;]*;[^;]*;[^;]*;/g, '').slice(0, 200))
  }
})
const send = (method, params = {}) => new Promise((done) => {
  pending.set(++next, done)
  socket.send(JSON.stringify({ id: next, method, params }))
})
const evaluate = async (expression) => {
  const answer = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  // A measure that throws must never read as a step that passes.
  if (answer?.exceptionDetails) throw new Error(answer.exceptionDetails.exception?.description ?? answer.exceptionDetails.text)
  return answer?.result?.value
}
const game = `document.querySelector('iframe').contentDocument`
let failed = false
const check = (ok, label, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed = true
}
const note = (text) => console.log(`     ${text}`)
const shot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, `flows-${name}.png`), Buffer.from(data, 'base64'))
}
/** Waits until `expression` (evaluated in the outer page) is truthy. */
const until = async (expression, seconds = 20) => {
  for (let tries = 0; tries < seconds * 5; tries++) {
    if (await evaluate(expression)) return true
    await sleep(200)
  }
  return false
}
const inGame = (selector) => `!!${game}?.querySelector(${JSON.stringify(selector)})`
const click = (selector) => evaluate(`(() => { const e = ${game}.querySelector(${JSON.stringify(selector)}); if (!e) return false; e.click(); return true })()`)
const clickText = (selector, pattern) => evaluate(`(() => { const e = [...${game}.querySelectorAll(${JSON.stringify(selector)})].find((n) => ${pattern}.test(n.textContent)); if (!e) return false; e.click(); return true })()`)
const resize = (width, height) => send('Emulation.setDeviceMetricsOverride', { width: width + 80, height: height + 80, deviceScaleFactor: 1, mobile: false })
/** Seeds a returning player (or nobody) and loads the frame. `at` goes to the iframe's own address. */
async function open({ width = 926, height = 476, seed = true, keep = false, at = '' } = {}) {
  await resize(width, height)
  if (!keep) {
    await send('Page.navigate', { url: `${base}/index.html` })
    await sleep(600)
    await evaluate(`localStorage.clear(); localStorage.setItem('lettre-minute.locale.v1', 'en'); localStorage.setItem('lettre-minute.duel-rules.v1', 'true'); ${seed ? `localStorage.setItem('lettre-minute.tutorial.v1', 'true'); localStorage.setItem('lettre-minute.profile.v1', ${JSON.stringify(JSON.stringify(REGULAR))});` : ''} true`)
  }
  await send('Page.navigate', { url: `${base}/frame.html?w=${width}&h=${height}${at ? `&at=${encodeURIComponent(at)}` : ''}` })
  await sleep(1500)
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })

const run = (n) => !only || only.includes(String(n))
const starts = () => sdkLog.filter((entry) => /gameplay start/i.test(entry.text)).length
const stops = () => sdkLog.filter((entry) => /gameplay stop/i.test(entry.text)).length

if (run(1)) {
  console.log('\n1. gameplayStart only when the clock runs')
  // --- Solo: Play → (powers) → « Coming up » → run.
  await open()
  check(await until(inGame('.btn--play'), 15), 'solo: the home shows Play')
  const before = { start: starts(), stop: stops() }
  await click('.btn--play')
  const solo = []
  let loadout = false
  for (let i = 0; i < 300; i++) {
    const seen = await evaluate(`(() => { const d = ${game}; return { loadout: !!d.querySelector('.loadout'), countdown: !!d.querySelector('.countdown'), field: !!d.querySelector('.answer-field input'), starts: 0 } })()`)
    seen.starts = starts() - before.start
    solo.push(seen)
    if (seen.loadout && !loadout) { loadout = true; await click('.loadout .btn--play') }
    if (seen.field) break
    await sleep(200)
  }
  const first = solo.findIndex((seen) => seen.field)
  const countdownSamples = solo.filter((seen) => seen.countdown)
  check(first >= 0, 'solo: the run starts (answer field on screen)')
  check(countdownSamples.length > 0, `solo: the « Coming up » countdown was seen`, `${countdownSamples.length} samples${loadout ? ', through the powers screen' : ''}`)
  check(solo.slice(0, Math.max(first, 0)).every((seen) => seen.starts === 0), 'solo: no gameplayStart before the answer field appears (ad, powers, countdown)', `starts seen before the field: ${Math.max(...solo.slice(0, Math.max(first, 0)).map((seen) => seen.starts), 0)}`)
  await sleep(500)
  check(starts() - before.start === 1, 'solo: exactly one gameplayStart once the field is on screen', `${starts() - before.start}`)
  await shot('1-solo-run')

  // --- Duel at the house players' table (the local SDK's instant multiplayer).
  await open({ at: '?instantJoin=true' })
  check(await until(inGame('.duel-lobby'), 15), 'duel: the table opens (instant multiplayer, house players)')
  await shot('1-duel-lobby')
  const base = { start: starts(), stop: stops() }
  await clickText('button', /ready/i)
  const seenPhases = new Set()
  let early = 0
  let playing = false
  let over = false
  for (let i = 0; i < 600 && !over; i++) {
    const phase = await evaluate(`(() => { const d = ${game}; if (d.querySelector('.duel-ranking')) return 'over'; if (d.querySelector('.duel-run input')) return 'play'; if (d.querySelector('.duel-opening')) return 'opening'; if (d.querySelector('.duel-draft')) return 'draft'; if (d.querySelector('.duel-lobby')) return 'lobby'; return 'other' })()`)
    seenPhases.add(phase)
    if (phase === 'play' && !playing) { playing = true; await shot('1-duel-play') }
    if (phase === 'draft' && !seenPhases.has('shot-draft')) { seenPhases.add('shot-draft'); await shot('1-duel-draft') }
    if (!playing && starts() > base.start) early++
    if (phase === 'over') over = true
    await sleep(250)
  }
  check(seenPhases.has('draft') && seenPhases.has('opening'), 'duel: the draft and the opening were both seen', [...seenPhases].filter((p) => !p.startsWith('shot')).join(' → '))
  check(early === 0, 'duel: no gameplayStart while the categories are announced, picked or the opening runs', `${early} samples with a start before the play screen`)
  check(playing, 'duel: the play screen (answer field) shows')
  check(starts() - base.start === 1, 'duel: exactly one gameplayStart for the table', `${starts() - base.start}`)
  await sleep(800)
  check(over && stops() - base.stop >= 1, 'duel: a gameplayStop follows the end of the duel', over ? `${stops() - base.stop} stop(s)` : 'the duel never ended')
  await shot('1-duel-over')
}

if (run(2)) {
  console.log('\n2. a portal sign-out leaves a fresh guest')
  const stored = `(() => {
    const read = (key) => { try { return JSON.parse(localStorage.getItem(key) ?? 'null') } catch { return 'unreadable' } }
    const sdk = Object.keys(localStorage).filter((key) => key.startsWith('SDK_DATA_')).map((key) => read(key))
    const saved = sdk.map((entry) => entry?.data?.['lettre-minute.profile.v1'])
    return { profile: read('lettre-minute.profile.v1'), saved, sdkKeys: sdk.length }
  })()`
  const figures = `[...${game}.querySelectorAll('.figures')].map((n) => n.innerText.replace(/\\s+/g, ' ').trim()).join(' | ')`
  await open()
  check(await until(inGame('.btn--play')), 'signed in: the returning player’s home shows')
  await sleep(2500)
  const account = await evaluate(stored)
  const profile = typeof account.profile === 'string' ? JSON.parse(account.profile) : account.profile
  check(profile?.runs === 14 && profile?.xp === 2350, 'signed in: the profile holds the account’s progress (14 games, 2350 XP)', JSON.stringify({ runs: profile?.runs, xp: profile?.xp }))
  const shownIn = await evaluate(figures)
  check(/412/.test(shownIn) && /186/.test(shownIn), 'signed in: the home shows the best score and words found', shownIn)
  await shot('2-signed-in')

  // What a portal sign-out does: the page reloads and the portal says guest.
  await open({ keep: true, at: '?user_response=logged_out' })
  check(await until(inGame('.btn--play, .tutorial-answer')), 'signed out: the home (or a lesson) shows')
  await sleep(2500)
  const guest = await evaluate(stored)
  const kept = guest.profile
  check(!kept || kept.runs === 0 || kept.runs === undefined, 'signed out: the local profile carries no games', JSON.stringify(kept)?.slice(0, 120) ?? 'absent')
  check(!kept || !kept.xp, 'signed out: the local profile carries no XP', `xp ${kept?.xp ?? 'absent'}`)
  const leaked = guest.saved.filter((value) => value != null && !/"runs":0\b/.test(String(value)))
  check(leaked.length === 0, 'signed out: the SDK’s local save holds no profile', leaked.length ? String(leaked[0]).slice(0, 120) : `${guest.sdkKeys} SDK_DATA key(s), none with a profile`)
  const shownOut = await evaluate(figures)
  check(!/412|186|\b14\b/.test(shownOut), 'signed out: the home shows none of the account’s figures', shownOut || '(no figures)')
  const level = await evaluate(`${game}.body.innerText`)
  check(!/LEVEL\s*7\b/i.test(level), 'signed out: the home no longer says level 7')
  await shot('2-signed-out')

  // Signing back in: the game still starts.
  await open({ keep: true })
  const back = await until(inGame('.btn--play, .tutorial-answer'), 20)
  check(back, 'signed in again: the home (or a lesson) shows')
  if (await evaluate(inGame('.btn--play'))) {
    await click('.btn--play')
    if (await until(inGame('.loadout'), 6)) await click('.loadout .btn--play')
    check(await until(inGame('.answer-field input'), 40), 'signed in again: Play starts a run')
  } else check(await evaluate(inGame('.tutorial-answer')), 'signed in again: the first lesson is playable')
  await shot('2-signed-in-again')
}

if (run(3)) {
  console.log('\n3. no blank under the home leaderboard')
  const measure = `(() => {
    const d = ${game}
    const track = d.querySelector('.board-track')
    if (!track) return null
    const tabs = [...d.querySelectorAll('.boards .layer-tab[role=tab]')]
    const active = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true')
    const page = d.querySelectorAll('.board-track > .board:not(.board-onward)')[active]
    const box = track.getBoundingClientRect()
    const panel = d.querySelector('.boards').getBoundingClientRect(), dots = d.querySelector('.board-dots').getBoundingClientRect(), padBottom = parseFloat(getComputedStyle(d.querySelector('.boards')).paddingBottom) + parseFloat(getComputedStyle(d.querySelector('.boards')).borderBottomWidth)
    const slack = panel.bottom - dots.bottom - padBottom, gap = dots.top - box.bottom
    const rows = page ? page.querySelectorAll('.standing').length : -1
    return { slack, gap, active, track: box.height, page: page ? page.getBoundingClientRect().height : null, rows, empty: !!page?.querySelector('.board-empty'), pages: [...d.querySelectorAll('.board-track > .board')].map((b) => Math.round(b.getBoundingClientRect().height)) }
  })()`
  for (const [width, height] of [[478, 510], [390, 844]]) {
    const label = `${width}×${height}`
    await open({ width, height })
    const shown = await until(`${inGame('.board-track')}`, 20)
    check(shown, `${label}: the home shows its leaderboard`)
    if (!shown) continue
    // Boards loaded: rows, or the board’s own empty line (server unreachable).
    await until(`${game}.querySelector('.board-track .standing, .board-track .board-empty')`, 15)
    await sleep(1200)
    for (const tab of ['Day', 'Week']) {
      if (tab === 'Week') {
        await clickText('.boards .layer-tab', /^week$/i)
        await sleep(1500)
      }
      const got = await evaluate(measure)
      const names = ['Day', 'Week']
      check(got && got.active === names.indexOf(tab) && got.page !== null, `${label} ${tab}: the ${tab} tab is the page on screen`, got && `active ${got.active}`)
      if (!got || got.page === null) continue
      check(Math.abs(got.track - got.page) <= 2, `${label} ${tab}: the carousel is as tall as the board shown (${got.rows} rows${got.empty ? ', empty board' : ''})`, `track ${got.track.toFixed(1)} vs page ${got.page.toFixed(1)}; pages ${got.pages.join('/')}`)
      await evaluate(`${game}.querySelector('.boards').scrollIntoView({ block: 'end' })`)
      check(got.slack <= 2 && got.gap <= 24, `${label} ${tab}: nothing but the dots under the carousel`, `blank at the panel's foot ${got.slack.toFixed(1)}px, gap to the dots ${got.gap.toFixed(1)}px`)
      await shot(`3-${width}x${height}-${tab.toLowerCase()}`)
    }
  }
}

if (run(4)) {
  console.log('\n4. a classic bar on every scrollable scene')
  // Runs in the game's frame: every box that scrolls, and the bar it draws.
  const scrollers = `(() => {
    const w = document.querySelector('iframe').contentWindow, d = w.document
    const out = []
    for (const el of d.querySelectorAll('body *')) {
      if (el.closest('.debug-bar')) continue
      const style = w.getComputedStyle(el)
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0) {
        const bar = el.offsetWidth - el.clientWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth)
        out.push({ name: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : ''), bar, scroll: el.scrollHeight, client: el.clientHeight })
      }
    }
    const page = d.scrollingElement
    if (page.scrollHeight > w.innerHeight + 1) out.push({ name: '(the page itself)', bar: w.innerWidth - d.documentElement.clientWidth, scroll: page.scrollHeight, client: w.innerHeight })
    return out
  })()`
  const audit = async (label, expectOne) => {
    const found = await evaluate(scrollers)
    const bare = found.filter((box) => box.bar < 3)
    check(bare.length === 0, `${label}: every scrolling box draws a bar`, found.length ? found.map((box) => `${box.name} ${box.scroll}>${box.client} bar ${box.bar.toFixed(0)}px`).join('; ') : 'nothing scrolls here')
    if (expectOne) check(found.length > 0, `${label}: the scene really scrolls (the check proves something)`, found.length ? `${found.length} scroller(s)` : 'nothing scrolls: the check proves nothing here')
    return found
  }
  for (const [width, height] of [[1280, 520], [926, 476]]) {
    const label = `${width}×${height}`
    // The real path: the home’s card, then the ranking its screen offers.
    await open({ width, height })
    check(await until(inGame('.wk-card'), 15), `${label}: the home shows the challenge of the moment`)
    await click('.wk-card')
    check(await until(inGame('.wk-play-button'), 10), `${label}: the challenge of the moment opens`)
    await sleep(1200)
    await shot(`4-${width}x${height}-challenge`)
    await audit(`${label} challenge of the moment`, false)
    const real = await clickText('button', /this challenge.s ranking/i)
    let scene = 'the ranking (from the challenge screen)'
    if (real) {
      await sleep(2500)
    } else {
      // The portal's local SDK signs in no named account, so the ranking button
      // (a server feature) is not offered to a guest here: say so, and measure the
      // same screen from the debug board (real component, invented data).
      note(`${label}: the challenge screen offers no « This challenge’s ranking » here (no named account in the local harness) — measuring the ranking scene of the debug board instead`)
      await send('Page.navigate', { url: `${base}/index.html` })
      await sleep(600)
      await evaluate(`localStorage.setItem('lettre-minute.features.v1', JSON.stringify({ flags: {}, roles: { moderator: true, superModerator: true } })); true`)
      await send('Page.navigate', { url: `${base}/frame.html?w=${width}&h=${height}&at=${encodeURIComponent('#debug')}` })
      check(await until(inGame('[data-scenario="weekly-results"]'), 15), `${label}: the debug board lists the ranking scene`)
      await click('[data-scenario="weekly-results"]')
      await sleep(2000)
      scene = 'the ranking (debug-board scene)'
    }
    await shot(`4-${width}x${height}-ranking`)
    check(await evaluate(inGame('.wk-me, .wk-podium, .subpage-title')), `${label}: ${scene} is on screen`)
    await audit(`${label} ${scene}`, width === 926)
  }
}

check(errors.length === 0, 'no exception in the page', errors.join(' | '))
chrome.kill()
process.exit(failed ? 1 : 0)
