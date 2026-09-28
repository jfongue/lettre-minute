import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CATALOGUE, SOON } from '../domain/catalogue'
import { THIN_PROMPT_WORDS } from '../domain/run'
import { compactWord, initialOf, normalizeWord } from '../domain/text'
import { buildWordPack, findWord, knownByLetter, type WordRow } from '../domain/words'

/**
 * The dictionaries prepared but not shipped (see `DRAFT_SOURCES` in
 * scripts/sources.ts). Nothing loads them and no catalogue entry names them,
 * so nothing else would catch a draft the day it is activated: a row the
 * domain cannot read, an answer the category is about and does not hold, or a
 * category too thin for the draw to deal. Read as the game reads them.
 */
const DIR = join(import.meta.dirname, 'drafts')
const DRAFTS = ['ingredients', 'lieux']
const LANGS = ['de', 'en', 'es', 'fr', 'it', 'nl', 'pt']

const rowsOf = new Map<string, readonly WordRow[]>()
const packOf = new Map<string, ReturnType<typeof buildWordPack>>()
for (const lang of readdirSync(DIR)) {
  for (const file of readdirSync(join(DIR, lang))) {
    if (!file.endsWith('.json')) continue
    const name = `${lang}/${file.replace('.json', '')}`
    const rows = JSON.parse(readFileSync(join(DIR, lang, file), 'utf8')) as WordRow[]
    rowsOf.set(name, rows)
    packOf.set(name, buildWordPack(name, rows))
  }
}

/**
 * The first answers a table would shout, per language: a category that misses
 * one of these is not ready, whatever else it holds.
 */
