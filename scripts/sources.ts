/**
 * Where the word lists come from. A *pull* is one SPARQL query against
 * Wikidata; a category is a composition of pulls, so a heavy query (the taxon
 * ones) is paid for once even when several categories are built from it.
 */
export interface Pull {
  id: string
  /** Wikidata class. Instances of it — and of its subclasses when `deep`. */
  of: string
  /** Taxon pulls read the vernacular name (P1843) instead of the label. */
  vernacular?: boolean
  deep?: boolean
  /**
   * Edible things are modelled as subclasses of "vegetable", not as instances:
   * a carrot is a kind of vegetable, not one particular vegetable. Instance
   * pulls miss almost all of them.
   */
  subclass?: boolean
  /** Escape hatch for a shape the flags cannot express, written for one language scope. */
  raw?: (scope: Scope) => string
  /** Fetch aliases too — worth it for entities the player may name in several ways. */
  aliases?: boolean
  /** Only for communes: keeps the map to places a player has heard of. */
  minPopulation?: number
  /**
   * Fetch the female form of the label (P2521) as an alias: most languages
   * name a job in the masculine, and "Bäckerin" is as good an answer.
   */
  female?: boolean
  /** Company names: "Nike, Inc." and "Apple Inc." are answered as Nike and Apple. */
  corporate?: boolean
  /**
   * The largest cities of each country, ranked by GeoNames and named by
   * Wikidata through their GeoNames id (P1566): ranking them in SPARQL times
   * the endpoint out, and its own city classes leave out Paris and Berlin.
   */
  largestCities?: boolean
  /**
   * Bumped whenever the query changes what its rows carry: the cache under
   * `.cache/pulls` is keyed on it, and shared by every checkout of the repo —
   * another one may still be reading the old file.
   */
  version?: number
  /**
   * With `largestCities`: these countries — GeoNames' ISO codes — also keep
   * every city from `minCityPopulation` up, not only their largest.
   */
  cityCountries?: readonly string[]
  minCityPopulation?: number
}

/**
 * A country of this many people keeps its ten largest cities, a smaller one
 * its five: a player who names Charleroi or Porto Alegre has not cheated.
 * Luxembourg and Singapore stay at five.
 */
export const LARGE_COUNTRY_POPULATION = 8_000_000
export const CITIES_PER_COUNTRY = { large: 10, small: 5 }

/**
 * The ten countries the game's seven languages are spoken in, and the
 * population from which their cities are all kept. A top-ten list leaves out
 * the city a player answers without thinking — Villeurbanne, Coventry,
 * Sabadell — where the rest of the world would only bring in towns nobody
 * can name.
 */
export const BIG_CITY_COUNTRIES = ['BE', 'FR', 'DE', 'NL', 'ES', 'BR', 'PT', 'GB', 'IE', 'IT'] as const
export const BIG_CITY_POPULATION = 100_000

/** The language a query reads its labels in, and the Wikipedia it trusts for titles. */
export interface Scope {
  /** A SPARQL filter keeping a literal in the language, e.g. `inLanguage('?label')`. */
  inLanguage(variable: string): string
  /** `https://fr.wikipedia.org/` */
  wikipedia: string
  /**
   * Binds `?label` to the item's label in the language, or else to its
   * multilingual one: Wikidata now files a name spelt alike everywhere —
   * Oslo, WhatsApp, PlayStation — under "mul" alone, with no "en" or "fr".
   * Only for names: a taxon's "mul" label is its Latin binomial.
   */
  label(item: string): string
  /** Binds `?alias` to each of the item's aliases in the language, when it has any. */
  aliases(item: string): string
}

export function scopeFor(labels: readonly string[], wiki: string): Scope {
  const tags = labels.map((tag) => `"${tag}"`).join(', ')
  const inLanguage = (variable: string) =>
    labels.length === 1 ? `FILTER(lang(${variable}) = ${tags})` : `FILTER(lang(${variable}) IN (${tags}))`
  return {
    inLanguage,
    wikipedia: `https://${wiki}.wikipedia.org/`,
    label: (item) => `OPTIONAL { ${item} rdfs:label ?own . ${inLanguage('?own')} }
  OPTIONAL { ${item} rdfs:label ?mul . FILTER(lang(?mul) = "mul") }
  BIND(COALESCE(?own, ?mul) AS ?label) FILTER(BOUND(?label))`,
    aliases: (item) => `OPTIONAL { ${item} skos:altLabel ?alias . ${inLanguage('?alias')} }`,
  }
}

