/**
 * Rebuilds the word lists under src/data/words from Wikidata and the
 * Wiktionary, with how much each word is used in French today: its frequency
 * in wordfreq's corpora and the daily views of its French Wikipedia article.
 *
 *   node --experimental-strip-types scripts/import-words.ts [pullId…]
 *
 * The pull results are cached under .cache/pulls so a failed run — the taxon
 * queries are slow and time out often — resumes instead of starting over.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { normalizeWord } from '../src/domain/text.ts'
import type { WordRow } from '../src/domain/words.ts'
import { CATEGORY_SOURCES, PULLS, queryFor, type Pull } from './sources.ts'

const ENDPOINT = 'https://query.wikidata.org/sparql'
const AGENT = 'LettreMinuteWordImport/0.1 (https://github.com/jfongue; jeremy@enaos.com)'
const CACHE = '.cache/pulls'
const WIKT_CACHE = '.cache/wiktionary-tree'
const WIKT_PAGES_CACHE = '.cache/wiktionary-pages.json'
const WIKTIONARY_API = 'https://fr.wiktionary.org/w/api.php'
const OUT = 'src/data/words'
const LEXIQUE_URL = 'http://www.lexique.org/databases/Lexique383/Lexique383.tsv'
const LEXIQUE_CACHE = '.cache/lexique383.tsv'
const WORDFREQ_URL = 'https://raw.githubusercontent.com/rspeer/wordfreq/master/wordfreq/data/large_fr.msgpack.gz'
const WORDFREQ_CACHE = '.cache/wordfreq-large-fr.msgpack.gz'
const WIKIPEDIA_API = 'https://fr.wikipedia.org/w/api.php'
const ARTICLES_CACHE = '.cache/frwiki-articles-v2.json'
const CLASSES_CACHE = '.cache/frwiki-classes.json'
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php'
const CLICKSTREAM_URL = 'https://dumps.wikimedia.org/other/clickstream'

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

/**
 * Subcategories whose words are no answer to the category above them: pet
 * names and slang ("greffier", "le meilleur ami de l’homme"), imaginary beasts,
 * meats, criminals, military ranks, athletes by position ("attaquant",
 * "Bayern"), coat colours only horses have ("bai", "alezan"), religious orders
 * and the non-binary job neologisms nobody types in a hurry. The Légumineuses
 * are the botanical family — gorse, mimosa, wisteria — not pulses; the
 * chromatic fields file every word with a colour sense in a compound, so "eau",
 * "avocat" and "bouteille" would be colours.
 */
const WIKTIONARY_EXCLUDED = new Set([
  'Légumineuses en français',
  'Champs chromatiques en français',
  'Noms alternatifs des animaux en français',
  'Animaux imaginaires en français',
  'Viandes en français',
  'Criminels et délinquants en français',
  'Soldats en français',
  'Sportifs en français',
  'Ordres religieux en français',
  'Noms de métiers non-binaires en français',
  'Couleurs de robes de chevaux en français',
])

/** Taxon, monotypic taxon, organisms known by a particular common name. */
const LIVING_THINGS = new Set(['Q16521', 'Q310890', 'Q55983715'])

/**
 * The categories where a Wiktionary word filed for a later sense must have an
 * article about a thing of the category (`strayWords`). Colours are left out:
 * nearly all of them are a later sense of a fruit or a mineral, and rightly so.
 */
const SENSE_CHECKED: Record<string, ReadonlySet<string>> = {
  animaux: LIVING_THINGS,
  oiseaux: LIVING_THINGS,
  poissons: LIVING_THINGS,
  insectes: LIVING_THINGS,
  'fruits-legumes': LIVING_THINGS,
}

/** Fewer Wikipedias than this describe a thing only specialists look up. */
const NICHE_SITELINKS = 10

/**
 * As many Wikipedias as this describe a thing whose name is its main sense:
 * "rouge" the colour, "chat" the cat. The Wiktionary lists alone would miss
 * them — "Couleurs en français" files the basic colours in subcategories.
 */
const MAJOR_SITELINKS = 50

/**
 * The daily visits that weigh as much as a corpus frequency, on the two log
 * scales of `rawFame` in src/domain/words.ts: log10(1 + f) / 2.2 against
 * log10(1 + v) / 3.3.
 */
