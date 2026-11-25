/**
 * Builds the Y8 version (y8/README.md): `vite build --mode y8` into dist-y8/,
 * its page renamed index.html at the root, zipped into y8/lettre-minute-y8.zip.
 * Y8 documents no size limit; the weight is printed for the record.
 *
 *   npm run y8:build
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { loadEnv } from 'vite'

const OUT = 'dist-y8'
const ZIP = 'y8/lettre-minute-y8.zip'
const MB = 1024 * 1024

// Comme pour CrazyGames : sans serveur, les classements partent vides. Un
// dossier de travail d'agent n'a pas de .env.local (CLAUDE.md).
const env = loadEnv('y8', process.cwd(), '')
const read = (name: string) => env[name] || process.env[name]
const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((name) => !read(name))
if (missing.length > 0) {
  console.error(`Build Y8 sans serveur : ${missing.join(', ')} manque. Copier .env.local dans ce dossier de travail.`)
  process.exit(1)
}
// Sans les identifiants du Developer Portal, le jeu part sans SDK : ni pub, ni
// sauvegarde Y8. Utile pour un premier essai, pas pour la revue.
for (const name of ['VITE_Y8_APP_ID', 'VITE_Y8_GAME_ID']) {
  if (!read(name)) console.warn(`attention : ${name} manque, le build Y8 part sans SDK (y8/README.md).`)
}

const run = (command: string, args: string[]) => execFileSync(command, args, { stdio: 'inherit' })

run('npx', ['tsc', '-b'])
rmSync(OUT, { recursive: true, force: true })
run('npx', ['vite', 'build', '--mode', 'y8'])
renameSync(join(OUT, 'y8.html'), join(OUT, 'index.html'))

function filesUnder(dir: string): { path: string; size: number }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [{ path, size: statSync(path).size }]
  })
}

const files = filesUnder(OUT)
const total = files.reduce((sum, file) => sum + file.size, 0)
rmSync(ZIP, { force: true })
execFileSync('zip', ['-q', '-r', '-X', join('..', ZIP), '.'], { cwd: OUT, stdio: 'inherit' })
console.log(`\n${files.length} files, ${(total / MB).toFixed(2)} MB; zip: ${ZIP}, ${(statSync(ZIP).size / MB).toFixed(2)} MB`)