const STAPLE_MATERIALS = [
  // Wood, stone, glass, paper, plastic, leather, cotton, wool, clay, concrete,
  // brick, sand, gold, silver, copper, aluminium, steel, iron, tin, bronze,
  // lead, marble, zinc.
  'Q287', 'Q22731', 'Q11469', 'Q11472', 'Q11474', 'Q286', 'Q11457', 'Q42329', 'Q42302', 'Q22657', 'Q40089',
  'Q34679', 'Q677', 'Q897', 'Q1090', 'Q753', 'Q11427', 'Q34095', 'Q663', 'Q743', 'Q37756', 'Q40861', 'Q23757',
  // Cement, plaster, roof tile, slate, bitumen, tar, asphalt, plywood, mortar,
  // rammed earth, wattle and daub, lime, adobe, terracotta, gravel, granite.
  'Q45190', 'Q274988', 'Q268547', 'Q207079', 'Q167510', 'Q186209', 'Q202251', 'Q219803', 'Q189566', 'Q1363009',
  'Q1368940', 'Q250423', 'Q359957', 'Q60424', 'Q133833', 'Q41177',
  // Cardboard, rubber, porcelain, ceramic, faience, cork, Kevlar, glass fibre,
  // polystyrene, paraffin, wax, silicone, resin, textile, linen, enamel,
  // crystal.
  'Q389782', 'Q18113858', 'Q130693', 'Q45621', 'Q209671', 'Q49444', 'Q207344', 'Q5861', 'Q146243', 'Q177540',
  'Q124695', 'Q146439', 'Q145205', 'Q28823', 'Q1426327', 'Q213371', 'Q392551',
  // Ivory, nacre, amber, horn, bone, graphite, diamond, quartz, mica, coal, petroleum.
  'Q82001', 'Q215865', 'Q25381', 'Q65284752', 'Q265868', 'Q5309', 'Q5283', 'Q43010', 'Q114675', 'Q24489', 'Q22656',
  // Salt, oil, silk, straw, fur, feather, soil, mud, dust, ash, charcoal,
  // petrol, diesel, natural gas, steam, snow, rock, chalk.
  'Q11254', 'Q42962', 'Q37681', 'Q160066', 'Q197204', 'Q81025', 'Q36133', 'Q170449', 'Q165632', 'Q152079', 'Q177463',
  'Q39558', 'Q38423', 'Q40858', 'Q3251738', 'Q7561', 'Q8063', 'Q183670',
  // Polyester, nylon, latex, neoprene, acrylic glass, carbon fibre, velvet,
  // lace, suede, denim, wicker, rattan, stainless steel, sheet metal.
  'Q188245', 'Q177941', 'Q244680', 'Q143937', 'Q146123', 'Q5860', 'Q243519', 'Q231250', 'Q1071417', 'Q652698',
  'Q1081013', 'Q323021', 'Q172587', 'Q211367',
  // Fire, water, air, ice, aether, gas, and the Earth.
  'Q3196', 'Q283', 'Q7391292', 'Q23392', 'Q381913', 'Q11432', 'Q2',
]

const BRAND_CLASSES = [
  // Brand, car manufacturer, business, public company, enterprise, company,
  // corporation, video game publisher, software company, technology company.
  'Q431289', 'Q786820', 'Q4830453', 'Q891723', 'Q6881511', 'Q783794', 'Q167037', 'Q1137109', 'Q1058914', 'Q18388277',
  // Trademark, food brand, drink brand, bottled water, car brand, perfume
  // brand, fashion label, fashion house, food manufacturer, motorcycle
  // manufacturer, chaebol, airline.
  'Q167270', 'Q16323605', 'Q114392939', 'Q1049049', 'Q10429667', 'Q137183855', 'Q1618899', 'Q1941779', 'Q1252971',
  'Q15081030', 'Q482517', 'Q46970',
  // Retail, supermarket, clothing store, hardware store and fast food chains.
  'Q507619', 'Q18043413', 'Q76213285', 'Q27970162', 'Q18509232',
  // Social networking service, online service, mobile app, instant messaging
  // client, online video platform, video and music streaming services.
  'Q3220391', 'Q19967801', 'Q620615', 'Q2462003', 'Q559856', 'Q59152282', 'Q15590336',
]