const OBVIOUS: Record<string, Record<string, readonly string[]>> = {
  fr: {
    ingredients: [
      'sel', 'poivre', 'farine', 'sucre', 'beurre', 'huile', 'huile d’olive', 'lait', 'œuf', 'miel', 'vinaigre',
      'moutarde', 'mayonnaise', 'chocolat', 'chocolat noir', 'cacao', 'vanille', 'cannelle', 'curry', 'cumin',
      'persil', 'basilic', 'thym', 'romarin', 'ail', 'oignon', 'tomate', 'carotte', 'pomme de terre', 'champignon',
      'riz', 'pâtes', 'lentilles', 'fromage', 'crème', 'yaourt', 'poulet', 'bœuf', 'porc', 'agneau', 'veau', 'dinde',
      'jambon', 'saucisse', 'thon', 'saumon', 'cabillaud', 'crevette', 'moule', 'huître', 'noix', 'amande', 'eau',
    ],
    lieux: [
      'usine', 'boulangerie', 'mairie', 'piscine', 'parc', 'place', 'jardin public', 'école', 'hôpital', 'gare',
      'aéroport', 'supermarché', 'marché', 'banque', 'poste', 'restaurant', 'café', 'hôtel', 'musée', 'bibliothèque',
      'stade', 'gymnase', 'église', 'cathédrale', 'mosquée', 'synagogue', 'château', 'pont', 'immeuble', 'maison',
      'appartement', 'ferme', 'moulin', 'entrepôt', 'atelier', 'garage', 'parking', 'pharmacie', 'librairie',
      'boucherie', 'poissonnerie', 'fromagerie', 'cinéma', 'théâtre', 'prison', 'tribunal', 'casino', 'cimetière',
      'fontaine',
    ],
  },
  en: {
    ingredients: [
      'salt', 'pepper', 'flour', 'sugar', 'butter', 'oil', 'milk', 'egg', 'honey', 'vinegar', 'mustard', 'chocolate',
      'cocoa', 'vanilla', 'cinnamon', 'curry', 'cumin', 'parsley', 'basil', 'thyme', 'rosemary', 'garlic', 'onion',
      'tomato', 'carrot', 'potato', 'mushroom', 'rice', 'pasta', 'lentils', 'cheese', 'cream', 'yoghurt', 'chicken',
      'beef', 'pork', 'lamb', 'veal', 'turkey', 'ham', 'sausage', 'tuna', 'salmon', 'cod', 'shrimp', 'mussel',
      'oyster', 'nut', 'almond', 'water',
    ],
    lieux: [
      'factory', 'bakery', 'town hall', 'swimming pool', 'park', 'square', 'garden', 'school', 'hospital', 'station',
      'airport', 'supermarket', 'market', 'bank', 'post office', 'restaurant', 'café', 'hotel', 'museum', 'library',
      'stadium', 'gym', 'church', 'cathedral', 'mosque', 'synagogue', 'castle', 'bridge', 'building', 'house',
      'flat', 'farm', 'mill', 'warehouse', 'workshop', 'garage', 'car park', 'pharmacy', 'bookshop', 'butcher',
      'fishmonger', 'cinema', 'theatre', 'prison', 'court', 'casino', 'cemetery', 'fountain',
    ],
  },
  de: {
    ingredients: [
      'Salz', 'Pfeffer', 'Mehl', 'Zucker', 'Butter', 'Öl', 'Milch', 'Ei', 'Honig', 'Essig', 'Senf', 'Schokolade',
      'Kakao', 'Vanille', 'Zimt', 'Curry', 'Kümmel', 'Petersilie', 'Basilikum', 'Thymian', 'Rosmarin', 'Knoblauch',
      'Zwiebel', 'Tomate', 'Karotte', 'Kartoffel', 'Pilz', 'Reis', 'Nudeln', 'Linsen', 'Käse', 'Sahne', 'Joghurt',
      'Hähnchen', 'Rindfleisch', 'Schweinefleisch', 'Lammfleisch', 'Kalb', 'Pute', 'Schinken', 'Wurst', 'Thunfisch',
      'Lachs', 'Kabeljau', 'Garnele', 'Muschel', 'Auster', 'Nuss', 'Mandel', 'Wasser',
    ],
    lieux: [
      'Fabrik', 'Bäckerei', 'Rathaus', 'Schwimmbad', 'Park', 'Platz', 'Garten', 'Schule', 'Krankenhaus', 'Bahnhof',
      'Flughafen', 'Supermarkt', 'Markt', 'Bank', 'Post', 'Restaurant', 'Café', 'Hotel', 'Museum', 'Bibliothek',
      'Stadion', 'Turnhalle', 'Kirche', 'Dom', 'Moschee', 'Synagoge', 'Schloss', 'Brücke', 'Gebäude', 'Haus',
      'Wohnung', 'Bauernhof', 'Mühle', 'Lager', 'Werkstatt', 'Garage', 'Parkplatz', 'Apotheke', 'Buchhandlung',
      'Metzgerei', 'Fischgeschäft', 'Kino', 'Theater', 'Gefängnis', 'Gericht', 'Kasino', 'Friedhof', 'Brunnen',
    ],
  },
  es: {
    ingredients: [
      'sal', 'pimienta', 'harina', 'azúcar', 'mantequilla', 'aceite', 'leche', 'huevo', 'miel', 'vinagre', 'mostaza',
      'chocolate', 'cacao', 'vainilla', 'canela', 'curry', 'comino', 'perejil', 'albahaca', 'tomillo', 'romero',
      'ajo', 'cebolla', 'tomate', 'zanahoria', 'patata', 'champiñón', 'arroz', 'pasta', 'lentejas', 'queso', 'nata',
      'yogur', 'pollo', 'ternera', 'cerdo', 'cordero', 'pavo', 'jamón', 'salchicha', 'atún', 'salmón', 'bacalao',
      'gamba', 'mejillón', 'ostra', 'nuez', 'almendra', 'agua',
    ],
    lieux: [
      'fábrica', 'panadería', 'ayuntamiento', 'piscina', 'parque', 'plaza', 'jardín', 'escuela', 'hospital',
      'estación', 'aeropuerto', 'supermercado', 'mercado', 'banco', 'correos', 'restaurante', 'café', 'hotel',
      'museo', 'biblioteca', 'estadio', 'gimnasio', 'iglesia', 'catedral', 'mezquita', 'sinagoga', 'castillo',
      'puente', 'edificio', 'casa', 'piso', 'granja', 'molino', 'almacén', 'taller', 'garaje', 'aparcamiento',
      'farmacia', 'librería', 'carnicería', 'pescadería', 'cine', 'teatro', 'cárcel', 'juzgado', 'casino',
      'cementerio', 'fuente',
    ],
  },
  it: {
    ingredients: [
      'sale', 'pepe', 'farina', 'zucchero', 'burro', 'olio', 'latte', 'uovo', 'miele', 'aceto', 'senape',
      'cioccolato', 'cacao', 'vaniglia', 'cannella', 'curry', 'cumino', 'prezzemolo', 'basilico', 'timo', 'rosmarino',
      'aglio', 'cipolla', 'pomodoro', 'carota', 'patata', 'fungo', 'riso', 'pasta', 'lenticchie', 'formaggio',
      'panna', 'yogurt', 'pollo', 'manzo', 'maiale', 'agnello', 'vitello', 'tacchino', 'prosciutto', 'salsiccia',
      'tonno', 'salmone', 'merluzzo', 'gambero', 'cozza', 'ostrica', 'noce', 'mandorla', 'acqua',
    ],
    lieux: [
      'fabbrica', 'panetteria', 'municipio', 'piscina', 'parco', 'piazza', 'giardino', 'scuola', 'ospedale',
      'stazione', 'aeroporto', 'supermercato', 'mercato', 'banca', 'posta', 'ristorante', 'caffè', 'albergo', 'museo',
      'biblioteca', 'stadio', 'palestra', 'chiesa', 'cattedrale', 'moschea', 'sinagoga', 'castello', 'ponte',
      'edificio', 'casa', 'appartamento', 'fattoria', 'mulino', 'magazzino', 'officina', 'garage', 'parcheggio',
      'farmacia', 'libreria', 'macelleria', 'pescheria', 'cinema', 'teatro', 'prigione', 'tribunale', 'casinò',
      'cimitero', 'fontana',
    ],
  },
  nl: {
    ingredients: [
      'zout', 'peper', 'bloem', 'suiker', 'boter', 'olie', 'melk', 'ei', 'honing', 'azijn', 'mosterd', 'chocolade',
      'cacao', 'vanille', 'kaneel', 'kerrie', 'komijn', 'peterselie', 'basilicum', 'tijm', 'rozemarijn', 'knoflook',
      'ui', 'tomaat', 'wortel', 'aardappel', 'champignon', 'rijst', 'pasta', 'linzen', 'kaas', 'room', 'yoghurt',
      'kip', 'rundvlees', 'varkensvlees', 'lamsvlees', 'kalfsvlees', 'kalkoen', 'ham', 'worst', 'tonijn', 'zalm',
      'kabeljauw', 'garnaal', 'mossel', 'oester', 'noot', 'amandel', 'water',
    ],
    lieux: [
      'fabriek', 'bakkerij', 'stadhuis', 'zwembad', 'park', 'plein', 'tuin', 'school', 'ziekenhuis', 'station',
      'vliegveld', 'supermarkt', 'markt', 'bank', 'postkantoor', 'restaurant', 'café', 'hotel', 'museum',
      'bibliotheek', 'stadion', 'sportschool', 'kerk', 'kathedraal', 'moskee', 'synagoge', 'kasteel', 'brug',
      'gebouw', 'huis', 'flat', 'boerderij', 'molen', 'pakhuis', 'werkplaats', 'garage', 'parkeerplaats', 'apotheek',
      'boekhandel', 'slagerij', 'viswinkel', 'bioscoop', 'theater', 'gevangenis', 'rechtbank', 'casino',
      'begraafplaats', 'fontein',
    ],
  },
  pt: {
    ingredients: [
      'sal', 'pimenta', 'farinha', 'açúcar', 'manteiga', 'azeite', 'leite', 'ovo', 'mel', 'vinagre', 'mostarda',
      'chocolate', 'cacau', 'baunilha', 'canela', 'caril', 'cominho', 'salsa', 'manjericão', 'tomilho', 'alecrim',
      'alho', 'cebola', 'tomate', 'cenoura', 'batata', 'cogumelo', 'arroz', 'massa', 'lentilha', 'queijo', 'nata',
      'iogurte', 'frango', 'carne bovina', 'porco', 'cordeiro', 'peru', 'presunto', 'salsicha', 'atum', 'salmão',
      'bacalhau', 'camarão', 'mexilhão', 'ostra', 'castanha', 'amêndoa', 'água',
    ],
    lieux: [
      'fábrica', 'padaria', 'prefeitura', 'piscina', 'parque', 'praça', 'jardim', 'escola', 'hospital', 'estação',
      'aeroporto', 'supermercado', 'mercado', 'banco', 'correios', 'restaurante', 'café', 'hotel', 'museu',
      'biblioteca', 'estádio', 'ginásio', 'igreja', 'catedral', 'mesquita', 'sinagoga', 'castelo', 'ponte',
      'edifício', 'casa', 'apartamento', 'fazenda', 'moinho', 'armazém', 'oficina', 'garagem', 'estacionamento',
      'farmácia', 'livraria', 'açougue', 'peixaria', 'cinema', 'teatro', 'prisão', 'tribunal', 'cassino',
      'cemitério', 'fonte',
    ],
  },
}

