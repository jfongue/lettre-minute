import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SOON } from '../domain/catalogue'
import { THIN_PROMPT_WORDS } from '../domain/run'
import { compactWord, initialOf, normalizeWord } from '../domain/text'
import { buildWordPack, findWord, knownByLetter, type WordRow } from '../domain/words'

/**
 * The categories prepared but not shipped (`DRAFT_SOURCES`, `SOON`): their
 * dictionaries wait under src/data/drafts, which the game never loads. Before
 * one moves to src/data/words, it must hold the answers a table would shout
 * in each of the seven languages, and enough known letters to be drawn.
 */
const DIR = join(import.meta.dirname, 'drafts')
const WORDS = join(import.meta.dirname, 'words')
const LANGS = ['de', 'en', 'es', 'fr', 'it', 'nl', 'pt']
const DRAFTS = SOON.map((category) => category.id)

const rowsOf = new Map<string, readonly WordRow[]>()
const packOf = new Map<string, ReturnType<typeof buildWordPack>>()
for (const lang of existsSync(DIR) ? readdirSync(DIR) : []) {
  for (const file of readdirSync(join(DIR, lang))) {
    if (!file.endsWith('.json')) continue
    const name = `${lang}/${file.replace('.json', '')}`
    const rows = JSON.parse(readFileSync(join(DIR, lang, file), 'utf8')) as WordRow[]
    rowsOf.set(name, rows)
    packOf.set(name, buildWordPack(name, rows))
  }
}

/**
 * Drafts no letter of which holds THIN_PROMPT_WORDS known words yet: Dutch
 * corpora rate « koptelefoon » or « bakfiets » too rare to count as known.
 * Not ready to ship as they stand — a run would deal the same few pairs —,
 * and held below the bar here so that the day an import lifts one, this list
 * has to shrink with it.
 */
const THIN_YET = ['nl/electronique', 'nl/locomotion', 'nl/meubles']

