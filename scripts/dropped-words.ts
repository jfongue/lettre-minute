/**
 * Words a category's sources bring in but no player would give as an answer,
 * per language. The Wiktionary's textile list holds every fabric ever named
 * after a town ("londres", "salle"), its metals every element announced and
 * never found. A whole family is better cut with an `exclude` pull; this list
 * takes the rest.
 */
export const DROPPED_WORDS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  // Aliases that read as their country's plural, or misspell it.
  pays: {
    en: ['Greenlandia', 'Nepall', 'Ugandah'],
    de: ['Kap Verden'],
    nl: ['Nederlanden'],
  },
  // The Wiktionary's aromatic plants hold a few names of the everyday word
  // before the herb — « pote », « tin » — and the woods and dishes named after one.
  'fruits-legumes': {
    fr: ['pote', 'tin', 'pied de lit', 'aspic', 'spic', 'santal', 'camphrier', 'cannelier', 'cannelier de Chine', 'acajou-amer'],
  },
  matieres: {
    fr: [
      // Things made of cloth, and fabrics named after a place or a fruit.
      'alexandrine', 'americani', 'ananas', 'application de Bruxelles', 'chiffon',
      'cravate', 'cucurbite', 'drap de douche', 'e-textile', 'essuie-éponge', 'fancy', 'fil', 'flambé',
      'foulard', 'fouta', 'giselle', 'lame', 'liteau', 'locronan', 'londres', 'malle-molle',
      'mandarine', 'marlborough', 'montre', 'pallas', 'salle', 'serviette de bain', 'serviette de douche',
      'serviette-éponge', 'souple', 'stamboul', 'tun',
      // Fossil beds, processes and adjectives, not matter.
      'couche à ossements', 'couvrance', 'ignimbritique', 'latéritisation', 'lit à ossements',
      // Elements that never were: announced discoveries later disproved, and
      // the placeholder names of elements since named.
      'aldébaranium', 'cassiopéium', 'centurium', 'cochonium', 'dianium', 'dilithium', 'éka-aluminium',
      'éka-borium', 'éka-prométhium', 'eka-silicium', 'ékamanganèse', 'ékaniobium', 'ékasilicium', 'ékatantale',
      'florentium', 'hahnium', 'joliotium', 'kourtchatovium', 'nielsbohrium', 'nipponium', 'norium', 'pélopium',
      'virenium',
      // Families, compounds and shapes rather than a metal.
      'blindage homogène laminé', 'bullions', 'carbure de titane', 'chrome hexavalent', 'coil',
      'élément-trace métallique', 'groupe du platine', 'hydrure de titane', 'Ion ferreux', 'le metal non magnet',
      'maille', 'métal de transition', 'métal pauvre', 'métal réfractaire', 'métalloïde', 'métaux alcalins',
      'pierre à briquet', 'profilé', 'Rhodite', 'sel de lithium',
    ],
    // The English Wiktionary files standing stones under "Rocks", and every
    // fabric named after a place, a ship or a word of every day; its
    // translations carry them into the other languages.
    en: [
      'menhir', 'tibet', 'Cyprus', 'course', 'SS', 'deal', 'check', 'iron man', 'bafta', 'stuff', 'card', 'oxford',
      'omar', 'silesia', 'dreadnought', 'duck', 'holland', 'rabat', 'runner', 'fell', 'Copper production', 'Saxony',
      'hunger stone', 'pilled', 'material', 'cataract', 'handle', 'waffle', 'bituminous',
    ],
    de: [
      'Menhir', 'Basis', 'Spitze', 'Arm', 'Grundlage', 'Manchester', 'Schlachtschiff', 'Schindmähre',
      'Rettungsdecke', 'Silbermine', 'Makramee', 'Dilithium', 'Stoff', 'Moderator', 'Moderatorin', 'eiben',
      'eichen', 'erlen',
    ],
    es: [
      'menhir', 'derecho', 'blanco', 'género', 'celular', 'holanda', 'gato calicó', 'bosque', 'damasco', 'albo',
      'basa', 'alcalino', 'metal de transición', 'miro', 'aurífero', 'férrico', 'indiana',
    ],
    it: ['menhir', 'mano', 'cellulare', 'bosco', 'olanda', 'falesia', 'tenda', 'crespella', 'pietra della fame'],
    nl: [
      'menhir', 'stop', 'mat', 'lapjeskat', 'woud', 'mercury', 'gouden', 'ijzeren', 'stalen', 'koperen', 'bronzen',
      'hongersteen', 'dilithium', 'baai', 'ebbenhouten',
    ],
    pt: [
      'menir', 'brasil', 'casa', 'tais', 'roupa', 'mata', 'holanda', 'bordo', 'bombril', 'tapete', 'fino', 'penha',
      'pintado', 'atora', 'material', 'matéria', 'damasco', 'celular', 'cortina', 'castanho',
    ],
  },
  // Botanical family names — the taxon's own vernacular name (P1843) is
  // sometimes just its family, and the Wiktionary's "Genres de plantes" and
  // "Familles de plantes" hold little else. Real French words, but no player
  // types "Rosacées" or "cactacée" for a rose bush or a cactus; "jacée" and
  // "échinacée" are kept, they are the everyday name of a plant, not a family.
  plantes: {
    fr: [
      'Adoxacées', 'Aizoacées', 'Alismatacées', 'Amaryllidacées', 'Apiacées', 'Arécacées', 'Asparagacées',
      'Berbéridacées', 'Brassicacées', 'Broméliacées', 'Brunoniacées', 'Butomacées', 'Campanulacées', 'Canellacées',
      'Caprifoliacées', 'Cardioptéridacées', 'Caricacées', 'Caryophyllacées', 'Chloranthacées', 'Cistacées',
      'Cléomacées', 'Convolvulacées', 'Cératophyllacées', 'Diapensiacées', 'Didieréacées', 'Dioncophyllacées',
      'Dipsacacées', 'Dipsacées', 'Droséracées', 'Fagacées', 'Gentianacées', 'Griseliniacées', 'Gyrostémonacées',
      'Haloragacées', 'Haloragidacées', 'Hydrocharitacées', 'Iridacées', 'Juglandacées', 'Limnanthacées',
      'Lobéliacées', 'Lythracées', 'Marantacées', 'Molluginacées', 'Morinacées', 'Myodocarpacées', 'Mélanthiacées',
      'Ményanthacées', 'Nyctaginacées', 'Nymphéacées', 'Oenothéracées', 'Onagracées', 'Orobanchacées', 'Osmondacée',
      'Papavéracée', 'Papilionacées', 'Pennantiacées', 'Physénacées', 'Phytolaccacées', 'Pinacées',
      'Plombaginacées', 'Plumbaginacées', 'Poacées', 'Polygonacées', 'Potamogétonacées', 'Renonculacées',
      'Rhabdodendracées', 'Rosacées', 'Rubiacées', 'Rutacées', 'Résédacées', 'Salicacées', 'Salvadoracées',
      'Sarcobatacées', 'Simmondsiacées', 'Solanacées', 'Staphyléacées', 'Stégnospermatacées', 'Ternstroemiacées',
      'Théacées', 'Triméniacées', 'Valérianacées', 'Verbénacées', 'Wintéracées', 'acéracées', 'adoxacée',
      'agavacées', 'amaryllidacée', 'ampélidacée', 'annonacée', 'annonacées', 'apiacée', 'aracée', 'aracées',
      'araucariacée', 'araucariacées', 'asparagacée', 'astéracée', 'boraginacée', 'brassicacée', 'broméliacée',
      'bétulacée', 'cactacée', 'calycanthacée', 'campanulacée', 'caryophyllacée', 'characée', 'chicoracée',
      'chénopodiacée', 'cistacée', 'combrétacée', 'combrétacées', 'convolvulacée', 'crassulacée', 'cucurbitacée',
      'cupressacée', 'cupressacées', 'cypéracées', 'datiscacée', 'dioscoréacée', 'diptérocarpacée',
      'diptérocarpacées', 'euphorbiacée', 'fabacée', 'fabacées', 'fagacée', 'fucacée', 'gnétacée', 'géraniacée',
      'géraniacées', 'hamamélidacée', 'hyacinthacée', 'hyacinthacées', 'hydrocharidacée', 'hydrophyllacée',
      'iridacée', 'joncacée', 'joncacées', 'juglandacée', 'labiacée', 'lamiacée', 'lardizabalacée', 'lauracée',
      'lauracées', 'liliacées', 'linacées', 'loliacées', 'magnoliacée', 'malvacée', 'malvacées', 'marsiléacée',
      'musacée', 'ménispermacée', 'nymphéacée', 'oléacée', 'onagracée', 'orchidacée', 'palmacées', 'pandanacée',
      'papilionacée', 'pinacée', 'podocarpacée', 'podocarpacées', 'podostémacées', 'protéacée', 'protéacées',
      'rosacée', 'rubiacée', 'rutacée', 'salicacée', 'sapindacées', 'sapotacée', 'saxifragacée', 'scrofulariacée',
      'solanacée', 'spiréacées', 'tanacée', 'taxacée', 'taxacées', 'tiliacées', 'trigoniacées', 'turnéracées',
      'typhacées', 'urticacée', 'valérianacée', 'verbénacée', 'vitacée', 'xanthorrhoéacée', 'zingibéracée',
      'zostéracées', 'Ébénacées', 'équisétacées', 'papilionacé',
    ],
    // A sense-matched translation table sometimes lands on the wrong sense of
    // an ambiguous gloss — a drink, not the fruit or plant it is made from.
    it: ['legale', 'aranciata'],
    es: ['chocolateado'],
    nl: ['jenever'],
  },
}

