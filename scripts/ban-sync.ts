import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { bannedByLang, dampingFor, withoutBanned, type Decided, type Row } from './ban-words.ts'

/**
 * Le dictionnaire qui suit les bans, sans reconstruire les dictionnaires :
 * quelques lignes retirées des fichiers livrés, et les freins des couples
 * qu'ils vidaient. C'est le pendant léger de `npm run import:words`, fait pour
 * tourner tout seul (`.github/workflows/dictionary.yml`) — il ne lit ni le
 * Wiktionnaire ni Wikidata, donc il ne lui faut aucun cache.
 *
 * Ce qu'il ne fait pas : faire entrer un mot accepté, qui a besoin d'une ligne
 * complète (fréquence, visites, sitelinks) et donc d'un import entier.
 *
 * npm run ban:sync
 */
const WORDS = 'src/data/words'
const SNAPSHOT = 'scripts/banned-words.json'
const DAMPED = 'src/data/damped-words.ts'
const CATEGORIES = ['fr', 'de', 'en', 'es', 'it', 'nl', 'pt']

/** Les décisions réglées, par l'API quand un service key est là, par le CLI sinon. */
function decided(): Decided[] {
  const key = process.env.SUPABASE_SERVICE_KEY
  const url = process.env.SUPABASE_URL
  if (key && url) {
    const response = execFileSync(
      'curl',
      [
        '-sS', '-f',
        `${url}/rest/v1/word_reviews?status=eq.accepted&select=category_id,word,kind,decided_at,created_at`,
        '-H', `apikey: ${key}`,
        '-H', `Authorization: Bearer ${key}`,
      ],
      { encoding: 'utf8', timeout: 60_000 },
    )
    return JSON.parse(response) as Decided[]
  }
  const output = execFileSync(
    'supabase',
    [
      'db', 'query', '--linked', '-o', 'json',
      "select category_id, word, kind, decided_at, created_at from public.word_reviews where status = 'accepted'",
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000 },
  )
  const parsed = JSON.parse(output) as Decided[] | { rows: Decided[] }
  return Array.isArray(parsed) ? parsed : parsed.rows
}

const write = (path: string, text: string) => writeFileSync(path, text)

async function main(): Promise<void> {
  const bans = bannedByLang(decided())

  // L'instantané que relit un import sans accès au projet.
  const snapshot: Record<string, Record<string, string[]>> = {}
  for (const [lang, categories] of bans) snapshot[lang] = Object.fromEntries(categories)
  write(SNAPSHOT, `${JSON.stringify(snapshot, null, 2)}\n`)

  const damped: Record<string, Record<string, number>> = {}
  let removed = 0
  for (const lang of CATEGORIES) {
    const categories = bans.get(lang)
    for (const file of readdirSync(`${WORDS}/${lang}`)) {
      const id = file.replace(/\.json$/, '')
      const path = `${WORDS}/${lang}/${file}`
      const rows = JSON.parse(readFileSync(path, 'utf8')) as Row[]
      const banned = new Set(categories?.get(id) ?? [])
      const kept = banned.size > 0 ? withoutBanned(rows, banned) : rows
      const factors = banned.size > 0 ? dampingFor(rows, banned) : {}
      if (Object.keys(factors).length > 0) {
        damped[lang] = { ...(damped[lang] ?? {}) }
        for (const [letter, factor] of Object.entries(factors)) {
          damped[lang]![`${id}:${letter}`] = factor
        }
      }
      if (kept.length === rows.length) continue
      removed += rows.length - kept.length
      // Une ligne par mot, comme l'import : un dictionnaire se relit ligne à ligne.
      write(path, `[\n${kept.map((row) => JSON.stringify(row)).join(',\n')}\n]\n`)
      console.log(`→ ${lang}/${id} : ${rows.length - kept.length} mot(s) retiré(s), ${kept.length} restants`)
    }
  }

  write(
    DAMPED,
    `/**
 * Écrit par \`npm run ban:sync\` : les couples lettre + catégorie qu'un ban a
 * vidés à moitié, leur cote multipliée d'autant. Le tirage ne les juge que par
 * le nombre de mots qui leur restent (\`run.ts\`), ce qui ne suffit pas quand une
 * catégorie perd la moitié de ce qu'on pouvait écrire. Parties seules, comme
 * \`DAMPED_PROMPTS\` : un défi ne tire que selon la graine et ses dictionnaires.
 */
export const DAMPED_WORDS: Readonly<Record<string, Readonly<Record<string, number>>>> = ${JSON.stringify(damped, null, 2)}
`,
  )
  console.log(`→ ${Object.values(damped).reduce((total, pairs) => total + Object.keys(pairs).length, 0)} couple(s) freiné(s), ${removed} mot(s) retiré(s)`)
}

await main()
