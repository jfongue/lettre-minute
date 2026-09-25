/**
 * Builds the one global `prenoms` dictionary, shipped identically to every
 * `src/data/words/<lang>/`: unlike a country or a job title, a first name
 * does not change with the interface language, and immigration carries the
 * same name — Mohammed, Karim, Yasmine — into every one of them under the
 * same spelling. So this reads Wikidata's given-name classes once, for the
 * game's seven languages at once, rather than per language like
 * `import-words.ts`.
 *
 *   node --experimental-strip-types scripts/first-names.ts
 *
 * Wikidata classes used (checked against the API before being hardcoded
 * here, per the same rule as scripts/sources.ts — a mistyped id answers zero
 * rows without an error): Q12308941 (male given name), Q11879590 (female
 * given name), Q3409032 (unisex given name).
 *
 * A query across the whole given-name tree (tens of thousands of items,
 * mostly a single family's spelling nobody else uses) answers within the
 * endpoint's own time budget, but *silently* — Wikidata returns whatever it
 * computed so far as a normal 200, with no sign it stopped early, and
 * "Marie", "John" and "Mohammed" came up missing from a first attempt at
 * this very script. Anchoring the query on the sitelink graph of one of the
 * game's languages first (`schema:about`/`isPartOf`, as `brand-class` in
 * sources.ts already does) — rather than scanning every given-name item and
 * filtering — answers in seconds and completely, at the cost of dropping a
 * given name with no article in any of the seven languages, which the
 * curated backstop below and wordfreq cannot cover anyway.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { inflateRawSync } from 'node:zlib'
import { compactWord, initialOf, normalizeWord } from '../src/domain/text.ts'
import type { WordRow } from '../src/domain/words.ts'
import { LANGUAGES, type Lang } from './languages.ts'
import { loadFrequencies } from './wordfreq.ts'

const ENDPOINT = 'https://query.wikidata.org/sparql'
const AGENT = 'LettreMinuteWordImport/0.1 (https://github.com/jfongue; jeremy@enaos.com)'
const PULLS_CACHE = '.cache/pulls'

const GIVEN_NAME_CLASSES = ['Q12308941', 'Q11879590', 'Q3409032']

/** Every language the game plays in: a name's label in any one of them is a candidate. */
const LABEL_LANGS = Object.keys(LANGUAGES) as Lang[]

/**
 * Wikidata's own multilingual fallback tag: a name spelled the same in every
 * language it lists — exactly this category's case — is filed once under
 * "mul", not repeated under "fr", "en"... "Marie" and "John" carry no fr/en
 * label at all and were missing from the first pull of this script until
 * this was added.
 */
const MUL = 'mul'

/** The Wikipedia edition of each: what a candidate must have an article on to be pulled at all. */
const WIKIPEDIA_OF: Record<Lang, string> = {
  fr: 'fr', en: 'en', es: 'es', de: 'de', it: 'it', nl: 'nl', pt: 'pt',
}

/**
 * Below this, a Wikidata "given name" item is as likely to be a stub nobody
 * reads as a real name — and, worse, its label sometimes collides with an
 * ordinary short word of another language ("Il", "Une", "Della", "Su"),
 * which wordfreq then reads as if it were the name, not the word. Above it,
 * a frequency reading is trusted at face value; below, only sitelinks count,
 * the same "attested or fifty Wikipedias" idea import-words.ts applies to a
 * homograph's frequency. The curated backstop below is exempt: each of its
 * names was picked by hand for being genuinely common, sitelinks or not.
 */
const MIN_SITELINKS_FOR_FREQUENCY = 4

/** A first name shorter than this is not one — initials slip into the given-name class. */
const MIN_LENGTH = 2

interface Row {
  display: string
  sitelinks: number
}

/** Minimal RFC 4180 reader, copied from import-words.ts: the two-column answers the endpoint returns. */
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