/**
 * Words a category must hold that no source gives under that spelling:
 * Wikidata labels concrete "béton de ciment" in French, and its aliases are
 * chemical formulas and oil crises. Read as if the Wiktionary filed them.
 */
export const ADDED_WORDS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  // Wikidata labels salt « sel alimentaire » and stainless steel « acier
  // inoxydable », and files a wood under its tree: no pull reaches « sel »,
  // « inox » or « chêne ».
  matieres: {
    fr: [
      'béton', 'plastique', 'vapeur', 'PVC', 'daim', 'bambou', 'chêne', 'pin', 'hêtre', 'bouleau', 'noyer', 'acajou',
      'ébène', 'teck', 'érable', 'sel', 'inox', 'plexiglas', 'tissu',
    ],
    en: ['salt', 'petrol', 'diesel', 'bamboo', 'asphalt', 'carbon fibre'],
    de: ['Gummi', 'Ziegel', 'Lehm', 'Kies', 'Öl', 'Benzin', 'Diesel', 'Bambus', 'Styropor', 'Gips', 'Salz'],
    es: ['cristal', 'goma', 'mimbre', 'bambú'],
    it: ['plastica', 'poliestere', 'camoscio', 'creta', 'cristallo', 'bambù', 'polistirolo'],
    nl: ['plastic', 'kunststof', 'diesel', 'titanium', 'gips', 'piepschuim', 'bamboe'],
    pt: ['cristal', 'vapor', 'fumaça', 'bambu', 'isopor', 'esmeralda'],
  },
  // Wikidata's anatomy is the anatomist's: « abdomen », « fosse nasale ». The
  // words a player says first sit among its aliases, with every technical
  // synonym, and the French Wiktionary files them under no body-part category.
  'corps-humain': {
    fr: [
      'narine', 'poitrine', 'ventre', 'rotule', 'plante du pied', 'moelle épinière', 'squelette', 'omoplate', 'cubitus',
      'péroné', 'ovaire', 'thorax', 'tronc', 'biceps', 'triceps', 'quadriceps', 'pupille', 'grain de beauté', 'ménisque',
      'tendon d’Achille', 'pommette', 'poing', 'gros orteil', 'fessier',
    ],
    en: [
      'pupil', 'iris', 'nostril', 'fingernail', 'toenail', 'belly button', 'belly', 'collarbone', 'shoulder blade',
      'biceps', 'kneecap', 'windpipe', 'freckle', 'fingertip',
    ],
    de: [
      'Bauch', 'Po', 'Zeh', 'Nasenloch', 'Fingernagel', 'Fingerspitze', 'Ellenbogen', 'Brustkorb', 'Pupille', 'Backenzahn',
      'Milchzahn', 'Skelett', 'Rachen',
    ],
    es: [
      'oreja', 'muela', 'rostro', 'pómulo', 'meñique', 'barriga', 'glúteo', 'omóplato', 'bíceps', 'tríceps', 'pupila',
      'retina', 'esqueleto', 'puño',
    ],
    it: ['narice', 'zigomo', 'torace', 'ventre', 'mascella', 'costola', 'spina dorsale', 'bicipite', 'pupilla', 'menisco'],
    nl: ['gezicht', 'darm', 'blaas', 'brein', 'scheen', 'bovenbeen', 'stuitje', 'pupil', 'iris', 'biceps', 'vingertop'],
    pt: [
      'narina', 'rosto', 'ouvido', 'pulso', 'mindinho', 'tórax', 'coluna', 'esqueleto', 'rótula', 'omoplata', 'maxilar',
      'amígdala', 'pupila', 'tímpano', 'bíceps',
    ],
  },
  // The English Wiktionary files "shark" under Sports — a card shark — and
  // never under Sharks; its translations inherit the gaps. Every word here was
  // a first answer the words test found missing.
  animaux: {
    en: ['shark', 'octopus'],
    pt: ['polvo'],
  },
  metiers: {
    en: ['doctor'],
    es: ['soldado'],
    nl: ['schilder', 'soldaat'],
    pt: ['soldado'],
  },
  sports: {
    en: ['soccer', 'swimming'],
    de: ['Schwimmen', 'Surfen'],
    nl: ['zwemmen'],
  },
  // The mushrooms a cook buys — the French Wiktionary's own category holds
  // every amanita — and the herbs it files under neither fruits nor
  // vegetables nor aromatic plants.
  'fruits-legumes': {
    fr: [
      'champignon', 'champignon de Paris', 'cèpe', 'girolle', 'chanterelle', 'morille', 'truffe', 'pleurote', 'bolet',
      'persil', 'basilic', 'échalote', 'salade', 'noix de pécan', 'noix du Brésil', 'physalis', 'nèfle', 'citronnelle',
    ],
    en: ['kiwi', 'mushroom', 'mint', 'rosemary', 'coriander', 'squash', 'arugula', 'sweetcorn'],
    de: ['Kartoffel', 'Kirsche', 'Radieschen', 'Pilz', 'Champignon', 'Pfifferling', 'Steinpilz', 'Minze', 'Wirsing', 'Rucola', 'Kresse'],
    es: ['champiñón', 'seta', 'hongo', 'trufa', 'menta', 'rúcula'],
    it: [
      'fungo', 'porcino', 'champignon', 'tartufo', 'bergamotto', 'verza', 'insalata', 'rosmarino', 'salvia', 'origano',
      'menta', 'cappero',
    ],
    nl: ['champignon', 'paddenstoel', 'rozemarijn', 'munt', 'koriander', 'blauwe bes', 'bruine boon', 'truffel'],
    pt: ['rúcula', 'aipim', 'rabanete', 'coentro', 'orégano', 'alecrim', 'cogumelo', 'aspargo', 'chuchu', 'palmito'],
  },
  // Brands no class of Wikidata's reaches in that language: French chains
  // fewer than fifteen Wikipedias describe, Oreo that is an instance of nothing.
  marques: {
    en: ['Cadbury'],
    fr: ['Decathlon', 'Castorama', 'Darty', 'Leclerc', 'Monoprix', 'Kinder', 'Oreo', 'Carambar', 'Sephora', 'SNCF', 'Michelin', 'Tefal'],
    es: ['Zara', 'Oreo', 'Danone', 'Kinder', 'Doritos', 'Decathlon'],
    it: ['Google', 'Kinder', 'Peroni', 'San Pellegrino', 'Mulino Bianco', 'Esselunga', 'Decathlon'],
    nl: ['Philips', 'Hema', 'Kruidvat', 'Etos', 'Action', 'Blokker', 'Coolblue', 'Gamma', 'Rabobank', 'Efteling'],
    pt: ['Natura', 'Sadia', 'Nubank', 'Levi’s'],
  },
  // Everyday genus names the Wiktionary only files under "Genres de plantes"
  // — dropped wholesale above for its Latin scientific names — and one filed
  // only under the condiment category also skipped whole.
  plantes: {
    fr: ['buis', 'aloès', 'curcuma'],
    // The Wiktionary only files its plural "tulipas".
    pt: ['tulipa'],
  },
  // Wikidata's own label for a staple object is sometimes a formal or
  // compound one — "téléphone mobile", "Leuchte" — never the bare word a
  // player types first.
  objets: {
    en: ['phone'],
    fr: ['téléphone', 'sac', 'vis'],
    de: ['Telefon', 'Regenschirm', 'Lampe'],
    es: ['teléfono', 'lámpara'],
    it: ['telefono', 'lampada'],
    nl: ['telefoon', 'lamp'],
    pt: ['telefone', 'lâmpada'],
  },
}

