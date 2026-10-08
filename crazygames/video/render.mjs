// Renders the two CrazyGames preview videos with HyperFrames, from the run
// capture.mjs recorded: crazygames/assets/video-landscape-1920x1080.mp4 and
// video-portrait-1080x1620.mp4 (the portal asks for 1080p at 16:9 and 2:3),
// 15 to 20 s, H.264, no audio track, the cover as first and last frame.
//
//   cd crazygames/video && npm install      (HyperFrames and GSAP, local to this folder)
//   node capture.mjs && node render.mjs
import { execFileSync, spawn } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const ASSETS = join(ROOT, 'crazygames/assets')
const MEDIA = join(HERE, 'media')
const FORMATS = [
  { format: 'landscape', width: 1920, height: 1080 },
  { format: 'portrait', width: 1080, height: 1620 },
]
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

mkdirSync(MEDIA, { recursive: true })
copyFileSync(join(ROOT, 'assets/source/jost.woff2'), join(MEDIA, 'jost.woff2'))
copyFileSync(join(ASSETS, 'cover-landscape-1920x1080.png'), join(MEDIA, 'cover-landscape.png'))

// The portrait cover is 800 × 1200; the video's 1080 × 1620 gets the same page
// drawn at 1.35×, not a stretched picture.
async function portraitCover() {
  const port = 9388
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter',
    `--remote-debugging-port=${port}`, `--user-data-dir=${join(ROOT, '.cache/crazygames-video-chrome')}`, '--hide-scrollbars', '--no-first-run',
  ])
  await sleep(2000)
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((done) => socket.addEventListener('open', done))
  let next = 1
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data))
    if (message.id && pending.has(message.id)) pending.get(message.id)(message.result)
  })
  const send = (method, params = {}) => new Promise((done) => {
    const id = next++
    pending.set(id, done)
    socket.send(JSON.stringify({ id, method, params }))
  })
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 800, height: 1200, deviceScaleFactor: 1.35, mobile: false })
  await send('Page.navigate', { url: `${pathToFileURL(join(ASSETS, 'cover.html')).href}?format=portrait` })
  await sleep(1500)
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(MEDIA, 'cover-portrait.png'), Buffer.from(data, 'base64'))
  chrome.kill()
}
await portraitCover()

// The cuts, read from the capture: the run from the moment typing starts to
// just after the rare word lands, then the summary once its words are up.
const marks = JSON.parse(readFileSync(join(HERE, 'capture/marks.json'), 'utf8'))
const round = (value) => Math.round(value * 100) / 100
const IN_END = 1.4
const RUN_FROM = marks.run + 0.4
const RUN_DUR = round(marks.word4 + 0.9 - RUN_FROM)
const SUM_AT = round(IN_END + RUN_DUR)
const SUM_DUR = 3
const OUT_AT = round(SUM_AT + SUM_DUR - 0.1)
const TOTAL = round(OUT_AT + 1.7)
// « Rare words pay the most » comes with the rare word itself, and stays over the summary.
const C4 = round(IN_END + marks.word4 - RUN_FROM - 0.2)
const T = {
  TOTAL, IN_END: IN_END + 0.4, RUN_AT: IN_END, RUN_DUR, RUN_FROM: round(RUN_FROM),
  SUM_AT, SUM_DUR, SUM_FROM: round(marks.timeUp + 3), OUT_AT, OUT_DUR: round(TOTAL - OUT_AT),
  C1: IN_END + 0.2, C1_DUR: 3.4, C2: round(IN_END + 3.6), C2_DUR: 3.6,
  C3: round(IN_END + 7.2), C3_DUR: round(C4 - IN_END - 7.2), C4, C4_DUR: round(TOTAL - C4),
}
if (TOTAL < 15 || TOTAL > 20) throw new Error(`the cut lasts ${TOTAL} s, outside the portal's 15–20 s`)
console.log(JSON.stringify(T))
const template = readFileSync(join(HERE, 'template.html'), 'utf8')
for (const { format, width, height } of FORMATS) {
  const page = `${format}.html`
  let html = template.replaceAll('{{W}}', String(width)).replaceAll('{{H}}', String(height)).replaceAll('{{FORMAT}}', format).replaceAll('{{TIMES}}', JSON.stringify(T))
  for (const [slot, value] of Object.entries(T)) html = html.replaceAll(`{{${slot}}}`, String(value))
  writeFileSync(join(HERE, page), html)
  const raw = join(HERE, `renders/${format}.mp4`)
  execFileSync('npx', ['hyperframes', 'render', '.', '-c', page, '-o', raw, '--fps', '30', '--quality', 'delivery', '--video-frame-format', 'png', '--quiet'], {
    cwd: HERE,
    stdio: 'inherit',
  })
  // Whatever the renderer muxed, the portal wants no sound: the video stream alone, untouched.
  const out = join(ASSETS, `video-${format}-${width}x${height}.mp4`)
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-map', '0:v:0', '-c', 'copy', '-an', '-movflags', '+faststart', `${out}.tmp.mp4`])
  renameSync(`${out}.tmp.mp4`, out)
  console.log(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height', '-of', 'compact', out], { encoding: 'utf8' }))
}
