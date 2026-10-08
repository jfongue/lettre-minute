/**
 * The end of `npm run check`: every version builds from the shared screens
 * (CLAUDE.md, « Plateformes »), so a change that breaks one shows before the
 * commit, not at its release. Builds the app (Android and web) and the
 * CrazyGames version into .cache/check/, checks that neither carries the
 * other's host, then type-checks and builds the Reddit daily. Each build takes
 * a second or two and needs no network.
 *
 *   npm run check:platforms
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = '.cache/check'
const run = (command: string, args: string[]) => execFileSync(command, args, { stdio: 'inherit' })

function scripts(dir: string): string {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => readFileSync(join(entry.parentPath, entry.name), 'utf8'))
    .join('\n')
}

let failed = false
function refuse(label: string, bundle: string, marker: string): void {
  if (!bundle.includes(marker)) return
  console.error(`${label} carries « ${marker} »: another host's code reached its bundle (src/platform/index.ts).`)
  failed = true
}

const build = (mode: string | null, outDir: string) =>
  run('npx', ['vite', 'build', ...(mode ? ['--mode', mode] : []), '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'])

build(null, join(OUT, 'app'))
build('crazygames', join(OUT, 'crazygames'))
refuse('The Android and web build', scripts(join(OUT, 'app')), 'sdk.crazygames.com')
refuse('The CrazyGames build', scripts(join(OUT, 'crazygames')), 'keepsProgress:!1')

if (!existsSync('reddit/node_modules')) {
  console.error('reddit/node_modules is missing: npm --prefix reddit ci (or link the main checkout’s).')
  process.exit(1)
}
run('npm', ['--prefix', 'reddit', '--silent', 'run', 'check'])

if (failed) process.exit(1)
console.log('ok   app, CrazyGames and Reddit builds')
