/**
 * Rebuilds the word lists under src/data/words/<lang> from Wikidata and the
 * Wiktionary, with how much each word is used in that language today: its
 * frequency in wordfreq's corpora and the daily views of its Wikipedia article.
 *
 *   node --experimental-strip-types scripts/import-words.ts [--lang=de] [pullId…]
 *
 * The pull results are cached under .cache/pulls so a failed run — the taxon
 * queries are slow and time out often — resumes instead of starting over.
 */
import { execFileSync } from 'node:child_process'
import { createReadStream, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { Readable } from 'node:stream'
import { createGunzip } from 'node:zlib'
import { compactWord, normalizeWord } from '../src/domain/text.ts'
import type { WordRow } from '../src/domain/words.ts'
import { LANGUAGES, TOPICS, type Lang, type LanguageSource } from './languages.ts'
import { loadFrequencies } from './wordfreq.ts'
import { ADDED_WORDS, DROPPED_WORDS, PLACEHOLDER_ELEMENT } from './dropped-words.ts'
import { loadCommunityWords } from './community-words.ts'
import { CATEGORY_SOURCES, CITIES_PER_COUNTRY, LARGE_COUNTRY_POPULATION, PULLS, queryFor, scopeFor, type Pull, type Scope } from './sources.ts'

const ENDPOINT = 'https://query.wikidata.org/sparql'
const AGENT = 'LettreMinuteWordImport/0.1 (https://github.com/jfongue; jeremy@enaos.com)'
const WIKT_CACHE = '.cache/wiktionary'
const WIKTIONARY_API = 'https://fr.wiktionary.org/w/api.php'
const EN_WIKTIONARY_API = 'https://en.wiktionary.org/w/api.php'
const TOPIC_TREE_CACHE = '.cache/wiktionary-topics.json'
const LEXIQUE_URL = 'http://www.lexique.org/databases/Lexique383/Lexique383.tsv'
const LEXIQUE_CACHE = '.cache/lexique383.tsv'
const KAIKKI_URL = 'https://kaikki.org/dictionary'
const TRANSLATIONS_CACHE = '.cache/kaikki-translations.json'
const CLICKSTREAM_URL = 'https://dumps.wikimedia.org/other/clickstream'

/**
 * Per-language paths. French keeps the ones it was first imported under, so
 * its caches — hours of Wikidata and Wikipedia calls — stay valid.
 */
function pathsFor(lang: Lang) {
  const french = lang === 'fr'
  return {
    pulls: french ? '.cache/pulls' : `.cache/pulls/${lang}`,
    articles: french ? '.cache/frwiki-articles-v2.json' : `.cache/${lang}wiki-articles.json`,
    wordfreq: `.cache/wordfreq-large-${lang}.msgpack.gz`,
    kaikki: `.cache/kaikki-${lang}.json`,
    out: `src/data/words/${lang}`,
  }
}

/**
 * Wiktionary is where the everyday French words live: Wikidata knows fifty
 * breeds of cat but not "abeille", and a category of common nouns built on it
 * alone leaves the obvious answers out.
 */
const FRENCH_WIKTIONARY: Record<string, readonly string[]> = {
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
  metiers: ['Métiers en français'],
  sports: ['Sports en français'],
  matieres: ['Métaux en français', 'Alliages en français', 'Roches en français', 'Textiles en français'],
  plantes: ['Plantes en français'],
  objets: ['Meubles en français', 'Ustensiles de cuisine en français', 'Outils en français', 'Récipients en français'],
}

/**
 * The French Wiktionary files most words one or more levels below these roots
 * — « requin » under Requins, « avocat » under Métiers du droit, « natation »
 * under Sports nautiques —, so their subcategories are walked too. Only where
 * the tree stays on its subject: Matières would wander into jewellery and
 * shipwrecks.
 */
const FRENCH_WALKED = new Set(['animaux', 'metiers', 'sports', 'fruits-legumes', 'plantes'])

/** Subcategories that are about the subject rather than of it. */
const FRENCH_SKIPPED = new Set([
  'Viandes en français',
  'Animaux imaginaires en français',
  'Criminels et délinquants en français',
  'Diminutifs de métiers en français',
  // Every feminine noun that could be a trade — « miséreuse », « Gaditane »:
  // Lexique already bends the trades that are.
  'Noms de métiers féminisés en français',
  'Religieux en français',
  'Soldats en français',
  'Sportifs en français',
  // Condiments and sauces, not the plants they are made of — a subcategory
  // of « Plantes » on the Wiktionary all the same.
  'Épices, aromates et condiments en français',
  'Plantes imaginaires en français',
  // Botanical family and genus names, mostly Latin — « Rosacées », «
  // Aubrieta » — that no player would type; the everyday genus names among
  // them ("buis", "aloès") are added by hand instead.
  'Familles de plantes en français',
  'Genres de plantes en français',
  // Walking "Plantes en français" descends into every botanical family and
  // clade the Wiktionnaire files below it — over a hundred and fifty
  // categories such as « Rosacées » or « Astéridées », each one a list of
  // species by their Latin binomial, not a plant name a player would give.
  // Only the categories that name a kind of plant by an everyday word —
  // « Arbres », « Fougères », « Chênes » — stay walked.
  'Cabombacées en français', 'Embryophytes en français', 'Noms de fleurs identiques à des noms d’arbres en français',
  'Trachéophytes en français', 'Cibotiacées en français', 'Cycadacées en français', 'Dennstaedtiacées en français',
  'Dryoptéridacées en français', 'Eucommiacées en français', 'Pipéracées en français', 'Angiospermes en français',
  'Daphniphyllacées en français', 'Dicotylédones en français', 'Monocotylédones en français',
  'Monocotylédones en koyukon', 'Athyriacées en français', 'Blechnacées en français', 'Cyathéacées en français',
  'Davalliacées en français', 'Dicksoniacées en français', 'Polypodiacées en français', 'Ptéridacées en français',
  'Salviniacées en français', 'Spermatophytes en français', 'Acanthacées en français', 'Aizoacées en français',
  'Amaranthacées en français', 'Amaryllidacées en français', 'Annonacées en français', 'Apiacées en français',
  'Apocynacées en français', 'Aracées en français', 'Araliacées en français', 'Arécacées en français',
  'Argophyllacées en français', 'Asphodélacées en français', 'Astéracées en français', 'Balsaminacées en français',
  'Berbéridacées en français', 'Bétulacées en français', 'Bignoniacées en français', 'Bixacées en français',
  'Boraginacées en français', 'Brassicacées', 'Brassicacées en français', 'Broméliacées en français',
  'Burséracées en français', 'Butomacées en français', 'Buxacées en français', 'Cactacées en français',
  'Calceolariacées en français', 'Calcéolariacées en français', 'Calycanthacées en français',
  'Campanulacées en français', 'Cannabacées en français', 'Cannacées en français', 'Caprifoliacées en français',
  'Caryophyllacées en français', 'Casuarinacées en français', 'Célastracées en français',
  'Cératophyllacées en français', 'Cercidiphyllacées en français', 'Cistacées en français',
  'Cléomacées en français', 'Clusiacées en français', 'Colchicacées en français', 'Combrétacées en français',
  'Commélinacées en français', 'Convolvulacées en français', 'Coriariacées en français', 'Cornacées en français',
  'Corynocarpacées en français', 'Costacées en français', 'Cunoniacées en français', 'Cyclanthacées en français',
  'Cypéracées en français', 'Cyrillacées en français', 'Didieréacées en français', 'Dilléniacées en français',
  'Doryanthacées en français', 'Droseracées en français', 'Droséracées en français', 'Éléagnacées en français',
  'Éléocarpacées en français', 'Éricacées en français', 'Eupteléacées en français', 'Fagacées en français',
  'Gentianacées en français', 'Géraniacées en français', 'Gesnériacées en français', 'Hamamélidacées en français',
  'Hydrangéacées en français', 'Hydrocharitacées en français', 'Juglandacées en français', 'Juncacées en français',
  'Lamiacées en français', 'Lardizabalacées en français', 'Lauracées en français', 'Liliacées en français',
  'Lythracées en français', 'Malvacées en français', 'Mélastomatacées en français', 'Méliacées en français',
  'Ménispermacées en français', 'Montiacées en français', 'Moracées en français', 'Moringacées en français',
  'Musacées en français', 'Myrtacées en français', 'Nymphéacées en français', 'Onagracées en français',
  'Orchidacées en français', 'Papavéracées en français', 'Pentaphylacaceées en français',
  'Plantaginacées en français', 'Plumbaginacées en français', 'Poacées en français', 'Polémoniacées en français',
  'Polygonacées en français', 'Pontédériacées en français', 'Portulacacées en français',
  'Primulacées en français', 'Protéacées en français', 'Ranunculacées en français', 'Renonculacées en français',
  'Rhamnacées en français', 'Rubiacées en français', 'Rutacées en français', 'Sapindacées en français',
  'Sapotacées en français', 'Schisandracées en français', 'Scrophulariacées en français',
  'Solanacées en français', 'Strelitziacées en français', 'Urticacées en français', 'Verbenacées en français',
  'Vitacées en français', 'Winteracées en français', 'Xanthorrhoéacées en français', 'Zingibéracées en français',
  'Aquifoliacées en français', 'Astéridées en français', 'Cléthracées en français', 'Columelliacées en français',
  'Composées en français', 'Crassulacées en français', 'Crucifères en français', 'Cucurbitacées en français',
  'Diptérocarpacées en français', 'Érythroxylacées en français', 'Escalloniacées en français',
  'Euphorbiacées en français', 'Famille des œillets en français', 'Fouquiériacées en français',
  'Gelsémiacées en français', 'Gesneriacées en français', 'Goodéniacées en français', 'Itéacées en français',
  'Labiées en français', 'Linacées en français', 'Nyssacées en français', 'Ombellifères en français',
  'Famille des pavots en français', 'Pentaphylacacées en français', 'Phytolaccacées en français',
  'Rosacées en français', 'Salicacées en français', 'Saxifragacées en français', 'Théacées en français',
  'Thyméléacées en français', 'Tropaéolacées en français', 'Alismatacées en français', 'Asparagacées en français',
  'Asphodèlacées en français', 'Dioscoréacées en français', 'Graminées en français', 'Hypoxidacées en français',
  'Iridacées en français', 'Ixioliriacées en français', 'Marantacées en français', 'Cypéracées en koyukon',
  'Fabacées en français',
])

/**
 * Occurrences per million from which a word filed only in a subcategory is
 * taken for a homograph: « cochon » and « requin » stay under it, « forme »,
 * « enfant » and « suisse » do not.
 */
const HOMOGRAPH_FREQUENCY = 10

/**
 * Where subcategories name things after everyday words — breeds, butterflies,
 * apple varieties. A trade filed under Santé is « infirmière » for good.
 */
const HOMOGRAPH_PRONE = new Set(['animaux', 'fruits-legumes', 'plantes'])

/**
 * Where the Wiktionary's own category listing is a flora or a toolshed
 * rather than a list of everyday words: every species a contributor ever
 * filed under "Plantes", every specialist tool English catalogues under
 * "Tools". Elsewhere a Wiktionary word is trusted outright — a rare beetle
 * is still a beetle — but here it is kept only when it also has some
 * measured use in the language, came from Wikidata, or was vouched for by
 * hand (`ADDED_WORDS`, a moderator).
 */
const STRICT_ATTESTED = new Set(['plantes', 'objets'])

const FRENCH_TREE_CACHE = '.cache/wiktionnaire-subcategories.json'
const FRENCH_TREE_DEPTH = 3

/** A legal form closing a company's name, which nobody says when naming the brand. */
const LEGAL_FORM = /,?\s+(?:Inc\.?|Incorporated|Ltd\.?|Limited|Corp\.?|Corporation|Company|Co\.|plc|PLC|LLC|AG|SE|GmbH|S\.?A\.?|S\.p\.A\.?|N\.V\.?|B\.V\.?|Holdings?)$/

/** English is the language of company names whatever the dictionary's: "The Coca-Cola Company" in French too. */
const CORPORATE_ARTICLE = /^the /i

/** Fewer Wikipedias than this describe a thing only specialists look up. */
const NICHE_SITELINKS = 10

/**
 * A Wikidata word that fewer Wikipedias than NICHE_SITELINKS describe, that
 * nobody says and that barely one reader a day opens is not kept: "Shaata
 * Gardens Toad" is a word no player will type, and such words were a third
 * of the English dictionary's weight.
 */
const SHIPPED_MIN_DAILY_VISITS = 1

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

async function sparql(query: string, attempts = 4, attempt = 1): Promise<Row[]> {
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
    if (attempt >= attempts) throw error
    console.warn(`  retry ${attempt} — ${(error as Error).message}`)
    await new Promise((resolve) => setTimeout(resolve, 10_000 * attempt))
    return sparql(query, attempts, attempt + 1)
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

    // Walking the subcategories asks for dozens of lists in a row: the API
    // answers a burst with 429, which `wikimedia` waits out.
    const response = await wikimedia(url)
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

/** Every subcategory under `root`, down to FRENCH_TREE_DEPTH, the skipped ones and theirs left out. */
async function frenchSubcategories(root: string): Promise<string[]> {
  const cache: Record<string, string[]> = existsSync(FRENCH_TREE_CACHE) ? JSON.parse(readFileSync(FRENCH_TREE_CACHE, 'utf8')) : {}
  if (cache[root]) return cache[root]

  const seen = new Set([root])
  let frontier = [root]
  for (let depth = 0; depth < FRENCH_TREE_DEPTH && frontier.length > 0; depth++) {
    const next: string[] = []
    for (const title of frontier) {
      const url = new URL(WIKTIONARY_API)
      url.searchParams.set('action', 'query')
      url.searchParams.set('list', 'categorymembers')
      url.searchParams.set('cmtitle', `Catégorie:${title}`)
      url.searchParams.set('cmtype', 'subcat')
      url.searchParams.set('cmlimit', '500')
      url.searchParams.set('format', 'json')
      const payload = (await (await wikimedia(url)).json()) as { query?: { categorymembers?: { title: string }[] } }
      for (const member of payload.query?.categorymembers ?? []) {
        const name = member.title.replace(/^Catégorie:/, '')
        // A category filed by suffix — « Mots en français suffixés avec -ère » —
        // holds every word ending so, trade or not.
        if (seen.has(name) || FRENCH_SKIPPED.has(name) || name.includes('suffixés avec')) continue
        seen.add(name)
        next.push(name)
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000))
    }
    frontier = next
  }
  cache[root] = [...seen]
  writeFileSync(FRENCH_TREE_CACHE, JSON.stringify(cache, null, 1))
  console.log(`· wiktionnaire ${root}: ${seen.size} catégories`)
  return cache[root]
}

async function pullRows(pull: Pull, scope: Scope, dir: string, force: boolean, attempts: number): Promise<Row[]> {
  const path = `${dir}/${pull.id}.json`
  if (!force && existsSync(path)) {
    const cached = JSON.parse(readFileSync(path, 'utf8')) as Row[]
    console.log(`· ${pull.id}: ${cached.length} lignes (cache)`)
    return cached
  }

  const started = Date.now()
  const rows = pull.largestCities ? await largestCities(scope, attempts) : await sparql(queryFor(pull, scope), attempts)
  writeFileSync(path, JSON.stringify(rows))
  console.log(`· ${pull.id}: ${rows.length} lignes en ${Math.round((Date.now() - started) / 1000)} s`)
  return rows
}

const GEONAMES_CACHE = '.cache/geonames'
// Sections of a city (PPLX: Paris 15e, Manhattan's neighbourhoods), historical,
// abandoned and destroyed places are not cities a player would name.
const NOT_A_CITY = new Set(['PPLX', 'PPLH', 'PPLW', 'PPLQ', 'PPLCH'])

async function geonamesFile(name: string): Promise<string> {
  mkdirSync(GEONAMES_CACHE, { recursive: true })
  const path = `${GEONAMES_CACHE}/${name}.txt`
  if (existsSync(path)) return readFileSync(path, 'utf8')
  const zipped = name !== 'countryInfo'
  const response = await fetch(`https://download.geonames.org/export/dump/${name}.${zipped ? 'zip' : 'txt'}`, {
    headers: { 'User-Agent': AGENT },
  })
  if (!response.ok) throw new Error(`geonames ${name}: HTTP ${response.status}`)
  if (zipped) {
    writeFileSync(`${GEONAMES_CACHE}/${name}.zip`, Buffer.from(await response.arrayBuffer()))
    execFileSync('unzip', ['-o', '-q', `${GEONAMES_CACHE}/${name}.zip`, '-d', GEONAMES_CACHE])
  } else {
    writeFileSync(path, await response.text())
  }
  return readFileSync(path, 'utf8')
}

interface City {
  geonames: string
  population: number
  /** GeoNames' name, and its ASCII spelling, which is often the English one. */
  names: string[]
  country: string
  /** The country's languages, as GeoNames lists them: `de-CH`, `fr-CH`… */
  languages: string[]
}

/** Each country's largest cities, as many as its size allows. */
async function largestCityList(): Promise<City[]> {
  const countries = new Map<string, { population: number; languages: string[] }>()
  for (const line of (await geonamesFile('countryInfo')).split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue
    const fields = line.split('\t')
    countries.set(fields[0]!, {
      population: Number(fields[7]) || 0,
      languages: (fields[15] ?? '').split(',').map((tag) => tag.split('-')[0]!).filter(Boolean),
    })
  }
  const byCountry = new Map<string, City[]>()
  for (const line of (await geonamesFile('cities15000')).split('\n')) {
    const fields = line.split('\t')
    if (fields.length < 15 || NOT_A_CITY.has(fields[7]!)) continue
    const country = fields[8]!
    const cities = byCountry.get(country) ?? []
    cities.push({
      geonames: fields[0]!,
      population: Number(fields[14]) || 0,
      names: [...new Set([fields[1]!, fields[2]!])],
      country,
      languages: countries.get(country)?.languages ?? [],
    })
    byCountry.set(country, cities)
  }
  return [...byCountry].flatMap(([country, cities]) => {
    const keep =
      (countries.get(country)?.population ?? 0) >= LARGE_COUNTRY_POPULATION
        ? CITIES_PER_COUNTRY.large
        : CITIES_PER_COUNTRY.small
    return cities.sort((a, b) => b.population - a.population).slice(0, keep)
  })
}

/** A raw answer, for the queries whose columns are not a label and a count. */
async function sparqlTable(query: string, attempt = 1): Promise<Record<string, string>[]> {
  try {
    // Posted: a few hundred names overflow the longest URL the endpoint takes.
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/sparql-results+json', 'User-Agent': AGENT },
      body: new URLSearchParams({ query }),
      signal: AbortSignal.timeout(180_000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const payload = (await response.json()) as { results: { bindings: Record<string, { value: string }>[] } }
    return payload.results.bindings.map((binding) =>
      Object.fromEntries(Object.entries(binding).map(([key, cell]) => [key, cell.value])),
    )
  } catch (error) {
    if (attempt >= 4) throw error
    await new Promise((resolve) => setTimeout(resolve, 10_000 * attempt))
    return sparqlTable(query, attempt + 1)
  }
}

const sparqlString = (text: string) => JSON.stringify(text)

async function largestCities(scope: Scope, attempts: number): Promise<Row[]> {
  const cities = await largestCityList()
  const items = new Set<string>()
  // Wikidata often files a GeoNames id on a stub — Munich's has no French
  // label and three sitelinks — located in (P131) the city's real item. The
  // parent counts when its population is the city's, not a region's. Asked
  // in one query with the labels, this times the endpoint out.
  for (let start = 0; start < cities.length; start += 200) {
    const chunk = cities.slice(start, start + 200)
    const size = new Map(chunk.map((city) => [city.geonames, city.population]))
    const found = await sparqlTable(`SELECT ?geonames ?child ?parent ?pop WHERE {
  VALUES ?geonames { ${chunk.map((city) => sparqlString(city.geonames)).join(' ')} }
  ?child wdt:P1566 ?geonames .
  OPTIONAL { ?child wdt:P131 ?parent . ?parent wdt:P1082 ?pop }
}`)
    for (const row of found) {
      items.add(row.child!.split('/').pop()!)
      const population = Number(row.pop)
      const own = size.get(row.geonames!) ?? 0
      if (row.parent && population >= own * 0.3 && population <= own * 3) items.add(row.parent.split('/').pop()!)
    }
  }
  // Cologne, Geneva and Zürich carry the GeoNames id of their municipality,
  // not of the city: they are found by name instead, in the country's
  // languages, and the best-known namesake in that country wins.
  for (let start = 0; start < cities.length; start += 60) {
    const chunk = cities.slice(start, start + 60)
    const values = chunk.flatMap((city) =>
      city.names.flatMap((name) =>
        [...new Set([...city.languages, 'en', 'mul'])].map(
          (tag) => `(${sparqlString(city.geonames)} ${sparqlString(name)}@${tag} "${city.country}")`,
        ),
      ),
    )
    // Left to itself, the optimizer starts from every country's items.
    const found = await sparqlTable(`SELECT DISTINCT ?geonames ?item ?n WHERE {
  hint:Query hint:optimizer "None" .
  VALUES (?geonames ?name ?iso) { ${values.join(' ')} }
  ?item rdfs:label ?name .
  ?item wdt:P17 ?country .
  ?country wdt:P297 ?iso .
  ?item wikibase:sitelinks ?n .
  FILTER EXISTS { ?item wdt:P1082 [] }
}`)
    const best = new Map<string, { item: string; sitelinks: number }>()
    for (const row of found) {
      const sitelinks = Number(row.n) || 0
      if ((best.get(row.geonames!)?.sitelinks ?? -1) < sitelinks)
        best.set(row.geonames!, { item: row.item!.split('/').pop()!, sitelinks })
    }
    for (const { item } of best.values()) items.add(item)
  }

  const ids = [...items]
  const rows: Row[] = []
  for (let start = 0; start < ids.length; start += 300) {
    rows.push(
      ...(await sparql(
        `SELECT ?label ?n WHERE {
  VALUES ?item { ${ids
    .slice(start, start + 300)
    .map((id) => `wd:${id}`)
    .join(' ')} }
  ?item rdfs:label ?label ; wikibase:sitelinks ?n .
  ${scope.inLanguage('?label')}
}`,
        attempts,
      )),
    )
  }
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
 * The Wikipedia article each word lands on, redirects followed — null
 * when there is none, DISAMBIGUATION when it is a list of homonyms, which
 * says nothing of how known this one is. Asked fifty titles at a time, one
 * call after the other: the API throttles an anonymous client that hurries.
 */
const DISAMBIGUATION = '#homonymie'

async function wikipediaArticles(lang: Lang, path: string, words: readonly string[]): Promise<Map<string, string | null>> {
  const cache = new Map<string, string | null>(
    existsSync(path) ? Object.entries(JSON.parse(readFileSync(path, 'utf8'))) : [],
  )
  const missing = [...new Set(words)].filter((word) => !cache.has(word))
  if (missing.length > 0) console.log(`· wikipédia: ${missing.length} titres à résoudre`)

  for (let start = 0; start < missing.length; start += 50) {
    const batch = missing.slice(start, start + 50)
    const url = new URL(`https://${lang}.wikipedia.org/w/api.php`)
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
      writeFileSync(path, JSON.stringify(Object.fromEntries(cache)))
      console.log(`  ${Math.min(start + 50, missing.length)}/${missing.length}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  return cache
}

/**
 * Daily visits of Wikipedia articles over the last published month, read from
 * the clickstream dump: one file where the pageviews API would take one call
 * per article, and throttle long before the end. Sitelinks cannot say how well
 * known a thing is — bots wrote an article in forty languages for every bird
 * species and every French commune, so "Aigle martial" and "Abrest" counted
 * as widely known. What the language's readers open today tells them apart.
 *
 * The dump drops the links followed ten times or fewer in the month, so an
 * article almost nobody opens reads as zero, which is what it is. It is
 * streamed and only the wanted titles are kept: the English one weighs half a
 * gigabyte compressed, far more than a string can hold once inflated.
 */
async function wikipediaVisits(lang: Lang, titles: ReadonlySet<string>): Promise<Map<string, number>> {
  const now = new Date()
  let path: string | null = null
  let days = 30
  // A month's dump comes out in the first days of the next: when the last one
  // is not there yet, the one before it is.
  for (const back of [1, 2]) {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))
    const tag = month.toISOString().slice(0, 7)
    const candidate = `.cache/clickstream-${lang}wiki-${tag}.tsv.gz`
    if (!existsSync(candidate)) {
      const response = await wikimedia(`${CLICKSTREAM_URL}/${tag}/clickstream-${lang}wiki-${tag}.tsv.gz`)
      if (response.status === 404) continue
      console.log(`· clickstream ${lang} ${tag}: téléchargement`)
      writeFileSync(candidate, Buffer.from(await response.arrayBuffer()))
    }
    path = candidate
    days = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate()
    break
  }
  if (!path) throw new Error('clickstream: aucun mois publié')

  const visits = new Map<string, number>()
  const lines = createInterface({ input: createReadStream(path).pipe(createGunzip()), crlfDelay: Infinity })
  for await (const line of lines) {
    const [, target = '', , count = '0'] = line.split('\t')
    if (target === '') continue
    const title = target.replace(/_/g, ' ')
    if (!titles.has(title)) continue
    visits.set(title, (visits.get(title) ?? 0) + Number(count) / days)
  }
  console.log(`· clickstream ${lang}: ${visits.size} articles lus`)
  return visits
}

interface Lexique {
  /** Normalized form → the lemma it belongs to. */
  lemmaOf: Map<string, string>
  /** Normalized lemma → every noun and adjective form, in their own spelling. */
  formsOf: Map<string, string[]>
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

  for (const line of lines.slice(1)) {
    const columns = line.split('\t')
    const spelling = (columns[orthoAt] ?? '').trim()
    const word = normalizeWord(spelling)
    if (word === '') continue

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

  console.log(`· lexique: ${formsOf.size} lemmes`)
  return { lemmaOf, formsOf }
}

/**
 * The English Wiktionary's topic categories below each root, as Wiktextract
 * names them. Asked once per root, slowly — the API throttles an anonymous
 * client that hurries — and cached for good: the tree barely moves.
 */
async function topicTree(roots: readonly string[]): Promise<Set<string>> {
  const cache: Record<string, string[]> = existsSync(TOPIC_TREE_CACHE)
    ? JSON.parse(readFileSync(TOPIC_TREE_CACHE, 'utf8'))
    : {}
  const all = new Set<string>()

  for (const root of roots) {
    if (!cache[root]) {
      const seen = new Set([root])
      let frontier = [root]
      for (let depth = 0; depth < 6 && frontier.length > 0; depth++) {
        const next: string[] = []
        for (const topic of frontier) {
          let cursor: string | null = null
          do {
            const url = new URL(EN_WIKTIONARY_API)
            url.searchParams.set('action', 'query')
            url.searchParams.set('list', 'categorymembers')
            url.searchParams.set('cmtitle', `Category:en:${topic}`)
            url.searchParams.set('cmtype', 'subcat')
            url.searchParams.set('cmlimit', '500')
            url.searchParams.set('format', 'json')
            if (cursor) url.searchParams.set('cmcontinue', cursor)
            const payload = (await (await wikimedia(url)).json()) as {
              query?: { categorymembers?: { title: string }[] }
              continue?: { cmcontinue?: string }
            }
            for (const member of payload.query?.categorymembers ?? []) {
              // Only the topic subcategories: "Category:English terms…" and
              // the thesaurus pages are bookkeeping, not animals.
              if (!member.title.startsWith('Category:en:')) continue
              const name = member.title.slice('Category:en:'.length)
              if (!seen.has(name)) {
                seen.add(name)
                next.push(name)
              }
            }
            cursor = payload.continue?.cmcontinue ?? null
            await new Promise((resolve) => setTimeout(resolve, 1_500))
          } while (cursor)
        }
        frontier = next
      }
      cache[root] = [...seen]
      writeFileSync(TOPIC_TREE_CACHE, JSON.stringify(cache, null, 1))
      console.log(`· wiktionary ${root}: ${seen.size} thèmes`)
    }
    for (const topic of cache[root]!) all.add(topic)
  }
  return all
}

interface Kaikki extends Lexique {
  /** Topic category → the words the Wiktionary files under it, in their own spelling. */
  topics: Map<string, string[]>
}

/** Tags that make a form something a player would not type as an answer. */
const FORM_NOISE = /^(?:diminutive|augmentative|obsolete|archaic|dated|dialectal|rare|nonstandard|alternative|misspelling|romanization|table-tags|inflection-template|class|genitive|dative|accusative|ablative|vocative|instrumental|comparative|superlative|strong|weak|mixed|possessive|abbreviation|colloquial|informal|pejorative)$/

/**
 * Nouns and adjectives of one language, read from Wiktextract's dump of the
 * English Wiktionary: how each word bends — "Katzen" for "Katze", "roja" for
 * "rojo" — and which topic categories file it. The dumps are large (English
 * nouns alone weigh 1.7 GB), so they are streamed once and only what the
 * import reads is kept.
 */
async function loadKaikki(source: LanguageSource, path: string, wanted: ReadonlySet<string>): Promise<Kaikki> {
  if (existsSync(path)) {
    const cached = JSON.parse(readFileSync(path, 'utf8')) as {
      wanted: string[]
      forms: [string, string[]][]
      topics: [string, string[]][]
    }
    // A topic added since the cache was written is not in it: stream again.
    if ([...wanted].every((topic) => cached.wanted.includes(topic))) {
      const formsOf = new Map(cached.forms)
      const lemmaOf = new Map<string, string>()
      for (const [lemma, forms] of formsOf) for (const form of forms) lemmaOf.set(normalizeWord(form), lemma)
      for (const lemma of formsOf.keys()) lemmaOf.set(lemma, lemma)
      console.log(`· kaikki ${source.code}: ${formsOf.size} lemmes (cache)`)
      return { lemmaOf, formsOf, topics: new Map(cached.topics) }
    }
  }

  const formsOf = new Map<string, string[]>()
  const topics = new Map<string, string[]>()
  for (const pos of ['noun', 'adj']) {
    const url = `${KAIKKI_URL}/${source.kaikki}/pos-${pos}/kaikki.org-dictionary-${source.kaikki}-by-pos-${pos}.jsonl`
    console.log(`· kaikki ${source.code} ${pos}: lecture`)
    const response = await fetch(url, { headers: { 'User-Agent': AGENT } })
    if (!response.ok || !response.body) throw new Error(`kaikki ${pos}: HTTP ${response.status}`)
    const lines = createInterface({ input: Readable.fromWeb(response.body as never), crlfDelay: Infinity })
    let read = 0
    for await (const line of lines) {
      if (++read % 200_000 === 0) console.log(`  ${read} entrées`)
      let entry: {
        word?: string
        lang_code?: string
        forms?: { form?: string; tags?: string[] }[]
        senses?: { categories?: (string | { name?: string })[]; tags?: string[] }[]
      }
      try {
        entry = JSON.parse(line)
      } catch {
        continue
      }
      const word = entry.word?.trim()
      if (!word || entry.lang_code !== source.code) continue
      const lemma = normalizeWord(word)
      if (lemma === '') continue

      for (const form of entry.forms ?? []) {
        const spelling = form.form?.trim()
        const tags = form.tags ?? []
        if (!spelling || spelling === word) continue
        // A plural or a feminine is an answer; a genitive or a diminutive is not.
        if (!tags.includes('plural') && !tags.includes('feminine')) continue
        if (tags.some((tag) => FORM_NOISE.test(tag))) continue
        const forms = formsOf.get(lemma) ?? []
        if (!forms.includes(spelling)) forms.push(spelling)
        formsOf.set(lemma, forms)
      }

      const filed = new Set<string>()
      for (const sense of entry.senses ?? []) {
        for (const category of sense.categories ?? []) {
          const name = typeof category === 'string' ? category : category.name
          if (name && wanted.has(name)) filed.add(name)
        }
      }
      for (const name of filed) {
        const list = topics.get(name) ?? []
        if (!list.includes(word)) list.push(word)
        topics.set(name, list)
      }
    }
  }

  writeFileSync(path, JSON.stringify({ wanted: [...wanted], forms: [...formsOf], topics: [...topics] }))
  const lemmaOf = new Map<string, string>()
  for (const [lemma, forms] of formsOf) for (const form of forms) lemmaOf.set(normalizeWord(form), lemma)
  for (const lemma of formsOf.keys()) lemmaOf.set(lemma, lemma)
  console.log(`· kaikki ${source.code}: ${formsOf.size} lemmes, ${topics.size} thèmes`)
  return { lemmaOf, formsOf, topics }
}

/** Words too common in a gloss to say which sense a translation belongs to. */
const GLOSS_NOISE = new Set(['the', 'and', 'any', 'for', 'from', 'with', 'that', 'this', 'which', 'one', 'who', 'its', 'are', 'used', 'kind', 'type', 'sort', 'other', 'such', 'also'])

/** Five letters are enough to hear "domestic" in "domesticated". */
function glossStems(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter((word) => !GLOSS_NOISE.has(word)).map((word) => word.slice(0, 5))
}

/**
 * What the English Wiktionary files under a topic, translated into the other
 * languages. It knows far more about "cat" (Cats, Felids) than about "kat" or
 * "Katze", whose entries are rarely filed at all, and every translation table
 * says what the cat is called elsewhere.
 *
 * Only the translations of the sense the topic is on are taken: "orange" is a
 * fruit in one sense and a tree in another, and "sinaasappelboom" is no
 * fruit. A table hangs either on its sense, or on the entry with a short label
 * ("fruit", "domestic species") that has to be found in the sense's gloss.
 */
async function loadTranslations(
  langs: readonly Lang[],
  wanted: ReadonlySet<string>,
): Promise<Map<Lang, Map<string, string[]>>> {
  if (existsSync(TRANSLATIONS_CACHE)) {
    const cached = JSON.parse(readFileSync(TRANSLATIONS_CACHE, 'utf8')) as {
      wanted: string[]
      byLang: Record<string, [string, string[]][]>
    }
    if ([...wanted].every((topic) => cached.wanted.includes(topic)) && langs.every((lang) => cached.byLang[lang])) {
      console.log('· traductions: cache')
      return new Map(langs.map((lang) => [lang, new Map(cached.byLang[lang])]))
    }
  }

  const byLang = new Map<Lang, Map<string, string[]>>(langs.map((lang) => [lang, new Map()]))
  const file = (lang: Lang, topic: string, word: string) => {
    const topics = byLang.get(lang)
    if (!topics) return
    const list = topics.get(topic) ?? []
    if (!list.includes(word)) list.push(word)
    topics.set(topic, list)
  }

  type Translation = { lang_code?: string; word?: string; sense?: string }
  for (const pos of ['noun', 'adj']) {
    const url = `${KAIKKI_URL}/English/pos-${pos}/kaikki.org-dictionary-English-by-pos-${pos}.jsonl`
    console.log(`· traductions ${pos}: lecture`)
    const response = await fetch(url, { headers: { 'User-Agent': AGENT } })
    if (!response.ok || !response.body) throw new Error(`kaikki traductions ${pos}: HTTP ${response.status}`)
    const lines = createInterface({ input: Readable.fromWeb(response.body as never), crlfDelay: Infinity })
    let read = 0
    for await (const line of lines) {
      if (++read % 200_000 === 0) console.log(`  ${read} entrées`)
      let entry: {
        lang_code?: string
        translations?: Translation[]
        senses?: { categories?: (string | { name?: string })[]; glosses?: string[]; raw_glosses?: string[]; translations?: Translation[] }[]
      }
      try {
        entry = JSON.parse(line)
      } catch {
        continue
      }
      if (entry.lang_code !== 'en') continue

      const filed: { topics: string[]; stems: Set<string> }[] = []
      for (const sense of entry.senses ?? []) {
        const topics: string[] = []
        for (const category of sense.categories ?? []) {
          const name = typeof category === 'string' ? category : category.name
          if (name && wanted.has(name)) topics.push(name)
        }
        if (topics.length === 0) continue
        filed.push({ topics, stems: new Set(glossStems([...(sense.glosses ?? []), ...(sense.raw_glosses ?? [])].join(' '))) })
        for (const translation of sense.translations ?? []) {
          const word = translation.word?.trim()
          if (word) for (const topic of topics) file(translation.lang_code as Lang, topic, word)
        }
      }
      if (filed.length === 0) continue

      for (const translation of entry.translations ?? []) {
        const word = translation.word?.trim()
        if (!word || !byLang.has(translation.lang_code as Lang)) continue
        const label = glossStems(translation.sense ?? '')
        for (const { topics, stems } of filed) {
          // An unlabelled table can only be trusted when every sense is in the topic.
          const matches =
            label.length === 0
              ? filed.length === (entry.senses ?? []).length
              : label.filter((stem) => stems.has(stem)).length * 2 >= label.length
          if (matches) for (const topic of topics) file(translation.lang_code as Lang, topic, word)
        }
      }
    }
  }

  writeFileSync(
    TRANSLATIONS_CACHE,
    JSON.stringify({ wanted: [...wanted], byLang: Object.fromEntries([...byLang].map(([lang, topics]) => [lang, [...topics]])) }),
  )
  for (const [lang, topics] of byLang) {
    console.log(`· traductions ${lang}: ${[...topics.values()].reduce((sum, words) => sum + words.length, 0)} mots`)
  }
  return byLang
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
  // Any Latin letter: Latin-1 alone turned away « cœur », « œil » and « bœuf »,
  // and the Wiktionary's typographic apostrophe every « maître d’hôtel ».
  if (!/^\p{Script=Latin}[\p{Script=Latin}'’ -]*$/u.test(display.normalize('NFC'))) return false
  // A letter the matching cannot spell in ASCII — « ə », « ŋ » — would vanish
  // from the answer, and a word judged without one of its letters is another word.
  return [...display.normalize('NFC')].every((char) => !/\p{L}/u.test(char) || normalizeWord(char) !== '')
}

/**
 * A taxon with no real vernacular name still answers Wikidata's P1843 query,
 * filled by a contributor with the scientific binomial itself ("Arenga
 * pinnata") or a coinage that apes one ("Alisma Fausse Renoncule") — every
 * word capitalised, unlike a real common name, which stays in sentence case
 * even when it runs to several words ("belle de nuit").
 */
function looksScientific(display: string): boolean {
  const words = display.split(' ')
  return words.length > 1 && words.every((word) => /^\p{Lu}/u.test(word))
}

interface Entry {
  display: string
  sitelinks: number
  alias: boolean
  /**
   * The label as Wikidata wrote it, which is what Wikipedia titles its article
   * after: "Nike, Inc." is found, "Nike" is the goddess.
   */
  title: string
}

function main(argv: readonly string[]) {
  const langArg = argv.find((arg) => arg.startsWith('--lang='))?.slice('--lang='.length) ?? 'fr'
  if (!(langArg in LANGUAGES)) throw new Error(`langue inconnue : ${langArg}`)
  const lang = langArg as Lang
  const source = LANGUAGES[lang]
  const paths = pathsFor(lang)
  const scope = scopeFor(source.labels, lang)

  mkdirSync(paths.pulls, { recursive: true })
  mkdirSync(WIKT_CACHE, { recursive: true })
  mkdirSync(paths.out, { recursive: true })

  const only = new Set(argv.filter((arg) => !arg.startsWith('--lang=')))
  const force = only.has('--force')
  const wanted = PULLS.filter((pull) => only.size === 0 || force || only.has(pull.id))

  return (async () => {
    // French bends its words by Lexique and files them by its own Wiktionary;
    // every other language reads both from the English Wiktionary.
    let lexicon: Lexique
    let kaikki: Kaikki | null = null
    const topicsOf = new Map<string, Set<string>>()
    if (lang === 'fr') {
      lexicon = await loadLexique()
    } else {
      const everyTopic = new Set<string>()
      for (const [categoryId, spec] of Object.entries(TOPICS)) {
        const skipped = new Set(spec.skip ?? [])
        const topics = new Set([...spec.topics, ...(await topicTree(spec.expand ?? []))].filter((topic) => !skipped.has(topic)))
        topicsOf.set(categoryId, topics)
        for (const topic of topics) everyTopic.add(topic)
      }
      kaikki = await loadKaikki(source, paths.kaikki, everyTopic)
      lexicon = kaikki
      // English files its own words; the others also read its translations.
      if (lang !== 'en') {
        const others = (Object.keys(LANGUAGES) as Lang[]).filter((code) => code !== 'fr' && code !== 'en')
        const translated = (await loadTranslations(others, everyTopic)).get(lang)!
        for (const [topic, words] of translated) {
          kaikki.topics.set(topic, [...new Set([...(kaikki.topics.get(topic) ?? []), ...words])])
        }
      }
    }
    const frequencies = await loadFrequencies(lang, paths.wordfreq)
    const community = (await loadCommunityWords())[lang] ?? {}

    const byPull = new Map<string, Row[]>()
    const failed: string[] = []
    for (const pull of wanted) {
      try {
        // Outside French, the vernacular names of a taxon are a handful of rows
        // for a query that times out more often than not — five butterflies in
        // Italian — and the Wiktionary's topics already hold those animals. One
        // try, then the category is built without it.
        const attempts = pull.vernacular && lang !== 'fr' ? 1 : 4
        byPull.set(pull.id, await pullRows(pull, scope, paths.pulls, force && only.has(pull.id), attempts))
      } catch (error) {
        // One dead query must not cost the whole import: the categories built
        // from it keep the file they already have on disk.
        failed.push(pull.id)
        console.warn(`! ${pull.id}: abandonné — ${(error as Error).message}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 3_000))
    }

    /** The words a Wiktionary files under this very category. */
    /**
     * The words a Wiktionary files under this very category, and among them
     * those only a subcategory files: a breed, a butterfly or a young animal
     * named like an everyday word — « Picard », « Diane », « enfant ».
     */
    const attestedWords = async (categoryId: string): Promise<{ words: string[]; deep: Set<string> } | null> => {
      if (kaikki) {
        const topics = topicsOf.get(categoryId)
        if (!topics) return null
        return { words: [...topics].flatMap((topic) => kaikki!.topics.get(topic) ?? []), deep: new Set() }
      }
      const roots = FRENCH_WIKTIONARY[categoryId]
      if (!roots) return null
      const fromRoots = new Set<string>()
      const fromBelow = new Set<string>()
      const words: string[] = []
      for (const root of roots) {
        // `frenchSubcategories` caches the whole walked tree under the root:
        // a title added to FRENCH_SKIPPED after that cache was written would
        // otherwise stay in it forever, so the skip is re-applied here too.
        const titles = FRENCH_WALKED.has(categoryId)
          ? (await frenchSubcategories(root)).filter((title) => !FRENCH_SKIPPED.has(title))
          : [root]
        for (const title of titles) {
          try {
            const listed = await wiktionaryWords(title, false)
            words.push(...listed)
            for (const word of listed) (title === root ? fromRoots : fromBelow).add(normalizeWord(word))
          } catch (error) {
            console.warn(`! wiktionnaire ${title}: ${(error as Error).message}`)
          }
        }
      }
      return { words, deep: new Set([...fromBelow].filter((key) => !fromRoots.has(key))) }
    }

    // Every category is gathered before any Wikipedia is read: the visits
    // come from one dump, streamed once for all of them.
    const gathered: { id: string; best: Map<string, Entry>; attested: Set<string>; commonNouns: boolean; names: boolean }[] = []
    for (const category of CATEGORY_SOURCES) {
      // A category is a union: it is worth rebuilding from the pulls that
      // answered, as long as one did. Rebuilding from none would empty it.
      const sources = category.pulls.filter((id) => byPull.has(id))
      if (sources.length === 0) {
        console.warn(`~ ${category.id}: inchangé (aucune source)`)
        continue
      }
      if (sources.length < category.pulls.length) {
        console.warn(`~ ${category.id}: partiel (${sources.length}/${category.pulls.length} sources)`)
      }

      // A word also reachable from an `exclude` pull is dropped rather than
      // added: "fruit" and "fleur" are anatomical structures too, just of a
      // plant rather than a body, and the class doesn't tell the two apart.
      const excluded = new Set<string>()
      for (const id of category.exclude ?? []) {
        for (const row of byPull.get(id) ?? []) {
          const key = normalizeWord(row.display)
          if (key !== '') excluded.add(key)
        }
      }
      // Dropped by hand: kept out of the Wiktionary's words too, unlike the pulls.
      const dropped = new Set((DROPPED_WORDS[category.id]?.[lang] ?? []).map(normalizeWord))
      for (const key of dropped) excluded.add(key)

      // One entry per normalized word: the shortest spelling wins, and a word
      // found in several pulls keeps its best notoriety.
      // `alias` stays true only while every row naming the word was an alias.
      const best = new Map<string, Entry>()
      for (const id of sources) {
        const corporate = PULLS.find((pull) => pull.id === id)?.corporate === true
        for (const row of byPull.get(id)!) {
          // "le Canada" is a real French alias, but keeping it would let the
          // player answer a country on the letter L. Only aliases are stripped:
          // in a label the article belongs to the name ("Le Havre").
          let cleaned = (row.alias ? row.display.replace(source.articles, '') : row.display)
            .trim()
            .replace(/\s+/g, ' ')
          const title = cleaned
          // "The Walt Disney Company" is said "Disney" or "Walt Disney": once the
          // legal form is gone, a leading article is only a way to answer on T.
          if (corporate && LEGAL_FORM.test(cleaned)) cleaned = cleaned.replace(LEGAL_FORM, '').replace(CORPORATE_ARTICLE, '')

          // Wikidata writes a French occupation as "boulanger ou boulangère".
          // Both forms are words a player may type, so both are kept.
          for (const display of source.alternatives ? cleaned.split(source.alternatives) : [cleaned]) {
            if (!acceptable(display)) continue
            if (category.id === 'plantes' && looksScientific(display)) continue
            const key = normalizeWord(display)
            if (key === '' || excluded.has(key) || PLACEHOLDER_ELEMENT.test(key)) continue
            if (row.alias && key.replace(/ /g, '').length < (category.shortestAlias ?? 0)) continue
            const current = best.get(key)
            if (!current) best.set(key, { display, sitelinks: row.sitelinks, alias: row.alias === true, title: display === cleaned ? title : display })
            else {
              current.sitelinks = Math.max(current.sitelinks, row.sitelinks)
              current.alias &&= row.alias === true
              if (display.length < current.display.length) {
                current.display = display
                current.title = display === cleaned ? title : display
              }
            }
          }
        }
      }

      // The words the Wiktionary files under this very category: for them, and
      // only them, the corpus frequency measures the right sense.
      const listed = await attestedWords(category.id)
      const added = ADDED_WORDS[category.id]?.[lang] ?? []
      // Three moderators vouched for these: they are filed here as surely as a
      // Wiktionary word, and no homograph guess overrules them.
      const moderated = new Set((community[category.id] ?? []).map(normalizeWord))
      // Vetted by hand already: exempt from the STRICT_ATTESTED frequency
      // gate below, or a plant only ever added because no source names it
      // would need a corpus frequency to pass a filter meant to catch what
      // no one added on purpose.
      const handPicked = new Set([...added, ...(community[category.id] ?? [])].map((word) => normalizeWord(word.trim().replace(/\s+/g, ' '))))
      const attested = new Set<string>()
      for (const word of [...(listed?.words ?? []), ...added, ...(community[category.id] ?? [])]) {
        const display = word.trim().replace(/\s+/g, ' ')
        if (!acceptable(display)) continue
        const key = normalizeWord(display)
        if (dropped.has(key) || PLACEHOLDER_ELEMENT.test(key)) continue
        // Filed only deep down, unknown to Wikidata, and far more common than
        // any animal name: the word's everyday sense is another one, and its
        // frequency, its article's visits and the typo tolerance around it
        // would all lie.
        const everyday = frequencies.get(display.normalize('NFC').toLowerCase()) ?? 0
        const homograph = HOMOGRAPH_PRONE.has(category.id) && listed?.deep.has(key) && !best.has(key) && everyday >= HOMOGRAPH_FREQUENCY
        if (homograph && !moderated.has(key)) continue
        // A flora or a toolshed word with no measured use at all and no
        // Wikidata entry either is filed by a Wiktionary contributor, not
        // said by anyone: dropped, unless it was vouched for by hand.
        const obscure = STRICT_ATTESTED.has(category.id) && everyday === 0 && !best.has(key) && !handPicked.has(key)
        if (obscure) continue
        if (key !== '') attested.add(key)
        if (key === '' || best.has(key)) continue
        // No sitelinks: a Wiktionary word is rated on its corpus frequency
        // alone, which is exactly what a common noun has.
        best.set(key, { display, sitelinks: 0, alias: false, title: display })
      }
      gathered.push({ id: category.id, best, attested, commonNouns: listed !== null, names: category.names === true })
    }

    // Inflected forms borrow the notoriety of the word they bend, so only the
    // words themselves are looked up.
    const articles = await wikipediaArticles(
      lang,
      paths.articles,
      gathered.flatMap(({ best }) => [...best.values()].map((entry) => entry.title)),
    )
    const titles = new Set<string>()
    for (const title of articles.values()) if (title && title !== DISAMBIGUATION) titles.add(title)
    const visits = await wikipediaVisits(lang, titles)

    for (const { id, best, attested, commonNouns, names } of gathered) {
      const rows = new Map<string, WordRow>()
      const dropped = new Set<string>()
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
        const everyday = frequencies.get(entry.display.normalize('NFC').toLowerCase()) ?? 0
        const senseKnown =
          commonNouns && (attested.has(key) || (!entry.alias && entry.sitelinks >= MAJOR_SITELINKS))
        const frequency = senseKnown ? everyday : 0

        const article = articles.get(entry.title) ?? null
        let daily: number | undefined
        if (article !== DISAMBIGUATION || entry.alias) {
          let visited = article && article !== DISAMBIGUATION ? (visits.get(article) ?? 0) : 0
          const niche = entry.sitelinks > 0 && entry.sitelinks < NICHE_SITELINKS
          if (niche && !attested.has(key)) visited = Math.min(visited, visitsWorth(commonNouns ? everyday : 0))
          // A word with no article of its own reads zero rather than nothing,
          // or the domain would fall back on the bot-inflated sitelinks.
          daily = Math.round(visited)
        }
        if (!attested.has(key) && frequency === 0 && daily !== undefined && daily <= SHIPPED_MIN_DAILY_VISITS && entry.sitelinks < NICHE_SITELINKS) {
          dropped.add(key)
          continue
        }
        const fields = [entry.display, entry.sitelinks, rounded(frequency)] as const
        rows.set(key, daily === undefined ? fields : [...fields, '', daily])
      }

      // Every inflected form of an accepted word is accepted too, pointing back
      // at it: "chats" scores like "chat", and cannot be played twice in the
      // same run under two spellings.
      let variants = 0
      for (const [key, entry] of names ? [] : best) {
        if (dropped.has(key)) continue
        const lemma = lexicon.lemmaOf.get(key)
        if (!lemma) continue
        for (const inflected of lexicon.formsOf.get(lemma) ?? []) {
          // The English Wiktionary writes German plurals with their article —
          // "die Katzenjungen" — which would answer an animal on D.
          const form = inflected.replace(source.articles, '').trim()
          const formKey = normalizeWord(form)
          if (formKey === '' || rows.has(formKey) || !acceptable(form)) continue
          const frequency = attested.has(key) ? (frequencies.get(form.normalize('NFC').toLowerCase()) ?? 0) : 0
          rows.set(formKey, [form, entry.sitelinks, rounded(frequency), key])
          variants++
        }
      }

      // Spellings the game compacts alike — « Alpen-Steinbock » and
      // « Alpensteinbock », « Formule E » and « formulée » — answer as one: the
      // domain keeps the first it reads, which the sort order picks at random.
      // A word beats a form, then the better known; forms of a dropped word
      // follow the one kept.
      const kept = new Map<string, string>()
      const renamed = new Map<string, string>()
      const fame = (row: WordRow) => (row[4] ?? 0) * 1_000 + row[1]
      const byPreference = [...rows.entries()].sort(([, a], [, b]) => Number(Boolean(a[3])) - Number(Boolean(b[3])) || fame(b) - fame(a))
      for (const [key, row] of byPreference) {
        const compact = compactWord(row[0])
        const winner = kept.get(compact)
        if (winner === undefined) kept.set(compact, key)
        else {
          rows.delete(key)
          if (!row[3]) renamed.set(key, winner)
        }
      }
      for (const [key, row] of rows) {
        const lemma = row[3] ? renamed.get(row[3]) : undefined
        if (lemma !== undefined) rows.set(key, [row[0], row[1], row[2], lemma])
      }

      const lines = [...rows.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([, row]) => JSON.stringify(row))

      // One row per line, so a regenerated dictionary diffs word by word.
      writeFileSync(`${paths.out}/${id}.json`, `[\n${lines.join(',\n')}\n]\n`)
      console.log(`→ ${lang}/${id}: ${lines.length} mots (dont ${variants} formes fléchies)`)
    }
    if (failed.length > 0) console.warn(`! sources en échec : ${failed.join(', ')}`)
  })()
}

await main(process.argv.slice(2))
