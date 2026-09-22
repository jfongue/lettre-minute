/**
 * Where the word lists come from. A *pull* is one SPARQL query against
 * Wikidata; a category is a composition of pulls, so a heavy query (the taxon
 * ones) is paid for once even when several categories are built from it.
 */
export interface Pull {
  id: string
  /** Wikidata class. Instances of it — and of its subclasses when `deep`. */
  of: string
  /** Taxon pulls read the French vernacular name (P1843) instead of the label. */
  vernacular?: boolean
  deep?: boolean
  /**
   * Edible things are modelled as subclasses of "vegetable", not as instances:
   * a carrot is a kind of vegetable, not one particular vegetable. Instance
   * pulls miss almost all of them.
   */
  subclass?: boolean
  /** Escape hatch for a shape the flags cannot express. */
  raw?: string
  /** Fetch French aliases too — worth it for entities the player may name in several ways. */
  aliases?: boolean
  /** Only for communes: keeps the map to places a player has heard of. */
  minPopulation?: number
}

export const PULLS: readonly Pull[] = [
  { id: 'countries', of: 'Q6256', aliases: true },
  {
    id: 'capitals',
    of: 'Q5119',
    // "Instance of capital" holds barely sixty items; what a player means by a
    // capital is the city some country declares as its own.
    raw: `SELECT ?label ?n WHERE {
  ?country wdt:P31 wd:Q6256 ; wdt:P36 ?item .
  ?item rdfs:label ?label ; wikibase:sitelinks ?n .
  FILTER(lang(?label) = "fr")
}`,
  },
  { id: 'elements', of: 'Q11344', aliases: true },
  { id: 'colors', of: 'Q1075', deep: true },
  // Instances of "profession": the subclass tree of "occupation" holds trade
  // families ("métier du bois"), not the jobs themselves. Their French label is
  // the double-gendered form, which the import splits in two.
  { id: 'professions', of: 'Q28640' },
  { id: 'instruments', of: 'Q34379', subclass: true },
  { id: 'sports', of: 'Q31629', deep: true },
  { id: 'fruits', of: 'Q3314483', subclass: true },
  { id: 'vegetables', of: 'Q11004', subclass: true },
  { id: 'communes-fr', of: 'Q484170', minPopulation: 4000 },
  // The everyday names — chat, chien, cheval — hang off "organism known by a
  // particular common name", not off the taxon tree, and no vernacular pull
  // brings them back.
  { id: 'common-names', of: 'Q55983715' },
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
]

export interface CategorySource {
  id: string
  pulls: readonly string[]
}

export const CATEGORY_SOURCES: readonly CategorySource[] = [
  { id: 'pays', pulls: ['countries'] },
  { id: 'couleurs', pulls: ['colors'] },
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
    ],
  },
  { id: 'oiseaux', pulls: ['birds'] },
  { id: 'poissons', pulls: ['fish-ray', 'fish-cartilaginous'] },
  {
    id: 'insectes',
    pulls: ['beetles', 'butterflies', 'flies', 'hymenoptera', 'hemiptera', 'dragonflies', 'grasshoppers'],
  },
  { id: 'metiers', pulls: ['professions'] },
  { id: 'sports', pulls: ['sports'] },
  { id: 'instruments', pulls: ['instruments'] },
  { id: 'capitales', pulls: ['capitals'] },
  { id: 'villes-de-france', pulls: ['communes-fr'] },
  { id: 'elements-chimiques', pulls: ['elements'] },
]

export function queryFor(pull: Pull): string {
  if (pull.raw) return pull.raw

  if (pull.subclass) {
    return `SELECT ?label ?n WHERE {
  ?item wdt:P279* wd:${pull.of} ; rdfs:label ?label ; wikibase:sitelinks ?n .
  FILTER(lang(?label) = "fr")
}`
  }

  if (pull.vernacular) {
    // The French vernacular names are a far smaller set than the taxon tree, so
    // they are matched first and the ancestry is only checked on the survivors.
    // Walking the tree first times the endpoint out on the larger classes.
    return `SELECT ?label ?n WHERE {
  ?item wdt:P1843 ?label . FILTER(lang(?label) = "fr")
  ?item wikibase:sitelinks ?n .
  ?item wdt:P171* wd:${pull.of} .
}`
  }

  const step = pull.deep ? 'wdt:P31/wdt:P279*' : 'wdt:P31'
  const population = pull.minPopulation
    ? `\n  ?item wdt:P1082 ?pop . FILTER(?pop >= ${pull.minPopulation})`
    : ''
  const alias = pull.aliases
    ? `\n  OPTIONAL { ?item skos:altLabel ?alias . FILTER(lang(?alias) = "fr") }`
    : ''

  // An unbound projected variable is refused by the endpoint, so the SELECT
  // clause only mentions ?alias when the query actually binds one.
  return `SELECT ?label ${pull.aliases ? '?alias ' : ''}?n WHERE {
  ?item ${step} wd:${pull.of} ; rdfs:label ?label ; wikibase:sitelinks ?n .
  FILTER(lang(?label) = "fr")${population}${alias}
}`
}
