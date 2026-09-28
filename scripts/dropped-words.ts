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
      // Homographs the Wiktionnaire's "Plantes en français" root itself
      // files under an unrelated sense — a wind, a shove, a bacterium, a
      // mineral, a star — and a two-letter Antillean tree name no player
      // outside the Antilles would give.
      'alizé', 'bourrade', 'at', 'bacille', 'bacilles', 'azurite', 'antarès', 'ambon',
      // A genus name misspelled ("Acinitum" for "Aconitum"), duplicating the
      // real names "Aconit napel" and "Aconit anthore" already in the list.
      'Acinitum napellus',
      // A real dialectal name for wild oats, but its corpus frequency (and
      // any player's first thought) is its crude modern sense.
      'branlette',
    ],
    // A sense-matched translation table sometimes lands on the wrong sense of
    // an ambiguous gloss — a drink, not the fruit or plant it is made from.
    it: ['legale', 'aranciata'],
    es: ['chocolateado'],
    nl: ['jenever'],
    // The English Wiktionary's "Trees", "Flowers" and "Plants" topics also
    // hold a scattering of unrelated senses — a place, a person, a disease,
    // fiction — that share a headword with a plant elsewhere in the table.
    en: [
      'arboretum', 'arboretums', 'arboreta', 'monolith', 'monoliths', 'greave', 'greaves', 'measles', 'triffid',
      'triffids', 'treant', 'treants', 'storer', 'storers', 'strangler', 'stranglers', 'thug', 'thugs', 'upstart',
      'upstarts', 'waver', 'wavers', 'sweets', 'purples', 'big', 'bigs', 'dent', 'dents', 'flint', 'flints',
      'china', 'chinas', 'indian', 'indians', 'kaiserin', 'kaiserins', 'cornhuskers', 'cornhusker', 'lawyer',
      'lawyers', 'snapper', 'snappers', 'moth', 'moths', 'rosie', 'rosies', 'lems', 'lem', 'epiphora', 'epiphoras',
      'olay', 'olays', 'queen', 'queens', 'ait', 'aits', 'asham', 'ashams', 'abus', 'abu',
    ],
  },
  // Everyday objects filed under "Tools" or "Containers" alongside a
  // homograph — a garment, a bullfighter, an ethnic slur, a leadership
  // title — and a mistranslation where an ambiguous English word ("tank")
  // lent its unrelated sense to another language's table.
  objets: {
    fr: ['nègre', 'négresse', 'nègres', 'négresses', 'goy', 'primat', 'matador', 'matadors', 'polka', 'polkas', 'longuet', 'longuette', 'longuettes'],
    en: ['boneless', 'starbase', 'starbases', 'cesca', 'cescas'],
    it: ['carro armato'],
    // A Wiktionary sense mismatch: not a container or a tool by any stretch,
    // and a crude one besides.
    pt: ['merda'],
  },
  // Drafts, French for now. The Wiktionnaire's grammar calls a determiner, a
  // pronoun or a cardinal an adjective: « mon », « trois », « sur » are filed
  // in the class, and their everyday sense is the one the corpus counts. So
  // are the abbreviations and symbols its own class collects — « GPS », « TTC »
  // — which no one answers when asked to qualify someone.
  adjectifs: {
    fr: [
      'un', 'une', 'ce', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos',
      'leur', 'leurs', 'me', 'te', 'se', 'moi', 'toi', 'lui', 'ça', 'cela', 'ceci', 'qui', 'que', 'quoi', 'dont',
      'quel', 'quelle', 'chaque', 'aucun', 'aucune', 'plusieurs', 'quelques', 'peu', 'moins', 'plus', 'autant',
      'trop', 'très', 'avant', 'après', 'sur', 'sous', 'dans', 'par', 'pour', 'avec', 'sans', 'vers', 'entre',
      'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize',
      'quatorze', 'quinze', 'seize', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'cent', 'mille',
      'million', 'milliard', 'Ce', 'Me', 'Mes', 'Ve', 'DoS', 'mm', 'AC', 'AP', 'DA', 'IE', 'IP', 'OP', 'US', 'GPS',
      'SDF', 'KO', 'AB', 'BTS', 'FAI', 'PV', 'HT', 'HS', 'SM', 'RPG', 'XL', 'XXL', 'SF', 'DEV', 'nb', 'tt', 'ts',
      'aka', 'Ste', 'ML', 'SR', 'AA', 'Panini', 'Xe', 'Carrez', 'tel', 'telle', 'tels', 'telles', 'AEC', 'ASA', 'BDSM',
      'BS', 'Bx', 'CIF', 'DIY', 'DP', 'DVD', 'EC', 'ERP', 'FLINT', 'GC', 'HC', 'IDE', 'MINT', 'MURAT', 'NAC', 'NBC',
      'NC', 'NS', 'ORL', 'OSI', 'PAM', 'PD', 'PLM', 'REI', 'RTL', 'Renaissance', 'SATA', 'SB', 'SDI', 'SNP', 'TB',
      'TCC', 'TCE', 'TMA', 'TSA', 'TTBM', 'TTC', 'ULB', 'USB', 'UV', 'XS', 'Jedi',
    ],
  },
  // A place the Wiktionnaire files as the speciality that names itself after
  // it — « Strasbourg », « Morteau », « Narbonne » — the brands its fruit and
  // cereal lists carry, and the Latin binomials its seafood list holds. The
  // dish is in the category under its own name: « saucisse de Strasbourg ».
  ingredients: {
    fr: [
      'casse', 'chinois', 'vienne', 'césar', 'made', 'Gala', 'Golden', 'williams', 'marion', 'Strasbourg',
      'canada', 'montreuil', 'saint-Denis', 'suède', 'hollande', 'rodez', 'narbonne', 'dunkerque', 'colmar',
      'autun', 'vendôme', 'Morteau', 'Bergues', 'madère', 'jésus', 'Antarès', 'Fabacées', 'Papilionacées',
      'Robinia pseudoacacia', 'Froot Loops', 'Lucky Charms', 'Oregoniidae', 'Pinnotheres pisum', 'Uca', 'PST',
      'Cambozola', 'Camelbert',
    ],
  },
  // « celle » and « tel » are places only in a dictionary — a hermit's cell, an
  // archaeological mound — and the corpus reads them as a pronoun and a
  // determiner; the rest are initials, clipped words, a brand, one palace and
  // the named houses of the Wiktionary's own examples.
  lieux: {
    fr: [
      'celle', 'tel', 'CO', 'CHU', 'hyper', 'franchise', 'Élysée', 'CHRU', 'CHSLD', 'HIA', 'HLM', 'Marpa',
      'restau U', 'resto U', 'Maison Blanche', 'Maison Bleue', 'Maison Rose', 'McDo', 'Reichstag', 'Westminster',
      'Zarzuela', 'maison INSEAD', 'cayenne', 'grec', 'kegré',
    ],
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
  //
  // "Cactus" has no topic of its own in the Wiktionary's tree — cacti are
  // filed as succulents, a family the category never walks — so the word
  // every player gives first is missing in every language that reads it.
  // The English Wiktionary also names a fruit tree or a herb by a compound
  // no one leads with — "fig tree", "stinging nettle" — where the bare word
  // is the everyday one.
  plantes: {
    fr: ['buis', 'aloès', 'curcuma', 'palmier'],
    // The Wiktionary only files its plural "tulipas".
    pt: ['tulipa', 'urtiga', 'lavanda', 'dente-de-leão', 'cato'],
    en: ['cactus', 'nettle', 'ivy'],
    es: ['cactus', 'diente de león'],
    de: ['Brennnessel', 'Lavendel', 'Kaktus', 'Efeu', 'Bambus'],
    it: ['ortica', 'lavanda', 'tarassaco', 'cactus', 'edera'],
    nl: ['brandnetel', 'lavendel', 'cactus', 'klimop', 'bamboe'],
  },
  // Wikidata's own label for a staple object is sometimes a formal or
  // compound one — "téléphone mobile", "Leuchte" — never the bare word a
  // player types first; a ballpoint pen, a wristwatch or a drinking glass
  // the same way leaves the plain "pen", "watch" or "glass" unanswered.
  objets: {
    en: ['phone', 'telephone', 'pen', 'glass', 'watch'],
    fr: ['téléphone', 'sac', 'vis', 'montre'],
    de: ['Telefon', 'Regenschirm', 'Lampe', 'Stift', 'Glas'],
    es: ['teléfono', 'lámpara'],
    it: ['telefono', 'lampada', 'penna', 'spazzolino'],
    nl: ['telefoon', 'lamp', 'pen', 'glas', 'horloge'],
    pt: ['telefone', 'lâmpada', 'caneta', 'copo'],
  },
  // Draft categories (see DRAFT_SOURCES), French for now. The Wiktionnaire's
  // food tree holds the produce, the cheeses, the seafood and the spices, but
  // files neither the pantry — sel, farine, huile — nor a single meat: the
  // meats hang off the animals and the condiments off the plants, both pruned
  // away there. Everything below is what a cook names before a recipe.
  ingredients: {
    fr: [
      'sel', 'poivre', 'poivre noir', 'farine', 'fécule', 'levure', 'bicarbonate', 'sucre', 'sucre glace',
      'sucre roux', 'sucre vanillé', 'miel', 'sirop', 'confiture', 'chocolat', 'chocolat noir', 'chocolat blanc',
      'cacao', 'vanille', 'cannelle', 'curry', 'cumin', 'safran', 'muscade', 'clou de girofle', 'gingembre',
      'piment', 'herbes de Provence', 'bouquet garni', 'laurier', 'thym', 'romarin', 'sauge', 'origan', 'estragon',
      'ciboulette', 'persil', 'basilic', 'coriandre', 'menthe', 'aneth', 'moutarde', 'mayonnaise', 'ketchup',
      'vinaigre', 'vinaigre balsamique', 'huile d’olive', 'beurre', 'margarine', 'crème', 'crème fraîche', 'lait',
      'yaourt', 'fromage râpé', 'œuf', 'jaune d’œuf', 'blanc d’œuf', 'pain', 'chapelure', 'riz', 'semoule',
      'pâtes', 'spaghetti', 'macaroni', 'nouilles', 'lentilles', 'pois chiches', 'haricots blancs',
      'haricots rouges', 'tofu', 'bouillon', 'bouillon cube', 'concentré de tomate', 'coulis', 'sauce tomate',
      'olives', 'câpres', 'cornichons', 'anchois', 'poulet', 'bœuf', 'porc', 'agneau', 'veau', 'dinde', 'canard',
      'lapin', 'jambon', 'lardons', 'saucisse', 'saucisson', 'merguez', 'steak', 'côtelette', 'rôti', 'foie',
      'pâté', 'thon', 'saumon', 'cabillaud', 'sardine', 'truite', 'maquereau', 'crevette', 'moule', 'huître',
      'calamar', 'noix', 'amande', 'noisette', 'cacahuète', 'pistache', 'noix de coco', 'raisin sec', 'datte',
      'pruneau', 'gélatine', 'eau', 'champignon', 'champignon de Paris', 'cèpe', 'girolle', 'chanterelle',
      'morille', 'truffe', 'pleurote', 'bolet', 'shiitaké',
    ],
  },
  // The edifice tree names the places a city is made of: mairie, piscine,
  // parc and place are filed by no category of the Wiktionnaire, and neither
  // are the shops and amenities of an everyday street.
  lieux: {
    fr: [
      'mairie', 'hôtel de ville', 'préfecture', 'sous-préfecture', 'commissariat', 'gendarmerie', 'caserne',
      'prison', 'tribunal', 'palais de justice', 'école', 'collège', 'lycée', 'université', 'crèche', 'hôpital',
      'clinique', 'pharmacie', 'laboratoire', 'gare', 'gare routière', 'aéroport', 'port', 'parking',
      'station-service', 'garage', 'supermarché', 'hypermarché', 'marché', 'épicerie', 'supérette', 'boulangerie',
      'boucherie', 'charcuterie', 'poissonnerie', 'fromagerie', 'primeur', 'pâtisserie', 'librairie', 'papeterie',
      'quincaillerie', 'droguerie', 'fleuriste', 'cordonnerie', 'coiffeur', 'pressing', 'laverie', 'banque',
      'poste', 'bureau de tabac', 'kiosque', 'restaurant', 'brasserie', 'bistrot', 'bar', 'café', 'hôtel',
      'auberge', 'cinéma', 'théâtre', 'opéra', 'musée', 'bibliothèque', 'médiathèque', 'discothèque',
      'salle de concert', 'stade', 'gymnase', 'piscine', 'patinoire', 'terrain de sport', 'parc', 'jardin public',
      'square', 'place', 'esplanade', 'fontaine', 'cimetière', 'église', 'cathédrale', 'chapelle', 'temple',
      'mosquée', 'synagogue', 'château', 'palais', 'tour', 'pont', 'viaduc', 'tunnel', 'immeuble', 'maison',
      'appartement', 'ferme', 'grange', 'étable', 'moulin', 'entrepôt', 'usine', 'atelier', 'bureau', 'zoo',
      'aquarium', 'parc d’attractions', 'camping',
    ],
  },
  // The adjectives a table shouts first: the whole grammatical class is read,
  // and the eleven thousand a floor keeps can still miss the words a player
  // types without thinking.
  adjectifs: {
    fr: [
      'gentil', 'méchant', 'drôle', 'aimable', 'sympathique', 'antipathique', 'calme', 'nerveux', 'timide',
      'courageux', 'peureux', 'lâche', 'honnête', 'menteur', 'généreux', 'avare', 'égoïste', 'altruiste', 'poli',
      'impoli', 'grossier', 'patient', 'impatient', 'têtu', 'sérieux', 'joyeux', 'triste', 'heureux',
      'malheureux', 'optimiste', 'pessimiste', 'curieux', 'intelligent', 'idiot', 'malin', 'rusé', 'naïf',
      'crédule', 'méfiant', 'ambitieux', 'paresseux', 'travailleur', 'actif', 'dynamique', 'sportif', 'cultivé',
      'sage', 'fou', 'raisonnable', 'impulsif', 'bavard', 'silencieux', 'discret', 'indiscret', 'agressif',
      'doux', 'violent', 'cruel', 'sensible', 'insensible', 'émotif', 'accueillant', 'serviable', 'rancunier',
      'jaloux', 'envieux', 'modeste', 'prétentieux', 'arrogant', 'humble', 'fier', 'vaniteux', 'séduisant',
      'beau', 'laid', 'petit', 'grand', 'gros', 'mince', 'fort', 'faible', 'rapide', 'lent', 'jeune', 'vieux',
    ],
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