/** The first answers a table would shout, per language. */
const OBVIOUS: Record<string, Record<string, readonly string[]>> = {
  fr: {
    meubles: [
      'lit', 'armoire', 'canapé', 'table', 'chaise', 'fauteuil', 'commode', 'buffet', 'bureau', 'étagère', 'tabouret',
      'banc', 'réfrigérateur', 'frigo', 'congélateur', 'lave-linge', 'lave-vaisselle', 'four', 'micro-ondes', 'télévision',
      'aspirateur', 'piano', 'baignoire', 'matelas', 'échelle', 'brouette', 'valise', 'horloge',
    ],
    'animaux-marins': [
      'requin', 'baleine', 'dauphin', 'orque', 'phoque', 'otarie', 'morse', 'pieuvre', 'poulpe', 'calmar', 'seiche',
      'méduse', 'étoile de mer', 'oursin', 'crabe', 'homard', 'langouste', 'crevette', 'moule', 'huître', 'thon',
      'saumon', 'sardine', 'morue', 'cabillaud', 'raie', 'espadon', 'hippocampe', 'anguille', 'corail',
    ],
    'oiseaux-reptiles': [
      'moineau', 'pigeon', 'aigle', 'corbeau', 'merle', 'poule', 'coq', 'canard', 'cygne', 'hibou', 'chouette',
      'perroquet', 'autruche', 'pingouin', 'manchot', 'flamant', 'mouette', 'pie', 'rouge-gorge', 'faucon', 'serpent',
      'lézard', 'crocodile', 'alligator', 'tortue', 'caméléon', 'iguane', 'vipère', 'couleuvre', 'cobra', 'python',
    ],
    locomotion: [
      'marche', 'cheval', 'voiture', 'avion', 'roller', 'aviron', 'vélo', 'trottinette', 'bus', 'RER', 'TGV', 'métro',
      'tram', 'tramway', 'patins à roulettes', 'taxi', 'Uber', 'train', 'bateau', 'moto', 'scooter', 'camion',
      'hélicoptère', 'skateboard', 'kayak', 'canoë', 'ferry', 'autocar', 'montgolfière', 'fusée', 'voilier', 'téléphérique',
    ],
    vetements: [
      'pull', 'chaussette', 'boucle d’oreille', 'casquette', 'lunettes', 'pantalon', 'jean', 'chemise', 't-shirt', 'robe',
      'jupe', 'veste', 'manteau', 'blouson', 'short', 'culotte', 'soutien-gorge', 'pyjama', 'écharpe', 'bonnet',
      'chapeau', 'gant', 'ceinture', 'cravate', 'chaussure', 'basket', 'botte', 'sandale', 'collier', 'bracelet', 'bague',
      'montre', 'sac à main',
    ],
    electronique: [
      'ordinateur', 'caisse enregistreuse', 'ordinateur portable', 'casque', 'téléphone', 'smartphone', 'télévision',
      'imprimante', 'tablette', 'console', 'écouteurs', 'enceinte', 'appareil photo', 'clavier', 'souris', 'écran',
      'radio', 'télécommande', 'calculatrice', 'scanner', 'micro', 'webcam', 'routeur', 'clé USB', 'chargeur',
    ],
  },
  en: {
    meubles: [
      'bed', 'wardrobe', 'sofa', 'couch', 'table', 'chair', 'armchair', 'desk', 'shelf', 'stool', 'bench', 'fridge',
      'refrigerator', 'freezer', 'washing machine', 'dishwasher', 'oven', 'microwave', 'television', 'vacuum cleaner',
      'piano', 'bathtub', 'mattress', 'ladder', 'wheelbarrow', 'suitcase', 'clock',
    ],
    'animaux-marins': [
      'shark', 'whale', 'dolphin', 'orca', 'seal', 'sea lion', 'walrus', 'octopus', 'squid', 'cuttlefish', 'jellyfish',
      'starfish', 'sea urchin', 'crab', 'lobster', 'shrimp', 'prawn', 'mussel', 'oyster', 'scallop', 'tuna', 'salmon',
      'sardine', 'cod', 'ray', 'swordfish', 'seahorse', 'eel', 'coral',
    ],
    'oiseaux-reptiles': [
      'sparrow', 'pigeon', 'eagle', 'crow', 'blackbird', 'hen', 'chicken', 'rooster', 'duck', 'swan', 'owl', 'parrot',
      'ostrich', 'penguin', 'flamingo', 'seagull', 'magpie', 'robin', 'falcon', 'snake', 'lizard', 'crocodile',
      'alligator', 'turtle', 'tortoise', 'chameleon', 'iguana', 'viper', 'cobra', 'python',
    ],
    locomotion: [
      'walking', 'horse', 'car', 'plane', 'rowing', 'bicycle', 'bike', 'scooter', 'bus', 'train', 'metro', 'subway',
      'tram', 'roller skates', 'taxi', 'Uber', 'boat', 'motorbike', 'motorcycle', 'truck', 'lorry', 'helicopter',
      'skateboard', 'kayak', 'canoe', 'ferry', 'coach', 'rocket', 'submarine', 'sailboat', 'cable car',
    ],
    vetements: [
      'jumper', 'sweater', 'sock', 'earring', 'cap', 'glasses', 'trousers', 'jeans', 'shirt', 't-shirt', 'dress', 'skirt',
      'jacket', 'coat', 'shorts', 'bra', 'pyjamas', 'scarf', 'hat', 'glove', 'belt', 'tie', 'shoe', 'trainers', 'boot',
      'sandal', 'necklace', 'bracelet', 'ring', 'watch', 'handbag',
    ],
    electronique: [
      'computer', 'cash register', 'laptop', 'headphones', 'phone', 'smartphone', 'television', 'TV', 'printer', 'tablet',
      'console', 'earphones', 'speaker', 'camera', 'keyboard', 'mouse', 'monitor', 'screen', 'radio', 'remote',
      'calculator', 'scanner', 'microphone', 'webcam', 'router', 'charger',
    ],
  },
  de: {
    meubles: [
      'Bett', 'Schrank', 'Sofa', 'Tisch', 'Stuhl', 'Sessel', 'Kommode', 'Schreibtisch', 'Regal', 'Hocker', 'Bank',
      'Kühlschrank', 'Gefrierschrank', 'Waschmaschine', 'Spülmaschine', 'Backofen', 'Mikrowelle', 'Fernseher',
      'Staubsauger', 'Klavier', 'Badewanne', 'Matratze', 'Leiter', 'Schubkarre', 'Koffer',
    ],
    'animaux-marins': [
      'Hai', 'Wal', 'Delfin', 'Orca', 'Robbe', 'Seelöwe', 'Walross', 'Krake', 'Tintenfisch', 'Qualle', 'Seestern',
      'Seeigel', 'Krabbe', 'Hummer', 'Garnele', 'Miesmuschel', 'Auster', 'Jakobsmuschel', 'Thunfisch', 'Lachs',
      'Sardine', 'Kabeljau', 'Rochen', 'Schwertfisch', 'Seepferdchen', 'Aal', 'Koralle',
    ],
    'oiseaux-reptiles': [
      'Spatz', 'Taube', 'Adler', 'Krähe', 'Rabe', 'Amsel', 'Huhn', 'Hahn', 'Ente', 'Schwan', 'Eule', 'Papagei',
      'Strauß', 'Pinguin', 'Flamingo', 'Möwe', 'Elster', 'Rotkehlchen', 'Falke', 'Schlange', 'Eidechse', 'Krokodil',
      'Alligator', 'Schildkröte', 'Chamäleon', 'Leguan', 'Viper', 'Kobra', 'Python',
    ],
    locomotion: [
      'Pferd', 'Auto', 'Flugzeug', 'Rudern', 'Fahrrad', 'Roller', 'Bus', 'S-Bahn', 'ICE', 'U-Bahn', 'Straßenbahn',
      'Rollschuhe', 'Taxi', 'Uber', 'Zug', 'Boot', 'Schiff', 'Motorrad', 'Lastwagen', 'Hubschrauber', 'Skateboard',
      'Kajak', 'Kanu', 'Fähre', 'Rakete', 'Segelboot', 'Seilbahn',
    ],
    vetements: [
      'Pullover', 'Pulli', 'Socke', 'Ohrring', 'Mütze', 'Brille', 'Hose', 'Jeans', 'Hemd', 'T-Shirt', 'Kleid', 'Rock',
      'Jacke', 'Mantel', 'Unterhose', 'BH', 'Schlafanzug', 'Schal', 'Hut', 'Handschuh', 'Gürtel', 'Krawatte', 'Schuh',
      'Stiefel', 'Sandale', 'Halskette', 'Armband', 'Ring', 'Uhr', 'Handtasche',
    ],
    electronique: [
      'Computer', 'Registrierkasse', 'Laptop', 'Kopfhörer', 'Telefon', 'Handy', 'Smartphone', 'Fernseher', 'Drucker',
      'Tablet', 'Spielkonsole', 'Lautsprecher', 'Kamera', 'Tastatur', 'Maus', 'Bildschirm', 'Radio', 'Fernbedienung',
      'Taschenrechner', 'Scanner', 'Mikrofon', 'Webcam', 'Router', 'Ladegerät',
    ],
  },
  es: {
    meubles: [
      'cama', 'armario', 'sofá', 'mesa', 'silla', 'sillón', 'cómoda', 'escritorio', 'estantería', 'taburete', 'banco',
      'nevera', 'frigorífico', 'congelador', 'lavadora', 'lavavajillas', 'horno', 'microondas', 'televisor',
      'aspiradora', 'piano', 'bañera', 'colchón', 'escalera', 'carretilla', 'maleta',
    ],
    'animaux-marins': [
      'tiburón', 'ballena', 'delfín', 'orca', 'foca', 'león marino', 'morsa', 'pulpo', 'calamar', 'sepia', 'medusa',
      'estrella de mar', 'erizo de mar', 'cangrejo', 'langosta', 'gamba', 'camarón', 'mejillón', 'ostra', 'vieira', 'atún',
      'salmón', 'sardina', 'bacalao', 'raya', 'pez espada', 'caballito de mar', 'anguila', 'coral',
    ],
    'oiseaux-reptiles': [
      'gorrión', 'paloma', 'águila', 'cuervo', 'mirlo', 'gallina', 'gallo', 'pato', 'cisne', 'búho', 'lechuza', 'loro',
      'avestruz', 'pingüino', 'flamenco', 'gaviota', 'urraca', 'petirrojo', 'halcón', 'serpiente', 'lagarto',
      'cocodrilo', 'caimán', 'tortuga', 'camaleón', 'iguana', 'víbora', 'cobra', 'pitón',
    ],
    locomotion: [
      'caballo', 'coche', 'avión', 'patines', 'remo', 'bicicleta', 'patinete', 'autobús', 'tren', 'metro', 'tranvía',
      'taxi', 'Uber', 'barco', 'moto', 'camión', 'helicóptero', 'monopatín', 'kayak', 'canoa', 'ferri', 'cohete',
      'submarino', 'velero', 'teleférico', 'trineo',
    ],
    vetements: [
      'jersey', 'suéter', 'calcetín', 'pendiente', 'gorra', 'gafas', 'pantalón', 'vaqueros', 'camisa', 'camiseta',
      'vestido', 'falda', 'chaqueta', 'abrigo', 'calzoncillos', 'sujetador', 'pijama', 'bufanda', 'sombrero', 'guante',
      'cinturón', 'corbata', 'zapato', 'zapatilla', 'bota', 'sandalia', 'collar', 'pulsera', 'anillo', 'reloj', 'bolso',
    ],
    electronique: [
      'ordenador', 'computadora', 'caja registradora', 'portátil', 'auriculares', 'teléfono', 'móvil', 'smartphone',
      'televisor', 'televisión', 'impresora', 'tableta', 'consola', 'altavoz', 'cámara', 'teclado', 'ratón', 'pantalla',
      'radio', 'mando', 'calculadora', 'escáner', 'micrófono', 'webcam', 'router', 'cargador',
    ],
  },
  it: {
    meubles: [
      'letto', 'armadio', 'divano', 'tavolo', 'sedia', 'poltrona', 'comò', 'scrivania', 'scaffale', 'sgabello', 'panca',
      'frigorifero', 'frigo', 'congelatore', 'lavatrice', 'lavastoviglie', 'forno', 'microonde', 'televisore',
      'aspirapolvere', 'pianoforte', 'vasca da bagno', 'materasso', 'scala', 'carriola', 'valigia',
    ],
    'animaux-marins': [
      'squalo', 'balena', 'delfino', 'orca', 'foca', 'leone marino', 'tricheco', 'polpo', 'calamaro', 'seppia', 'medusa',
      'stella marina', 'riccio di mare', 'granchio', 'aragosta', 'gambero', 'cozza', 'ostrica', 'capasanta', 'tonno',
      'salmone', 'sardina', 'merluzzo', 'razza', 'pesce spada', 'cavalluccio marino', 'anguilla', 'corallo',
    ],
    'oiseaux-reptiles': [
      'passero', 'piccione', 'aquila', 'corvo', 'merlo', 'gallina', 'gallo', 'anatra', 'cigno', 'gufo', 'civetta',
      'pappagallo', 'struzzo', 'pinguino', 'fenicottero', 'gabbiano', 'gazza', 'pettirosso', 'falco', 'serpente',
      'lucertola', 'coccodrillo', 'alligatore', 'tartaruga', 'camaleonte', 'iguana', 'vipera', 'cobra', 'pitone',
    ],
    locomotion: [
      'cavallo', 'auto', 'macchina', 'aereo', 'pattini', 'canottaggio', 'bicicletta', 'monopattino', 'autobus', 'treno',
      'metropolitana', 'tram', 'taxi', 'Uber', 'barca', 'nave', 'moto', 'camion', 'elicottero', 'skateboard', 'kayak',
      'canoa', 'traghetto', 'razzo', 'sottomarino', 'funivia', 'slitta',
    ],
    vetements: [
      'maglione', 'calzino', 'orecchino', 'berretto', 'occhiali', 'pantaloni', 'jeans', 'camicia', 'maglietta', 'vestito',
      'gonna', 'giacca', 'cappotto', 'mutande', 'reggiseno', 'pigiama', 'sciarpa', 'cappello', 'guanto', 'cintura',
      'cravatta', 'scarpa', 'stivale', 'sandalo', 'collana', 'braccialetto', 'anello', 'orologio', 'borsa',
    ],
    electronique: [
      'computer', 'registratore di cassa', 'portatile', 'cuffie', 'telefono', 'cellulare', 'smartphone', 'televisore',
      'televisione', 'stampante', 'tablet', 'console', 'altoparlante', 'fotocamera', 'tastiera', 'mouse', 'schermo',
      'radio', 'telecomando', 'calcolatrice', 'scanner', 'microfono', 'webcam', 'router', 'caricabatterie',
    ],
  },
  nl: {
    meubles: [
      'bed', 'kast', 'bank', 'tafel', 'stoel', 'fauteuil', 'commode', 'bureau', 'boekenkast', 'kruk', 'koelkast', 'vriezer',
      'wasmachine', 'vaatwasser', 'oven', 'magnetron', 'televisie', 'stofzuiger', 'piano', 'bad', 'matras', 'ladder',
      'kruiwagen', 'koffer', 'klok',
    ],
    'animaux-marins': [
      'haai', 'walvis', 'dolfijn', 'orka', 'zeehond', 'zeeleeuw', 'walrus', 'octopus', 'inktvis', 'kwal', 'zeester',
      'zee-egel', 'krab', 'kreeft', 'garnaal', 'mossel', 'oester', 'sint-jakobsschelp', 'tonijn', 'zalm', 'sardine',
      'kabeljauw', 'rog', 'zwaardvis', 'zeepaardje', 'paling', 'koraal',
    ],
    'oiseaux-reptiles': [
      'mus', 'duif', 'arend', 'adelaar', 'kraai', 'merel', 'kip', 'haan', 'eend', 'zwaan', 'uil', 'papegaai',
      'struisvogel', 'pinguïn', 'flamingo', 'meeuw', 'ekster', 'roodborstje', 'valk', 'slang', 'hagedis', 'krokodil',
      'alligator', 'schildpad', 'kameleon', 'leguaan', 'adder', 'cobra', 'python',
    ],
    locomotion: [
      'lopen', 'paard', 'auto', 'vliegtuig', 'roeien', 'fiets', 'step', 'bus', 'trein', 'metro', 'tram', 'rolschaatsen',
      'taxi', 'Uber', 'boot', 'schip', 'motor', 'vrachtwagen', 'helikopter', 'skateboard', 'kajak', 'kano', 'veerboot',
      'raket', 'onderzeeër', 'zeilboot', 'kabelbaan', 'slee',
    ],
    vetements: [
      'trui', 'sok', 'oorbel', 'pet', 'bril', 'broek', 'spijkerbroek', 'overhemd', 't-shirt', 'jurk', 'rok', 'jas',
      'onderbroek', 'beha', 'pyjama', 'sjaal', 'muts', 'hoed', 'handschoen', 'riem', 'stropdas', 'schoen', 'laars',
      'sandaal', 'ketting', 'armband', 'ring', 'horloge', 'handtas',
    ],
    electronique: [
      'computer', 'kassa', 'laptop', 'koptelefoon', 'telefoon', 'mobiel', 'smartphone', 'televisie', 'tv', 'printer',
      'tablet', 'spelcomputer', 'luidspreker', 'camera', 'toetsenbord', 'muis', 'beeldscherm', 'radio',
      'afstandsbediening', 'rekenmachine', 'scanner', 'microfoon', 'webcam', 'router', 'oplader',
    ],
  },
  pt: {
    meubles: [
      'cama', 'armário', 'sofá', 'mesa', 'cadeira', 'poltrona', 'cômoda', 'escrivaninha', 'estante', 'banco', 'geladeira',
      'congelador', 'máquina de lavar', 'lava-louças', 'forno', 'micro-ondas', 'televisão', 'aspirador', 'piano',
      'banheira', 'colchão', 'escada', 'carrinho de mão', 'mala',
    ],
    'animaux-marins': [
      'tubarão', 'baleia', 'golfinho', 'orca', 'foca', 'leão-marinho', 'morsa', 'polvo', 'lula', 'choco', 'água-viva',
      'estrela-do-mar', 'ouriço-do-mar', 'caranguejo', 'lagosta', 'camarão', 'mexilhão', 'ostra', 'vieira', 'atum',
      'salmão', 'sardinha', 'bacalhau', 'raia', 'peixe-espada', 'cavalo-marinho', 'enguia', 'coral',
    ],
    'oiseaux-reptiles': [
      'pardal', 'pombo', 'águia', 'corvo', 'melro', 'galinha', 'galo', 'pato', 'cisne', 'coruja', 'papagaio', 'avestruz',
      'pinguim', 'flamingo', 'gaivota', 'pega', 'falcão', 'cobra', 'serpente', 'lagarto', 'crocodilo', 'jacaré',
      'tartaruga', 'camaleão', 'iguana', 'víbora', 'píton',
    ],
    locomotion: [
      'caminhada', 'cavalo', 'carro', 'avião', 'patins', 'remo', 'bicicleta', 'patinete', 'ônibus', 'trem', 'metrô',
      'bonde', 'táxi', 'Uber', 'barco', 'navio', 'moto', 'caminhão', 'helicóptero', 'skate', 'caiaque', 'canoa', 'balsa',
      'foguete', 'submarino', 'veleiro', 'teleférico', 'trenó',
    ],
    vetements: [
      'suéter', 'meia', 'brinco', 'boné', 'óculos', 'calça', 'jeans', 'camisa', 'camiseta', 'vestido', 'saia', 'jaqueta',
      'casaco', 'cueca', 'sutiã', 'pijama', 'cachecol', 'chapéu', 'luva', 'cinto', 'gravata', 'sapato', 'tênis', 'bota',
      'sandália', 'colar', 'pulseira', 'anel', 'relógio', 'bolsa',
    ],
    electronique: [
      'computador', 'caixa registradora', 'notebook', 'fone de ouvido', 'telefone', 'celular', 'smartphone', 'televisão',
      'impressora', 'tablet', 'console', 'alto-falante', 'câmera', 'teclado', 'mouse', 'tela', 'monitor', 'rádio',
      'controle remoto', 'calculadora', 'scanner', 'microfone', 'webcam', 'roteador', 'carregador',
    ],
  },
}

