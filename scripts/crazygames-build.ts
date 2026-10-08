/**
 * Builds the CrazyGames version (crazygames/README.md): `vite build --mode
 * crazygames` into dist-crazygames/, its page renamed index.html at the root,
 * zipped into crazygames/lettre-minute-crazygames.zip, and its weight checked
 * against the portal's limits — 250 MB and 1,500 files in all, 50 MB until the
 * first gameplayStart (20 MB for the mobile home page).
 *
 *   npm run crazygames:build
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const OUT = 'dist-crazygames'
const ZIP = 'crazygames/lettre-minute-crazygames.zip'
const MB = 1024 * 1024
const LIMITS = { total: 250 * MB, files: 1500, initial: 50 * MB, mobileInitial: 20 * MB }
// A run deals five categories: the most the first gameplayStart can wait on.
const RUN_CATEGORIES = 5

const run = (command: string, args: string[]) => execFileSync(command, args, { stdio: 'inherit' })

run('npx', ['tsc', '-b'])
rmSync(OUT, { recursive: true, force: true })
run('npx', ['vite', 'build', '--mode', 'crazygames'])
renameSync(join(OUT, 'crazygames.html'), join(OUT, 'index.html'))

function filesUnder(dir: string): { path: string; size: number }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [{ path, size: statSync(path).size }]
  })
}

const files = filesUnder(OUT)
const total = files.reduce((sum, file) => sum + file.size, 0)

// The dictionaries are their own chunks, named after their category: they
// are fetched when a run deals them, never at launch.
const languages = readdirSync('src/data/words').filter((lang) => statSync(join('src/data/words', lang)).isDirectory())
const categoryIds = new Set(languages.flatMap((lang) => readdirSync(join('src/data/words', lang)).map((name) => name.replace(/\.json$/, ''))))
const isDictionary = (path: string) => categoryIds.has(path.split('/').pop()!.replace(/-[\w-]{8}\.js$/, ''))
const dictionaries = files.filter((file) => isDictionary(file.path))
const shell = total - dictionaries.reduce((sum, file) => sum + file.size, 0)
const heaviestRun = dictionaries
  .map((file) => file.size)
  .sort((one, other) => other - one)
  .slice(0, RUN_CATEGORIES)
  .reduce((sum, size) => sum + size, 0)
const initial = shell + heaviestRun

rmSync(ZIP, { force: true })
execFileSync('zip', ['-q', '-r', '-X', join('..', ZIP), '.'], { cwd: OUT, stdio: 'inherit' })

const mb = (bytes: number) => `${(bytes / MB).toFixed(2)} MB`
const check = (label: string, value: number, limit: number, show: (n: number) => string = mb) =>
  console.log(`${value <= limit ? 'ok  ' : 'OVER'} ${label}: ${show(value)} (limit ${show(limit)})`)

console.log('')
check('files', files.length, LIMITS.files, String)
check('total', total, LIMITS.total)
console.log(`     code, styles, fonts (everything but dictionaries): ${mb(shell)}`)
check('initial download, worst case (all code + five heaviest dictionaries)', initial, LIMITS.initial)
check('initial download for the mobile home page', initial, LIMITS.mobileInitial)
console.log(`     zip: ${ZIP}, ${existsSync(ZIP) ? mb(statSync(ZIP).size) : 'missing'}`)
if (files.length > LIMITS.files || total > LIMITS.total || initial > LIMITS.initial) process.exit(1)
