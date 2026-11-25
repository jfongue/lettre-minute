/**
 * The end of `npm run check`: every version builds from the shared screens
 * (CLAUDE.md, « Plateformes »), so a change that breaks one shows before the
 * commit, not at its release. Builds the app (Android and web), the
 * CrazyGames, Playgama and Y8 versions into .cache/check/, checks that none
 * carries another's host, then type-checks and builds the Reddit daily. Each build takes
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
build('playgama', join(OUT, 'playgama'))
build('y8', join(OUT, 'y8'))
const app = scripts(join(OUT, 'app'))
const crazyGames = scripts(join(OUT, 'crazygames'))
const playgama = scripts(join(OUT, 'playgama/assets'))
const y8 = scripts(join(OUT, 'y8'))
refuse('The Android and web build', app, 'sdk.crazygames.com')
refuse('The Android and web build', app, 'interstitial_state_changed')
refuse('The Android and web build', app, 'cdn.y8.com')
refuse('The CrazyGames build', crazyGames, 'keepsProgress:!1')
refuse('The CrazyGames build', crazyGames, 'interstitial_state_changed')
refuse('The CrazyGames build', crazyGames, 'cdn.y8.com')
refuse('The Playgama build', playgama, 'sdk.crazygames.com')
refuse('The Playgama build', playgama, 'keepsProgress:!1')
refuse('The Playgama build', playgama, 'cdn.y8.com')
refuse('The Y8 build', y8, 'sdk.crazygames.com')
refuse('The Y8 build', y8, 'interstitial_state_changed')

if (!existsSync('reddit/node_modules')) {
  console.error('reddit/node_modules is missing: npm --prefix reddit ci (or link the main checkout’s).')
  process.exit(1)
}
run('npm', ['--prefix', 'reddit', '--silent', 'run', 'check'])

if (failed) process.exit(1)
console.log('ok   app, CrazyGames, Playgama, Y8 and Reddit builds')