/** A slip anyone makes at speed: no accents, no capital, no hyphen. */
const hurried = (word: string) =>
  word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-’']/g, ' ')

describe('draft dictionaries', () => {
  it('prepares each announced category in every language, and nothing else', () => {
    for (const lang of LANGS) {
      const ids = readdirSync(join(DIR, lang))
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.replace('.json', ''))
      expect(ids.sort(), lang).toEqual([...DRAFTS].sort())
    }
  })

  it('keeps « Petit objet » and « Meubles et gros objets » apart, each word in one of the two', () => {
    for (const lang of LANGS) {
      const small = new Set(
        (JSON.parse(readFileSync(join(WORDS, lang, 'objets.json'), 'utf8')) as WordRow[]).map(([display]) => normalizeWord(display)),
      )
      const shared = rowsOf
        .get(`${lang}/meubles`)!
        .filter(([display, , , canonical]) => !canonical && small.has(normalizeWord(display)))
        .map(([display]) => display)
      expect(shared, lang).toEqual([])
    }
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
        const best = Math.max(...known.values())
        if (THIN_YET.includes(name)) expect(best, name).toBeLessThan(THIN_PROMPT_WORDS)
        else expect(best, name).toBeGreaterThanOrEqual(THIN_PROMPT_WORDS)
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
