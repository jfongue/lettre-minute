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
const WIKT_CACHE = '.cache/wiktionary'
const WIKTIONARY_API = 'https://fr.wiktionary.org/w/api.php'
const OUT = 'src/data/words'
const LEXIQUE_URL = 'http://www.lexique.org/databases/Lexique383/Lexique383.tsv'
const LEXIQUE_CACHE = '.cache/lexique383.tsv'

/**
 * Wiktionary is where the everyday French words live: Wikidata knows fifty
 * breeds of cat but not "abeille", and a category of common nouns built on it
 * alone leaves the obvious answers out.
 */
const WIKTIONARY: Record<string, readonly string[]> = {
  couleurs: ['Couleurs en français'],
  'fruits-legumes': ['Fruits en français', 'Légumes en français'],
  animaux: [
    'Animaux en français',
    'Mammifères en français',
    'Oiseaux en français',
    'Poissons en français',
    'Insectes en français',
    'Reptiles en français',
    'Amphibiens en français',
    'Mollusques en français',
    'Crustacés en français',
    'Arachnides en français',
  ],
  oiseaux: ['Oiseaux en français'],
  poissons: ['Poissons en français'],
  insectes: ['Insectes en français'],
  metiers: ['Métiers en français'],
  sports: ['Sports en français'],
  instruments: ['Instruments de musique en français'],
  'elements-chimiques': ['Éléments chimiques en français'],
}

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

async function wiktionaryWords(title: string, force: boolean): Promise<string[]> {
  const path = `${WIKT_CACHE}/${title.replace(/[^a-zA-Z0-9]+/g, '-')}.json`
  if (!force && existsSync(path)) {
    return JSON.parse(readFileSync(path, 'utf8')) as string[]
  }

  const words: string[] = []
  let cursor: string | null = null
  // The API caps a listing at 500 entries; a category of several thousand words
  // is walked page by page.
  do {
    const url = new URL(WIKTIONARY_API)
    url.searchParams.set('action', 'query')
    url.searchParams.set('list', 'categorymembers')
    url.searchParams.set('cmtitle', `Catégorie:${title}`)
    url.searchParams.set('cmlimit', '500')
    url.searchParams.set('cmnamespace', '0')
    url.searchParams.set('format', 'json')
    if (cursor) url.searchParams.set('cmcontinue', cursor)

    const response = await fetch(url, {
      headers: { 'User-Agent': AGENT },
      signal: AbortSignal.timeout(60_000),
    })
    if (!response.ok) throw new Error(`wiktionnaire ${title}: HTTP ${response.status}`)

    const payload = (await response.json()) as {
      query?: { categorymembers?: { title: string }[] }
      continue?: { cmcontinue?: string }
    }
    for (const member of payload.query?.categorymembers ?? []) words.push(member.title)
    cursor = payload.continue?.cmcontinue ?? null
  } while (cursor && words.length < 20_000)

  writeFileSync(path, JSON.stringify(words))
  console.log(`· wiktionnaire ${title}: ${words.length} mots`)
  return words
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

interface Lexique {
  /** Normalized form → occurrences per million in books. */
  frequency: Map<string, number>
  /** Normalized form → the lemma it belongs to. */
  lemmaOf: Map<string, string>
  /** Normalized lemma → every noun and adjective form, in their own spelling. */
  formsOf: Map<string, string[]>
}

/**
 * Lexique 3.83 gives both how common a word is and how it bends. The game needs
 * the second as much as the first: a player who types "chats" or "bleue" has
 * answered, and only the inflected forms say so.
 */
async function loadLexique(): Promise<Lexique> {
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
  const lemmaAt = header.indexOf('lemme')
  const gramAt = header.indexOf('cgram')
  if (orthoAt < 0 || freqAt < 0 || lemmaAt < 0 || gramAt < 0) {
    throw new Error('lexique: colonnes ortho/freqlivres/lemme/cgram introuvables')
  }

  const frequency = new Map<string, number>()
  const lemmaOf = new Map<string, string>()
  const formsOf = new Map<string, string[]>()

  for (const line of lines.slice(1)) {
    const columns = line.split('\t')
    const spelling = (columns[orthoAt] ?? '').trim()
    const word = normalizeWord(spelling)
    const value = Number(columns[freqAt] ?? 0)
    if (word === '') continue
    if (Number.isFinite(value)) frequency.set(word, Math.max(frequency.get(word) ?? 0, value))

    // Verbs and function words would drag a category into forms nobody would
    // accept as an answer; a noun or an adjective is what a category holds.
    const gram = columns[gramAt] ?? ''
    if (gram !== 'NOM' && gram !== 'ADJ') continue

    const lemma = normalizeWord(columns[lemmaAt] ?? '')
    if (lemma === '') continue
    lemmaOf.set(word, lemma)
    const forms = formsOf.get(lemma) ?? []
    if (!forms.includes(spelling)) forms.push(spelling)
    formsOf.set(lemma, forms)
  }

  console.log(`· lexique: ${frequency.size} formes, ${formsOf.size} lemmes`)
  return { frequency, lemmaOf, formsOf }
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
  mkdirSync(WIKT_CACHE, { recursive: true })
  mkdirSync(OUT, { recursive: true })

  const only = new Set(argv)
  const force = only.has('--force')
  const wanted = PULLS.filter((pull) => only.size === 0 || force || only.has(pull.id))

  return (async () => {
    const lexique = await loadLexique()
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

      for (const title of WIKTIONARY[source.id] ?? []) {
        try {
          for (const word of await wiktionaryWords(title, false)) {
            const display = word.trim().replace(/\s+/g, ' ')
            if (!acceptable(display)) continue
            const key = normalizeWord(display)
            if (key === '' || best.has(key)) continue
            // No sitelinks: a Wiktionary word is rated on its corpus frequency
            // alone, which is exactly what a common noun has.
            best.set(key, { display, sitelinks: 0 })
          }
        } catch (error) {
          console.warn(`! wiktionnaire ${title}: ${(error as Error).message}`)
        }
      }

      // Every inflected form of an accepted word is accepted too, pointing back
      // at it: "chats" scores like "chat", and cannot be played twice in the
      // same run under two spellings.
      const rows = new Map<string, string>()
      for (const [key, entry] of best) {
        rows.set(key, `${entry.display}|${entry.sitelinks}|${(lexique.frequency.get(key) ?? 0).toFixed(2)}`)
      }

      let variants = 0
      for (const [key, entry] of best) {
        const lemma = lexique.lemmaOf.get(key)
        if (!lemma) continue
        for (const form of lexique.formsOf.get(lemma) ?? []) {
          const formKey = normalizeWord(form)
          if (formKey === '' || rows.has(formKey) || !acceptable(form)) continue
          const frequency = lexique.frequency.get(formKey) ?? 0
          rows.set(formKey, `${form}|${entry.sitelinks}|${frequency.toFixed(2)}|${key}`)
          variants++
        }
      }

      const lines = [...rows.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([, line]) => line)

      writeFileSync(`${OUT}/${source.id}.txt`, `${lines.join('\n')}\n`)
      console.log(`→ ${source.id}: ${lines.length} mots (dont ${variants} formes fléchies)`)
    }
    if (failed.length > 0) console.warn(`! sources en échec : ${failed.join(', ')}`)
  })()
}

await main(process.argv.slice(2))
