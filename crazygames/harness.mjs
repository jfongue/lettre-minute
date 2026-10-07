// Serves dist-crazygames/ on localhost, where the CrazyGames SDK starts in its
// `local` mode (demo ads as an overlay text, console logging), and frames it the
// way the portal does: /  is the game alone, /frame.html the game in an iframe
// at the portal's sizes (?size=desktop|small|phone).
//
//   npm run crazygames:build && node crazygames/harness.mjs   (PORT, default 5747)
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../dist-crazygames/', import.meta.url))
const port = Number(process.env.PORT) || 5747
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}
const SIZES = { desktop: [1280, 720], small: [800, 450], phone: [375, 667] }

const frame = (size) => {
  const [width, height] = SIZES[size] ?? SIZES.desktop
  return `<!doctype html><meta charset="utf-8"><title>CrazyGames harness</title>
<style>body{margin:0;background:#202030;display:grid;place-items:center;min-height:100vh;font:14px system-ui;color:#ccc}
nav{position:fixed;top:8px;left:8px}a{color:#9cf;margin-right:12px}iframe{border:0;background:#000}</style>
<nav>${Object.keys(SIZES).map((name) => `<a href="?size=${name}">${name}</a>`).join('')}</nav>
<iframe src="/index.html" width="${width}" height="${height}" allow="autoplay; fullscreen"></iframe>`
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${port}`)
  if (url.pathname === '/frame.html') {
    response.writeHead(200, { 'content-type': TYPES['.html'] })
    response.end(frame(url.searchParams.get('size') ?? 'desktop'))
    return
  }
  const path = normalize(join(root, url.pathname === '/' ? 'index.html' : url.pathname))
  if (!path.startsWith(root) || !existsSync(path) || !statSync(path).isFile()) {
    response.writeHead(404)
    response.end('not found')
    return
  }
  response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' })
  createReadStream(path).pipe(response)
}).listen(port, () => console.log(`CrazyGames build on http://localhost:${port}/ — framed: http://localhost:${port}/frame.html`))
