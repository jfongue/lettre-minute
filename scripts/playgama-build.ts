/**
 * Builds the Playgama version (playgama/README.md): `vite build --mode
 * playgama` into dist-playgama/, its page renamed index.html at the root next
 * to the Bridge and its config, zipped into playgama/lettre-minute-playgama.zip,
 * and checked against Playgama's rules — 300 MB in all, Latin file names only,
 * nothing fetched from outside the archive but the game's server.
 *
 *   npm run playgama:build
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { loadEnv } from 'vite'

const OUT = 'dist-playgama'
const ZIP = 'playgama/lettre-minute-playgama.zip'
const MB = 1024 * 1024
const LIMIT = 300 * MB

// Les classements viennent du serveur : sans lui le build part avec un
// classement vide. Un dossier de travail d'agent n'a pas toujours de
// .env.local (CLAUDE.md) : on échoue ici plutôt que de livrer sans serveur.
const env = loadEnv('playgama', process.cwd(), '')
const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((name) => !(env[name] || process.env[name]))
if (missing.length > 0) {
  console.error(`Build Playgama sans serveur : ${missing.join(', ')} manque.`)
  console.error('Copier .env.local dans ce dossier de travail (CLAUDE.md) avant de construire.')
  process.exit(1)
}

const run = (command: string, args: string[]) => execFileSync(command, args, { stdio: 'inherit' })

run('npx', ['tsc', '-b'])
rmSync(OUT, { recursive: true, force: true })
run('npx', ['vite', 'build', '--mode', 'playgama'])
renameSync(join(OUT, 'playgama.html'), join(OUT, 'index.html'))

function filesUnder(dir: string): { path: string; size: number }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [{ path, size: statSync(path).size }]
  })
}

const files = filesUnder(OUT)
const total = files.reduce((sum, file) => sum + file.size, 0)
const problems: string[] = []
if (total > LIMIT) problems.push(`total ${(total / MB).toFixed(2)} MB over 300 MB`)
for (const file of files) {
  if (!/^[\x20-\x7e]+$/.test(relative(OUT, file.path))) problems.push(`non-Latin file name: ${file.path}`)
}
for (const needed of ['index.html', 'playgama-bridge.js', 'playgama-bridge-config.json']) {
  if (!existsSync(join(OUT, needed))) problems.push(`missing at the root: ${needed}`)
}
// The Bridge must be the page's first script, loaded as a plain tag.
const page = readFileSync(join(OUT, 'index.html'), 'utf8')
const firstScript = /<script[^>]*>/.exec(page)?.[0] ?? ''
if (!/src="\.\/playgama-bridge\.js"/.test(firstScript) || /async|defer|type="module"/.test(firstScript)) {
  problems.push(`the Bridge is not the page's first plain script: ${firstScript}`)
}
// Nothing from outside the archive: the server's own calls aside, no script,
// style or font may name another host.
for (const file of files.filter((one) => /\.(html|css)$/.test(one.path))) {
  const outside = readFileSync(file.path, 'utf8').match(/(?:src|href)="https?:\/\/[^"]+"|url\(["']?https?:\/\/[^)]+\)/g)
  if (outside) problems.push(`${file.path} loads from outside: ${outside.join(', ')}`)
}

rmSync(ZIP, { force: true })
execFileSync('zip', ['-q', '-r', '-X', join('..', ZIP), '.'], { cwd: OUT, stdio: 'inherit' })

console.log('')
console.log(`${total <= LIMIT ? 'ok  ' : 'OVER'} total: ${(total / MB).toFixed(2)} MB in ${files.length} files (limit 300 MB)`)
console.log(`     zip: ${ZIP}, ${existsSync(ZIP) ? `${(statSync(ZIP).size / MB).toFixed(2)} MB` : 'missing'}`)
for (const problem of problems) console.error(`FAIL ${problem}`)
if (problems.length > 0) process.exit(1)