function brandLabel(scope: Scope): string {
  return `OPTIONAL { ?item rdfs:label ?own . ${scope.inLanguage('?own')} }
  OPTIONAL { ?item rdfs:label ?mul . FILTER(lang(?mul) = "mul") }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <${scope.wikipedia}> ; schema:name ?title . }
  FILTER(BOUND(?title) || BOUND(?mul))
  BIND(COALESCE(?own, ?mul, ?title) AS ?label)
  ${scope.aliases('?item')}`
}

const STAPLE_OBJECTS = [
  // Furniture, and what sits on it.
  'Q15026', 'Q42177', 'Q131514', 'Q35197', 'Q376',
  // Carried on a person or in a bag.
  'Q26965868', 'Q132041', 'Q17517', 'Q41607', 'Q134205', 'Q467505', 'Q5843', 'Q131740', 'Q200814', 'Q1642980',
  'Q23834',
  // Tableware and kitchen.
  'Q81881', 'Q32489', 'Q81895', 'Q57216', 'Q21167379', 'Q81727', 'Q5567094', 'Q153988', 'Q2366864', 'Q127666',
  // Tools.
  'Q40847', 'Q160137', 'Q14674', 'Q142690', 'Q25294', 'Q161071', 'Q154411', 'Q37077', 'Q11022', 'Q172833',
  'Q47107', 'Q168639',
  // Soft furnishings and light.
  'Q131696', 'Q99895', 'Q5852', 'Q191851', 'Q12888135', 'Q1395006',
  // Appliances and electronics.
  'Q37828', 'Q124441', 'Q289', 'Q101674', 'Q3962', 'Q250', 'Q7987', 'Q185091', 'Q267298',
]

