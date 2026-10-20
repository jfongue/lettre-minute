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
  /**
   * With `largestCities`: these countries keep `extraCities` more cities
   * than the rules above give them, the next ones down GeoNames' ranking —
   * however small, down to the towns of 15 000 that cities15000 ends on.
   */
  extraCityCountries?: readonly string[]
  extraCities?: number
  /**
   * Built from these pulls as every language answered them, not from a query
   * of its own: each language gets the union of their items, named in its
   * own words when Wikidata has them — `sharedRows` in import-words.ts.
   */
  sharedFrom?: readonly string[]
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

/**
 * Those ten, and the three big countries a player names cities of next, each
 * keep fifty cities more than their top list and their floor give them: the
 * floor alone left Belgium, Portugal and Ireland a handful — Ostend, Aveiro
 * and Galway are towns of 20 000 to 80 000 —, and the United States, Canada
 * and Switzerland their ten largest.
 */
export const EXTRA_CITY_COUNTRIES = [...BIG_CITY_COUNTRIES, 'US', 'CA', 'CH'] as const
export const EXTRA_CITIES = 50

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

/**
 * Small objects — what fits in a backpack — and the furniture and appliances
 * that do not, each named one by one: « Petit objet » and its draft «
 * Meubles et gros objets » share no word (`apartFrom`).
 */
const STAPLE_OBJECTS = [
  // Carried on a person or in a bag.
  'Q26965868', 'Q132041', 'Q17517', 'Q41607', 'Q134205', 'Q467505', 'Q5843', 'Q131740', 'Q1642980',
  'Q23834',
  // Tableware and kitchen.
  'Q81881', 'Q32489', 'Q81895', 'Q57216', 'Q21167379', 'Q81727', 'Q5567094', 'Q153988', 'Q2366864', 'Q127666',
  // Tools.
  'Q40847', 'Q160137', 'Q14674', 'Q142690', 'Q25294', 'Q161071', 'Q154411', 'Q37077', 'Q11022', 'Q172833',
  'Q47107',
  // Linen, light, a mirror to hold.
  'Q131696', 'Q99895', 'Q5852', 'Q191851', 'Q12888135', 'Q1395006', 'Q35197',
  // What runs on a battery, and the battery.
  'Q3962', 'Q250', 'Q7987', 'Q185091', 'Q267298',
]

const STAPLE_FURNITURE = [
  // Chair, bed, couch, ladder, suitcase. Not the clock: German, Spanish, Italian
  // and Portuguese call it as they call a watch, which fits in a backpack.
  'Q15026', 'Q42177', 'Q131514', 'Q168639', 'Q200814',
  // Refrigerator, washing machine, television, vacuum cleaner.
  'Q37828', 'Q124441', 'Q289', 'Q101674',
]

const STAPLE_ELECTRONICS = [
  // Computer, desktop, personal computer, laptop, tablet, monitor, keyboard,
  // mouse, printer, scanner, photocopier, fax, router, modem, USB stick, webcam.
  'Q68', 'Q56155', 'Q16338', 'Q3962', 'Q155972', 'Q5290', 'Q250', 'Q7987', 'Q82', 'Q82744', 'Q185369', 'Q132744',
  'Q5318', 'Q5607', 'Q1647694', 'Q29576',
  // Telephone, mobile phone, smartphone, smartwatch, walkie-talkie, answering
  // machine, cash register, calculator.
  'Q11035', 'Q17517', 'Q22645', 'Q5362345', 'Q938319', 'Q568717', 'Q235041', 'Q31087',
  // Television set, remote, games console, projector, DVD player, camera,
  // digital camera, camcorder, radio, loudspeaker, amplifier, microphone, MP3
  // player, GPS.
  'Q8075', 'Q185091', 'Q8076', 'Q275568', 'Q3783103', 'Q15328', 'Q62927', 'Q335234', 'Q159391', 'Q570', 'Q27094',
  'Q46384', 'Q697434', 'Q1486497',
]

/** From the feet to the rocket: walking and running are ways to get somewhere too. */
const STAPLE_TRANSPORT = [
  'Q6537379', 'Q105674', 'Q214912', 'Q726', 'Q235356', 'Q11442', 'Q924724', 'Q536135', 'Q223924', 'Q502057', 'Q15783',
  'Q1031639', 'Q181388', 'Q17240', 'Q1420', 'Q188475', 'Q215601', 'Q193468', 'Q43193', 'Q39495', 'Q180481', 'Q34493',
  'Q193234', 'Q201783', 'Q5638', 'Q12334006', 'Q946479', 'Q5639', 'Q3407658', 'Q5503', 'Q870', 'Q129337', 'Q187934',
  'Q142031', 'Q13409250', 'Q780442', 'Q182634', 'Q35872', 'Q11446', 'Q25653', 'Q171529', 'Q179246', 'Q159354',
  'Q1075310', 'Q182916', 'Q185757', 'Q2811', 'Q197', 'Q34486', 'Q1551574', 'Q41291',
]

