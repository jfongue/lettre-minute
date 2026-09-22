/**
 * Rebuilds the word lists under src/data/words from Wikidata, with a corpus
 * frequency attached to every word that a French dictionary knows.
 *
 *   node --experimental-strip-types scripts/import-words.ts [pullId…]
 *
 * The pull results are cached under .cache/pulls so a failed run — the taxon
 * queries are slow and time out often — resumes instead of starting over.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { normalizeWord } from '../src/domain/text.ts'
import { CATEGORY_SOURCES, PULLS, queryFor, type Pull } from './sources.ts'

const ENDPOINT = 'https://query.wikidata.org/sparql'
const AGENT = 'LettrineWordImport/0.1 (https://github.com/jfongue; jeremy@enaos.com)'
const CACHE = '.cache/pulls'
const OUT = 'src/data/words'
const LEXIQUE_URL = 'http://www.lexique.org/databases/Lexique383/Lexique383.tsv'
const LEXIQUE_CACHE = '.cache/lexique383.tsv'

interface Row {
  display: string
  sitelinks: number
  /** Aliases get an extra cleanup pass: only they carry articles. */
  alias?: boolean
}

/**
 * Minimal RFC 4180 reader — enough for the two-column answers the endpoint
 * returns, quotes and embedded separators included.
 */
function parseCsv(body: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < body.length; i++) {
    const char = body[i]!
    if (quoted) {
      if (char !== '"') field += char
      else if (body[i + 1] === '"') {
        field += '"'
        i++
      } else quoted = false
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''))
      rows.push(row)
      row = []
      field = ''
    } else field += char
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