export const PULLS: readonly Pull[] = [
  { id: 'countries', of: 'Q6256', aliases: true, version: 2 },
  // England, Scotland, Wales and Northern Ireland are the country a player
  // names, and no instance of "country": Wikidata files them as its parts.
  {
    id: 'home-nations',
    of: 'Q3336843',
    version: 2,
    raw: (scope) => `SELECT ?label ?alias ?n WHERE {
  VALUES ?item { wd:Q21 wd:Q22 wd:Q25 wd:Q26 }
  ?item wikibase:sitelinks ?n .
  ${scope.label('?item')}
  ${scope.aliases('?item')}
}`,
  },
  {
    id: 'capitals',
    of: 'Q5119',
    version: 2,
    // "Instance of capital" holds barely sixty items; what a player means by a
    // capital is the city some country declares as its own.
    raw: (scope) => `SELECT ?label ?alias ?n WHERE {
  ?country wdt:P31 wd:Q6256 ; wdt:P36 ?item .
  ?item wikibase:sitelinks ?n .
  ${scope.label('?item')}
  ${scope.aliases('?item')}
}`,
  },
  { id: 'largest-cities', of: 'Q515', largestCities: true, version: 2 },
  // The largest of each country are not enough for the ones the game is
  // played in: the player names the city next door, which no top-ten list
  // holds. Kept as its own pull, so the day the ten countries change — or
  // the floor moves — only this one query is paid for again.
  {
    id: 'big-cities',
    of: 'Q515',
    largestCities: true,
    cityCountries: BIG_CITY_COUNTRIES,
    minCityPopulation: BIG_CITY_POPULATION,
    version: 2,
  },
  // Iron, copper, bronze, and every alloy. No class of "material" will do:
  // "material" has food as a subclass, "building material" windows and menhirs.
  { id: 'metals', of: 'Q11426', subclass: true },
  // Every element, oxygen and neon included, which "metal" leaves out. The
  // ones not yet made come too, under names the import drops
  // (PLACEHOLDER_ELEMENT).
  { id: 'chemical-elements', of: 'Q11344' },
  // The words everyone gives first — bois, verre, cuir — sit under no class
  // that would not also drag in thousands of specialist products: in Spanish,
  // the "building material" item for wood is "madera para la construcción".
  // Named one by one instead, which is also how the category keeps its
  // building materials without the windows, soils and menhirs their class
  // holds. So are the four elements, which Wikidata ties to nothing but their
  // star signs — and the planet stands for earth, whose label is the word in
  // every language when the classical element's reads "signe terre".
  {
    id: 'staple-materials',
    of: 'Q287',
    version: 3,
    raw: (scope) => `SELECT ?label ?n WHERE {
  VALUES ?item { ${STAPLE_MATERIALS.map((id) => `wd:${id}`).join(' ')} }
  ?item rdfs:label ?label ; wikibase:sitelinks ?n .
  ${scope.inLanguage('?label')}
}`,
  },
  // Same idea as staple-materials: a class of "furniture" or "tool" drags in
  // every catalogued model, so the everyday objects are named one by one.
  // The Wiktionary tops this up with what a class could never enumerate —
  // "clé", "parapluie" are objects, not kinds of one.
  {
    id: 'staple-objects',
    of: 'Q15026',
    raw: (scope) => `SELECT ?label ?n WHERE {
  VALUES ?item { ${STAPLE_OBJECTS.map((id) => `wd:${id}`).join(' ')} }
  ?item rdfs:label ?label ; wikibase:sitelinks ?n .
  ${scope.inLanguage('?label')}
}`,
  },
  // "Anatomical structure" rather than a "part of the human body" query: most
  // everyday words — tête, main, œil — hang off the generic taxon-wide class,
  // not off a link to the specific human-body item. But that class also
  // covers plant anatomy — "fruit" and "fleur" are anatomical structures too —
  // so `exclude` below drops whatever also falls under "plant organ".
  { id: 'anatomy', of: 'Q4936952', subclass: true },
  { id: 'plant-organ', of: 'Q24060707', subclass: true },
  { id: 'colors', of: 'Q1075', deep: true },
  { id: 'colors-sub', of: 'Q1075', subclass: true },
  // Instances of "profession": the subclass tree of "occupation" holds trade
  // families ("métier du bois"), not the jobs themselves. Their French label is
  // the double-gendered form, which the import splits in two.
  { id: 'professions', of: 'Q28640', female: true },
  { id: 'professions-sub', of: 'Q28640', subclass: true },
  { id: 'sports', of: 'Q31629', deep: true },
  { id: 'sports-sub', of: 'Q349', subclass: true },
  { id: 'fruits', of: 'Q3314483', subclass: true },
  { id: 'vegetables', of: 'Q11004', subclass: true },
  // The everyday names — chat, chien, cheval — hang off "organism known by a
  // particular common name", not off the taxon tree, and no vernacular pull
  // brings them back.
  { id: 'common-names', of: 'Q55983715' },
  // The same class holds the plants known by a common name — tree, grass,
  // cabbage — which the animals category drops.
  {
    id: 'common-plants',
    of: 'Q55983715',
    raw: (scope) => `SELECT ?label ?n WHERE {
  ?item wdt:P31 wd:Q55983715 ; rdfs:label ?label ; wikibase:sitelinks ?n .
  ${scope.inLanguage('?label')}
  FILTER EXISTS { ?item wdt:P279* wd:Q756 }
}`,
  },
  // Most everyday plant names — chêne, sapin, tulipe — are the taxon's own
  // label rather than a "common name" entity, but the taxon's vernacular name
  // (P1843) still catches the rest: it is how the animal pulls above work.
  { id: 'plants-vernacular', of: 'Q756', vernacular: true },
  { id: 'mammals', of: 'Q7377', vernacular: true },
  { id: 'birds', of: 'Q5113', vernacular: true },
  { id: 'reptiles', of: 'Q10811', vernacular: true },
  { id: 'amphibians', of: 'Q10908', vernacular: true },
  { id: 'fish-ray', of: 'Q127282', vernacular: true },
  { id: 'fish-cartilaginous', of: 'Q28425', vernacular: true },
  // Insecta as a whole times the endpoint out, so the class is pulled one
  // order at a time and the category is rebuilt from whichever orders answered.
  { id: 'beetles', of: 'Q22671', vernacular: true },
  { id: 'butterflies', of: 'Q28319', vernacular: true },
  { id: 'flies', of: 'Q25312', vernacular: true },
  { id: 'hymenoptera', of: 'Q22651', vernacular: true },
  { id: 'hemiptera', of: 'Q26371', vernacular: true },
  { id: 'dragonflies', of: 'Q25375', vernacular: true },
  { id: 'grasshoppers', of: 'Q167810', vernacular: true },
  { id: 'molluscs', of: 'Q25326', vernacular: true },
  { id: 'crustaceans', of: 'Q25364', vernacular: true },
  { id: 'arachnids', of: 'Q1358', vernacular: true },
  { id: 'annelids', of: 'Q25522', vernacular: true },
  { id: 'echinoderms', of: 'Q44631', vernacular: true },
  { id: 'cockroaches', of: 'Q25309', vernacular: true },
  { id: 'mantises', of: 'Q131250', vernacular: true },
  { id: 'lacewings', of: 'Q156438', vernacular: true },
  { id: 'earwigs', of: 'Q13676', vernacular: true },
  { id: 'mayflies', of: 'Q174273', vernacular: true },
  { id: 'caddisflies', of: 'Q184616', vernacular: true },
  { id: 'fleas', of: 'Q388162', vernacular: true },
  // Wikidata's corporate modelling has no single clean class: Nike and Chanel
  // are instances of "brand", Renault of "car manufacturer", Nutella of "food
  // brand", Instagram of "social networking service", Zara of "clothing store
  // chain". A legal form or an industry statement was tried too, but both sit
  // on communes, the UN, or "football" as often as on a company — a filter too
  // loose to trust. Two narrow pulls, unioned by the category, catch what a
  // single query misses. Wherever Wikidata gives the item no label of the
  // language, its multilingual one stands in — PlayStation, WhatsApp — and
  // else the Wikipedia article's title — Coca-Cola, Facebook. An item known
  // only by a label, with no article in the language, is someone else's brand.
  // The aliases bring the name a player says: « Mercedes », « Ford », « KFC ».
  {
    id: 'brand-class',
    of: 'Q431289',
    corporate: true,
    version: 2,
    raw: (scope) => `SELECT ?label ?alias ?n WHERE {
  VALUES ?class { ${BRAND_CLASSES.map((id) => `wd:${id}`).join(' ')} }
  ?item wdt:P31 ?class ; wikibase:sitelinks ?n . FILTER(?n >= 15)
  ${brandLabel(scope)}
}`,
  },
  {
    id: 'brand-product',
    of: 'Q431289',
    corporate: true,
    version: 2,
    // Reverse of "has brand" on a product — catches a brand entity that
    // carries none of the classes above, as long as one product of it names it.
    // Started from the language's articles: from the products, it times out.
    raw: (scope) => `SELECT DISTINCT ?label ?alias ?n WHERE {
  ?article schema:about ?item ; schema:isPartOf <${scope.wikipedia}> ; schema:name ?title .
  ?product wdt:P1716 ?item . ?item wikibase:sitelinks ?n . FILTER(?n >= 15)
  OPTIONAL { ?item rdfs:label ?own . ${scope.inLanguage('?own')} }
  OPTIONAL { ?item rdfs:label ?mul . FILTER(lang(?mul) = "mul") }
  BIND(COALESCE(?own, ?mul, ?title) AS ?label)
  ${scope.aliases('?item')}
}`,
  },
]

