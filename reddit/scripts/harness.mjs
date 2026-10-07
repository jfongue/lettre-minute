// Serves the built client outside Reddit, for a look before a playtest:
// a fake post (`?lang=fr`, `?played`, `?out` for a logged-out reader) and a
// fake /api answering from memory. `devvit playtest` stays the real check.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../dist/client', import.meta.url))
const port = Number(process.env.PORT) || 5399
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.map': 'application/json' }

const mock = `<script>
(() => {
  const query = new URLSearchParams(location.search)
  const lang = query.get('lang') || 'en'
  const day = new Date().toISOString().slice(0, 10)
  const out = query.has('out')
  globalThis.devvit = { context: {
    postId: 't3_harness', subredditName: 'harness',
    userId: out ? undefined : 't2_me', username: out ? undefined : 'harness',
    postData: { day, lang, number: 7, categories: (query.get('cats') || 'pays,animaux,couleurs,fruits-legumes,metiers').split(',') },
  } }
  const top = [{ name: 'quiscale', score: 412 }, { name: 'pangolin', score: 288 }, { name: 'okapi', score: 97 }]
  let played = query.has('played') ? { score: 120, words: [], skips: 2, bestCombo: 3, rank: 2, total: 4, unique: [], streak: 3 } : null
  const json = (body) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
  const real = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const path = String(input)
    if (path === '/api/day') return json({ type: 'day', username: out ? null : 'harness', players: top.length, top, played })
    if (path === '/api/play') {
      const result = JSON.parse(init.body)
      const counted = !out && !played
      if (counted) { played = { ...result, rank: 1, total: 4, unique: [], streak: 4 }; top.unshift({ name: 'harness', score: result.score }) }
      const unique = result.words.filter((_, at) => at % 2 === 0).map((w) => w.categoryId + ':' + w.key)
      return json({ type: 'play', counted, top: top.slice(0, 10).sort((a, b) => b.score - a.score), players: top.length,
        standing: { rank: 1 + top.filter((row) => row.score > result.score).length, total: top.length, unique, streak: counted ? 4 : 0 } })
    }
    if (path === '/api/share') { console.log('[harness] shared:', JSON.parse(init.body).text); return json({ type: 'share', ok: true }) }
    return real(input, init)
  }
})()
</script>`

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const path = url.pathname === '/' ? '/game.html' : url.pathname
  const file = normalize(join(root, path))
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404).end('not found')
    return
  }
  response.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream')
  if (extname(file) === '.html') {
    response.end(readFileSync(file, 'utf8').replace('<head>', `<head>${mock}`))
    return
  }
  createReadStream(file).pipe(response)
}).listen(port, () => console.log(`harness on http://localhost:${port}/game.html and /splash.html`))
