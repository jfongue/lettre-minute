// Passe en revue TOUS les écrans que la planche debug montre avec les vrais
// composants, à chaque taille de cadre du portail — y compris une fenêtre
// haute (1920×1080, 2200×1244), que le portail donne telle quelle au jeu et
// sur laquelle toute règle de cadre limitée à `max-height: 820px` retombait
// sur la colonne du téléphone. Chaque écran doit tenir dans le cadre : le
// document ne défile pas, et aucun contrôle ne tombe hors du cadre sans qu'un
// groupe ne puisse l'y ramener en défilant.
//
// Plus lent que `crazygames:check` (le tour complet prend ~15 min par taille),
// et complémentaire : celui-ci joue les vrais parcours, celui-là voit tout.
//
// npm run crazygames:harness (autre shell), puis
// npm run crazygames:scan                    (toutes les tailles)
// npm run crazygames:scan -- 2200 1244       (une taille)
// npm run crazygames:scan -- 926 476 duel    (une taille, les scénarios dont le titre contient « duel »)
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, '.cache/cg-sweep')
const base = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:5747'
const only = process.argv.length >= 4 && !process.argv[2].startsWith('http') ? [[Number(process.argv[2]), Number(process.argv[3])]] : null
const PORT = 9436
const SIZES = only ?? [[1920, 1080], [2200, 1244], [1280, 720], [926, 476], [854, 412], [800, 450], [640, 360]]
const FILTER = process.argv[4] ?? ''
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

mkdirSync(OUT, { recursive: true })
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(ROOT, '.cache/cg-sweep-chrome')}`,
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
  // Une boîte de dialogue laissée ouverte bloque la page et l'évaluation :
  // on la refuse pour que la planche ne s'arrête jamais dessus.
  if (message.method === 'Page.javascriptDialogOpening') {
    socket.send(JSON.stringify({ id: ++next, method: 'Page.handleJavaScriptDialog', params: { accept: false } }))
  }
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
// Rien ne doit pouvoir bloquer la revue : une évaluation qui ne répond pas
// au bout de 20 s rend `undefined`, et on passe au scénario suivant.
const evaluate = async (expression) => (await Promise.race([
  send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }),
  sleep(20000).then(() => undefined),
]))?.result?.value

let failed = 0
const check = (ok, label, detail) => {
  console.log(`${ok ? 'ok ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

const shot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'))
}