async function sparql(query: string, attempt = 1): Promise<Row[]> {
  // The JSON answer to the largest taxon queries comes back truncated at a
  // megabyte, every time. CSV says the same thing in half the bytes, so the
  // last attempt asks for that instead of failing the pull.
  const asCsv = attempt >= 3
  try {
    const response = await fetch(`${ENDPOINT}?query=${encodeURIComponent(query)}`, {
      headers: {
        Accept: asCsv ? 'text/csv' : 'application/sparql-results+json',
        'User-Agent': AGENT,
      },
      signal: AbortSignal.timeout(180_000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    if (asCsv) {
      const table = parseCsv(await response.text())
      const header = table[0] ?? []
      const labelAt = header.indexOf('label')
      const aliasAt = header.indexOf('alias')
      const countAt = header.indexOf('n')
      const rows: Row[] = []
      for (const line of table.slice(1)) {
        const sitelinks = Number(line[countAt] ?? 0) || 0
        if (labelAt >= 0 && line[labelAt]) rows.push({ display: line[labelAt]!, sitelinks })
        if (aliasAt >= 0 && line[aliasAt]) rows.push({ display: line[aliasAt]!, sitelinks, alias: true })
      }
      return rows
    }

    // A few Wikidata labels carry raw control characters, which JSON.parse
    // refuses inside a string literal. Turning every control character into a
    // space keeps the document structurally identical and the labels readable.
    // oxlint-disable-next-line no-control-regex -- that is precisely the point
    const body = (await response.text()).replace(/[\u0000-\u001f]/g, ' ')
    const payload = JSON.parse(body) as {
      results: { bindings: Record<string, { value: string }>[] }
    }
    const rows: Row[] = []
    for (const binding of payload.results.bindings) {
      const sitelinks = Number(binding.n?.value ?? 0)
      for (const key of ['label', 'alias'] as const) {
        const value = binding[key]?.value
        if (value) rows.push({ display: value, sitelinks, alias: key === 'alias' })
      }
    }
    return rows
  } catch (error) {
    if (attempt >= 4) throw error
    console.warn(`  retry ${attempt} — ${(error as Error).message}`)
    await new Promise((resolve) => setTimeout(resolve, 10_000 * attempt))
    return sparql(query, attempt + 1)
  }
}

async function pullRows(pull: Pull, force: boolean): Promise<Row[]> {
  const path = `${CACHE}/${pull.id}.json`
  if (!force && existsSync(path)) {
    const cached = JSON.parse(readFileSync(path, 'utf8')) as Row[]
    console.log(`· ${pull.id}: ${cached.length} lignes (cache)`)
    return cached
  }

  const started = Date.now()
  const rows = await sparql(queryFor(pull))
  writeFileSync(path, JSON.stringify(rows))
  console.log(`· ${pull.id}: ${rows.length} lignes en ${Math.round((Date.now() - started) / 1000)} s`)
  return rows
}

/** Lexique 3.83, kept only as "normalized form → occurrences per million in books". */
async function lexiqueFrequencies(): Promise<Map<string, number>> {
  if (!existsSync(LEXIQUE_CACHE)) {
    console.log('· lexique: téléchargement')
    const response = await fetch(LEXIQUE_URL, { signal: AbortSignal.timeout(180_000) })
    if (!response.ok) throw new Error(`lexique: HTTP ${response.status}`)
    writeFileSync(LEXIQUE_CACHE, Buffer.from(await response.arrayBuffer()))
  }

  const lines = readFileSync(LEXIQUE_CACHE, 'utf8').split('\n')
  const header = lines[0]!.split('\t')
  const orthoAt = header.indexOf('ortho')
  const freqAt = header.indexOf('freqlivres')
  if (orthoAt < 0 || freqAt < 0) throw new Error('lexique: colonnes ortho/freqlivres introuvables')

  const frequencies = new Map<string, number>()
  for (const line of lines.slice(1)) {
    const columns = line.split('\t')
    const word = normalizeWord(columns[orthoAt] ?? '')
    const frequency = Number(columns[freqAt] ?? 0)
    if (word === '' || !Number.isFinite(frequency)) continue
    frequencies.set(word, Math.max(frequencies.get(word) ?? 0, frequency))
  }
  console.log(`· lexique: ${frequencies.size} formes`)
  return frequencies
}

/**
 * Wikidata labels carry disambiguations, catalogue numbers and stray plurals.
 * Anything a player could not type in a hurry is dropped rather than kept as a
 * word that would only ever be refused.
 */
function acceptable(display: string): boolean {
  if (display.length < 2 || display.length > 28) return false
  if (/[0-9(),:;"«»/\\[\]]/.test(display)) return false
  if (/\b(?:sp|ssp|var|cf)\./.test(display)) return false
  return /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' -]*$/.test(display)
}

function main(argv: readonly string[]) {
  mkdirSync(CACHE, { recursive: true })
  mkdirSync(OUT, { recursive: true })

  const only = new Set(argv)
  const force = only.has('--force')
  const wanted = PULLS.filter((pull) => only.size === 0 || force || only.has(pull.id))

  return (async () => {
    const frequencies = await lexiqueFrequencies()
    const byPull = new Map<string, Row[]>()
    const failed: string[] = []
    for (const pull of wanted) {
      try {
        byPull.set(pull.id, await pullRows(pull, force && only.has(pull.id)))
      } catch (error) {
        // One dead query must not cost the whole import: the categories built
        // from it keep the file they already have on disk.
        failed.push(pull.id)
        console.warn(`! ${pull.id}: abandonné — ${(error as Error).message}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 3_000))
    }

    for (const source of CATEGORY_SOURCES) {
      // A category is a union: it is worth rebuilding from the pulls that
      // answered, as long as one did. Rebuilding from none would empty it.
      const sources = source.pulls.filter((id) => byPull.has(id))
      if (sources.length === 0) {
        console.warn(`~ ${source.id}: inchangé (aucune source)`)
        continue
      }
      if (sources.length < source.pulls.length) {
        console.warn(`~ ${source.id}: partiel (${sources.length}/${source.pulls.length} sources)`)
      }

      // One entry per normalized word: the shortest spelling wins, and a word
      // found in several pulls keeps its best notoriety.
      const best = new Map<string, { display: string; sitelinks: number }>()
      for (const id of sources) {
        for (const row of byPull.get(id)!) {
          // "le Canada" is a real French alias, but keeping it would let the
          // player answer a country on the letter L. Only aliases are stripped:
          // in a label the article belongs to the name ("Le Havre").
          const cleaned = (row.alias ? row.display.replace(/^(?:[Ll]es?|[Ll]a|[Ll]') ?/, '') : row.display)
            .trim()
            .replace(/\s+/g, ' ')

          // Wikidata writes an occupation as "boulanger ou boulangère". Both
          // forms are words a player may type, so both are kept.
          for (const display of cleaned.split(/ ou /)) {
            if (!acceptable(display)) continue
            const key = normalizeWord(display)
            if (key === '') continue
            const current = best.get(key)
            if (!current) best.set(key, { display, sitelinks: row.sitelinks })
            else {
              current.sitelinks = Math.max(current.sitelinks, row.sitelinks)
              if (display.length < current.display.length) current.display = display
            }
          }
        }
      }

      const lines = [...best.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => {
          const frequency = frequencies.get(key) ?? 0
          return `${entry.display}|${entry.sitelinks}|${frequency.toFixed(2)}`
        })

      writeFileSync(`${OUT}/${source.id}.txt`, `${lines.join('\n')}\n`)
      console.log(`→ ${source.id}: ${lines.length} mots`)
    }
    if (failed.length > 0) console.warn(`! sources en échec : ${failed.join(', ')}`)
  })()
}

await main(process.argv.slice(2))