/** Same shape as import-words.ts's `sparql`: CSV on the last attempt, once JSON has failed to parse twice. */
async function sparql(query: string, attempts = 4, attempt = 1): Promise<Row[]> {
  const asCsv = attempt >= 3
  try {
    const response = await fetch(`${ENDPOINT}?query=${encodeURIComponent(query)}`, {
      headers: { Accept: asCsv ? 'text/csv' : 'application/sparql-results+json', 'User-Agent': AGENT },
      signal: AbortSignal.timeout(170_000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    if (asCsv) {
      const table = parseCsv(await response.text())
      const header = table[0] ?? []
      const labelAt = header.indexOf('label')
      const countAt = header.indexOf('n')
      const rows: Row[] = []
      for (const line of table.slice(1)) {
        if (labelAt < 0 || !line[labelAt]) continue
        rows.push({ display: line[labelAt]!, sitelinks: Number(line[countAt] ?? 0) || 0 })
      }
      return rows
    }

    // oxlint-disable-next-line no-control-regex -- a few labels carry raw control characters JSON.parse refuses
    const body = (await response.text()).replace(/[\u0000-\u001f]/g, ' ')
    const payload = JSON.parse(body) as { results: { bindings: Record<string, { value: string }>[] } }
    return payload.results.bindings
      .filter((binding) => binding.label?.value)
      .map((binding) => ({ display: binding.label!.value, sitelinks: Number(binding.n?.value ?? 0) }))
  } catch (error) {
    if (attempt >= attempts) throw error
    console.warn(`  retry ${attempt} — ${(error as Error).message}`)
    await new Promise((resolve) => setTimeout(resolve, 10_000 * attempt))
    return sparql(query, attempts, attempt + 1)
  }
}

/** Every given name (any of the three classes) with an article on `lang`'s Wikipedia. */
async function pullWikipedia(lang: Lang): Promise<Row[]> {
  const path = `${PULLS_CACHE}/first-names-${lang}.json`
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8')) as Row[]

  const langFilter = [...LABEL_LANGS, MUL].map((code) => `"${code}"`).join(', ')
  const classes = GIVEN_NAME_CLASSES.map((id) => `wd:${id}`).join(' ')
  const query = `SELECT ?label ?n WHERE {
  VALUES ?class { ${classes} }
  ?article schema:about ?item ; schema:isPartOf <https://${WIKIPEDIA_OF[lang]}.wikipedia.org/> .
  ?item wdt:P31 ?class ; rdfs:label ?label ; wikibase:sitelinks ?n .
  FILTER(lang(?label) IN (${langFilter}))
}`
  console.log(`· wikidata: prénoms (${lang}.wikipedia)`)
  const rows = await sparql(query)
  mkdirSync(PULLS_CACHE, { recursive: true })
  writeFileSync(path, JSON.stringify(rows))
  console.log(`  ${rows.length} lignes`)
  return rows
}

/**
 * A short, hand-picked backstop for names common by immigration in the
 * game's countries (France, Germany, the Netherlands, the UK...) whose
 * Wikidata coverage is too thin to carry an article anywhere — Wikidata
 * knows "Aïcha" (Q20001165) but no Wikipedia does. Their fame still comes
 * out right below: wordfreq reads how often the spelling appears in
 * everyday text, not how many articles describe it, and none of these
 * spellings collides with an ordinary word of the game's languages, unlike
 * the short items MIN_SITELINKS_FOR_FREQUENCY guards against.
 */
const ADDED_NAMES: readonly string[] = [
  'Aïcha', 'Yasmine', 'Nawel', 'Imane', 'Zineb', 'Ilyes', 'Rayan', 'Ayoub', 'Sofiane', 'Bilal', 'Hamza',
  'Amine', 'Rachid', 'Nadia', 'Malika', 'Samira', 'Nassim', 'Younes', 'Wassim', 'Meriem', 'Fadwa',
  'Mamadou', 'Aminata', 'Awa', 'Ibrahima', 'Fatoumata', 'Aissatou', 'Kadiatou', 'Moussa', 'Cheikh',
  'Minh', 'Linh', 'Thanh',
]

/**
 * A short given name that also happens to spell an article, pronoun or
 * preposition of one of the game's languages — "Il", "Su", "Della", "Alla" —
 * inherits that word's wordfreq frequency, not its own: real but obscure
 * names like Uma, Nur, Will or Per would otherwise come out among the most
 * notorious in the whole category. Their sitelinks reading is untouched —
 * they stay playable, just correctly unremarkable.
 */
const HOMOGRAPH_STOPWORDS = new Set([
  'il', 'lo', 'la', 'le', 'les', 'un', 'une', 'de', 'des', 'du', 'et', 'ma', 'ta', 'sa', 'su', 'ai', 'elle',
  'per', 'von', 'nel', 'una', 'uma', 'alla', 'della', 'dalla', 'degli', 'delle', 'dei', 'del', 'dello',
  'dallo', 'nur', 'my', 'will', 'eine', 'ein', 'der', 'die', 'das', 'den', 'dem', 'em', 'na', 'no', 'do',
  'da', 'e', 'o', 'a', 'y', 'en', 'et', 'mas', 'pero', 'con', 'su', 'suo',
  // The same trap at four and five letters: an everyday Italian, Dutch or
  // English word that also happens to be someone's given name somewhere.
  'al', 'ed', 'ela', 'hanno', 'anni', 'uno', 'nada', 'mio', 'dag', 'even', 'vita', 'love', 'primo', 'anno',
  'just', 'may', 'bent', 'dan', 'ville', 'job', 'tage', 'ante', 'else', 'said', 'esa', 'minha',
])

function junk(display: string): boolean {
  if (compactWord(display).length < MIN_LENGTH) return true
  if (initialOf(display) === '') return true
  // Same shape the shipped-dictionary test enforces: letters, and what joins them.
  if (!/^\p{L}[\p{L}'’ -]*$/u.test(display)) return true
  if ([...display].some((char) => /\p{L}/u.test(char) && normalizeWord(char) === '')) return true
  // A hyphen with nothing either side, or a name that is only punctuation once trimmed.
  if (/^[-'’\s]+$/.test(display) || /--/.test(display) || /^-|-$/.test(display)) return true
  return false
}

/**
 * "France" and "Paris" are both instances of a given-name class on Wikidata
 * (rare, but real) and inherit that spelling's own wordfreq frequency, sky
 * high for an everyday country or capital — while "Sofia" and "Victoria" are
 * also both a capital and two of the best-known names in the category.
 * Already-shipped rows of those two categories, in any language, are the
 * cheapest way to spot the clash; the fix is to distrust the frequency
 * reading (as for HOMOGRAPH_STOPWORDS), not to drop the name — its own
 * sitelinks, from the given-name item, still say correctly how obscure or
 * well-known a name "France" or "Sofia" actually is.
 */
function loadPlaceNames(): Set<string> {
  const places = new Set<string>()
  for (const lang of LABEL_LANGS) {
    for (const id of ['pays', 'capitales']) {
      const path = `src/data/words/${lang}/${id}.json`
      if (!existsSync(path)) continue
      const rows = JSON.parse(readFileSync(path, 'utf8')) as WordRow[]
      for (const [display] of rows) places.add(compactWord(display))
    }
  }
  return places
}

/**
 * A birth-registry backstop, on top of Wikidata: "Kylian" and "Mathis" are
 * some of the most common boys' names born in France this decade, yet carry
 * no Wikipedia article in any language — only a Wikimedia Commons category —
 * so `pullWikipedia` never sees them, and wordfreq barely does either (a
 * name a child was given five years ago hasn't had time to turn up in books,
 * news or blended web text the way "Jean" or "Emma" have). Wikidata's own
 * sitelinks measure encyclopedic interest, not how many babies got the name
 * (CLAUDE.md's "sitelinks don't measure fame" point, applied to people who
 * are themselves too young to have a Wikipedia page yet). National birth
 * statistics are the one source that reads real-world popularity directly:
 * INSEE's "fichier des prénoms" (France), the SSA's baby-name files (US) and
 * the ONS's baby-name tables (England & Wales) are all published as open
 * data. Every name in the top NATIONAL_TOP_LIMIT of any of them ships
 * regardless of what Wikidata or wordfreq say, and is guaranteed to read as
 * "known" (KNOWN_FAME in src/domain/words.ts) — being one of a few hundred
 * names an entire country currently gives its children is a stronger signal
 * than any dictionary corpus can contradict.
 *
 * Statbel (Belgium), Destatis (Germany), Istat (Italy), CBS (Netherlands)
 * and the INE (Spain) publish similar statistics, but not as a flat,
 * directly downloadable file — Statbel's interactive tool needs a session,
 * CBS's is a StatLine query, Destatis and Istat require picking a table from
 * a catalogue — so they are left out rather than scraped by hand.
 */
const OPEN_DATA_CACHE = '.cache/open-data'
const NATIONAL_TOP_LIMIT = 500

/**
 * Whatever wordfreq or the Wikidata/place/stopword filters above make of a
 * name's spelling, a name in the national top list reads as "known": just
 * over the ~6.6-per-million reading that clears KNOWN_FAME in rawFame's
 * `spoken` term (log10(1 + frequency) / 2.2 ≥ 0.4).
 */
const GUARANTEED_KNOWN_FREQUENCY = 8

async function fetchBuffer(url: string, cachePath: string): Promise<Buffer> {
  if (existsSync(cachePath)) return readFileSync(cachePath)
  console.log(`· téléchargement: ${url}`)
  const response = await fetch(url, { headers: { 'User-Agent': AGENT }, signal: AbortSignal.timeout(120_000) })
  if (!response.ok) throw new Error(`HTTP ${response.status} — ${url}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  mkdirSync(dirname(cachePath), { recursive: true })
  writeFileSync(cachePath, buffer)
  return buffer
}

/**
 * The smallest possible ZIP reader: locate the end-of-central-directory
 * record from the back of the file (robust to any trailing comment), then
 * decompress every entry the central directory lists. Good enough for the
 * modest, plain archives below (a CSV, an .xlsx, a folder of yearly text
 * files) — nothing here needs zip64 or encryption.
 */
function unzipAll(buffer: Buffer): Map<string, Buffer> {
  const maxCommentLength = 65536
  const searchStart = Math.max(0, buffer.length - 22 - maxCommentLength)
  let eocd = -1
  for (let i = buffer.length - 22; i >= searchStart; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('zip: no end-of-central-directory record found')

  const cdOffset = buffer.readUInt32LE(eocd + 16)
  const cdEnd = cdOffset + buffer.readUInt32LE(eocd + 12)
  const entries = new Map<string, Buffer>()
  let at = cdOffset
  while (at < cdEnd) {
    if (buffer.readUInt32LE(at) !== 0x02014b50) break
    const method = buffer.readUInt16LE(at + 10)
    const compressedSize = buffer.readUInt32LE(at + 20)
    const nameLength = buffer.readUInt16LE(at + 28)
    const extraLength = buffer.readUInt16LE(at + 30)
    const commentLength = buffer.readUInt16LE(at + 32)
    const localOffset = buffer.readUInt32LE(at + 42)
    const name = buffer.toString('utf8', at + 46, at + 46 + nameLength)

    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize)
    entries.set(name, method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed))

    at += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

/** The best `limit` keys of `counts`, richest first. */
function topN(counts: Map<string, number>, limit: number): Map<string, number> {
  return new Map([...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit))
}

/** INSEE writes names in capitals ("JEAN-PIERRE", "LÉA"); the game shows names the way a player would write one. */
function titleCase(raw: string): string {
  return raw
    .toLowerCase()
    .split(/([- ])/)
    .map((part) => (part === '-' || part === ' ' || part === '' ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('')
}

const INSEE_URL = 'https://www.insee.fr/fr/statistiques/fichier/8595130/prenoms-2025-nat_csv.zip'
/** INSEE's own placeholder for a name too rare to publish without identifying a child. */
const INSEE_PLACEHOLDER = '_PRENOMS_RARES'
/** Recent enough to catch a name like "Kylian" (which barely existed before the 1990s) without only reading last year's fad. */
const INSEE_MIN_YEAR = 2000

/** France, from the "fichier des prénoms" — one row per (sex, name, year), summed over the recent years. */
async function loadInseeTop(limit: number): Promise<Map<string, number>> {
  const buffer = await fetchBuffer(INSEE_URL, `${OPEN_DATA_CACHE}/insee-prenoms.zip`)
  const entries = unzipAll(buffer)
  const csvName = [...entries.keys()].find((name) => name.endsWith('.csv'))
  if (!csvName) throw new Error('insee: aucun csv dans l’archive')
  const text = entries.get(csvName)!.toString('utf8')

  const totals = new Map<string, number>()
  let first = true
  for (const line of text.split('\n')) {
    if (first) {
      first = false
      continue
    }
    const [, prenom, periode, valeurRaw] = line.split(';')
    if (!prenom || prenom === INSEE_PLACEHOLDER) continue
    const year = Number(periode)
    if (!Number.isInteger(year) || year < INSEE_MIN_YEAR) continue
    const display = titleCase(prenom)
    totals.set(display, (totals.get(display) ?? 0) + (Number(valeurRaw) || 0))
  }
  return topN(totals, limit)
}

/**
 * The SSA's own domain blocks this sandbox's requests outright (HTTP 403);
 * this GitHub mirror carries the same yearly `yobYYYY.txt` files the SSA
 * publishes (name,sex,count), current up to 2020 — recent enough for the
 * purpose here, since a top-500 given name rarely falls out of use in a
 * few years.
 */
const SSA_URL = 'https://raw.githubusercontent.com/hackerb9/ssa-baby-names/master/raw-data/names.zip'
const SSA_YEARS = [2016, 2017, 2018, 2019, 2020]

/** United States, from the SSA's yearly baby-name counts, both sexes summed over the last mirrored years. */
async function loadSsaTop(limit: number): Promise<Map<string, number>> {
  const buffer = await fetchBuffer(SSA_URL, `${OPEN_DATA_CACHE}/ssa-names.zip`)
  const entries = unzipAll(buffer)
  const totals = new Map<string, number>()
  for (const year of SSA_YEARS) {
    const text = entries.get(`yob${year}.txt`)?.toString('utf8')
    if (!text) continue
    for (const line of text.split('\n')) {
      const [name, , countRaw] = line.split(',')
      if (!name) continue
      totals.set(name, (totals.get(name) ?? 0) + (Number(countRaw) || 0))
    }
  }
  return topN(totals, limit)
}

/** All `<si>` text of an OOXML shared-strings table, in order — what a cell's `t="s"` value indexes into. */
function sharedStrings(xml: string): string[] {
  const items: string[] = []
  for (const si of xml.matchAll(/<si>(.*?)<\/si>/gs)) {
    items.push([...si[1]!.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join(''))
  }
  return items
}

interface SheetCell {
  row: number
  col: string
  value: string
  shared: boolean
}

/** Every non-empty cell of an OOXML worksheet, in document order. */
function sheetCells(xml: string): SheetCell[] {
  const cells: SheetCell[] = []
  for (const cell of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>(?:<v>([^<]*)<\/v>)?<\/c>/g)) {
    const [, col, rowText, attrs, value] = cell
    if (value === undefined) continue
    cells.push({ row: Number(rowText), col: col!, value, shared: /\bt="s"/.test(attrs ?? '') })
  }
  return cells
}

/**
 * The ONS ships one workbook per sex with several tables; "Table_2" is a
 * top-100, but one of the others is the full list every name reached at
 * least 3 uses on — always the sheet with the most rows, whichever table
 * number that turns out to be this year.
 */
function biggestTableSheet(entries: Map<string, Buffer>): string {
  const workbookXml = entries.get('xl/workbook.xml')!.toString('utf8')
  const relsXml = entries.get('xl/_rels/workbook.xml.rels')!.toString('utf8')
  const targetOf = new Map<string, string>()
  for (const rel of relsXml.matchAll(/<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    targetOf.set(rel[1]!, rel[2]!)
  }

  let best: { path: string; rows: number } | null = null
  for (const sheet of workbookXml.matchAll(/<sheet name="Table_\d+"[^>]*r:id="([^"]+)"/g)) {
    const target = targetOf.get(sheet[1]!)
    if (!target) continue
    const path = `xl/${target}`
    const xml = entries.get(path)?.toString('utf8')
    const dimension = xml?.match(/<dimension ref="[A-Z]+\d+:[A-Z]+(\d+)"\/>/)
    const rows = dimension ? Number(dimension[1]) : 0
    if (!best || rows > best.rows) best = { path, rows }
  }
  if (!best) throw new Error('ons: aucune feuille Table_N trouvée')
  return best.path
}

/** England & Wales, from one ONS workbook (boys or girls) — rank, name and count columns A, B, C of its fullest table. */
async function loadOnsTop(url: string, cachePath: string, limit: number): Promise<Map<string, number>> {
  const buffer = await fetchBuffer(url, cachePath)
  const entries = unzipAll(buffer)
  const strings = sharedStrings(entries.get('xl/sharedStrings.xml')!.toString('utf8'))
  const sheetXml = entries.get(biggestTableSheet(entries))!.toString('utf8')

  const byRow = new Map<number, Map<string, string>>()
  for (const cell of sheetCells(sheetXml)) {
    const row = byRow.get(cell.row) ?? new Map<string, string>()
    row.set(cell.col, cell.shared ? (strings[Number(cell.value)] ?? '') : cell.value)
    byRow.set(cell.row, row)
  }

  const totals = new Map<string, number>()
  for (const [, row] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
    const rank = Number(row.get('A'))
    const name = row.get('B')
    const count = Number(row.get('C'))
    if (!Number.isFinite(rank) || !name || !Number.isFinite(count)) continue
    totals.set(name, count)
    if (totals.size >= limit) break
  }
  return totals
}

const ONS_BOYS_URL =
  'https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/birthsdeathsandmarriages/livebirths/datasets/babynamesenglandandwalesbabynamesstatisticsboys/2025/2025boysbabynames.xlsx'
const ONS_GIRLS_URL =
  'https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/birthsdeathsandmarriages/livebirths/datasets/babynamesenglandandwalesbabynamesstatisticsgirls/2025/2025girlsbabynames.xlsx'

/** The merged, deduplicated top names of every national source — a name known in several counts the most it reached in any one. */
async function loadNationalTopNames(): Promise<Map<string, number>> {
  const sourced = await Promise.all([
    loadInseeTop(NATIONAL_TOP_LIMIT).catch((error: Error) => {
      console.warn(`  insee indisponible — ${error.message}`)
      return new Map<string, number>()
    }),
    loadSsaTop(NATIONAL_TOP_LIMIT).catch((error: Error) => {
      console.warn(`  ssa indisponible — ${error.message}`)
      return new Map<string, number>()
    }),
    loadOnsTop(ONS_BOYS_URL, `${OPEN_DATA_CACHE}/ons-boys.xlsx`, NATIONAL_TOP_LIMIT).catch((error: Error) => {
      console.warn(`  ons (garçons) indisponible — ${error.message}`)
      return new Map<string, number>()
    }),
    loadOnsTop(ONS_GIRLS_URL, `${OPEN_DATA_CACHE}/ons-girls.xlsx`, NATIONAL_TOP_LIMIT).catch((error: Error) => {
      console.warn(`  ons (filles) indisponible — ${error.message}`)
      return new Map<string, number>()
    }),
  ])

  const merged = new Map<string, number>()
  for (const source of sourced) {
    for (const [name, count] of source) merged.set(name, Math.max(merged.get(name) ?? 0, count))
  }
  console.log(
    `· prénoms nationaux: insee=${sourced[0].size} ssa=${sourced[1].size} ons-garçons=${sourced[2].size} ` +
      `ons-filles=${sourced[3].size} → ${merged.size} noms`,
  )
  return merged
}

async function main() {
  const perLanguage = await Promise.all(LABEL_LANGS.map((lang) => pullWikipedia(lang)))
  const pulled = perLanguage.flat()
  const places = loadPlaceNames()

  // Grouped by compact key: two spellings that fold the same (María, Marià)
  // are two different Wikidata items, but the domain keeps only the first
  // row of a clash (CLAUDE.md), so the import picks which — the one with the
  // most sitelinks, the way a player would recognise it fastest.
  const bySitelinks = new Map<string, Row>()
  for (const row of pulled) {
    if (junk(row.display)) continue
    const key = compactWord(row.display)
    const current = bySitelinks.get(key)
    if (!current || row.sitelinks > current.sitelinks) bySitelinks.set(key, row)
  }
  for (const display of ADDED_NAMES) {
    const key = compactWord(display)
    if (!bySitelinks.has(key)) bySitelinks.set(key, { display, sitelinks: 0 })
  }

  // A name in a country's actual birth registry ships and reads as known no
  // matter what Wikidata or wordfreq say about it (see loadNationalTopNames).
  // Its own spelling wins over whatever Wikidata variant happens to carry
  // more sitelinks, too: "Léa" is one of France's most common names this
  // decade, spelled with its accent every time — a Wikidata item for the
  // unaccented "Lea" (Michele, the actress) outranked it on sitelinks alone
  // and would otherwise have shipped as the display, silently. Two sources
  // spelling the same key differently — INSEE's "Léa" against an SSA "Lea",
  // say — settle on whichever was given to more children, since a rough
  // count is still a better tie-breaker than pull order.
  const nationalTop = await loadNationalTopNames()
  const guaranteed = new Set<string>(ADDED_NAMES.map((display) => compactWord(display)))
  const bestNational = new Map<string, { display: string; count: number }>()
  for (const [display, count] of nationalTop) {
    if (junk(display)) continue
    const key = compactWord(display)
    const current = bestNational.get(key)
    if (!current || count > current.count) bestNational.set(key, { display, count })
  }
  // "Only override an unaccented display" cuts the other way too: "José" (from
  // Wikidata, correctly accented) must not lose its accent to the SSA's plain
  // "Jose" just because more American babies are named that than French ones
  // are named "Léa" — a count from one country is not a reason to overwrite a
  // spelling from another. Non-ASCII on the existing side means keep it.
  // oxlint-disable-next-line no-control-regex -- the range excludes non-ASCII, not control characters
  const hasDiacritic = (text: string) => /[^\x00-\x7F]/.test(text)
  for (const [key, { display }] of bestNational) {
    guaranteed.add(key)
    const current = bySitelinks.get(key)
    if (current && hasDiacritic(current.display)) continue
    bySitelinks.set(key, { display, sitelinks: current?.sitelinks ?? 0 })
  }

  console.log(`· ${bySitelinks.size} prénoms candidats`)

  // The frequency a name is used at, read across every corpus the game plays
  // in and kept at its highest: "Marie" is read on French text, "Mary" and
  // "Maria" on English and Spanish/Italian/Portuguese text, each under its
  // own spelling — wordfreq keys on the exact spelling, accents kept.
  const frequenciesByLang = new Map<Lang, Map<string, number>>()
  for (const lang of LABEL_LANGS) frequenciesByLang.set(lang, await loadFrequencies(lang))

  function frequencyOf(display: string): number {
    const folded = display.normalize('NFC').toLowerCase()
    let best = 0
    for (const frequencies of frequenciesByLang.values()) best = Math.max(best, frequencies.get(folded) ?? 0)
    return best
  }

  // Every given name with an article anywhere runs to twenty thousand — most
  // of them a single family's spelling, not an answer any player would give.
  // A modest floor on either signal keeps the shipped file to a size a
  // player's device is happy loading, at the cost of names known only to
  // their own family: the curated backstop is exempt; it was already chosen
  // for being genuinely common despite carrying neither signal on its own.
  const MIN_SITELINKS_TO_SHIP = 6
  const MIN_FREQUENCY_TO_SHIP = 2

  const rows: WordRow[] = []
  for (const { display, sitelinks } of bySitelinks.values()) {
    const key = compactWord(display)
    const isGuaranteed = guaranteed.has(key)
    const trustFrequency =
      (sitelinks >= MIN_SITELINKS_FOR_FREQUENCY || isGuaranteed) &&
      !HOMOGRAPH_STOPWORDS.has(key) &&
      !places.has(key)
    let frequency = trustFrequency ? Math.round(frequencyOf(display) * 100) / 100 : 0
    // A birth-registry or immigration-backstop name always reads as known,
    // whatever its own wordfreq or Wikidata reading came out to.
    if (isGuaranteed) frequency = Math.max(frequency, GUARANTEED_KNOWN_FREQUENCY)
    if (!isGuaranteed && sitelinks < MIN_SITELINKS_TO_SHIP && frequency < MIN_FREQUENCY_TO_SHIP) continue
    rows.push([display, sitelinks, frequency])
  }

  // A category of names does not bend (no canonical form), and the shipped
  // test requires rows sorted the way the import writes them.
  rows.sort((a, b) => {
    const ka = normalizeWord(a[0])
    const kb = normalizeWord(b[0])
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })

  console.log(`· ${rows.length} prénoms retenus`)

  for (const lang of LABEL_LANGS) {
    const dir = `src/data/words/${lang}`
    mkdirSync(dir, { recursive: true })
    writeFileSync(`${dir}/prenoms.json`, JSON.stringify(rows))
  }
  console.log(`· écrit dans src/data/words/{${LABEL_LANGS.join(',')}}/prenoms.json`)
}

main()