export interface CategorySource {
  id: string
  pulls: readonly string[]
  /** Pulls whose words are dropped from this category rather than added to it. */
  exclude?: readonly string[]
  /**
   * A category of names does not bend: the forms Lexique and the Wiktionary
   * give belong to a homograph — « bénigne » for Bénin, « née » for NE, the
   * code of Niger — or are plurals no player types, « Berlins », « Adobes ».
   */
  names?: boolean
  /**
   * Aliases this short are codes — ISO, IOC, top-level domains: « bb », « fi »,
   * « GAB » — which would score a country on two keystrokes.
   */
  shortestAlias?: number
  /**
   * An alias only counts when it opens like its label and is not the label
   * with more words: a city's aliases hold its nicknames — « Internationale
   * Messestadt », « Ahuzat Bayit » — and a brand's its subsidiaries —
   * « Ford Australia ». Either would answer on a letter the thing is not
   * named on, or name another.
   */
  strictAliases?: boolean
}

export const CATEGORY_SOURCES: readonly CategorySource[] = [
  { id: 'pays', pulls: ['countries', 'home-nations'], names: true, shortestAlias: 4 },
  { id: 'couleurs', pulls: ['colors', 'colors-sub'] },
  { id: 'fruits-legumes', pulls: ['fruits', 'vegetables'] },
  {
    id: 'animaux',
    pulls: [
      'common-names',
      'mammals',
      'birds',
      'reptiles',
      'amphibians',
      'fish-ray',
      'fish-cartilaginous',
      'beetles',
      'butterflies',
      'flies',
      'hymenoptera',
      'hemiptera',
      'dragonflies',
      'grasshoppers',
      'molluscs',
      'crustaceans',
      'arachnids',
      'annelids',
      'echinoderms',
      'cockroaches',
      'mantises',
      'lacewings',
      'earwigs',
      'mayflies',
      'caddisflies',
      'fleas',
    ],
    exclude: ['common-plants', 'plants-vernacular'],
  },
  { id: 'plantes', pulls: ['common-plants', 'plants-vernacular'] },
  { id: 'objets', pulls: ['staple-objects'] },
  { id: 'metiers', pulls: ['professions', 'professions-sub'] },
  { id: 'sports', pulls: ['sports', 'sports-sub'] },
  // The aliases of a city are IATA and UN/LOCODE codes as often as names.
  { id: 'capitales', pulls: ['capitals', 'largest-cities', 'big-cities'], names: true, shortestAlias: 4, strictAliases: true },
  { id: 'matieres', pulls: ['metals', 'staple-materials', 'chemical-elements'] },
  { id: 'corps-humain', pulls: ['anatomy'], exclude: ['plant-organ'] },
  { id: 'marques', pulls: ['brand-class', 'brand-product'], names: true, strictAliases: true },
]