/** A slip anyone makes at speed: no accents, no capital, no hyphen. */
const hurried = (word: string) =>
  word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-’']/g, ' ')

describe('draft dictionaries', () => {
  it('ships each draft in every language', () => {
    for (const lang of LANGS) {
      const ids = readdirSync(join(DIR, lang))
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.replace('.json', ''))
        .sort()
      expect(ids, lang).toEqual([...DRAFTS].sort())
    }
  })

  it('is exactly what the game announces and cannot deal', () => {
    // A draft that ships becomes a catalogue entry and leaves this file: the
    // two lists move together, or the menu promises what no run can play.
    expect(SOON.map((category) => category.id).sort()).toEqual([...DRAFTS].sort())
    for (const id of DRAFTS) expect(CATALOGUE.some((category) => category.id === id), id).toBe(false)
  })

  for (const [name, rows] of rowsOf) {
    describe(name, () => {
      it('holds well-formed rows, one per word, sorted as the import writes them', () => {
        const keys = rows.map(([display]) => normalizeWord(display))
        expect(new Set(keys).size).toBe(keys.length)
        expect([...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(keys)

        const bad: string[] = []
        for (const row of rows) {
          const [display, sitelinks, frequency, canonical, views] = row
          const wrong = (why: string) => bad.push(`${display}: ${why}`)
          if (row.length < 3 || row.length > 5) wrong('width')
          if (display !== display.trim() || /\s{2}/.test(display)) wrong('spacing')
          if (!/^\p{L}[\p{L}'’ -]*$/u.test(display)) wrong('characters')
          if (initialOf(display) === '' || compactWord(display).length < 2) wrong('too short')
          if (!Number.isInteger(sitelinks) || sitelinks < 0) wrong('sitelinks')
          if (!Number.isFinite(frequency) || frequency < 0) wrong('frequency')
          if (views !== undefined && (!Number.isInteger(views) || views < 0)) wrong('views')
          if (views !== undefined && canonical !== '') wrong('form with views')
        }
        expect(bad).toEqual([])
      })

      it('finds every word under its own key', () => {
        const pack = packOf.get(name)!
        const clashes: string[] = []
        for (const [display, , , canonical] of rows) {
          const key = canonical || normalizeWord(display)
          const found = findWord(pack, display, 0)?.entry
          if (found?.key !== key && found?.key !== normalizeWord(display)) clashes.push(`${display} → ${found?.display}`)
        }
        expect(clashes).toEqual([])
      })

      it('has known words on enough letters to be drawn', () => {
        const known = knownByLetter(packOf.get(name)!)
        expect(known.size, name).toBeGreaterThanOrEqual(12)
        expect(Math.max(...known.values()), name).toBeGreaterThanOrEqual(THIN_PROMPT_WORDS)
      })
    })
  }

  for (const [lang, categories] of Object.entries(OBVIOUS)) {
    for (const [id, words] of Object.entries(categories)) {
      it(`${lang}/${id} knows ${words.length} obvious answers`, () => {
        const pack = packOf.get(`${lang}/${id}`)!
        const missing = words.filter((word) => findWord(pack, word, 0) === null)
        expect(missing).toEqual([])
        const lost = words.filter((word) => findWord(pack, hurried(word), 0) === null)
        expect(lost).toEqual([])
      })
    }
  }
})
