import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

/**
 * The owner's dashboard, as one JSON document: `analytics_snapshot` (0029)
 * computes it on the server, read here as the project's owner through the
 * linked CLI — no key to copy, and no player can call it from the app. The
 * file lands in `.cache/analytics.json`, from where the dashboard artifact is
 * fed. `npm run analytics -- 60` widens the window to sixty days.
 */
const days = Number(process.argv[2] ?? 30)
const output = execFileSync(
  'supabase',
  ['db', 'query', '--linked', '-o', 'json', `select public.analytics_snapshot(${Math.floor(days)}) as snapshot`],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], timeout: 180_000 },
)
const { rows } = JSON.parse(output) as { rows: { snapshot: unknown }[] }
mkdirSync('.cache', { recursive: true })
writeFileSync('.cache/analytics.json', JSON.stringify(rows[0]?.snapshot ?? null))
console.log(`.cache/analytics.json — ${days} jours`)