export function queryFor(pull: Pull, scope: Scope): string {
  if (pull.raw) return pull.raw(scope)

  if (pull.subclass) {
    return `SELECT ?label ?n WHERE {
  ?item wdt:P279* wd:${pull.of} ; rdfs:label ?label ; wikibase:sitelinks ?n .
  ${scope.inLanguage('?label')}
}`
  }

  if (pull.vernacular) {
    // The vernacular names are a far smaller set than the taxon tree, so they
    // are matched first and the ancestry is only checked on the survivors.
    // Walking the tree first times the endpoint out on the larger classes.
    return `SELECT ?label ?n WHERE {
  ?item wdt:P1843 ?label . ${scope.inLanguage('?label')}
  ?item wikibase:sitelinks ?n .
  ?item wdt:P171* wd:${pull.of} .
}`
  }

  const step = pull.deep ? 'wdt:P31/wdt:P279*' : 'wdt:P31'
  const population = pull.minPopulation
    ? `\n  ?item wdt:P1082 ?pop . FILTER(?pop >= ${pull.minPopulation})`
    : ''
  const alias = pull.aliases
    ? `\n  OPTIONAL { ?item skos:altLabel ?alias . ${scope.inLanguage('?alias')} }`
    : pull.female
      ? `\n  OPTIONAL { ?item wdt:P2521 ?alias . ${scope.inLanguage('?alias')} }`
      : ''
  const withAlias = pull.aliases || pull.female

  // An unbound projected variable is refused by the endpoint, so the SELECT
  // clause only mentions ?alias when the query actually binds one.
  return `SELECT ?label ${withAlias ? '?alias ' : ''}?n WHERE {
  ?item ${step} wd:${pull.of} ; rdfs:label ?label ; wikibase:sitelinks ?n .
  ${scope.inLanguage('?label')}${population}${alias}
}`
}
