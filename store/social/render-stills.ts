// Renders the kit's stills from post.html in headless Chrome:
// .cache/social-kit/kit/<lang>/image-<format>-<n>.png — the title (0) and the
// six captioned shots in square, feed, story and landscape, plus the profile
// banner. The shots are the raw captures of store/android/screenshots/<lang>/:
// redo them first (scripts/render-screenshots.ts) when the screens change —
// all but the run and the scoring screen, which come from the run capture.ts
// filmed: the raw ones of the six languages other than French are an empty run
// and a zero score.
//
//   node store/social/render-stills.ts [lang…]
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import './copy.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const COPY = (globalThis as any).COPY as Record<string, unknown>
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9393
const FORMATS: [format: string, width: number, height: number, shots: number[]][] = [
  ['square', 1080, 1080, [0, 1, 2, 3, 4, 5, 6]],
  ['feed', 1080, 1350, [0, 1, 2, 3, 4, 5, 6]],
  ['story', 1080, 1920, [0, 1, 2, 3, 4, 5, 6]],
  ['landscape', 1920, 1080, [0, 1, 2, 3, 4, 5, 6]],
  ['banner', 1500, 500, [0]],
]
const langs = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(COPY)
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-crash-reporter', '--allow-file-access-from-files',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(ROOT, '.cache/social-chrome-stills')}`, '--hide-scrollbars', '--no-first-run',
])
await sleep(2000)
try {
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((done) => socket.addEventListener('open', done))
  let next = 1
  const pending = new Map<number, (value: any) => void>()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data))
    if (message.id && pending.has(message.id)) pending.get(message.id)!(message.result)
  })
  const send = (method: string, params: object = {}): Promise<any> => new Promise((done) => {
    const id = next++
    pending.set(id, done)
    socket.send(JSON.stringify({ id, method, params }))
  })
  await send('Page.enable')
  const page = pathToFileURL(join(HERE, 'post.html')).href
  for (const lang of langs) {
    const work = join(ROOT, '.cache/social-kit/work', lang)
    const marks = JSON.parse(readFileSync(join(work, 'marks.json'), 'utf8'))
    // The second word typed in full, just before Enter; the score, its words up.
    for (const [file, at] of [['partie.png', marks.word2 - 0.3], ['bilan.png', marks.timeUp + 4]] as const) {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(at), '-i', join(work, 'gameplay.mp4'), '-frames:v', '1', join(work, file)])
    }
    for (const [format, width, height, shots] of FORMATS) {
      const out = join(ROOT, '.cache/social-kit/kit', lang)
      mkdirSync(out, { recursive: true })
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
      for (const n of shots) {
        await send('Page.navigate', { url: `${page}?lang=${lang}&format=${format}&n=${n}` })
        await sleep(300)
        // Every capture decoded and the font in, or the phone comes out blank.
        await send('Runtime.evaluate', {
          expression: 'Promise.all([...document.images].map((image) => image.decode().catch(() => {}))).then(() => document.fonts.ready).then(() => new Promise((done) => setTimeout(done, 150)))',
          awaitPromise: true,
        })
        const { data } = await send('Page.captureScreenshot', { format: 'png' })
        writeFileSync(join(out, `image-${format}-${n}.png`), Buffer.from(data, 'base64'))
      }
    }
    console.log(`${lang}: stills done`)
  }
} finally {
  chrome.kill()
}