/**
 * Aliases no source gives, per category and language: the short name a player
 * types → the label of the word it scores as. Wikidata's English Mercedes-Benz
 * has no « Mercedes », its Kyiv no « Kiev ».
 */
export const ADDED_ALIASES: Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, string>>>>>> = {
  marques: {
    fr: { Disney: 'Walt Disney', KFC: 'Kentucky Fried Chicken', Pepsi: 'Pepsi-Cola', Dior: 'Christian Dior' },
    en: { Mercedes: 'Mercedes-Benz', Disney: 'Walt Disney' },
    de: { VW: 'Volkswagen', Bosch: 'Robert Bosch', dm: 'dm-drogerie markt' },
    es: { Disney: 'Walt Disney', Bosch: 'Robert Bosch' },
    it: { Versace: 'Gianni Versace', Vespa: 'Piaggio Vespa' },
    pt: { Toyota: 'Toyota Motor', Santander: 'Banco Santander', Dior: 'Christian Dior' },
  },
  pays: {
    de: { USA: 'Vereinigte Staaten' },
  },
  capitales: {
    en: { Kiev: 'Kyiv' },
    de: { Frankfurt: 'Frankfurt am Main' },
  },
}

/**
 * Codes that are also the name everyone uses, let through the shortest-alias
 * guard (`shortestAlias`, sources.ts), as normalized keys.
 */
export const SHORT_NAMES: readonly string[] = ['usa', 'uk']

/**
 * The placeholder an element bears until it is named — "unbinilium", element
 * 120 — spelt out from its number, in every language. Wikidata files the ones
 * not yet made as elements all the same.
 */
export const PLACEHOLDER_ELEMENT = /^un(?:nil|un|bi|tri|quad|pent|hex|sept|oct|enn)+i(?:um|o)$/
