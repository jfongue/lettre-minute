import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../domain/catalogue'
import { THIN_PROMPT_WORDS } from '../domain/run'
import { compactWord, initialOf, normalizeWord } from '../domain/text'
import { buildWordPack, findWord, knownByLetter, type WordPack, type WordRow } from '../domain/words'

/**
 * The shipped dictionaries, read as the game reads them. The import is
 * rerun by hand against sources that drift, so what it writes is checked
 * here: the shape the domain relies on, the junk it once let through, and
 * the answers any player would give first.
 */
const WORDS_DIR = join(import.meta.dirname, 'words')
const LANGS = readdirSync(WORDS_DIR).sort()

const rowsOf = new Map<string, readonly WordRow[]>()
const packOf = new Map<string, WordPack>()
for (const lang of LANGS) {
  for (const file of readdirSync(join(WORDS_DIR, lang))) {
    if (!file.endsWith('.json')) continue
    const id = file.replace('.json', '')
    const rows = JSON.parse(readFileSync(join(WORDS_DIR, lang, file), 'utf8')) as WordRow[]
    rowsOf.set(`${lang}/${id}`, rows)
    packOf.set(`${lang}/${id}`, buildWordPack(id, rows))
  }
}

const pack = (lang: string, id: string) => packOf.get(`${lang}/${id}`)!

/** The categories whose words are names: they do not bend, and a form there is a homograph's. */
const NAMES = ['pays', 'capitales', 'marques', 'prenoms']

/**
 * Shipped although no letter holds THIN_PROMPT_WORDS known words: Dutch
 * corpora rate most of its vehicles too rare to count as known,
 * so a run deals few of its pairs. Held below the bar so that the day an
 * import lifts one, this list has to shrink with it.
 */
const THIN_YET = ['nl/locomotion']