const stapleQuery =(items: readonly string[]) => (scope: Scope) => `SELECT ?label ?n WHERE {
  VALUES ?item { ${items.map((id) => `wd:${id}`).join(' ')} }
  ?item rdfs:label ?label ; wikibase:sitelinks ?n .
  ${scope.inLanguage('?label')}
}`

/**
 * The everyday names — chat, chien, poulet — hang off "organism known by a
 * particular common name" (Q55983715), not off the taxon tree, and no
 * vernacular pull brings them back. Walked from the common name up to its
 * class: asked of the fish or the molluscs, the same walk times the endpoint
 * out, so only mammals, birds and reptiles are.
 */
const commonNamesUnder = (roots: readonly string[]) => (scope: Scope) => `SELECT DISTINCT ?label ?n WHERE {
  VALUES ?root { ${roots.map((id) => `wd:${id}`).join(' ')} }
  ?item wdt:P31 wd:Q55983715 ; wdt:P279+ ?taxon .
  ?taxon wdt:P171* ?root .
  ?item rdfs:label ?label ; wikibase:sitelinks ?n .
  ${scope.inLanguage('?label')}
}`

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
    extraCityCountries: EXTRA_CITY_COUNTRIES,
    extraCities: EXTRA_CITIES,
    version: 3,
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
  { id: 'staple-objects', of: 'Q15026', version: 3, raw: stapleQuery(STAPLE_OBJECTS) },
  { id: 'staple-furniture', of: 'Q15026', version: 3, raw: stapleQuery(STAPLE_FURNITURE) },
  { id: 'staple-electronics', of: 'Q68', raw: stapleQuery(STAPLE_ELECTRONICS) },
  { id: 'staple-transport', of: 'Q1420', raw: stapleQuery(STAPLE_TRANSPORT) },
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
  { id: 'common-mammals', of: 'Q55983715', raw: commonNamesUnder(['Q7377']) },
  { id: 'common-birds-reptiles', of: 'Q55983715', raw: commonNamesUnder(['Q5113', 'Q10811']) },
  // "Organism known by a particular common name" also holds the plants known
  // by one — tree, grass, cabbage — which the animal categories drop.
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
  // What lives in the sea, class by class: Actinopterygii, Chondrichthyes,
  // Cetacea, Pinnipedia, Sirenia, Cephalopoda, Bivalvia, Decapoda,
  // Echinodermata, Cnidaria — never Mollusca whole, mostly snails. The
  // cartilaginous fish were once asked under Q28425, which is the bats.
  // (The insects, the spiders and the worms left with « Animaux », when it
  // became « Mammifères »: their pulls are in git's history.)
  { id: 'fish-ray', of: 'Q127282', vernacular: true },
  { id: 'fish-cartilaginous', of: 'Q25371', vernacular: true, version: 2 },
  { id: 'cetaceans', of: 'Q160', vernacular: true },
  { id: 'pinnipeds', of: 'Q30263', vernacular: true },
  { id: 'sirenians', of: 'Q25431', vernacular: true },
  { id: 'cephalopods', of: 'Q128257', vernacular: true },
  { id: 'bivalves', of: 'Q25368', vernacular: true },
  { id: 'decapods', of: 'Q4610', vernacular: true },
  { id: 'echinoderms', of: 'Q44631', vernacular: true },
  { id: 'cnidarians', of: 'Q25441', vernacular: true },
  // Wikidata's corporate modelling has no single clean class: Nike and Chanel
  // are instances of "brand", Renault of "car manufacturer", Nutella of "food
  // brand", Instagram of "social networking service", Zara of "clothing store
  // chain". A legal form or an industry statement was tried too, but both sit
  // on communes, the UN, or "football" as often as on a company — a filter too
  // loose to trust. Two narrow pulls, unioned by the category, catch what a
  // single query misses. Wherever Wikidata gives the item no label of the
  // language, its multilingual one stands in — PlayStation, WhatsApp — and
  // else the Wikipedia article's title — Coca-Cola, Facebook. An item known
  // only by a label, with no article in the language, is someone else's brand,
  // which `brands-shared` brings in from that someone else's pull. The
  // aliases bring the name a player says: « Mercedes », « Ford », « KFC ».
  {
    id: 'brand-class',
    of: 'Q431289',
    corporate: true,
    version: 3,
    raw: (scope) => `SELECT ?item ?label ?alias ?n WHERE {
  VALUES ?class { ${BRAND_CLASSES.map((id) => `wd:${id}`).join(' ')} }
  ?item wdt:P31 ?class ; wikibase:sitelinks ?n . FILTER(?n >= 15)
  ${brandLabel(scope)}
}`,
  },
  {
    id: 'brand-product',
    of: 'Q431289',
    corporate: true,
    version: 3,
    // Reverse of "has brand" on a product — catches a brand entity that
    // carries none of the classes above, as long as one product of it names it.
    // Started from the language's articles: from the products, it times out.
    raw: (scope) => `SELECT DISTINCT ?item ?label ?alias ?n WHERE {
  ?article schema:about ?item ; schema:isPartOf <${scope.wikipedia}> ; schema:name ?title .
  ?product wdt:P1716 ?item . ?item wikibase:sitelinks ?n . FILTER(?n >= 15)
  OPTIONAL { ?item rdfs:label ?own . ${scope.inLanguage('?own')} }
  OPTIONAL { ?item rdfs:label ?mul . FILTER(lang(?mul) = "mul") }
  BIND(COALESCE(?own, ?mul, ?title) AS ?label)
  ${scope.aliases('?item')}
}`,
  },
  // A brand is the same brand in every language: Hema, Esselunga and Natura
  // are answers in French too, though only their own country's Wikipedia
  // describes them. Each language gets every brand the two pulls above found
  // in any of the seven, under its own label, else its multilingual one, else
  // the label most languages give it. Moderation stays per language: the
  // server still files each word under its language's prefix.
  { id: 'brands-shared', of: 'Q431289', corporate: true, sharedFrom: ['brand-class', 'brand-product'] },
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
  /**
   * Categories that share no word with this one: whatever they would hold —
   * their Wiktionary listing, their pulls, their words added by hand — is
   * dropped here, so each word is in exactly one of them.
   */
  apartFrom?: readonly string[]
}

