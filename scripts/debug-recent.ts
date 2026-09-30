import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { join, normalize } from 'node:path'

/**
 * Writes the debug scenarios touched since the last delivered version — the
 * ones the board highlights in red, so a release is checked without
 * hunting for what it changed — and those the last delivered version did not
 * have at all, in blue: a new screen is checked whole, not for what moved.
 *
 *   npm run debug:recent
 *
 * Git is read here and nowhere else: the generated list is committed, so the
 * web build and the phone app carry the highlight without git, and it holds
 * until the next release regenerates it. Everything is read from HEAD — work
 * not committed is not delivered —, which also keeps the line numbers the
 * highlight relies on free of any uncommitted edit.
 */

const BOARD = 'src/debug/DebugBoard.tsx'
const OUT = 'src/debug/recent.ts'
/** Une planche change quand un écran change, jamais quand une règle du domaine change. */
const SCREENS = 'src/ui/'

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' })
const rows = (output: string) => output.split('\n').filter((line) => line !== '')

/** Les commits « Version X.Y.Z (versionCode N) » sont les livraisons du dépôt. */
function releases(): { sha: string; version: string }[] {
  const found: { sha: string; version: string }[] = []
  for (const row of rows(git('log', '--format=%H%x00%s'))) {
    const [sha, subject = ''] = row.split('\0')
    const match = /^Version (\d+\.\d+\.\d+)\b/.exec(subject)
    if (!match) continue
    found.push({ sha, version: match[1] })
    if (found.length === 1) break
  }
  return found
}

/** Les fichiers livrés depuis `base`. */
function changedFiles(base: string): Set<string> {
  return new Set(rows(git('diff', '--name-only', base, 'HEAD')))
}

/** Les lignes neuves de la planche depuis `base` : c'est là que git dit « changée ». */
function changedLines(base: string): Set<number> {
  const touched = new Set<number>()
  for (const row of rows(git('diff', '-U0', base, 'HEAD', '--', BOARD))) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(row)
    if (!hunk) continue
    // git compte à partir de 1, la source lue à partir de 0.
    const start = Number(hunk[1]) - 1
    const count = hunk[2] === undefined ? 1 : Number(hunk[2])
    for (let line = start; line < start + count; line++) touched.add(line)
  }
  return touched
}

// ------------------------------------------------------- la planche elle-même --

const source = git('show', `HEAD:${BOARD}`).split('\n')

/** Le module d'un import relatif, extension devinée : les imports du dépôt l'omettent. */
function resolve(specifier: string): string {
  const path = normalize(join('src/debug', specifier))
  for (const extension of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
    if (existsSync(path + extension)) return path + extension
  }
  return path
}

// Un type ne dessine rien : l'import qui ne porte que lui ne compte pas.
const imported = new Map<string, string>()
for (const line of source) {
  if (/^import\s+type\b/.test(line)) continue
  const named = /^import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'(\.[^']+)'/.exec(line)
  if (named) {
    for (const entry of named[1].split(',')) {
      const name = entry.replace(/^type\s+/, '').split(/\s+as\s+/).pop()?.trim()
      if (name) imported.set(name, resolve(named[2]))
    }
    continue
  }
  const single = /^import\s+([A-Za-z_$][\w$]*)\s+from\s+'(\.[^']+)'/.exec(line)
  if (single) imported.set(single[1], resolve(single[2]))
}

/** Le début d'un bloc : sa première ligne, le commentaire qui le présente compris. */
function head(index: number): number {
  let start = index
  while (start > 0 && /^\s*(\/\/|\/\*|\*|$)/.test(source[start - 1])) start--
  return start
}

/** Les déclarations du fichier : une planche peut montrer un rendu écrit plus haut. */
const declared = new Map<string, { start: number; end: number }>()
source.forEach((line, index) => {
  const declaration = /^(?:export\s+)?(?:function|const)\s+([A-Za-z_$][\w$]*)/.exec(line)
  if (!declaration) return
  const start = head(index)
  const previous = [...declared.values()].at(-1)
  if (previous) previous.end = start
  declared.set(declaration[1], { start, end: source.length })
})

const startOfScenarios = source.findIndex((line) => /^const SCENARIOS\b/.test(line))
/** Le `]` de fin du tableau SCENARIOS : la dernière planche s'arrête là. */
const endOfScenarios = source.findIndex((line, index) => line === ']' && index > startOfScenarios)

