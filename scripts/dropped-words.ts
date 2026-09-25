/**
 * Words a category's sources bring in but no player would give as an answer,
 * per language. The Wiktionary's textile list holds every fabric ever named
 * after a town ("londres", "salle"), its metals every element announced and
 * never found. A whole family is better cut with an `exclude` pull; this list
 * takes the rest.
 */
export const DROPPED_WORDS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
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
}

/**
 * Words a category must hold that no source gives under that spelling:
 * Wikidata labels concrete "béton de ciment" in French, and its aliases are
 * chemical formulas and oil crises. Read as if the Wiktionary filed them.
 */
export const ADDED_WORDS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  matieres: {
    fr: ['béton'],
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
  'fruits-legumes': {
    en: ['kiwi'],
    de: ['Kartoffel', 'Kirsche', 'Radieschen'],
  },
  // Brands no class of Wikidata's reaches in that language.
  marques: {
    es: ['Zara'],
    it: ['Google'],
    nl: ['Philips'],
    pt: ['Natura'],
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
}

/**
 * The placeholder an element bears until it is named — "unbinilium", element
 * 120 — spelt out from its number, in every language. Wikidata files the ones
 * not yet made as elements all the same.
 */
export const PLACEHOLDER_ELEMENT = /^un(?:nil|un|bi|tri|quad|pent|hex|sept|oct|enn)+i(?:um|o)$/
