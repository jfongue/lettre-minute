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
}

/** The language a query reads its labels in, and the Wikipedia it trusts for titles. */
export interface Scope {
  /** A SPARQL filter keeping a literal in the language, e.g. `inLanguage('?label')`. */
  inLanguage(variable: string): string
  /** `https://fr.wikipedia.org/` */
  wikipedia: string
}

export function scopeFor(labels: readonly string[], wiki: string): Scope {
  const tags = labels.map((tag) => `"${tag}"`).join(', ')
  return {
    inLanguage: (variable) =>
      labels.length === 1 ? `FILTER(lang(${variable}) = ${tags})` : `FILTER(lang(${variable}) IN (${tags}))`,
    wikipedia: `https://${wiki}.wikipedia.org/`,
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
  // Fire, water, air, ice, aether, gas, and the Earth.
  'Q3196', 'Q283', 'Q7391292', 'Q23392', 'Q381913', 'Q11432', 'Q2',
]

export const PULLS: readonly Pull[] = [
  { id: 'countries', of: 'Q6256', aliases: true },
  {
    id: 'capitals',
    of: 'Q5119',
    // "Instance of capital" holds barely sixty items; what a player means by a
    // capital is the city some country declares as its own.
    raw: (scope) => `SELECT ?label ?n WHERE {
  ?country wdt:P31 wd:Q6256 ; wdt:P36 ?item .
  ?item rdfs:label ?label ; wikibase:sitelinks ?n .
  ${scope.inLanguage('?label')}
}`,
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
    raw: (scope) => `SELECT ?label ?n WHERE {
  VALUES ?item { ${STAPLE_MATERIALS.map((id) => `wd:${id}`).join(' ')} }
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
  // are instances of "brand", Renault of "car manufacturer". A legal form or an
  // industry statement was tried too, but both sit on communes, the UN, or
  // "football" as often as on a company — a filter too loose to trust. Two
  // narrow pulls, unioned by the category, catch what a single query misses;
  // the Wikipedia article title stands in for the label whenever Wikidata never
  // gave the item one of its own — true for Coca-Cola and Facebook.
  {
    id: 'brand-class',
    of: 'Q431289',
    corporate: true,
    raw: (scope) => `SELECT ?label ?n WHERE {
  VALUES ?class { wd:Q431289 wd:Q786820 wd:Q4830453 wd:Q891723 wd:Q6881511 wd:Q783794 wd:Q167037 wd:Q1137109 wd:Q1058914 wd:Q18388277 }
  ?article schema:about ?item ; schema:isPartOf <${scope.wikipedia}> ; schema:name ?title .
  ?item wdt:P31 ?class ; wikibase:sitelinks ?n . FILTER(?n >= 15)
  OPTIONAL { ?item rdfs:label ?ownlabel . ${scope.inLanguage('?ownlabel')} }
  BIND(COALESCE(?ownlabel, ?title) AS ?label)
}`,
  },
  {
    id: 'brand-product',
    of: 'Q431289',
    corporate: true,
    // Reverse of "has brand" on a product — catches a brand entity that
    // carries none of the classes above, as long as one product of it names it.
    raw: (scope) => `SELECT ?label ?n WHERE {
  ?article schema:about ?item ; schema:isPartOf <${scope.wikipedia}> ; schema:name ?title .
  ?product wdt:P1716 ?item . ?item wikibase:sitelinks ?n . FILTER(?n >= 15)
  OPTIONAL { ?item rdfs:label ?ownlabel . ${scope.inLanguage('?ownlabel')} }
  BIND(COALESCE(?ownlabel, ?title) AS ?label)
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
}

export const CATEGORY_SOURCES: readonly CategorySource[] = [
  { id: 'pays', pulls: ['countries'], names: true, shortestAlias: 4 },
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
    exclude: ['common-plants'],
  },
  { id: 'metiers', pulls: ['professions', 'professions-sub'] },
  { id: 'sports', pulls: ['sports', 'sports-sub'] },
  { id: 'capitales', pulls: ['capitals'], names: true },
  { id: 'matieres', pulls: ['metals', 'staple-materials', 'chemical-elements'] },
  { id: 'corps-humain', pulls: ['anatomy'], exclude: ['plant-organ'] },
  { id: 'marques', pulls: ['brand-class', 'brand-product'], names: true },
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