/** Chaque planche, de son `{` à celui de la suivante. */
const heads: { id: string; start: number }[] = []
source.forEach((line, index) => {
  // Seules les entrées du tableau SCENARIOS : les données inventées ont aussi des `id`.
  if (index <= startOfScenarios || index >= endOfScenarios) return
  const id = /^    id: '([\w-]+)',$/.exec(line)
  if (id) heads.push({ id: id[1], start: head(index - 1) })
})
const scenarios = heads.map((scenario, index) => ({
  ...scenario,
  end: heads[index + 1]?.start ?? endOfScenarios,
}))

/** Ce qu'une planche montre : les modules qu'elle nomme, et les rendus qu'elle appelle. */
function shown(start: number, end: number): { modules: Set<string>; renders: { start: number; end: number }[] } {
  const modules = new Set<string>()
  const renders: { start: number; end: number }[] = []
  const read = new Set<string>()
  let text = source.slice(start, end).join('\n')
  // Deux passes : un rendu cité par un rendu écrit plus haut (LeaderboardsScenario).
  for (let pass = 0; pass < 2; pass++) {
    for (const [name, module] of imported) {
      if (new RegExp(`\\b${name}\\b`).test(text)) modules.add(module)
    }
    for (const [name, range] of declared) {
      if (read.has(name) || !new RegExp(`\\b${name}\\b`).test(text)) continue
      read.add(name)
      renders.push(range)
      text += '\n' + source.slice(range.start, range.end).join('\n')
    }
  }
  return { modules, renders }
}

// ------------------------------------------------------------------ la liste --

const [last] = releases()
if (!last) {
  console.error('! aucun commit « Version X.Y.Z » : la liste précédente est laissée telle quelle')
  process.exit(1)
}

// La fenêtre part de la dernière livraison : ce qui a changé depuis est ce que la prochaine livrera.
const base = last.sha
const files = changedFiles(base)
const edited = changedLines(base)

/** Les identifiants de planche d'une version de la planche. */
function idsIn(text: string): Set<string> {
  const lines = text.split('\n')
  const from = lines.findIndex((line) => /^const SCENARIOS\b/.test(line))
  const to = lines.findIndex((line, index) => line === ']' && index > from)
  return new Set(lines.slice(from, to).flatMap((line) => /^    id: '([\w-]+)',$/.exec(line)?.[1] ?? []))
}
// Nouvelle : absente de la dernière version livrée. Une planche nouvelle n'est pas « touchée » en plus.
const shipped = idsIn(git('show', `${last.sha}:${BOARD}`))
const fresh = scenarios.map((scenario) => scenario.id).filter((id) => !shipped.has(id))

const recent: string[] = []
for (const scenario of scenarios) {
  if (!shipped.has(scenario.id)) continue
  const { modules, renders } = shown(scenario.start, scenario.end)
  const screen = [...modules].some((module) => module.startsWith(SCREENS) && files.has(module))
  // La planche change aussi quand le rendu qu'elle appelle change.
  const block = [...edited].some(
    (line) =>
      (line >= scenario.start && line < scenario.end) ||
      renders.some((range) => line >= range.start && line < range.end),
  )
  if (screen || block) recent.push(scenario.id)
}

const list = (values: readonly string[]) => values.map((value) => `'${value}'`).join(', ')
writeFileSync(
  OUT,
  `/*\n` +
    ` * Écrit par \`npm run debug:recent\` : les planches touchées depuis la dernière\n` +
    ` * version livrée (${last.version}). Le fichier est commité — la planche et le\n` +
    ` * build n'ont pas besoin de git — et se régénère avant de livrer.\n` +
    ` * NEW_SCENARIOS : les planches que la ${last.version} n'avait pas.\n` +
    ` */\n` +
    `export const RECENT_SCENARIOS: readonly string[] = [${list(recent)}]\n` +
    `export const NEW_SINCE = '${last.version}'\n` +
    `export const NEW_SCENARIOS: readonly string[] = [${list(fresh)}]\n`,
)

console.log(`→ ${recent.length} planche(s) touchée(s) depuis la ${last.version} : ${recent.join(', ') || '—'}`)
console.log(`→ ${fresh.length} planche(s) nouvelle(s) depuis la ${last.version} : ${fresh.join(', ') || '—'}`)
console.log(`  ${files.size} fichier(s) changé(s)`)