export const CATEGORY_SOURCES: readonly CategorySource[] = [
  { id: 'pays', pulls: ['countries', 'home-nations'], names: true, shortestAlias: 4 },
  { id: 'couleurs', pulls: ['colors', 'colors-sub'] },
  { id: 'fruits-legumes', pulls: ['fruits', 'vegetables'] },
  // « Mammifères » since the birds, the fish and the insects made it a field
  // guide; the id stays, under which profiles and prompt_stats know it. The
  // sea's mammals are both here and in « Animaux marins ».
  { id: 'animaux', pulls: ['common-mammals', 'mammals'], exclude: ['common-plants', 'plants-vernacular'] },
  { id: 'plantes', pulls: ['common-plants', 'plants-vernacular'] },
  // « Petit objet », what fits in a backpack — same id, same reason.
  { id: 'objets', pulls: ['staple-objects'], apartFrom: ['meubles'] },
  { id: 'metiers', pulls: ['professions', 'professions-sub'] },
  { id: 'sports', pulls: ['sports', 'sports-sub'] },
  // The aliases of a city are IATA and UN/LOCODE codes as often as names.
  { id: 'capitales', pulls: ['capitals', 'largest-cities', 'big-cities'], names: true, shortestAlias: 4, strictAliases: true },
  { id: 'matieres', pulls: ['metals', 'staple-materials', 'chemical-elements'] },
  { id: 'corps-humain', pulls: ['anatomy'], exclude: ['plant-organ'] },
  { id: 'marques', pulls: ['brand-class', 'brand-product', 'brands-shared'], names: true, strictAliases: true },
  // The avant-premières, Premium's alone (`premiere` in the catalogue), born
  // drafts. Neither reads a pull: for food and edifices the Wiktionary's own
  // trees are the richer source.
  //
  // What a recipe calls for. The food tree holds the families — cheeses,
  // spices, meats, cereals, seafood — and the everyday words it files nowhere
  // (sel, poivre, farine) are added by hand.
  { id: 'ingredients', pulls: [] },
  // A city's buildings and public places, which the Wiktionnaire files under
  // « Édifices »: mairie, piscine and parc, filed by no category, come by hand.
  { id: 'lieux', pulls: [] },
]

/**
 * Categories prepared but not shipped. Nothing here is drawn: CATALOGUE does
 * not list them, and their dictionaries live under src/data/drafts — outside
 * the glob the app loads and outside the files every language must have.
 * `import-words.ts --draft` builds these and only these, from the pulls they
 * name and the Wiktionary: French from its own site, the six other languages
 * from the English Wiktionary's topics (`TOPICS`).
 *
 * Activating one costs a CATALOGUE entry in place of its SOON one, moving its
 * entry to CATEGORY_SOURCES and its dictionaries to src/data/words: its names
 * in the seven languages are already there.
 */
export const DRAFT_SOURCES: readonly CategorySource[] = [
  // Furniture, appliances and whatever does not fit in a backpack: every word
  // « Petit objet » gives up (`apartFrom`).
  { id: 'meubles', pulls: ['staple-furniture'] },
  // Fish, the sea's mammals, its shellfish and its jellyfish.
  {
    id: 'animaux-marins',
    pulls: ['fish-ray', 'fish-cartilaginous', 'cetaceans', 'pinnipeds', 'sirenians', 'cephalopods', 'bivalves', 'decapods', 'echinoderms', 'cnidarians'],
    exclude: ['common-plants', 'plants-vernacular'],
  },
  { id: 'oiseaux-reptiles', pulls: ['common-birds-reptiles', 'birds', 'reptiles'], exclude: ['common-plants', 'plants-vernacular'] },
  // Every way to get somewhere, from the feet up: the Wiktionary's vehicles,
  // and what it files under none — marche, roller, RER, Uber — by hand.
  { id: 'locomotion', pulls: ['staple-transport'] },
  { id: 'vetements', pulls: [] },
  // The Wiktionnaire files no electronic device anywhere: Wikidata names the
  // everyday ones, the English topics and the hand the rest.
  { id: 'electronique', pulls: ['staple-electronics'] },
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
