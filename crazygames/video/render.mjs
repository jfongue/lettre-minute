// Renders the two CrazyGames preview videos with HyperFrames, from the run
// capture.mjs recorded: crazygames/assets/video-landscape-1920x1080.mp4 and
// video-portrait-1080x1620.mp4 (the portal asks for 1080p at 16:9 and 2:3),
// 18 s, H.264, no audio track, the cover as first and last frame.
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

// The cuts: the run from just before its first prompt, the summary from just after the clock stops.
const marks = JSON.parse(readFileSync(join(HERE, 'capture/marks.json'), 'utf8'))
const template = readFileSync(join(HERE, 'template.html'), 'utf8')
for (const { format, width, height } of FORMATS) {
  const page = `${format}.html`
  writeFileSync(
    join(HERE, page),
    template
      .replaceAll('{{W}}', String(width))
      .replaceAll('{{H}}', String(height))
      .replaceAll('{{FORMAT}}', format)
      .replaceAll('{{RUN_FROM}}', String(Math.max(0, marks.run - 0.3).toFixed(2)))
      .replaceAll('{{SUMMARY_FROM}}', String((marks.timeUp + 3.2).toFixed(2))),
  )
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