// Ce que l'écran montre du cadre : le document ne défile pas, et aucun
// contrôle (bouton, champ) ne tombe hors du cadre — sauf s'il vit dans un
// groupe qui défile lui-même, ce que la revue accepte. La barre de la planche,
// fixe et à nous, est retirée le temps de la mesure.
const PROBE = `(() => {
const bar = document.querySelector('.debug-bar')
if (bar) bar.style.display = 'none'
const vw = window.innerWidth, vh = window.innerHeight
const reachable = (el, axis) => {
for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
const style = getComputedStyle(node)
if (axis === 'y' && /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 2) return true
if (axis === 'x' && /(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth + 2) return true
}
return false
}
const out = []
for (const el of document.querySelectorAll('button, input, textarea, a.btn, .btn')) {
const r = el.getBoundingClientRect()
if (!r.width && !r.height) continue
if (el.closest('.debug-bar')) continue
const down = (r.bottom > vh + 1 || r.top < -1) && !reachable(el, 'y')
const aside = (r.right > vw + 1 || r.left < -1) && !reachable(el, 'x')
if (down || aside) {
out.push((el.textContent || el.getAttribute('aria-label') || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ' x ' + Math.round(r.top) + '..' + Math.round(r.bottom) + ']')
}
}
// Une barre horizontale visible : une carte qui glisse hors d'une boîte qui
// défile en hauteur — jamais voulue, seul le défilement vertical l'est.
const bars = []
for (const el of document.querySelectorAll('*')) {
const style = getComputedStyle(el)
if (style.display === 'none' || style.scrollbarWidth === 'none') continue
if (/(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1) bars.push(el.tagName + '.' + (el.getAttribute('class') ?? '').split(' ').slice(0, 2).join('.'))
}
// Un écran qui défile en hauteur : la revue veut des scènes fixes. Seules
// défilent les listes par nature — le tiroir du menu et ses pages, les lignes
// d'un classement, les mots cachés du bilan —, et la planche elle-même. Les
// pages du menu montrées seules par la planche défilent aussi : signalé, pas
// refusé, chaque ligne se lit à la main.
const LISTS = '.menu, .board, .board-track, .standings, .hidden-answers, .reveal-words, .over-pane--more, .debug-board'
const scrolls = []
for (const el of document.querySelectorAll('*')) {
const style = getComputedStyle(el)
if (style.display === 'none' || el.closest(LISTS) || el.closest('.debug-bar')) continue
if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 2) scrolls.push(el.tagName + '.' + (el.getAttribute('class') ?? '').split(' ').slice(0, 2).join('.') + ' ' + el.scrollHeight + '>' + el.clientHeight)
}
const panes = []
for (const el of document.querySelectorAll('.sheet, .reveal, .poster, .language-picker, .loadout, .moderation, .dealt, .duel-rules, .duel-lobby, .duel-draft, .duel-opening, .duel-over, .duel-search, .duel-run, .duel-board, .answer-field, .answer-actions, .tutorial-answer')) {
const r = el.getBoundingClientRect()
if (!r.height) continue
panes.push({ cls: el.getAttribute('class')?.split(' ').slice(0, 2).join('.') ?? el.tagName, top: Math.round(r.top), bottom: Math.round(r.bottom) })
}
return {
vw, vh,
scrollH: document.documentElement.scrollHeight,
scrollW: document.documentElement.scrollWidth,
out,
bars,
scrolls,
over: panes.filter((pane) => pane.bottom > vh + 1 || pane.top < -1),
scene: document.querySelector('.debug-scene > *')?.getAttribute('class')?.split(' ').slice(0, 2).join('.') ?? (document.querySelector('.sheet--home') ? 'home' : '(aucune scène)'),
}
})()`

/** Mesure l'écran courant et juge le cadre. */
const measure = async (label, shotName) => {
  const probe = await evaluate(PROBE)
  if (!probe) return check(false, `${label}: la page répond`, 'aucune mesure')
  const fits = probe.scrollH <= probe.vh + 1 && probe.scrollW <= probe.vw + 1
  const ok = fits && probe.out.length === 0 && probe.over.length === 0 && probe.bars.length === 0
  check(ok, label, [
    fits ? null : `${probe.scrollW}×${probe.scrollH} pour ${probe.vw}×${probe.vh}`,
    probe.out.length ? `hors cadre : ${probe.out.join(' | ')}` : null,
    probe.bars.length ? `barre horizontale : ${probe.bars.join(' | ')}` : null,
    probe.over.length ? `sous le bord : ${probe.over.map((pane) => `${pane.cls} ${pane.top}..${pane.bottom}`).join(' | ')}` : null,
  ].filter(Boolean).join(' — '))
  if (probe.scrolls.length) console.log(`     ${label} défile : ${probe.scrolls.join(' | ')}`)
  if (!ok && shotName) await shot(`${shotName}-FAIL`)
  return { probe, ok }
}

const REGULAR = { xp: 2350, runs: 14, bestScore: 412, wordsFound: 186, bestCombo: 9, usage: {}, unlocked: ['fruits-legumes', 'metiers', 'sports', 'capitales'], offer: [], lastOffer: [], powers: [], equipped: [] }
const seed = (extra = '') => `(() => {
localStorage.clear()
localStorage.setItem('lettre-minute.tutorial.v1', 'true')
localStorage.setItem('lettre-minute.duel-rules.v1', 'true')
localStorage.setItem('lettre-minute.profile.v1', ${JSON.stringify(JSON.stringify(REGULAR))})
localStorage.setItem('lettre-minute.features.v1', JSON.stringify({
flags: { debugBoard: { everyone: 'on', moderator: 'neutral', premium: 'neutral', superModerator: 'neutral' } },
roles: { moderator: true, superModerator: true },
}))
${extra}
return true
})()`

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })

// `Page.navigate` vers la même page avec un fragment n'est qu'un changement de
// hash : sans un passage par about:blank, l'app garde son état de départ.
const open = async (url, wait) => {
  await send('Page.navigate', { url: 'about:blank' })
  await sleep(250)
  await send('Page.navigate', { url })
  await sleep(wait)
}

for (const [width, height] of SIZES) {
  const frame = `${width}x${height}`
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${base}/index.html` })
  await sleep(900)
  await evaluate(seed())
  await open(`${base}/index.html#debug`, 3000)
  const board = await evaluate(`!!document.querySelector('.debug-board')`)
  check(board, `${frame}: la planche debug s'ouvre`, board ? undefined : 'pas de planche')
  if (!board) continue
  const titles = (await evaluate(`[...document.querySelectorAll('button.debug-item')].map((el) => el.querySelector('strong')?.textContent?.trim() ?? el.textContent.trim())`)) ?? []
  console.log(` ${frame}: ${titles.length} scénarios`)
  for (const title of titles) {
    if (FILTER && !title.includes(FILTER)) continue
    const opened = await evaluate(`(() => {
const button = [...document.querySelectorAll('button.debug-item')].find((el) => (el.querySelector('strong')?.textContent?.trim() ?? el.textContent.trim()) === ${JSON.stringify(title)})
if (!button) return false
button.click()
return true
})()`)
    if (!opened) { check(false, `${frame}/${title}: la planche s'ouvre`, 'introuvable'); continue }
    await sleep(1200)
    const scene = await evaluate(`document.querySelector('.debug-scene > *')?.getAttribute('class') ?? ''`)
    if (!scene) { console.log(`  (${title} : pas un écran, sauté)`); continue }
    const slug = title.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 34)
    await measure(`${frame}/${slug}`, `${frame}-${slug}`)
    // Certains scénarios se jouent en plusieurs temps : on remesure 2,5 s plus
    // tard pour attraper ce qui n'arrive qu'après l'animation.
    await sleep(2500)
    await measure(`${frame}/${slug} (2,5 s plus tard)`)
    await evaluate(`document.querySelector('.debug-bar button')?.click()`)
    await sleep(600)
    // La planche revient parfois sur un écran au lieu de sa liste : on la
    // recharge plutôt que de mesurer le mauvais scénario.
    if (!(await evaluate(`!!document.querySelector('button.debug-item')`))) {
      await open(`${base}/index.html#debug`, 2500)
    }
  }
}

// L'accueil et la partie, en vrai : personne ne les montre par la planche.
for (const [width, height] of SIZES) {
  const frame = `${width}x${height}`
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${base}/index.html` })
  await sleep(900)
  await evaluate(seed())
  await open(`${base}/index.html`, 3500)
  await measure(`${frame}/accueil`, `${frame}-home`)
  const started = await evaluate(`(() => { const b = document.querySelector('.btn--play'); if (!b) return false; b.click(); return true })()`)
  check(started, `${frame}/accueil: « Play » lance la partie`, started ? undefined : 'aucun bouton Play')
  if (!started) continue
  await sleep(4000)
  if (await evaluate(`!!document.querySelector('.loadout')`)) {
    await measure(`${frame}/pouvoirs`, `${frame}-loadout`)
    await evaluate(`[...document.querySelectorAll('.loadout button')].find((el) => /play|jouer/i.test(el.textContent))?.click()`)
    await sleep(3000)
  }
  await measure(`${frame}/partie`, `${frame}-run`)
}

check(errors.length === 0, 'aucune exception dans la page', errors.join(' | ').slice(0, 300))
chrome.kill()
console.log(`\n${failed} échec(s) — captures : ${OUT}`)
process.exit(failed ? 1 : 0)