describe('shipped dictionaries', () => {
  it('ship every catalogue category in every language', () => {
    for (const lang of LANGS) {
      // Only the dictionaries: a session's claim file sits in the same folder.
      const ids = readdirSync(join(WORDS_DIR, lang))
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.replace('.json', ''))
        .sort()
      expect(ids, lang).toEqual(CATALOGUE.map((category) => category.id).sort())
    }
  })

  for (const [name, rows] of rowsOf) {
    describe(name, () => {
      it('holds well-formed rows, one per word, sorted as the import writes them', () => {
        const keys = rows.map(([display]) => normalizeWord(display))
        expect(new Set(keys).size).toBe(keys.length)
        expect([...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(keys)

        // Collected rather than asserted row by row: 80 000 English animals.
        const bad: string[] = []
        for (const row of rows) {
          const [display, sitelinks, frequency, canonical, views] = row
          const wrong = (why: string) => bad.push(`${display}: ${why}`)
          if (row.length < 3 || row.length > 5) wrong('width')
          if (display !== display.trim() || /\s{2}/.test(display)) wrong('spacing')
          // What a player can type in a hurry: letters, and what joins them.
          if (!/^\p{L}[\p{L}'’ -]*$/u.test(display)) wrong('characters')
          // A letter the matching cannot spell in ASCII would vanish from the answer.
          if ([...display].some((char) => /\p{L}/u.test(char) && normalizeWord(char) === '')) wrong('unspellable letter')
          if (initialOf(display) === '' || compactWord(display).length < 2) wrong('too short')
          if (!Number.isInteger(sitelinks) || sitelinks < 0) wrong('sitelinks')
          if (!Number.isFinite(frequency) || frequency < 0) wrong('frequency')
          if (views !== undefined && (!Number.isInteger(views) || views < 0)) wrong('views')
          // A form borrows its lemma's views.
          if (views !== undefined && canonical !== '') wrong('form with views')
        }
        expect(bad).toEqual([])
      })

      it('points every inflected form at a word of the same file', () => {
        const keys = new Set(rows.map(([display]) => normalizeWord(display)))
        const forms = new Set(rows.filter(([, , , canonical]) => canonical).map(([display]) => normalizeWord(display)))
        for (const [display, , , canonical] of rows) {
          if (!canonical) continue
          expect(canonical, display).toBe(canonical.trim())
          expect(canonical, display).not.toBe(normalizeWord(display))
          expect(keys.has(canonical), `${display} → ${canonical}`).toBe(true)
          // One hop: a lemma that is itself a form would score under a key no answer carries.
          expect(forms.has(canonical), `${display} → ${canonical}`).toBe(false)
        }
      })

      it('finds every word under its own key', () => {
        // Two spellings that compact alike — « Formule E », « formulée » — keep
        // only the first: the second would score as a word it is not.
        const clashes: string[] = []
        for (const [display, , , canonical] of rows) {
          const key = canonical || normalizeWord(display)
          const found = findWord(packOf.get(name)!, display, 0)?.entry
          if (found?.key !== key && found?.key !== normalizeWord(display)) clashes.push(`${display} → ${found?.display}`)
        }
        expect(clashes).toEqual([])
      })

      it('has known words on enough letters to be drawn', () => {
        // One known word is enough for a letter to come out; a category drawn
        // on a handful of letters would deal the same prompts run after run.
        const known = knownByLetter(packOf.get(name)!)
        expect(known.size, name).toBeGreaterThanOrEqual(12)
        const best = Math.max(...known.values())
        if (THIN_YET.includes(name)) expect(best, name).toBeLessThan(THIN_PROMPT_WORDS)
        else expect(best, name).toBeGreaterThanOrEqual(THIN_PROMPT_WORDS)
      })
    })
  }

  it('bend no name: a form in a category of names is an alias, never a plural', () => {
    // « USA » for the United States is an alias; « Berlins », « Adobes » are
    // plurals of a homograph's, which is all a name's inflections ever were.
    for (const lang of LANGS) {
      for (const id of NAMES) {
        const plurals = rowsOf
          .get(`${lang}/${id}`)!
          .filter(([display, , , canonical]) => {
            if (!canonical) return false
            const form = compactWord(display)
            const base = canonical.replace(/ /g, '')
            return form.startsWith(base) && ['s', 'es', 'n', 'en', 'x'].includes(form.slice(base.length))
          })
        expect(plurals.map(([display]) => display), `${lang}/${id}`).toEqual([])
      }
    }
  })

  it('score no country on a code: two letters are an ISO code, three capitals an IOC one', () => {
    // Save the two codes that are the name everyone says (SHORT_NAMES).
    const names = new Set(['usa', 'uk'])
    for (const lang of LANGS) {
      const codes = rowsOf
        .get(`${lang}/pays`)!
        .map(([display]) => display)
        .filter((display) => !names.has(compactWord(display)))
        .filter((display) => compactWord(display).length <= 2 || /^[A-Z]{3}$/.test(display))
      expect(codes, lang).toEqual([])
    }
  })
})

/**
 * The first answers a table would shout, per language and category. Each must
 * be found exactly — and, typed in a hurry, still found.
 */
const OBVIOUS: Record<string, Record<string, readonly string[]>> = {
  fr: {
    pays: ['France', 'Allemagne', 'Japon', 'Brésil', 'Canada', 'États-Unis', 'Côte d’Ivoire', 'Maroc', 'Zimbabwe', 'Angleterre', 'Écosse'],
    animaux: ['chat', 'chien', 'cheval', 'éléphant', 'vache', 'lion', 'zèbre', 'souris', 'lapin', 'ours', 'singe', 'baleine', 'dauphin', 'girafe', 'tigre', 'loup', 'renard', 'mouton', 'cochon', 'chèvre', 'hérisson', 'écureuil', 'kangourou', 'chauve-souris'],
    couleurs: ['rouge', 'bleu', 'vert', 'jaune', 'noir', 'blanc', 'orange', 'violet'],
    'fruits-legumes': ['pomme', 'banane', 'carotte', 'tomate', 'fraise', 'poireau', 'kiwi', 'champignon', 'basilic', 'persil', 'thym'],
    metiers: ['boulanger', 'médecin', 'avocat', 'plombier', 'infirmière', 'professeur', 'pompier', 'laboureur'],
    sports: ['football', 'tennis', 'judo', 'natation', 'rugby', 'ski', 'boxe', 'escrime'],
    'corps-humain': ['bras', 'jambe', 'cœur', 'œil', 'nez', 'genou', 'foie', 'orteil', 'ventre', 'narine'],
    matieres: ['fer', 'bois', 'or', 'oxygène', 'cuivre', 'verre', 'béton', 'coton', 'plastique', 'sel'],
    capitales: ['Paris', 'Londres', 'Tokyo', 'Berlin', 'Rome', 'Madrid', 'Ottawa', 'Nairobi', 'Lyon', 'Marseille', 'Munich', 'Anvers', 'Genève', 'Esch-sur-Alzette', 'Lille', 'Rennes', 'Dijon', 'Grenoble', 'Villeurbanne', 'Venise', 'Bilbao', 'Francfort'],
    marques: ['Nike', 'Apple', 'Renault', 'Peugeot', 'Coca-Cola', 'Google', 'Adidas', 'Samsung', 'Mercedes', 'Instagram', 'Ford', 'Amazon'],
    prenoms: ['Léa', 'Marie', 'Pierre', 'Jean', 'Emma', 'Lucas', 'Mohammed', 'Fatima', 'Karim', 'Yasmine'],
    plantes: ['rose', 'chêne', 'tulipe', 'ortie', 'fougère', 'sapin', 'lavande', 'marguerite', 'pissenlit', 'cactus', 'lierre', 'bambou', 'palmier', 'orchidée', 'tournesol'],
    objets: ['fourchette', 'clé', 'téléphone', 'parapluie', 'lampe', 'oreiller', 'verre', 'assiette', 'ciseaux', 'stylo', 'miroir', 'brosse à dents', 'montre', 'crayon', 'cuillère', 'briquet', 'peigne'],
    'oiseaux-reptiles': [
      'moineau', 'pigeon', 'aigle', 'corbeau', 'merle', 'poule', 'coq', 'canard', 'cygne', 'hibou', 'chouette',
      'perroquet', 'autruche', 'pingouin', 'manchot', 'flamant', 'mouette', 'pie', 'rouge-gorge', 'faucon', 'serpent',
      'lézard', 'crocodile', 'alligator', 'tortue', 'caméléon', 'iguane', 'vipère', 'couleuvre', 'cobra', 'python',
    ],
    'animaux-marins': [
      'requin', 'baleine', 'dauphin', 'orque', 'phoque', 'otarie', 'morse', 'pieuvre', 'poulpe', 'calmar', 'seiche',
      'méduse', 'étoile de mer', 'oursin', 'crabe', 'homard', 'langouste', 'crevette', 'moule', 'huître', 'thon',
      'saumon', 'sardine', 'morue', 'cabillaud', 'raie', 'espadon', 'hippocampe', 'anguille', 'corail',
    ],
    vetements: [
      'pull', 'chaussette', 'boucle d’oreille', 'casquette', 'lunettes', 'pantalon', 'jean', 'chemise', 't-shirt', 'robe',
      'jupe', 'veste', 'manteau', 'blouson', 'short', 'culotte', 'soutien-gorge', 'pyjama', 'écharpe', 'bonnet',
      'chapeau', 'gant', 'ceinture', 'cravate', 'chaussure', 'basket', 'botte', 'sandale', 'collier', 'bracelet', 'bague',
      'montre', 'sac à main',
    ],
    locomotion: [
      'marche', 'cheval', 'voiture', 'avion', 'roller', 'aviron', 'vélo', 'trottinette', 'bus', 'RER', 'TGV', 'métro',
      'tram', 'tramway', 'patins à roulettes', 'taxi', 'Uber', 'train', 'bateau', 'moto', 'scooter', 'camion',
      'hélicoptère', 'skateboard', 'kayak', 'canoë', 'ferry', 'autocar', 'montgolfière', 'fusée', 'voilier', 'téléphérique',
    ],
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
    pays: ['France', 'Germany', 'Japan', 'Brazil', 'Canada', 'United States', 'Mexico', 'USA', 'UK', 'England'],
    animaux: ['cat', 'dog', 'horse', 'elephant', 'cow', 'lion', 'zebra', 'mouse', 'rabbit', 'bear', 'monkey', 'whale', 'dolphin', 'giraffe', 'tiger', 'wolf', 'fox', 'sheep', 'pig', 'goat', 'hedgehog', 'squirrel', 'kangaroo', 'bat'],
    couleurs: ['red', 'blue', 'green', 'yellow', 'black', 'white', 'purple'],
    'fruits-legumes': ['apple', 'banana', 'carrot', 'tomato', 'strawberry', 'potato', 'mushroom', 'basil', 'parsley', 'thyme'],
    metiers: ['baker', 'doctor', 'lawyer', 'plumber', 'nurse', 'teacher', 'firefighter'],
    sports: ['football', 'tennis', 'judo', 'swimming', 'rugby', 'golf', 'boxing'],
    'corps-humain': ['arm', 'leg', 'heart', 'eye', 'nose', 'knee', 'liver', 'belly', 'nostril'],
    matieres: ['iron', 'wood', 'gold', 'oxygen', 'copper', 'glass', 'cotton', 'salt', 'oil'],
    capitales: ['Paris', 'London', 'Tokyo', 'Berlin', 'Rome', 'Madrid', 'Ottawa', 'Lyon', 'Munich', 'Chicago', 'Manchester', 'Coventry', 'Oxford', 'Cambridge', 'Brighton', 'Nuremberg', 'Leipzig', 'Oslo', 'Kiev', 'Frankfurt', 'Tel Aviv'],
    marques: ['Nike', 'Apple', 'Google', 'Adidas', 'Toyota', 'Samsung', 'Ford', 'Mercedes', 'Amazon', 'Facebook', 'Instagram'],
    prenoms: ['Emma', 'John', 'Mary', 'James', 'Sarah', 'Mohammed', 'Fatima', 'Kevin'],
    plantes: ['rose', 'oak', 'tulip', 'nettle', 'fern', 'fir', 'lavender', 'daisy', 'dandelion', 'cactus', 'ivy', 'bamboo', 'palm', 'orchid', 'sunflower'],
    objets: ['fork', 'key', 'phone', 'umbrella', 'lamp', 'pillow', 'glass', 'plate', 'scissors', 'pen', 'mirror', 'toothbrush', 'watch', 'pencil', 'spoon', 'lighter', 'comb'],
    'oiseaux-reptiles': [
      'sparrow', 'pigeon', 'eagle', 'crow', 'blackbird', 'hen', 'chicken', 'rooster', 'duck', 'swan', 'owl', 'parrot',
      'ostrich', 'penguin', 'flamingo', 'seagull', 'magpie', 'robin', 'falcon', 'snake', 'lizard', 'crocodile',
      'alligator', 'turtle', 'tortoise', 'chameleon', 'iguana', 'viper', 'cobra', 'python',
    ],
    'animaux-marins': [
      'shark', 'whale', 'dolphin', 'orca', 'seal', 'sea lion', 'walrus', 'octopus', 'squid', 'cuttlefish', 'jellyfish',
      'starfish', 'sea urchin', 'crab', 'lobster', 'shrimp', 'prawn', 'mussel', 'oyster', 'scallop', 'tuna', 'salmon',
      'sardine', 'cod', 'ray', 'swordfish', 'seahorse', 'eel', 'coral',
    ],
    vetements: [
      'jumper', 'sweater', 'sock', 'earring', 'cap', 'glasses', 'trousers', 'jeans', 'shirt', 't-shirt', 'dress', 'skirt',
      'jacket', 'coat', 'shorts', 'bra', 'pyjamas', 'scarf', 'hat', 'glove', 'belt', 'tie', 'shoe', 'trainers', 'boot',
      'sandal', 'necklace', 'bracelet', 'ring', 'watch', 'handbag',
    ],
    locomotion: [
      'walking', 'horse', 'car', 'plane', 'rowing', 'bicycle', 'bike', 'scooter', 'bus', 'train', 'metro', 'subway',
      'tram', 'roller skates', 'taxi', 'Uber', 'boat', 'motorbike', 'motorcycle', 'truck', 'lorry', 'helicopter',
      'skateboard', 'kayak', 'canoe', 'ferry', 'coach', 'rocket', 'submarine', 'sailboat', 'cable car',
    ],
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
    pays: ['Frankreich', 'Deutschland', 'Japan', 'Brasilien', 'Kanada', 'Österreich', 'USA'],
    animaux: ['Katze', 'Hund', 'Pferd', 'Elefant', 'Kuh', 'Löwe', 'Zebra', 'Maus', 'Kaninchen', 'Hase', 'Bär', 'Affe', 'Wal', 'Delfin', 'Giraffe', 'Tiger', 'Wolf', 'Fuchs', 'Schaf', 'Schwein', 'Ziege', 'Igel', 'Eichhörnchen', 'Känguru', 'Fledermaus'],
    couleurs: ['Rot', 'Blau', 'Grün', 'Gelb', 'Schwarz', 'Weiß'],
    'fruits-legumes': ['Apfel', 'Banane', 'Karotte', 'Tomate', 'Erdbeere', 'Kartoffel', 'Pilz', 'Petersilie', 'Basilikum'],
    metiers: ['Bäcker', 'Arzt', 'Anwalt', 'Klempner', 'Lehrer', 'Feuerwehrmann'],
    sports: ['Fußball', 'Tennis', 'Judo', 'Schwimmen', 'Rugby', 'Golf'],
    'corps-humain': ['Arm', 'Bein', 'Herz', 'Auge', 'Nase', 'Knie', 'Bauch'],
    matieres: ['Eisen', 'Holz', 'Gold', 'Sauerstoff', 'Kupfer', 'Glas', 'Öl', 'Salz'],
    capitales: ['Paris', 'London', 'Tokio', 'Berlin', 'Rom', 'Madrid', 'Leipzig', 'Hannover', 'Nürnberg', 'Aachen', 'Bremen', 'Venedig', 'Oslo', 'Frankfurt', 'Tel Aviv'],
    marques: ['Nike', 'Apple', 'Google', 'Adidas', 'Volkswagen', 'Mercedes', 'Amazon', 'Samsung'],
    prenoms: ['Hans', 'Emma', 'Maria', 'Kevin', 'Mohammed'],
    plantes: ['Rose', 'Eiche', 'Tulpe', 'Brennnessel', 'Farn', 'Tanne', 'Lavendel', 'Gänseblümchen', 'Löwenzahn', 'Kaktus', 'Efeu', 'Bambus', 'Palme', 'Orchidee', 'Sonnenblume'],
    objets: ['Gabel', 'Schlüssel', 'Telefon', 'Regenschirm', 'Lampe', 'Kissen', 'Glas', 'Teller', 'Schere', 'Stift', 'Spiegel', 'Zahnbürste', 'Uhr', 'Bleistift', 'Löffel', 'Feuerzeug', 'Kamm'],
    'oiseaux-reptiles': [
      'Spatz', 'Taube', 'Adler', 'Krähe', 'Rabe', 'Amsel', 'Huhn', 'Hahn', 'Ente', 'Schwan', 'Eule', 'Papagei',
      'Strauß', 'Pinguin', 'Flamingo', 'Möwe', 'Elster', 'Rotkehlchen', 'Falke', 'Schlange', 'Eidechse', 'Krokodil',
      'Alligator', 'Schildkröte', 'Chamäleon', 'Leguan', 'Viper', 'Kobra', 'Python',
    ],
    'animaux-marins': [
      'Hai', 'Wal', 'Delfin', 'Orca', 'Robbe', 'Seelöwe', 'Walross', 'Krake', 'Tintenfisch', 'Qualle', 'Seestern',
      'Seeigel', 'Krabbe', 'Hummer', 'Garnele', 'Miesmuschel', 'Auster', 'Jakobsmuschel', 'Thunfisch', 'Lachs',
      'Sardine', 'Kabeljau', 'Rochen', 'Schwertfisch', 'Seepferdchen', 'Aal', 'Koralle',
    ],
    vetements: [
      'Pullover', 'Pulli', 'Socke', 'Ohrring', 'Mütze', 'Brille', 'Hose', 'Jeans', 'Hemd', 'T-Shirt', 'Kleid', 'Rock',
      'Jacke', 'Mantel', 'Unterhose', 'BH', 'Schlafanzug', 'Schal', 'Hut', 'Handschuh', 'Gürtel', 'Krawatte', 'Schuh',
      'Stiefel', 'Sandale', 'Halskette', 'Armband', 'Ring', 'Uhr', 'Handtasche',
    ],
    locomotion: [
      'Pferd', 'Auto', 'Flugzeug', 'Rudern', 'Fahrrad', 'Roller', 'Bus', 'S-Bahn', 'ICE', 'U-Bahn', 'Straßenbahn',
      'Rollschuhe', 'Taxi', 'Uber', 'Zug', 'Boot', 'Schiff', 'Motorrad', 'Lastwagen', 'Hubschrauber', 'Skateboard',
      'Kajak', 'Kanu', 'Fähre', 'Rakete', 'Segelboot', 'Seilbahn',
    ],
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
    pays: ['Francia', 'Alemania', 'Japón', 'Brasil', 'Canadá', 'México'],
    animaux: ['gato', 'perro', 'caballo', 'elefante', 'vaca', 'león', 'cebra', 'ratón', 'conejo', 'oso', 'mono', 'ballena', 'delfín', 'jirafa', 'tigre', 'lobo', 'zorro', 'oveja', 'cerdo', 'cabra', 'erizo', 'ardilla', 'canguro', 'murciélago'],
    couleurs: ['rojo', 'azul', 'verde', 'amarillo', 'negro', 'blanco'],
    'fruits-legumes': ['manzana', 'plátano', 'zanahoria', 'tomate', 'fresa', 'patata', 'champiñón', 'perejil'],
    metiers: ['panadero', 'médico', 'abogado', 'fontanero', 'enfermera', 'profesor', 'bombero'],
    sports: ['fútbol', 'tenis', 'judo', 'natación', 'rugby', 'golf', 'boxeo'],
    'corps-humain': ['brazo', 'pierna', 'corazón', 'ojo', 'nariz', 'rodilla', 'oreja'],
    matieres: ['hierro', 'madera', 'oro', 'oxígeno', 'cobre', 'vidrio', 'seda'],
    capitales: ['París', 'Londres', 'Tokio', 'Berlín', 'Roma', 'Madrid', 'Bilbao', 'Granada', 'Valladolid', 'Vigo', 'Oviedo', 'Venecia'],
    marques: ['Nike', 'Apple', 'Google', 'Adidas', 'Zara'],
    prenoms: ['José', 'María', 'Juan', 'Sofía', 'Mohammed', 'Fatima'],
    plantes: ['rosa', 'roble', 'tulipán', 'ortiga', 'helecho', 'abeto', 'lavanda', 'margarita', 'diente de león', 'cactus', 'hiedra', 'bambú', 'palmera', 'orquídea', 'girasol'],
    objets: ['tenedor', 'llave', 'teléfono', 'paraguas', 'lámpara', 'almohada', 'vaso', 'plato', 'tijeras', 'bolígrafo', 'espejo', 'cepillo de dientes', 'reloj', 'lápiz', 'cuchara', 'mechero', 'peine'],
    'oiseaux-reptiles': [
      'gorrión', 'paloma', 'águila', 'cuervo', 'mirlo', 'gallina', 'gallo', 'pato', 'cisne', 'búho', 'lechuza', 'loro',
      'avestruz', 'pingüino', 'flamenco', 'gaviota', 'urraca', 'petirrojo', 'halcón', 'serpiente', 'lagarto',
      'cocodrilo', 'caimán', 'tortuga', 'camaleón', 'iguana', 'víbora', 'cobra', 'pitón',
    ],
    'animaux-marins': [
      'tiburón', 'ballena', 'delfín', 'orca', 'foca', 'león marino', 'morsa', 'pulpo', 'calamar', 'sepia', 'medusa',
      'estrella de mar', 'erizo de mar', 'cangrejo', 'langosta', 'gamba', 'camarón', 'mejillón', 'ostra', 'vieira', 'atún',
      'salmón', 'sardina', 'bacalao', 'raya', 'pez espada', 'caballito de mar', 'anguila', 'coral',
    ],
    vetements: [
      'jersey', 'suéter', 'calcetín', 'pendiente', 'gorra', 'gafas', 'pantalón', 'vaqueros', 'camisa', 'camiseta',
      'vestido', 'falda', 'chaqueta', 'abrigo', 'calzoncillos', 'sujetador', 'pijama', 'bufanda', 'sombrero', 'guante',
      'cinturón', 'corbata', 'zapato', 'zapatilla', 'bota', 'sandalia', 'collar', 'pulsera', 'anillo', 'reloj', 'bolso',
    ],
    locomotion: [
      'caballo', 'coche', 'avión', 'patines', 'remo', 'bicicleta', 'patinete', 'autobús', 'tren', 'metro', 'tranvía',
      'taxi', 'Uber', 'barco', 'moto', 'camión', 'helicóptero', 'monopatín', 'kayak', 'canoa', 'ferri', 'cohete',
      'submarino', 'velero', 'teleférico', 'trineo',
    ],
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
    pays: ['Francia', 'Germania', 'Giappone', 'Brasile', 'Canada', 'Messico'],
    animaux: ['gatto', 'cane', 'cavallo', 'elefante', 'mucca', 'leone', 'zebra', 'topo', 'coniglio', 'orso', 'scimmia', 'balena', 'delfino', 'giraffa', 'tigre', 'lupo', 'volpe', 'pecora', 'maiale', 'capra', 'riccio', 'scoiattolo', 'canguro', 'pipistrello'],
    couleurs: ['rosso', 'blu', 'verde', 'giallo', 'nero', 'bianco'],
    'fruits-legumes': ['mela', 'banana', 'carota', 'pomodoro', 'fragola', 'patata', 'fungo', 'basilico'],
    metiers: ['panettiere', 'medico', 'avvocato', 'idraulico', 'infermiere', 'insegnante', 'pompiere'],
    sports: ['calcio', 'tennis', 'judo', 'nuoto', 'rugby', 'golf', 'pugilato'],
    'corps-humain': ['braccio', 'gamba', 'cuore', 'occhio', 'naso', 'ginocchio'],
    matieres: ['ferro', 'legno', 'oro', 'ossigeno', 'rame', 'vetro'],
    capitales: ['Parigi', 'Londra', 'Tokyo', 'Berlino', 'Roma', 'Madrid', 'Taranto', 'Trieste', 'Venezia', 'Bolzano', 'Cagliari', 'Padova', 'Messina'],
    marques: ['Nike', 'Apple', 'Google', 'Adidas', 'Fiat', 'Ducati'],
    prenoms: ['Giulia', 'Marco', 'Maria', 'Giuseppe', 'Mohammed'],
    plantes: ['rosa', 'quercia', 'tulipano', 'ortica', 'felce', 'abete', 'lavanda', 'margherita', 'tarassaco', 'cactus', 'edera', 'bambù', 'palma', 'orchidea', 'girasole'],
    objets: ['forchetta', 'chiave', 'telefono', 'ombrello', 'lampada', 'cuscino', 'bicchiere', 'piatto', 'forbici', 'penna', 'specchio', 'spazzolino', 'orologio', 'matita', 'cucchiaio', 'accendino', 'pettine'],
    'oiseaux-reptiles': [
      'passero', 'piccione', 'aquila', 'corvo', 'merlo', 'gallina', 'gallo', 'anatra', 'cigno', 'gufo', 'civetta',
      'pappagallo', 'struzzo', 'pinguino', 'fenicottero', 'gabbiano', 'gazza', 'pettirosso', 'falco', 'serpente',
      'lucertola', 'coccodrillo', 'alligatore', 'tartaruga', 'camaleonte', 'iguana', 'vipera', 'cobra', 'pitone',
    ],
    'animaux-marins': [
      'squalo', 'balena', 'delfino', 'orca', 'foca', 'leone marino', 'tricheco', 'polpo', 'calamaro', 'seppia', 'medusa',
      'stella marina', 'riccio di mare', 'granchio', 'aragosta', 'gambero', 'cozza', 'ostrica', 'capasanta', 'tonno',
      'salmone', 'sardina', 'merluzzo', 'razza', 'pesce spada', 'cavalluccio marino', 'anguilla', 'corallo',
    ],
    vetements: [
      'maglione', 'calzino', 'orecchino', 'berretto', 'occhiali', 'pantaloni', 'jeans', 'camicia', 'maglietta', 'vestito',
      'gonna', 'giacca', 'cappotto', 'mutande', 'reggiseno', 'pigiama', 'sciarpa', 'cappello', 'guanto', 'cintura',
      'cravatta', 'scarpa', 'stivale', 'sandalo', 'collana', 'braccialetto', 'anello', 'orologio', 'borsa',
    ],
    locomotion: [
      'cavallo', 'auto', 'macchina', 'aereo', 'pattini', 'canottaggio', 'bicicletta', 'monopattino', 'autobus', 'treno',
      'metropolitana', 'tram', 'taxi', 'Uber', 'barca', 'nave', 'moto', 'camion', 'elicottero', 'skateboard', 'kayak',
      'canoa', 'traghetto', 'razzo', 'sottomarino', 'funivia', 'slitta',
    ],
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
    pays: ['Frankrijk', 'Duitsland', 'Japan', 'Brazilië', 'Canada', 'België'],
    animaux: ['kat', 'hond', 'paard', 'olifant', 'koe', 'leeuw', 'zebra', 'muis', 'konijn', 'beer', 'aap', 'walvis', 'dolfijn', 'giraf', 'tijger', 'wolf', 'vos', 'schaap', 'varken', 'geit', 'egel', 'eekhoorn', 'kangoeroe', 'vleermuis'],
    couleurs: ['rood', 'blauw', 'groen', 'geel', 'zwart', 'wit'],
    'fruits-legumes': ['appel', 'banaan', 'wortel', 'tomaat', 'aardbei', 'aardappel', 'champignon', 'peterselie'],
    metiers: ['bakker', 'arts', 'advocaat', 'loodgieter', 'verpleegster', 'leraar', 'brandweerman'],
    sports: ['voetbal', 'tennis', 'judo', 'zwemmen', 'rugby', 'golf', 'boksen'],
    'corps-humain': ['arm', 'been', 'hart', 'oog', 'neus', 'knie', 'gezicht'],
    matieres: ['ijzer', 'hout', 'goud', 'zuurstof', 'koper', 'glas', 'olie', 'plastic'],
    capitales: ['Parijs', 'Londen', 'Tokio', 'Berlijn', 'Rome', 'Madrid', 'Haarlem', 'Maastricht', 'Leiden', 'Arnhem', 'Enschede', 'Dordrecht', 'Rijsel', 'Brugge'],
    marques: ['Nike', 'Apple', 'Google', 'Adidas', 'Philips'],
    prenoms: ['Emma', 'Jan', 'Sanne', 'Mohammed', 'Fatima'],
    plantes: ['roos', 'eik', 'tulp', 'brandnetel', 'varen', 'spar', 'lavendel', 'madeliefje', 'paardenbloem', 'cactus', 'klimop', 'bamboe', 'palm', 'orchidee', 'zonnebloem'],
    objets: ['vork', 'sleutel', 'telefoon', 'paraplu', 'lamp', 'kussen', 'glas', 'bord', 'schaar', 'pen', 'spiegel', 'tandenborstel', 'horloge', 'potlood', 'lepel', 'aansteker', 'kam'],
    'oiseaux-reptiles': [
      'mus', 'duif', 'arend', 'adelaar', 'kraai', 'merel', 'kip', 'haan', 'eend', 'zwaan', 'uil', 'papegaai',
      'struisvogel', 'pinguïn', 'flamingo', 'meeuw', 'ekster', 'roodborstje', 'valk', 'slang', 'hagedis', 'krokodil',
      'alligator', 'schildpad', 'kameleon', 'leguaan', 'adder', 'cobra', 'python',
    ],
    'animaux-marins': [
      'haai', 'walvis', 'dolfijn', 'orka', 'zeehond', 'zeeleeuw', 'walrus', 'octopus', 'inktvis', 'kwal', 'zeester',
      'zee-egel', 'krab', 'kreeft', 'garnaal', 'mossel', 'oester', 'sint-jakobsschelp', 'tonijn', 'zalm', 'sardine',
      'kabeljauw', 'rog', 'zwaardvis', 'zeepaardje', 'paling', 'koraal',
    ],
    vetements: [
      'trui', 'sok', 'oorbel', 'pet', 'bril', 'broek', 'spijkerbroek', 'overhemd', 't-shirt', 'jurk', 'rok', 'jas',
      'onderbroek', 'beha', 'pyjama', 'sjaal', 'muts', 'hoed', 'handschoen', 'riem', 'stropdas', 'schoen', 'laars',
      'sandaal', 'ketting', 'armband', 'ring', 'horloge', 'handtas',
    ],
    locomotion: [
      'lopen', 'paard', 'auto', 'vliegtuig', 'roeien', 'fiets', 'step', 'bus', 'trein', 'metro', 'tram', 'rolschaatsen',
      'taxi', 'Uber', 'boot', 'schip', 'motor', 'vrachtwagen', 'helikopter', 'skateboard', 'kajak', 'kano', 'veerboot',
      'raket', 'onderzeeër', 'zeilboot', 'kabelbaan', 'slee',
    ],
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
    pays: ['França', 'Alemanha', 'Japão', 'Brasil', 'Canadá', 'México'],
    animaux: ['gato', 'cão', 'cachorro', 'cavalo', 'elefante', 'vaca', 'leão', 'zebra', 'rato', 'coelho', 'urso', 'macaco', 'baleia', 'golfinho', 'girafa', 'tigre', 'lobo', 'raposa', 'ovelha', 'porco', 'cabra', 'ouriço', 'esquilo', 'canguru', 'morcego'],
    couleurs: ['vermelho', 'azul', 'verde', 'amarelo', 'preto', 'branco'],
    'fruits-legumes': ['maçã', 'banana', 'cenoura', 'tomate', 'morango', 'batata', 'cogumelo'],
    metiers: ['padeiro', 'médico', 'advogado', 'encanador', 'enfermeira', 'professor', 'bombeiro'],
    sports: ['futebol', 'tênis', 'judô', 'natação', 'rugby', 'golfe', 'boxe'],
    'corps-humain': ['braço', 'perna', 'coração', 'olho', 'nariz', 'joelho'],
    matieres: ['ferro', 'madeira', 'ouro', 'oxigênio', 'cobre', 'vidro'],
    capitales: ['Paris', 'Londres', 'Tóquio', 'Berlim', 'Roma', 'Madrid', 'João Pessoa', 'Porto Alegre', 'Campinas', 'Florianópolis', 'Santos', 'Niterói', 'Veneza'],
    marques: ['Nike', 'Apple', 'Google', 'Adidas', 'Natura', 'Toyota', 'Ford'],
    prenoms: ['Maria', 'José', 'João', 'Ana', 'Mohammed'],
    plantes: ['rosa', 'carvalho', 'tulipa', 'urtiga', 'samambaia', 'abeto', 'lavanda', 'margarida', 'dente-de-leão', 'cato', 'hera', 'bambu', 'palmeira', 'orquídea', 'girassol'],
    objets: ['garfo', 'chave', 'telefone', 'guarda-chuva', 'lâmpada', 'travesseiro', 'copo', 'prato', 'tesoura', 'caneta', 'espelho', 'escova de dentes', 'relógio', 'lápis', 'colher', 'isqueiro', 'pente'],
    'oiseaux-reptiles': [
      'pardal', 'pombo', 'águia', 'corvo', 'melro', 'galinha', 'galo', 'pato', 'cisne', 'coruja', 'papagaio', 'avestruz',
      'pinguim', 'flamingo', 'gaivota', 'pega', 'falcão', 'cobra', 'serpente', 'lagarto', 'crocodilo', 'jacaré',
      'tartaruga', 'camaleão', 'iguana', 'víbora', 'píton',
    ],
    'animaux-marins': [
      'tubarão', 'baleia', 'golfinho', 'orca', 'foca', 'leão-marinho', 'morsa', 'polvo', 'lula', 'choco', 'água-viva',
      'estrela-do-mar', 'ouriço-do-mar', 'caranguejo', 'lagosta', 'camarão', 'mexilhão', 'ostra', 'vieira', 'atum',
      'salmão', 'sardinha', 'bacalhau', 'raia', 'peixe-espada', 'cavalo-marinho', 'enguia', 'coral',
    ],
    vetements: [
      'suéter', 'meia', 'brinco', 'boné', 'óculos', 'calça', 'jeans', 'camisa', 'camiseta', 'vestido', 'saia', 'jaqueta',
      'casaco', 'cueca', 'sutiã', 'pijama', 'cachecol', 'chapéu', 'luva', 'cinto', 'gravata', 'sapato', 'tênis', 'bota',
      'sandália', 'colar', 'pulseira', 'anel', 'relógio', 'bolsa',
    ],
    locomotion: [
      'caminhada', 'cavalo', 'carro', 'avião', 'patins', 'remo', 'bicicleta', 'patinete', 'ônibus', 'trem', 'metrô',
      'bonde', 'táxi', 'Uber', 'barco', 'navio', 'moto', 'caminhão', 'helicóptero', 'skate', 'caiaque', 'canoa', 'balsa',
      'foguete', 'submarino', 'veleiro', 'teleférico', 'trenó',
    ],
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

/** Answers the import once let through: codes, homographs' forms, a category's bookkeeping. */
const REFUSED: Record<string, Record<string, readonly string[]>> = {
  fr: {
    pays: ['bb', 'ne', 'née', 'bénigne', 'argentins', 'mes', 'suissesse', 'chinée'],
    capitales: ['mâles'],
    marques: ['accolades', 'Adobes'],
    animaux: ['table', 'voiture', 'abeille', 'moineau', 'requin', 'serpent'],
  },
  en: {
    pays: ['bars', 'bas', 'cans', 'des', 'Canadas', 'chillun', 'fi'],
    capitales: ['Berlins', 'bangkoks'],
    marques: ['acers', 'HPs'],
    animaux: ['malaria', 'saddle', 'Twilight Sparkle', 'bee', 'sparrow', 'snake'],
  },
  de: { pays: ['Polin', 'bs', 'VN'], capitales: ['Havannas'] },
  es: { pays: ['argentinas', 'aw'], capitales: ['berlines'] },
  it: { pays: ['cube', 'SK'], capitales: ['damaschi'] },
  nl: { pays: ['chilis', 'nl', 'MUS'], capitales: [] },
  pt: { pays: ['angolas', 'pt', 'sãs'], capitales: ['cairos'] },
}

/** A slip anyone makes at speed: no accents, no capital, no hyphen. */
const hurried = (word: string) =>
  word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-’']/g, ' ')

/** What the moderators accepted, as the last import read it (scripts/community-words.ts). */
const COMMUNITY = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../scripts/community-words.json'), 'utf8'),
) as Record<string, Record<string, string[]>>

/**
 * The spellings a super moderator corrected (scripts/amended-words.json): the
 * import renames the row, so the dictionary holds the corrected word while the
 * accepted list keeps the spelling it came in with — « Hypopotamus » reads
 * « Hippopotamus ».
 */
const AMENDED = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../scripts/amended-words.json'), 'utf8'),
) as Record<string, Record<string, { from: string; to: string }[]>>

const corrected = (lang: string, id: string, word: string) =>
  AMENDED[lang]?.[id]?.find((one) => normalizeWord(one.from) === normalizeWord(word))?.to ?? word

/**
 * Where a category gave words up when it narrowed: « Objets du quotidien »
 * became « Petit objet », and the moderators' « voiture » or « fenêtre » went
 * to the draft « Meubles et gros objets ».
 */
const NARROWED: Record<string, string> = { objets: 'meubles' }
const draftPack = (lang: string, id: string) => {
  const path = join(import.meta.dirname, 'drafts', lang, `${id}.json`)
  return buildWordPack(id, JSON.parse(readFileSync(path, 'utf8')) as WordRow[])
}

// No suite until a word is accepted: vitest fails an empty one.
for (const [lang, categories] of Object.entries(COMMUNITY)) {
  for (const [id, words] of Object.entries(categories)) {
    it(`${lang}/${id} ships the ${words.length} words its moderators accepted`, () => {
      const elsewhere = NARROWED[id] ? draftPack(lang, NARROWED[id]) : null
      const lost = words
        .map((word) => corrected(lang, id, word))
        .filter((word) => findWord(pack(lang, id), word, 0) === null && (!elsewhere || findWord(elsewhere, word, 0) === null))
      expect(lost).toEqual([])
    })
  }
}

describe('obvious answers', () => {
  for (const [lang, categories] of Object.entries(OBVIOUS)) {
    for (const [id, words] of Object.entries(categories)) {
      it(`${lang}/${id} knows ${words.join(', ')}`, () => {
        const missing = words.filter((word) => findWord(pack(lang, id), word, 0) === null)
        expect(missing).toEqual([])
        const lost = words.filter((word) => findWord(pack(lang, id), hurried(word), 0) === null)
        expect(lost).toEqual([])
      })
    }
  }

  for (const [lang, categories] of Object.entries(REFUSED)) {
    for (const [id, words] of Object.entries(categories)) {
      if (words.length === 0) continue
      it(`${lang}/${id} refuses ${words.join(', ')}`, () => {
        const accepted = words.filter((word) => findWord(pack(lang, id), word, 0) !== null)
        expect(accepted).toEqual([])
      })
    }
  }

  it('scores a form under the word it bends', () => {
    const cases: [string, string, string, string][] = [
      ['fr', 'animaux', 'chevaux', 'cheval'],
      ['fr', 'animaux', 'chats', 'chat'],
      ['fr', 'couleurs', 'vertes', 'vert'],
      ['fr', 'metiers', 'boulangers', 'boulanger'],
      ['en', 'animaux', 'horses', 'horse'],
      ['de', 'animaux', 'Katzen', 'katze'],
      ['es', 'animaux', 'perros', 'perro'],
      ['it', 'animaux', 'gatti', 'gatto'],
      ['nl', 'animaux', 'honden', 'hond'],
      ['pt', 'animaux', 'gatos', 'gato'],
      // An alias scores as the word it names.
      ['en', 'pays', 'USA', 'united states'],
      ['de', 'pays', 'USA', 'vereinigte staaten'],
      ['fr', 'pays', 'Chine populaire', 'chine'],
      ['en', 'marques', 'Mercedes', 'mercedes benz'],
      ['de', 'capitales', 'Frankfurt', 'frankfurt am main'],
    ]
    for (const [lang, id, form, lemma] of cases) {
      expect(findWord(pack(lang, id), form, 0)?.entry.key, `${lang}/${id} ${form}`).toBe(lemma)
    }
  })

  it('draws the letters a table expects on its best-known categories', () => {
    // Not F: France, Fidji and Finlande are all there is, and the « Fédération
    // de Russie » that once stocked it is Russia's alias.
    for (const [lang, id, letters] of [
      ['fr', 'pays', 'ABCIMP'],
      ['fr', 'animaux', 'ABCHLMPR'],
      ['en', 'pays', 'ABCGIMS'],
      ['de', 'pays', 'BDIKS'],
    ] as const) {
      const known = knownByLetter(pack(lang, id))
      const thin = [...letters].filter((letter) => (known.get(letter) ?? 0) < THIN_PROMPT_WORDS / 2)
      expect(thin, `${lang}/${id}`).toEqual([])
    }
  })
})
