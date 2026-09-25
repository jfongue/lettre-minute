/**
 * What changes from one language to the next in the import. French keeps its
 * own sources — the French Wiktionary's categories and Lexique's inflections —
 * which are richer than anything shared. Every other language reads the
 * English Wiktionary through Wiktextract (kaikki.org): the same topic
 * categories and the same inflection tables for all of them.
 */
export type Lang = 'fr' | 'en' | 'es' | 'de' | 'it' | 'nl' | 'pt'

export interface LanguageSource {
  code: Lang
  /** Wikidata language tags whose labels count as this language. */
  labels: readonly string[]
  /** The language's name on kaikki.org; absent for French. */
  kaikki?: string
  /**
   * Leading articles stripped from an alias or an inflected form: "the
   * Netherlands" must not answer on T. The space is required — optional, it
   * turned "Land Sint Maarten" into "nd Sint Maarten" and "lapins" into "pins".
   */
  articles: RegExp
  /** How a label writes two words in one — "boulanger ou boulangère". */
  alternatives?: RegExp
}

export const LANGUAGES: Record<Lang, LanguageSource> = {
  fr: { code: 'fr', labels: ['fr'], articles: /^(?:(?:[Ll]es?|[Ll]a) |[Ll]['’])/, alternatives: / ou / },
  en: { code: 'en', labels: ['en'], kaikki: 'English', articles: /^the /i },
  es: { code: 'es', labels: ['es'], kaikki: 'Spanish', articles: /^(?:el|la|los|las) /i },
  de: { code: 'de', labels: ['de'], kaikki: 'German', articles: /^(?:der|die|das) /i },
  it: { code: 'it', labels: ['it'], kaikki: 'Italian', articles: /^(?:(?:il|lo|la|i|gli|le) |l['’])/i },
  nl: { code: 'nl', labels: ['nl'], kaikki: 'Dutch', articles: /^(?:de|het) /i },
  pt: { code: 'pt', labels: ['pt', 'pt-br'], kaikki: 'Portuguese', articles: /^(?:o|a|os|as) /i },
}

/**
 * The English Wiktionary's topic categories each game category reads, as
 * Wiktextract names them (without the "de:" prefix). Chosen by hand: the
 * topic tree wanders — "Occupations" holds the Beatles, "Sports" its
 * equipment, "Metals" the smithy — so only `expand` topics take their
 * subcategories, and only the taxonomic ones are safe to expand.
 */
export interface Topics {
  topics: readonly string[]
  expand?: readonly string[]
  /**
   * Subcategories of an expanded topic that are about the animal, not animals:
   * its tack, its races, its diseases — and a cartoon or two.
   */
  skip?: readonly string[]
}

export const TOPICS: Record<string, Topics> = {
  couleurs: {
    topics: ['Colors', 'Blacks', 'Blues', 'Browns', 'Colors of the rainbow', 'Greens', 'Greys', 'Oranges', 'Pinks', 'Purples', 'Reds', 'Violets', 'Whites', 'Yellows'],
  },
  'fruits-legumes': {
    topics: [
      'Fruits', 'Berries', 'Stone fruits', 'Citrus fruits', 'Vegetables', 'Root vegetables', 'Leaf vegetables', 'Peppers',
      'Alliums', 'Legumes', 'Squashes', 'Cabbages', 'Nuts', 'Herbs',
    ],
    // Not "Mushrooms": it files a hedgehog, a sweet tooth and hot lips under
    // the fungi named like them. The mushrooms a cook buys are added by hand.
  },
  animaux: {
    topics: ['Animals'],
    expand: ['Mammals', 'Birds', 'Fish', 'Reptiles', 'Amphibians', 'Insects', 'Mollusks', 'Crustaceans', 'Arachnids'],
    skip: [
      'Animal riding', 'Dressage', 'Eggs', 'Equestrianism', 'Farriery', 'Feathers', 'Horse colors', 'Horse racing',
      'Horse tack', 'Moby-Dick', 'Mosquito-borne diseases', 'My Little Pony', 'Whaling',
    ],
  },
  metiers: {
    topics: ['Occupations', 'Healthcare occupations', 'Legal occupations', 'Nautical occupations', 'Occupations in hospitality', 'Religious occupations', 'Craftsmen', 'Salespeople', 'Servants', 'Scientists', 'Musicians', 'Artists'],
  },
  sports: {
    topics: ['Sports', 'Ball games', 'Martial arts', 'Racquet sports', 'Water sports', 'Winter sports', 'Board sports'],
  },
  matieres: { topics: ['Materials', 'Metals', 'Alloys', 'Rocks', 'Textiles', 'Fabrics', 'Woods'] },
  'corps-humain': { topics: ['Body parts'] },
  // Not expanded: walking "Trees", "Flowers", "Shrubs" and "Grasses" descends
  // into every family, order, subfamily and tribe the tree holds — "Rue
  // family plants", "Dalbergieae tribe plants" — which list a genus's Latin
  // binomials, not a name a player would give. What is left below is what
  // remained once those, cultivar names and "Woods" (lumber, not a plant)
  // were pulled back out by hand.
  plantes: {
    topics: [
      'Plants', 'Herbs', 'Ferns', 'Trees', 'Conifers', 'Eucalypts', 'Fig trees', 'Hollies', 'Legumes', 'Maples',
      'Oaks', 'Palm trees', 'Pome fruits', 'Stone fruits', 'Willows and poplars', 'Araucarians', 'Pines',
      'Chickpeas', 'Mints', 'Sages', 'Acacias', 'Phaseolus beans', 'Vigna beans', 'Cotton', 'Flowers', 'Orchids',
      'Roses', 'Alliums', 'Shrubs', 'Grasses', 'Bamboos', 'Grains', 'Maize (plant)', 'Maize (crop)', 'Maize (food)',
    ],
  },
  // Not expanded: "Tools" also holds weapons, sports and medical equipment,
  // which are not the everyday objects the category means.
  objets: { topics: ['Furniture', 'Tools', 'Cutlery', 'Tableware', 'Containers', 'Kitchenware'] },
}