function visitsWorth(frequency: number): number {
  return (1 + frequency) ** 1.5 - 1
}

/** Two decimals are all the frequency scale can tell apart. */
function rounded(frequency: number): number {
  return Math.round(frequency * 100) / 100
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

interface WiktionaryCategory {
  words: string[]
  subcategories: string[]
}

async function wiktionaryCategory(title: string): Promise<WiktionaryCategory> {
  const path = `${WIKT_CACHE}/${encodeURIComponent(title)}.json`
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8')) as WiktionaryCategory

  const category: WiktionaryCategory = { words: [], subcategories: [] }
  let cursor: string | null = null
  // The API caps a listing at 500 entries; a category of several thousand words
  // is walked page by page.
  do {
    const url = new URL(WIKTIONARY_API)
    url.searchParams.set('action', 'query')
    url.searchParams.set('list', 'categorymembers')
    url.searchParams.set('cmtitle', `Catégorie:${title}`)
    url.searchParams.set('cmlimit', '500')
    url.searchParams.set('cmnamespace', '0|14')
    url.searchParams.set('format', 'json')
    if (cursor) url.searchParams.set('cmcontinue', cursor)

    const response = await wikimedia(url)
    if (!response.ok) throw new Error(`wiktionnaire ${title}: HTTP ${response.status}`)

    const payload = (await response.json()) as {
      query?: { categorymembers?: { ns: number; title: string }[] }
      continue?: { cmcontinue?: string }
    }
    for (const member of payload.query?.categorymembers ?? []) {
      if (member.ns === 0) category.words.push(member.title)
      else category.subcategories.push(member.title.replace(/^Catégorie:/, ''))
    }
    cursor = payload.continue?.cmcontinue ?? null
  } while (cursor && category.words.length < 20_000)

  writeFileSync(path, JSON.stringify(category))
  console.log(`· wiktionnaire ${title}: ${category.words.length} mots, ${category.subcategories.length} sous-catégories`)
  return category
}

/**
 * The Wiktionary files the everyday words deep in subcategories: "aigle" under
 * Aigles, under Rapaces, under Oiseaux — the top category holds only the words
 * no subcategory claims. The whole tree is walked, but only through topic
 * subcategories (named "… en français"): "Noms de métiers féminisés" leads on
 * to "Mots en français suffixés avec -ère", which is morphology, not jobs.
 *
 * Each category comes with its topic and those of its ancestors: a word filed
 * under Buses carries the {{oiseaux}} template, not a {{buses}} one.
 */
async function wiktionaryTree(roots: readonly string[]): Promise<Map<string, { words: string[]; topics: string[] }>> {
  const tree = new Map<string, { words: string[]; topics: string[] }>()
  const walk = async (title: string, parentTopics: readonly string[]) => {
    if (tree.has(title) || WIKTIONARY_EXCLUDED.has(title)) return
    const topics = [...parentTopics, title.replace(/ en français$/, '').toLowerCase()]
    const { words, subcategories } = await wiktionaryCategory(title)
    tree.set(title, { words, topics })
    for (const sub of subcategories) if (sub.endsWith(' en français')) await walk(sub, topics)
  }
  for (const root of roots) await walk(root, [])
  return tree
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

/**
 * Wikimedia answers a burst with 429 and says how long to back off. Honouring
 * it is cheaper than losing the lookups already made.
 */
async function wikimedia(url: URL | string, attempt = 1): Promise<Response> {
  const response = await fetch(url, { headers: { 'User-Agent': AGENT }, signal: AbortSignal.timeout(180_000) })
  if (response.ok || response.status === 404) return response
  if (attempt >= 6 || (response.status !== 429 && response.status < 500)) {
    throw new Error(`wikimedia: HTTP ${response.status} — ${url}`)
  }
  const wait = Number(response.headers.get('retry-after')) || 2 ** attempt
  await new Promise((resolve) => setTimeout(resolve, wait * 1_000))
  return wikimedia(url, attempt + 1)
}

/**
 * The French Wikipedia article each word lands on, redirects followed — null
 * when there is none, DISAMBIGUATION when it is a list of homonyms, which
 * says nothing of how known this one is. Asked fifty titles at a time, one
 * call after the other: the API throttles an anonymous client that hurries.
 */
const DISAMBIGUATION = '#homonymie'

async function frenchArticles(words: readonly string[]): Promise<Map<string, string | null>> {
  const cache = new Map<string, string | null>(
    existsSync(ARTICLES_CACHE) ? Object.entries(JSON.parse(readFileSync(ARTICLES_CACHE, 'utf8'))) : [],
  )
  const missing = [...new Set(words)].filter((word) => !cache.has(word))
  if (missing.length > 0) console.log(`· wikipédia: ${missing.length} titres à résoudre`)

  for (let start = 0; start < missing.length; start += 50) {
    const batch = missing.slice(start, start + 50)
    const url = new URL(WIKIPEDIA_API)
    url.searchParams.set('action', 'query')
    url.searchParams.set('redirects', '1')
    url.searchParams.set('prop', 'pageprops')
    url.searchParams.set('ppprop', 'disambiguation')
    url.searchParams.set('titles', batch.join('|'))
    url.searchParams.set('format', 'json')
    url.searchParams.set('formatversion', '2')
    const { query = {} } = (await (await wikimedia(url)).json()) as {
      query?: {
        normalized?: { from: string; to: string }[]
        redirects?: { from: string; to: string }[]
        pages?: { title: string; missing?: boolean; invalid?: boolean; pageprops?: { disambiguation?: string } }[]
      }
    }

    const titleOf = new Map(batch.map((word) => [word, word]))
    for (const step of [query.normalized ?? [], query.redirects ?? []]) {
      const to = new Map(step.map(({ from, to }) => [from, to]))
      for (const [word, title] of titleOf) titleOf.set(word, to.get(title) ?? title)
    }
    const pages = new Map((query.pages ?? []).filter((page) => !page.missing && !page.invalid).map((page) => [page.title, page]))
    for (const [word, title] of titleOf) {
      const page = pages.get(title)
      cache.set(word, !page ? null : page.pageprops?.disambiguation !== undefined ? DISAMBIGUATION : title)
    }

    if ((start / 50) % 40 === 39 || start + 50 >= missing.length) {
      writeFileSync(ARTICLES_CACHE, JSON.stringify(Object.fromEntries(cache)))
      console.log(`  ${Math.min(start + 50, missing.length)}/${missing.length}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  return cache
}

/**
 * Daily visits of every French Wikipedia article over the last published month,
 * read from the clickstream dump: one sixty-megabyte file where the pageviews
 * API would take one call per article, and throttle long before the end.
 * Sitelinks cannot say how well known a thing is — bots wrote an article in
 * forty languages for every bird species and every French commune, so "Aigle
 * martial" and "Abrest" counted as widely known. What French readers open
 * today tells them apart.
 *
 * The dump drops the links followed ten times or fewer in the month, so an
 * article almost nobody opens reads as zero, which is what it is.
 */
async function frenchVisits(): Promise<Map<string, number>> {
  const now = new Date()
  let body: Buffer | null = null
  let days = 30
  // A month's dump comes out in the first days of the next: when the last one
  // is not there yet, the one before it is.
  for (const back of [1, 2]) {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))
    const tag = month.toISOString().slice(0, 7)
    const path = `.cache/clickstream-frwiki-${tag}.tsv.gz`
    if (!existsSync(path)) {
      const response = await wikimedia(`${CLICKSTREAM_URL}/${tag}/clickstream-frwiki-${tag}.tsv.gz`)
      if (response.status === 404) continue
      console.log(`· clickstream ${tag}: téléchargement`)
      writeFileSync(path, Buffer.from(await response.arrayBuffer()))
    }
    body = gunzipSync(readFileSync(path))
    days = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate()
    break
  }
  if (!body) throw new Error('clickstream: aucun mois publié')

  const visits = new Map<string, number>()
  for (const line of body.toString('utf8').split('\n')) {
    const [, target = '', , count = '0'] = line.split('\t')
    if (target === '') continue
    const title = target.replace(/_/g, ' ')
    visits.set(title, (visits.get(title) ?? 0) + Number(count) / days)
  }
  console.log(`· clickstream: ${visits.size} articles`)
  return visits
}

interface Lexique {
  /** Normalized form → the lemma it belongs to. */
  lemmaOf: Map<string, string>
  /** Normalized lemma → every noun and adjective form, in their own spelling. */
  formsOf: Map<string, string[]>
  /** Lower-cased spellings, to tell a name from a description in an alias. */
  nouns: Set<string>
  adjectives: Set<string>
}

/**
 * Lexique 3.83 says how a word bends: a player who types "chats" or "bleue"
 * has answered, and only the inflected forms say so. Its frequencies are no
 * longer read — they count novels from 1950 to 2000 and subtitles from the
 * early 2000s, not the French spoken today.
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
  const lemmaAt = header.indexOf('lemme')
  const gramAt = header.indexOf('cgram')
  if (orthoAt < 0 || lemmaAt < 0 || gramAt < 0) {
    throw new Error('lexique: colonnes ortho/lemme/cgram introuvables')
  }

  const lemmaOf = new Map<string, string>()
  const formsOf = new Map<string, string[]>()
  const nouns = new Set<string>()
  const adjectives = new Set<string>()

  for (const line of lines.slice(1)) {
    const columns = line.split('\t')
    const spelling = (columns[orthoAt] ?? '').trim()
    const word = normalizeWord(spelling)
    if (word === '') continue

    // Verbs and function words would drag a category into forms nobody would
    // accept as an answer; a noun or an adjective is what a category holds.
    const gram = columns[gramAt] ?? ''
    if (gram !== 'NOM' && gram !== 'ADJ') continue
    ;(gram === 'NOM' ? nouns : adjectives).add(spelling.toLowerCase())

    const lemma = normalizeWord(columns[lemmaAt] ?? '')
    if (lemma === '') continue
    lemmaOf.set(word, lemma)
    const forms = formsOf.get(lemma) ?? []
    if (!forms.includes(spelling)) forms.push(spelling)
    formsOf.set(lemma, forms)
  }

  console.log(`· lexique: ${formsOf.size} lemmes`)
  return { lemmaOf, formsOf, nouns, adjectives }
}

/**
 * Just enough MessagePack to read wordfreq's file: arrays, maps, strings and
 * small integers. Pulling a package in for one import script is not worth it.
 */
function unpack(bytes: Buffer): unknown {
  let at = 0
  const text = (length: number) => bytes.toString('utf8', (at += length) - length, at)
  const list = (length: number) => Array.from({ length }, read)
  const map = (length: number) => Object.fromEntries(Array.from({ length }, () => [read(), read()]))
  function read(): unknown {
    const tag = bytes[at++]!
    if (tag <= 0x7f) return tag
    if (tag >= 0xe0) return tag - 0x100
    if ((tag & 0xe0) === 0xa0) return text(tag & 0x1f)
    if ((tag & 0xf0) === 0x90) return list(tag & 0x0f)
    if ((tag & 0xf0) === 0x80) return map(tag & 0x0f)
    switch (tag) {
      case 0xc0: return null
      case 0xc2: return false
      case 0xc3: return true
      case 0xcc: return bytes[at++]
      case 0xcd: return bytes.readUInt16BE((at += 2) - 2)
      case 0xd9: return text(bytes[at++]!)
      case 0xda: return text(bytes.readUInt16BE((at += 2) - 2))
      case 0xdc: return list(bytes.readUInt16BE((at += 2) - 2))
      case 0xdd: return list(bytes.readUInt32BE((at += 4) - 4))
      case 0xde: return map(bytes.readUInt16BE((at += 2) - 2))
      default: throw new Error(`wordfreq: type msgpack 0x${tag.toString(16)} non géré`)
    }
  }
  return read()
}

/**
 * How often each word is used in French today, per million words, from
 * wordfreq: Wikipedia, OpenSubtitles 2018, news up to 2021, the web, Twitter
 * and Reddit, blended. Books alone print "abeille" or "coccinelle" far less
 * than people say them; the blend is the closer reading of the living language.
 *
 * The file lists words by bucket: bucket i holds every word used 10^(-i/100)
 * of the time.
 */
async function loadFrequencies(): Promise<Map<string, number>> {
  if (!existsSync(WORDFREQ_CACHE)) {
    console.log('· wordfreq: téléchargement')
    const response = await fetch(WORDFREQ_URL, { signal: AbortSignal.timeout(180_000) })
    if (!response.ok) throw new Error(`wordfreq: HTTP ${response.status}`)
    writeFileSync(WORDFREQ_CACHE, Buffer.from(await response.arrayBuffer()))
  }

  const [header, ...buckets] = unpack(gunzipSync(readFileSync(WORDFREQ_CACHE))) as [
    { format?: string },
    ...string[][],
  ]
  if (header.format !== 'cB') throw new Error('wordfreq: format inattendu')

  const frequency = new Map<string, number>()
  for (const [index, bucket] of buckets.entries()) {
    const perMillion = 10 ** (-index / 100) * 1_000_000
    for (const spelling of bucket) {
      // Keyed on the exact spelling, accents kept: folded, the sloth "aï"
      // would read as "ai" and the cerium "Ce" as "ce".
      if (!frequency.has(spelling)) frequency.set(spelling, perMillion)
    }
  }
  console.log(`· wordfreq: ${frequency.size} formes`)
  return frequency
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

/**
 * Wikidata's aliases mix other names of a thing ("Hollande", "Birmanie") with
 * ways of describing it: official styles ("République de Pologne", which would
 * let any country be answered on R), nicknames ("pays du Soleil-Levant",
 * "Oncle Sam", "l'Hexagone"), demonyms ("Brésilien"), codes and symbols ("UZ",
 * "Fe"). A description starts with a common noun, or is one once its article
 * is gone; a name does not.
 */
function describes(alias: string, lostArticle: boolean, lexique: Lexique): boolean {
  if (alias.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '').length < 4 || alias === alias.toUpperCase()) return true
  const [head = '', ...rest] = alias.toLowerCase().split(' ')
  if (rest.length > 0) return lexique.nouns.has(head)
  if (lostArticle && lexique.nouns.has(head)) return true
  return lexique.adjectives.has(head) && !lexique.nouns.has(head)
}

/** The French section of a Wiktionary page, reduced to what sorts its senses. */
interface WiktionaryPage {
  /** The templates on each definition, in the page's order: `oiseaux`, `figuré`… */
  senses: string[][]
  categories: string[]
}

async function wiktionaryPages(words: readonly string[]): Promise<Map<string, WiktionaryPage>> {
  const cache = new Map<string, WiktionaryPage>(
    existsSync(WIKT_PAGES_CACHE) ? Object.entries(JSON.parse(readFileSync(WIKT_PAGES_CACHE, 'utf8'))) : [],
  )
  const missing = [...new Set(words)].filter((word) => !cache.has(word))
  if (missing.length > 0) console.log(`· wiktionnaire: ${missing.length} pages à lire`)

  for (let start = 0; start < missing.length; start += 50) {
    const batch = missing.slice(start, start + 50)
    const url = new URL(WIKTIONARY_API)
    url.searchParams.set('action', 'query')
    url.searchParams.set('prop', 'revisions')
    url.searchParams.set('rvprop', 'content')
    url.searchParams.set('rvslots', 'main')
    url.searchParams.set('titles', batch.join('|'))
    url.searchParams.set('format', 'json')
    url.searchParams.set('formatversion', '2')
    const { query = {} } = (await (await wikimedia(url)).json()) as {
      query?: {
        normalized?: { from: string; to: string }[]
        pages?: { title: string; revisions?: { slots: { main: { content: string } } }[] }[]
      }
    }
    const asked = new Map((query.normalized ?? []).map(({ from, to }) => [to, from]))
    for (const page of query.pages ?? []) {
      const text = page.revisions?.[0]?.slots.main.content ?? ''
      const at = text.indexOf('== {{langue|fr}} ==')
      const french = at < 0 ? '' : text.slice(at).split(/\n== \{\{langue\|/)[0]!
      const senses = french
        .split('\n')
        .filter((line) => /^#(?![*:])/.test(line))
        .map((line) => [...line.matchAll(/\{\{([^|}]+)/g)].map((match) => match[1]!.trim().toLowerCase()))
      const categories = [...french.matchAll(/\[\[Catégorie:([^\]|]+)/g)].map((match) => match[1]!.trim())
      cache.set(asked.get(page.title) ?? page.title, { senses, categories })
    }
    for (const word of batch) if (!cache.has(word)) cache.set(word, { senses: [], categories: [] })
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  if (missing.length > 0) writeFileSync(WIKT_PAGES_CACHE, JSON.stringify(Object.fromEntries(cache)))
  return cache
}

const DISAMBIGUATION_ITEM = 'Q4167410'

async function wikidataClaims(items: readonly string[], property: 'P31' | 'P279'): Promise<Map<string, string[]>> {
  const values = new Map<string, string[]>()
  for (let start = 0; start < items.length; start += 50) {
    const url = new URL(WIKIDATA_API)
    url.searchParams.set('action', 'wbgetentities')
    url.searchParams.set('ids', items.slice(start, start + 50).join('|'))
    url.searchParams.set('props', 'claims')
    url.searchParams.set('format', 'json')
    const { entities = {} } = (await (await wikimedia(url)).json()) as {
      entities?: Record<string, { claims?: Record<string, { mainsnak: { datavalue?: { value: { id: string } } } }[]> }>
    }
    for (const [item, entity] of Object.entries(entities)) {
      values.set(item, (entity.claims?.[property] ?? []).flatMap((claim) => claim.mainsnak.datavalue?.value.id ?? []))
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  return values
}

/**
 * What the French Wikipedia article each word lands on is about, as the
 * Wikidata classes of its item (P31) and their parents — null when there is no
 * article, a homonymy page reading as a Wikimedia disambiguation page.
 */
async function articleClasses(words: readonly string[]): Promise<Map<string, string[] | null>> {
  const cache = new Map<string, string[] | null>(
    existsSync(CLASSES_CACHE) ? Object.entries(JSON.parse(readFileSync(CLASSES_CACHE, 'utf8'))) : [],
  )
  const missing = [...new Set(words)].filter((word) => !cache.has(word))
  if (missing.length === 0) return cache
  console.log(`· wikipédia: ${missing.length} articles à situer`)

  const itemOf = new Map<string, string | null>()
  for (let start = 0; start < missing.length; start += 50) {
    const batch = missing.slice(start, start + 50)
    const url = new URL(WIKIPEDIA_API)
    url.searchParams.set('action', 'query')
    url.searchParams.set('redirects', '1')
    url.searchParams.set('prop', 'pageprops')
    url.searchParams.set('ppprop', 'disambiguation|wikibase_item')
    url.searchParams.set('titles', batch.join('|'))
    url.searchParams.set('format', 'json')
    url.searchParams.set('formatversion', '2')
    const { query = {} } = (await (await wikimedia(url)).json()) as {
      query?: {
        normalized?: { from: string; to: string }[]
        redirects?: { from: string; to: string }[]
        pages?: { title: string; missing?: boolean; invalid?: boolean; pageprops?: { disambiguation?: string; wikibase_item?: string } }[]
      }
    }
    const titleOf = new Map(batch.map((word) => [word, word]))
    for (const step of [query.normalized ?? [], query.redirects ?? []]) {
      const to = new Map(step.map(({ from, to }) => [from, to]))
      for (const [word, title] of titleOf) titleOf.set(word, to.get(title) ?? title)
    }
    const pages = new Map((query.pages ?? []).filter((page) => !page.missing && !page.invalid).map((page) => [page.title, page]))
    for (const [word, title] of titleOf) {
      const page = pages.get(title)
      if (!page) cache.set(word, null)
      else if (page.pageprops?.disambiguation !== undefined) cache.set(word, [DISAMBIGUATION_ITEM])
      else itemOf.set(word, page.pageprops?.wikibase_item ?? null)
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  const items = [...new Set([...itemOf.values()].filter((item) => item !== null))]
  const classesOf = await wikidataClaims(items, 'P31')
  // One step up the class tree: "poule" is an instance of "animal of a given
  // sex", which is a kind of organism, not an organism class itself.
  const parentsOf = await wikidataClaims([...new Set([...classesOf.values()].flat())], 'P279')
  for (const [word, item] of itemOf) {
    const classes = item ? (classesOf.get(item) ?? []) : []
    cache.set(word, [...new Set([...classes, ...classes.flatMap((id) => parentsOf.get(id) ?? [])])])
  }

  writeFileSync(CLASSES_CACHE, JSON.stringify(Object.fromEntries(cache)))
  return cache
}

/**
 * The Wiktionary files a word under a category for any one of its senses, so
 * "pape" is a bird there — its third sense, after the pontiff — and so are
 * "dragon", "jardinier" and "cardinal". Accepting them turns the category into
 * a lottery on everyday words, each scored on the fame of its first sense.
 *
 * A word filed for a later sense is kept only when its Wikipedia article is
 * about a thing of the category (a taxon), a list of homonyms, or missing:
 * "bourdon", "manchot" and "cafard" are filed for a later sense too, and their
 * article is the animal's. A sense the page marks imaginary is dropped outright
 * ("galinette cendrée", the hunters' joke bird).
 */
async function strayWords(
  members: Map<string, { words: string[]; topics: string[] }>,
  classes: ReadonlySet<string>,
): Promise<Set<string>> {
  const pages = await wiktionaryPages([...members.values()].flatMap(({ words }) => words))
  const stray = new Set<string>()
  const doubtful = new Map<string, string[]>()
  for (const [title, { words, topics }] of members) {
    for (const word of words) {
      const page = pages.get(word)
      if (!page) continue
      const at = page.senses.findIndex((templates) => templates.some((template) => topics.includes(template)))
      const imaginary = page.categories.some((category) => category.endsWith('imaginaires en français'))
      if (imaginary && at < 0) stray.add(`${title}\n${word}`)
      else if (at > 0) doubtful.set(word, [...(doubtful.get(word) ?? []), title])
    }
  }

  const about = await articleClasses([...doubtful.keys()])
  for (const [word, inTitles] of doubtful) {
    const found = about.get(word) ?? null
    if (found === null || found.includes(DISAMBIGUATION_ITEM) || found.some((id) => classes.has(id))) continue
    for (const title of inTitles) stray.add(`${title}\n${word}`)
  }
  return stray
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
    const frequencies = await loadFrequencies()
    const visits = await frenchVisits()
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
      // `alias` stays true only while every row naming the word was an alias.
      const best = new Map<string, { display: string; sitelinks: number; alias: boolean }>()
      for (const id of sources) {
        for (const row of byPull.get(id)!) {
          // "le Canada" is a real French alias, but keeping it would let the
          // player answer a country on the letter L. Only aliases are stripped:
          // in a label the article belongs to the name ("Le Havre").
          const spelled = row.display.trim().replace(/\s+/g, ' ')
          const cleaned = row.alias ? spelled.replace(/^(?:(?:[Ll]es?|[Ll]a) |[Ll]['’])/, '') : spelled
          if (row.alias && describes(cleaned, cleaned !== spelled, lexique)) continue

          // Wikidata writes an occupation as "boulanger ou boulangère". Both
          // forms are words a player may type, so both are kept.
          for (const display of cleaned.split(/ ou /)) {
            if (!acceptable(display)) continue
            const key = normalizeWord(display)
            if (key === '') continue
            const current = best.get(key)
            if (!current) best.set(key, { display, sitelinks: row.sitelinks, alias: row.alias === true })
            else {
              current.sitelinks = Math.max(current.sitelinks, row.sitelinks)
              current.alias &&= row.alias === true
              if (display.length < current.display.length) current.display = display
            }
          }
        }
      }

      // The words the Wiktionary files under this very category: for them, and
      // only them, the corpus frequency measures the right sense.
      const roots = WIKTIONARY[source.id] ?? []
      const members = await wiktionaryTree(roots)
      for (const [title, category] of members) {
        // The subcategories file jargon abbreviations next to the words ("AQPS",
        // "OPJ"), where the top category keeps those everyone says ("PDG").
        const deep = !roots.includes(title)
        category.words = category.words
          .map((word) => word.trim().replace(/\s+/g, ' '))
          .filter((display) => acceptable(display) && normalizeWord(display) !== '')
          .filter((display) => !deep || display !== display.toUpperCase())
      }
      const classes = SENSE_CHECKED[source.id]
      const stray = classes ? await strayWords(members, classes) : new Set<string>()

      const attested = new Set<string>()
      const strayKeys = new Set<string>()
      for (const [title, { words }] of members) {
        for (const display of words) {
          const key = normalizeWord(display)
          if (stray.has(`${title}\n${display}`)) {
            strayKeys.add(key)
            continue
          }
          attested.add(key)
          if (best.has(key)) continue
          // No sitelinks: a Wiktionary word is rated on its corpus frequency
          // alone, which is exactly what a common noun has.
          best.set(key, { display, sitelinks: 0, alias: false })
        }
      }
      // Wikidata backs some of them with an item almost no Wikipedia describes —
      // "Pape", a bird group with one sitelink — which is no answer a player
      // would give either, and would be scored on the pontiff's fame.
      for (const key of strayKeys) {
        const entry = best.get(key)
        if (entry && !attested.has(key) && entry.sitelinks < NICHE_SITELINKS) best.delete(key)
      }

      // Inflected forms borrow the notoriety of the word they bend, so only the
      // words themselves are looked up.
      const articles = await frenchArticles([...best.values()].map((entry) => entry.display))
      const rows = new Map<string, WordRow>()
      for (const [key, entry] of best) {
        // A name shared with something far better known inherits its fame by
        // mistake, and each reading has its own way of lying.
        //
        // The corpus counts every sense of a word at once — "Mars" the month
        // for a fish, "ne" the negation for Niger's country code. It is only
        // read in categories of common nouns, for a word the Wiktionary files
        // there or the label of a thing most Wikipedias describe.
        //
        // An article is about one sense, but a label may land on a homonym's:
        // "instagrameur" on Instagram, "Salvador" the potato on the country. A
        // thing few Wikipedias describe is not credited more visits than its
        // name's everyday use would earn — "cheval", filed under a two-sitelink
        // item, keeps the horse's. A homonymy page is no reading: a label then
        // falls back on its sitelinks, an alias on nothing.
        const commonNouns = WIKTIONARY[source.id] !== undefined
        const everyday = frequencies.get(entry.display.normalize('NFC').toLowerCase()) ?? 0
        const senseKnown =
          commonNouns && (attested.has(key) || (!entry.alias && entry.sitelinks >= MAJOR_SITELINKS))
        const frequency = senseKnown ? everyday : 0

        const article = articles.get(entry.display) ?? null
        let daily: number | undefined
        if (article !== DISAMBIGUATION || entry.alias) {
          let visited = article && article !== DISAMBIGUATION ? (visits.get(article) ?? 0) : 0
          const niche = entry.sitelinks > 0 && entry.sitelinks < NICHE_SITELINKS
          if (niche && !attested.has(key)) visited = Math.min(visited, visitsWorth(commonNouns ? everyday : 0))
          // A word with no article of its own reads zero rather than nothing,
          // or the domain would fall back on the bot-inflated sitelinks.
          daily = Math.round(visited)
        }
        const fields = [entry.display, entry.sitelinks, rounded(frequency)] as const
        rows.set(key, daily === undefined ? fields : [...fields, '', daily])
      }

      // Every inflected form of an accepted word is accepted too, pointing back
      // at it: "chats" scores like "chat", and cannot be played twice in the
      // same run under two spellings.

      let variants = 0
      for (const [key, entry] of best) {
        const lemma = lexique.lemmaOf.get(key)
        if (!lemma) continue
        for (const form of lexique.formsOf.get(lemma) ?? []) {
          const formKey = normalizeWord(form)
          if (formKey === '' || rows.has(formKey) || !acceptable(form)) continue
          const frequency = attested.has(key) ? (frequencies.get(form.normalize('NFC').toLowerCase()) ?? 0) : 0
          rows.set(formKey, [form, entry.sitelinks, rounded(frequency), key])
          variants++
        }
      }

      const lines = [...rows.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([, row]) => JSON.stringify(row))

      // One row per line, so a regenerated dictionary diffs word by word.
      writeFileSync(`${OUT}/${source.id}.json`, `[\n${lines.join(',\n')}\n]\n`)
      console.log(`→ ${source.id}: ${lines.length} mots (dont ${variants} formes fléchies)`)
    }
    if (failed.length > 0) console.warn(`! sources en échec : ${failed.join(', ')}`)
  })()
}

await main(process.argv.slice(2))
