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
  // Drafts (see DRAFT_SOURCES). The furniture lists hold a style named after
  // its maker — « voltaire », « chippendale » —, a homograph the Wiktionary
  // filed there for one sense — « voyelle », « crapaud », a German « Kot » —,
  // and the small appliances and linen that fit in a backpack: dropped here,
  // they stay in « Petit objet », which takes whatever « Meubles et gros
  // objets » does not (`apartFrom`) — « Uhr » and « reloj » are watches too.
  meubles: {
    fr: [
      'ceinture', 'voyelle', 'théâtre', 'conversation', 'confident', 'indiscret', 'moine', 'cave', 'épi', 'borne', 'galerie',
      'guichet', 'traite', 'tablier', 'couche', 'sellerie', 'bât', 'crapaud', 'poire', 'polonais', 'singer', 'téléphone',
      'radio', 'liseuse', 'fer à repasser', 'compendium', 'cylindre', 'arche', 'orphée', 'paphos', 'tara', 'sanne', 'mette',
      'montauban', 'rothschild', 'dagobert', 'voltaire', 'chippendale', 'chilienne', 'ganache', 'marquise', 'duchesse',
      'potière', 'pinchart', 'torchio', 'saucier', 'faisselle', 'bibus', 'barbière', 'ambon', 'fumeuse', 'voyeuse',
      'dormeuse', 'assise', 'kang', 'magnétophone', 'électrophone', 'bouilloire', 'cafetière', 'mixeur', 'blender',
      'mélangeur', 'crêpière', 'yaourtière', 'sorbetière', 'pétrisseur', 'billig', 'rafraîchisseur', 'lampe', 'console',
    ],
    en: [
      'boneless', 'starbase', 'Cesca', 'Aeron', 'cricket', 'deuce', 'disk', 'bail', 'litter', 'Empire', 'Shaker', 'shepherdess',
      'caseworker', 'furni', 'HVAC', 'squab', 'sleeper', 'whatnot', 'rya', 'dooly', 'chowki', 'amud', 'lamp', 'diffuser',
      'hairdryer', 'oilcloth', 'tablecloth', 'stretchered', 'cornice', 'backrest', 'worktop', 'casework', 'tabletop',
      'flatpack', 'kneeler', 'drawer', 'buro',
    ],
    de: [
      'Zwei', 'Exkrement', 'Kot', 'Stuhlgang', 'Hirtin', 'Schäferin', 'Leere', 'Streu', 'Stroh', 'Kranz', 'Fries', 'Lager',
      'Bord', 'Brett', 'Bar', 'Ausrüstung', 'Ausstattung', 'Gerät', 'Festplatte', 'Föhn', 'Haartrockner', 'Lockenstab',
      'Waschlappen', 'Tischdecke', 'Tischtuch', 'Wachstuch', 'Sicherheitsverschluss', 'Randleiste', 'Sattelzugmaschine',
      'Fahrstuhl', 'Beifahrersitz', 'Kutschbock', 'Uhr', 'Fernsehen', 'Abwasch', 'Kindersitz', 'Sitzkissen',
    ],
    es: [
      'dos', 'sobre', 'piso', 'paño', 'toallita', 'manopla', 'mantel', 'encendedor', 'reloj', 'cadera', 'paje', 'greca',
      'colombina', 'comadrita', 'bigotera', 'afeitadora', 'secador', 'tostadora', 'batidora', 'cafetera', 'mezclador',
      'mezcladora', 'trituradora', 'difusor', 'HVAC', 'haragana', 'perezosa', 'perezoso', 'hogar', 'campana', 'vitro',
      'cucha', 'piltra', 'secadora',
    ],
    it: [
      'due', 'escremento', 'feci', 'abaco', 'agrippina', 'pastora', 'bussola', 'maniglia', 'Sacco', 'box', 'fon',
      'arricciacapelli', 'asciugacapelli', 'incerata', 'incerato', 'tovaglia', 'drappo', 'serpa', 'orologio', 'ribalta',
      'palchetto', 'dondola',
    ],
    nl: [
      'herderin', 'herderinnetje', 'stoelgang', 'strooisel', 'schijf', 'box', 'doek', 'föhn', 'haardroger', 'krultang',
      'tafelkleed', 'passagiersstoel', 'verhoog',
    ],
    pt: [
      'merda', 'cocô', 'fezes', 'dois', 'vazio', 'disco', 'pastora', 'almofada', 'relógio', 'secador', 'blecaute', 'AVAC',
      'HVAC', 'parque', 'arquivo', 'coxim', 'tábua', 'secretária',
    ],
  },
  // The vehicle lists file a car by the adjective its model was sold under,
  // a ship's part beside the ship, and slang beside both.
  locomotion: {
    fr: [
      'chatte', 'chiotte', 'allemande', 'américaine', 'italienne', 'japonaise', 'ancienne', 'automatique', 'manuelle',
      'électrique', 'familiale', 'intégrale', 'coupante', 'chaise', 'caisse', 'carcasse', 'bâtiment', 'annexe', 'combiné',
      'lin', 'meule', 'malle', 'litière', 'manivelle', 'hauban', 'lift', 'boot', 'boote', 'drag', 'dragon', 'ape', 'candi',
      'Axel', 'Dash', 'ID', 'BM', 'coupe', 'dormeuse', 'balancelle', 'jardinière', 'londre', 'bent', 'chasseur', 'éclaireur',
    ],
    en: [
      'blowtorch', 'carpenter', 'cock', 'German', 'fork', 'fly', 'funny', 'petrol', 'axle', 'fuselage', 'empennage',
      'aircrew', 'abeam', 'basket', 'accelerator', 'butt', 'gill', 'merchant', 'monger', 'ordinary', 'drive', 'combination',
      'diesel', 'break', 'bier', 'litter', 'beater', 'bolster', 'bounder', 'buzzard', 'caper', 'centipede', 'crummy',
      'feeder', 'fireball', 'heckler', 'hooker', 'hopper', 'jingle', 'keel', 'newbuild', 'picard', 'PEEP', 'DMS', 'ECM',
      'EAPC', 'GVWR', 'LWB', 'AV', 'FX', 'MX', 'dooly',
    ],
    nl: ['bak', 'beurt', 'bom', 'buis', 'aanrijding', 'as', 'eend', 'jager', 'kraai', 'rij', 'veren'],
  },
  // A place the Wiktionary files as the speciality that names itself after
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
    // The six others read the English Wiktionary's topics, which file a word
    // under a topic for one of its senses while the corpus counts the everyday
    // one — "big", "stock", "sulla", "data" — and its translation tables land
    // on that everyday sense in the language they feed: « tipo », « plata »,
    // « Rolle ». The words the category is about stay.
    en: ['big', 'cut', 'main', 'round', 'kid', 'stock', 'long pork', 'fat choy', 'naruto', "Jacob's ladder"],
    de: ['Rolle', 'Verbindung'],
    es: ['tipo', 'vuelta', 'fecha', 'plata', 'fondo', 'corte', 'china', 'siete', 'loco', 'completo'],
    it: ['sulla', 'roma', 'data', 'napoli', 'mamma', 'cibo', 'prodotti'],
    nl: ['rol'],
    pt: ['produção', 'data', 'corte', 'copa', 'achar'],
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
    // Same cause as the ingredients above: a numeral, a group, a service, a
    // distance — the everyday sense of a word the topic filed as a place.
    en: ['final', 'foreign', 'moving picture'],
    de: ['Zwei', 'Wirtschaft', 'Kreis', 'Aufgabe'],
    es: ['dos', 'grupo', 'final', 'último', 'servicio', 'zona', 'libre', 'común', 'cámara', 'banda'],
    it: ['due', 'gruppo', 'ultimo'],
    nl: ['laatste', 'groep', 'zaak', 'afstand'],
    pt: ['dois', 'grupo', 'final', 'último', 'direção', 'câmara'],
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
  // « Mammifères ». The Wiktionnaire files the farm's animals deep under
  // « Bovins » or « Caprins », where the homograph guard takes « vache »
  // and « chèvre » for the everyday words they also are.
  animaux: {
    fr: ['vache', 'souris', 'chèvre'],
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
  // « Petit objet » also holds what fills a pocket, a pencil case or a
  // toilet bag, which no topic files.
  objets: {
    en: ['phone', 'telephone', 'pen', 'glass', 'watch', 'lamp', 'lighter', 'wallet', 'coin', 'eraser', 'ruler', 'notebook', 'book', 'battery'],
    fr: ['téléphone', 'sac', 'vis', 'montre', 'briquet', 'gomme', 'règle', 'cahier', 'livre', 'pièce', 'trombone', 'agrafe', 'élastique'],
    de: [
      'Telefon', 'Regenschirm', 'Lampe', 'Stift', 'Glas', 'Uhr', 'Feuerzeug', 'Radiergummi', 'Lineal', 'Heft', 'Buch', 'Münze',
      'Geldbörse', 'Batterie',
    ],
    es: ['teléfono', 'lámpara', 'reloj', 'mechero', 'goma', 'regla', 'cuaderno', 'libro', 'moneda', 'cartera', 'pila'],
    it: ['telefono', 'lampada', 'penna', 'spazzolino', 'orologio', 'accendino', 'gomma', 'righello', 'quaderno', 'libro', 'moneta', 'portafoglio', 'pila'],
    nl: [
      'telefoon', 'lamp', 'pen', 'glas', 'horloge', 'aansteker', 'gum', 'liniaal', 'schrift', 'boek', 'munt', 'portemonnee',
      'batterij', 'kam', 'borstel', 'mes', 'lepel', 'beker', 'fles', 'doos', 'nagelknipper', 'zakdoek', 'tandpasta',
    ],
    pt: ['telefone', 'lâmpada', 'caneta', 'copo', 'relógio', 'isqueiro', 'borracha', 'régua', 'caderno', 'livro', 'moeda', 'carteira', 'pilha'],
  },
  // Drafts (see DRAFT_SOURCES). « Meubles et gros objets » holds, beside the
  // furniture and the appliances, what « Petit objet » gives up because it
  // fits in no backpack — the moderators' « voiture » and « fenêtre » among
  // them. Every word here is kept out of « Petit objet » (`apartFrom`).
  meubles: {
    fr: [
      'lave-vaisselle', 'micro-ondes', 'piano', 'baignoire', 'matelas', 'brouette', 'horloge', 'frigo', 'congélateur',
      'four', 'télévision', 'téléviseur', 'radiateur', 'cheminée', 'sèche-linge', 'climatiseur', 'tonneau', 'citerne',
      'benne', 'cuve', 'coffre-fort', 'établi', 'enclume', 'tondeuse', 'tronçonneuse', 'charrue', 'cercueil',
      'aquarium', 'barbecue', 'voiture', 'vélo', 'fenêtre', 'rideau', 'vitre', 'roue', 'totem', 'malle', 'lit superposé',
    ],
    en: [
      'desk', 'fridge', 'piano', 'bathtub', 'mattress', 'wheelbarrow', 'clock', 'freezer', 'oven', 'microwave', 'television',
      'dishwasher', 'washing machine', 'tumble dryer', 'radiator', 'fireplace', 'barrel', 'dumpster', 'safe', 'workbench',
      'anvil', 'lawnmower', 'coffin', 'aquarium', 'barbecue', 'trunk', 'wardrobe', 'bookcase', 'cupboard',
    ],
    de: [
      'Bank', 'Spülmaschine', 'Fernseher', 'Klavier', 'Badewanne', 'Matratze', 'Schubkarre', 'Kühlschrank', 'Gefrierschrank',
      'Waschmaschine', 'Backofen', 'Mikrowelle', 'Staubsauger', 'Schrank', 'Kleiderschrank', 'Bücherregal', 'Heizkörper',
      'Kamin', 'Fass', 'Tresor', 'Werkbank', 'Amboss', 'Rasenmäher', 'Sarg', 'Aquarium', 'Grill', 'Wäschetrockner',
    ],
    es: [
      'nevera', 'lavavajillas', 'televisor', 'piano', 'bañera', 'colchón', 'escalera', 'carretilla', 'frigorífico',
      'congelador', 'lavadora', 'horno', 'microondas', 'aspiradora', 'armario', 'estantería', 'radiador', 'chimenea',
      'barril', 'caja fuerte', 'yunque', 'cortacésped', 'ataúd', 'acuario', 'barbacoa', 'maleta', 'mesita', 'mostrador',
      'mampara', 'mesa de noche', 'cuna', 'cocina', 'cortina', 'cajonera', 'cabecero', 'camilla', 'coche', 'cofre', 'carro', 'cajón',
    ],
    it: [
      'panca', 'frigo', 'congelatore', 'televisore', 'pianoforte', 'vasca da bagno', 'materasso', 'carriola', 'frigorifero',
      'lavatrice', 'lavastoviglie', 'forno', 'microonde', 'aspirapolvere', 'armadio', 'divano', 'letto', 'scrivania',
      'scaffale', 'sgabello', 'termosifone', 'camino', 'botte', 'cassaforte', 'incudine', 'tosaerba', 'bara', 'acquario',
      'barbecue', 'asciugatrice', 'valigia', 'scala', 'comò', 'poltrona', 'libreria', 'cassettiera', 'comodino', 'cassapanca',
      'credenza', 'culla', 'caminetto', 'condizionatore', 'cucina', 'caldaia', 'cassaforte', 'guardaroba', 'gazebo', 'mensola',
      'mobile', 'radiatore', 'ombrellone', 'lampadario', 'dondolo', 'quadro', 'nave', 'tavolino', 'tappeto', 'trono', 'tv',
      'televisione', 'trattore', 'tavola', 'tenda', 'statua', 'salotto', 'carrello', 'cancello', 'cornice',
    ],
    nl: [
      'commode', 'vriezer', 'vaatwasser', 'piano', 'bad', 'matras', 'kruiwagen', 'koelkast', 'wasmachine', 'oven',
      'magnetron', 'televisie', 'stofzuiger', 'kast', 'kledingkast', 'boekenkast', 'bureau', 'kruk', 'fauteuil', 'bank',
      'tafel', 'stoel', 'bed', 'radiator', 'open haard', 'ton', 'kluis', 'werkbank', 'aambeeld', 'grasmaaier', 'doodskist',
      'aquarium', 'barbecue', 'droger', 'koffer', 'ladder', 'klok', 'wieg', 'sofa', 'aanrecht', 'airco', 'dressoir', 'divan',
      'fornuis', 'gordijn', 'hangmat', 'haard', 'ladekast', 'vleugel', 'waterbed', 'kachel', 'kinderstoel', 'kapstok', 'kist',
      'keukenkast', 'auto', 'fiets', 'raam', 'deur', 'wagen', 'tv', 'toilet', 'troon', 'tent', 'trampoline', 'tafeltje',
      'schilderij', 'standbeeld', 'slaapbank', 'schommel', 'kabinet', 'keuken', 'kar', 'kooi', 'kachel', 'kluis',
    ],
    pt: [
      'congelador', 'máquina de lavar', 'lava-louças', 'micro-ondas', 'piano', 'banheira', 'colchão', 'escada',
      'carrinho de mão', 'geladeira', 'forno', 'televisão', 'aspirador', 'armário', 'estante', 'escrivaninha', 'cômoda',
      'poltrona', 'sofá', 'cama', 'mesa', 'cadeira', 'radiador', 'lareira', 'barril', 'cofre', 'bigorna', 'cortador de grama',
      'caixão', 'aquário', 'churrasqueira', 'secadora', 'mala', 'banco', 'fogão', 'berço', 'cortina', 'cristaleira',
      'criado-mudo', 'cabideiro', 'carro', 'caldeira', 'divã', 'guarda-roupa', 'penteadeira', 'prateleira', 'rede', 'sofá-cama',
      'tanque', 'ventilador', 'vaso sanitário', 'bicicleta', 'janela', 'cozinha', 'carrinho',
    ],
  },
  'animaux-marins': {
    en: ['shark', 'whale', 'octopus', 'squid'],
    de: ['Delfin', 'Orca'],
    it: ['balena', 'corallo'],
    nl: ['oester', 'koraal'],
    pt: ['polvo'],
  },
  'oiseaux-reptiles': {
    fr: ['poule', 'crocodile'],
    nl: ['leguaan'],
    pt: ['píton'],
  },
  // What no vehicle topic files: the feet, the skates, the trains by their
  // names, and the car a phone calls.
  locomotion: {
    fr: ['roller', 'patins à roulettes', 'Uber', 'téléphérique', 'RER', 'TGV', 'marche', 'course à pied', 'auto-stop', 'covoiturage'],
    en: ['bike', 'metro', 'subway', 'motorbike', 'cable car', 'walking', 'Uber', 'underground', 'tube', 'roller skates', 'hitchhiking'],
    de: ['Pferd', 'Rudern', 'Roller', 'S-Bahn', 'ICE', 'Uber', 'Seilbahn', 'U-Bahn', 'Straßenbahn', 'Rollschuhe', 'Inlineskates', 'Trampen'],
    es: ['Uber', 'AVE', 'patines', 'caminar', 'autostop'],
    it: ['cavallo', 'Uber', 'camion', 'pattini', 'autostop'],
    nl: [
      'tram', 'Uber', 'lopen', 'fiets', 'step', 'rolschaatsen', 'skeelers', 'liften', 'brommer', 'scooter', 'metro', 'trein',
      'bus', 'taxi', 'auto', 'motor', 'boot', 'schip', 'vliegtuig', 'helikopter', 'veerboot', 'kano', 'kajak', 'raket',
      'zeilboot', 'kabelbaan', 'slee', 'paard', 'roeien', 'bakfiets', 'bromfiets', 'bestelwagen', 'binnenvaartschip', 'buggy',
      'ballon', 'luchtballon', 'bolderkar', 'brandweerwagen', 'bootje', 'truck', 'tank', 'vlot', 'schaatsen', 'wagen', 'tractor', 'voet', 'ski',
      'sloep', 'stoomtrein', 'sneltrein', 'speedboot', 'sportwagen', 'stadsbus', 'vrachtauto', 'trekker', 'tandem', 'trailer',
      'wandelen', 'zwemmen', 'motorfiets', 'voertuig',
    ],
    pt: ['caminhada', 'Uber', 'skate', 'carona', 'patins'],
  },
  vetements: {
    fr: ['boucle d’oreille', 'lunettes', 't-shirt', 'soutien-gorge', 'montre', 'sac à main', 'sac à dos', 'lunettes de soleil'],
    en: ['glasses', 't-shirt', 'trainers', 'watch', 'sunglasses', 'backpack'],
    de: ['T-Shirt', 'Sonnenbrille', 'Rucksack'],
    es: ['gafas', 'reloj', 'gafas de sol', 'mochila'],
    it: ['orologio', 'occhiali da sole', 'zaino'],
    nl: ['bril', 't-shirt', 'horloge', 'zonnebril', 'rugzak'],
    pt: ['óculos', 'calça', 'jeans', 'relógio', 'óculos de sol', 'mochila'],
  },
  // The Wiktionnaire files no device anywhere, and Wikidata names them the
  // formal way — « téléviseur », « ordinateur personnel ».
  electronique: {
    fr: [
      'casque', 'télévision', 'télé', 'tablette', 'console', 'écouteurs', 'enceinte', 'appareil photo', 'clavier', 'écran',
      'radio', 'micro', 'chargeur', 'ordinateur', 'ordinateur portable', 'téléphone', 'portable', 'smartphone', 'imprimante',
      'souris', 'télécommande', 'calculatrice', 'caisse enregistreuse', 'clé USB', 'disque dur', 'box', 'GPS', 'drone',
      'liseuse', 'manette', 'baladeur', 'montre connectée', 'photocopieuse', 'vidéoprojecteur', 'magnétoscope', 'minitel',
      'walkman', 'lecteur DVD', 'tablette tactile', 'haut-parleur', 'téléviseur', 'transistor', 'talkie-walkie', 'télécopieur',
      'tourne-disque', 'terminal', 'thermostat', 'tuner', 'téléphone fixe', 'téléphone mobile', 'tablette graphique', 'moniteur',
      'mobile', 'modem', 'magnétophone', 'mégaphone', 'amplificateur', 'ampli', 'caméra', 'caméscope', 'carte graphique',
      'chaîne hi-fi', 'décodeur', 'dictaphone', 'graveur', 'home cinéma', 'lecteur MP3', 'oreillette', 'onduleur', 'PC',
      'photocopieur', 'projecteur', 'platine', 'processeur', 'répondeur', 'radio-réveil', 'réveil', 'serveur', 'synthétiseur',
      'scanner', 'webcam', 'routeur', 'fax', 'bip', 'Game Boy', 'jukebox', 'flipper', 'borne d’arcade',
    ],
    en: [
      'headphones', 'phone', 'television', 'TV', 'tablet', 'console', 'earphones', 'speaker', 'mouse', 'monitor', 'screen',
      'radio', 'remote', 'scanner', 'charger', 'computer', 'laptop', 'printer', 'keyboard', 'camera', 'calculator', 'drone',
      'smartwatch', 'hard drive', 'joystick', 'e-reader',
    ],
    de: [
      'Laptop', 'Kopfhörer', 'Fernseher', 'Tablet', 'Maus', 'Bildschirm', 'Radio', 'Ladegerät', 'Handy', 'Drucker', 'Navi', 'Festplatte',
      'Server', 'Stereoanlage', 'Speicherkarte', 'USB-Stick', 'Scanner', 'Smartwatch', 'Spielkonsole', 'Sensor', 'Soundbar',
      'Subwoofer', 'Synthesizer', 'Smartphone', 'Satellitenschüssel', 'Telefon', 'Tastatur', 'Taschenrechner', 'Touchscreen',
      'Transistor', 'Taschenlampe', 'Telefax', 'Tonbandgerät', 'Tuner', 'Thermostat', 'Monitor', 'Mikrofon', 'Modem',
      'Mobiltelefon', 'Funkgerät', 'Fotoapparat', 'Fernbedienung', 'Faxgerät', 'Flachbildschirm', 'Computer', 'Kamera', 'Webcam',
      'Router', 'Lautsprecher', 'Registrierkasse', 'Kasse', 'Videorekorder', 'Plattenspieler', 'Walkman', 'Drohne', 'Beamer',
      'Navigationsgerät', 'Anrufbeantworter', 'Gameboy', 'E-Book-Reader', 'Kopierer', 'Rechner', 'Notebook', 'Hi-Fi-Anlage',
    ],
    es: [
      'ordenador', 'auriculares', 'televisión', 'consola', 'ratón', 'pantalla', 'mando', 'escáner', 'webcam', 'router',
      'cargador', 'móvil', 'portátil', 'impresora', 'tableta', 'altavoz', 'teclado', 'calculadora', 'micrófono', 'disco duro',
    ],
    it: [
      'portatile', 'cuffie', 'televisione', 'console', 'fotocamera', 'schermo', 'caricabatterie', 'cellulare', 'stampante',
      'tablet', 'altoparlante', 'tastiera', 'mouse', 'telecomando', 'calcolatrice', 'microfono', 'chiavetta', 'tv', 'citofono',
      'cordless', 'cassa', 'cuffiette', 'centralino', 'chip', 'computer', 'cinepresa', 'casse', 'telecamera', 'telefonino',
      'termostato', 'televisore', 'telefono', 'trasmettitore', 'tuner', 'transistor', 'smartphone', 'scanner', 'server', 'stereo',
      'sensore', 'satellitare', 'modem', 'monitor', 'radio', 'router', 'webcam', 'registratore', 'giradischi', 'videoregistratore',
      'proiettore', 'navigatore', 'drone', 'fax', 'fotocopiatrice', 'lettore DVD', 'amplificatore', 'decoder', 'segreteria telefonica',
      'gps', 'batteria',
    ],
    nl: [
      'kassa', 'koptelefoon', 'televisie', 'tv', 'tablet', 'beeldscherm', 'radio', 'oplader', 'computer', 'laptop',
      'telefoon', 'mobiel', 'smartphone', 'printer', 'spelcomputer', 'luidspreker', 'camera', 'toetsenbord', 'muis',
      'afstandsbediening', 'rekenmachine', 'scanner', 'microfoon', 'webcam', 'router', 'harde schijf', 'oordopjes',
      'videorecorder', 'dvd-speler', 'fototoestel', 'navigatiesysteem', 'e-reader', 'smartwatch', 'transistor', 'televisietoestel',
      'telefax', 'tuner', 'thermostaat', 'tv-toestel', 'telefooncentrale', 'speaker', 'server', 'stereo', 'stereo-installatie',
      'synthesizer', 'satellietschotel', 'spelcomputer', 'modem', 'monitor', 'mp3-speler', 'magnetofoon', 'beamer', 'drone',
      'fax', 'kopieerapparaat', 'antwoordapparaat', 'versterker', 'decoder', 'gameboy', 'walkman', 'platenspeler', 'processor',
      'scherm', 'speler', 'satelliet', 'toestel', 'gsm', 'sensor', 'simkaart', 'mobieltje', 'chip', 'console', 'cassettespeler',
      'computerscherm', 'cd-speler', 'camcorder', 'gameconsole', 'stereotoren',
    ],
    pt: [
      'notebook', 'fone de ouvido', 'televisão', 'console', 'monitor', 'controle remoto', 'scanner', 'carregador',
      'computador', 'celular', 'impressora', 'tablet', 'teclado', 'mouse', 'câmera', 'calculadora', 'tela', 'rádio', 'TV',
    ],
  },
  // Avant-premières, born drafts. The Wiktionnaire's food tree holds
  // the produce, the cheeses, the seafood and the spices, but files neither
  // the pantry — sel, farine, huile — nor a single meat: the meats hang off the
  // animals and the condiments off the plants, both pruned away there.
  // Everything below is what a cook names before a recipe, and the six other
  // languages read the English Wiktionary's topics, which hold the topic's own
  // words rather than the one every table shouts first.
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
    en: [
      'salt', 'pepper', 'flour', 'sugar', 'butter', 'oil', 'olive oil', 'milk', 'egg', 'honey', 'vinegar',
      'mustard', 'mayonnaise', 'ketchup', 'chocolate', 'dark chocolate', 'cocoa', 'vanilla', 'cinnamon', 'curry',
      'cumin', 'saffron', 'nutmeg', 'ginger', 'parsley', 'basil', 'thyme', 'rosemary', 'sage', 'oregano', 'mint',
      'chives', 'dill', 'bay leaf', 'tarragon', 'garlic', 'onion', 'shallot', 'tomato', 'carrot', 'potato',
      'mushroom', 'leek', 'cabbage', 'cauliflower', 'broccoli', 'spinach', 'lettuce', 'courgette', 'aubergine',
      'pepper', 'cucumber', 'beetroot', 'turnip', 'radish', 'celery', 'asparagus', 'pea', 'bean', 'chickpea',
      'lentil', 'rice', 'pasta', 'spaghetti', 'semolina', 'bread', 'yeast', 'baking soda', 'icing sugar', 'syrup',
      'jam', 'cheese', 'cream', 'yoghurt', 'tofu', 'stock', 'tomato sauce', 'tomato paste', 'olive', 'caper',
      'pickle', 'anchovy', 'chicken', 'beef', 'pork', 'lamb', 'veal', 'turkey', 'duck', 'rabbit', 'ham', 'bacon',
      'sausage', 'black pudding', 'pâté', 'tuna', 'salmon', 'cod', 'sardine', 'trout', 'mackerel', 'prawn',
      'mussel', 'oyster', 'squid', 'walnut', 'hazelnut', 'almond', 'peanut', 'pistachio', 'coconut', 'sesame',
      'sunflower seed', 'raisin', 'date', 'prune', 'lemon', 'orange', 'apple', 'pear', 'banana', 'strawberry',
      'raspberry', 'blueberry', 'grape', 'peach', 'apricot', 'cherry', 'plum', 'fig', 'pineapple', 'melon',
      'watermelon', 'kiwi', 'mango', 'water',
      'shrimp', 'nut',
    ],
    de: [
      'Salz', 'Pfeffer', 'Mehl', 'Zucker', 'Butter', 'Öl', 'Olivenöl', 'Milch', 'Ei', 'Honig', 'Essig', 'Senf',
      'Mayonnaise', 'Ketchup', 'Schokolade', 'Zartbitterschokolade', 'Kakao', 'Vanille', 'Zimt', 'Curry',
      'Kümmel', 'Safran', 'Muskatnuss', 'Ingwer', 'Petersilie', 'Basilikum', 'Thymian', 'Rosmarin', 'Salbei',
      'Oregano', 'Minze', 'Schnittlauch', 'Dill', 'Lorbeerblatt', 'Estragon', 'Knoblauch', 'Zwiebel', 'Schalotte',
      'Tomate', 'Karotte', 'Kartoffel', 'Pilz', 'Lauch', 'Kohl', 'Blumenkohl', 'Brokkoli', 'Spinat', 'Salat',
      'Zucchini', 'Aubergine', 'Paprika', 'Gurke', 'Rote Bete', 'Rübe', 'Radieschen', 'Sellerie', 'Spargel',
      'Erbse', 'Bohne', 'Kichererbse', 'Linse', 'Reis', 'Nudeln', 'Spaghetti', 'Grieß', 'Brot', 'Hefe',
      'Natron', 'Puderzucker', 'Sirup', 'Marmelade', 'Käse', 'Sahne', 'Joghurt', 'Tofu', 'Brühe', 'Tomatensauce',
      'Tomatenmark', 'Olive', 'Kaper', 'Gewürzgurke', 'Sardelle', 'Hähnchen', 'Rindfleisch', 'Schweinefleisch',
      'Lammfleisch', 'Kalb', 'Pute', 'Ente', 'Kaninchen', 'Schinken', 'Speck', 'Wurst', 'Blutwurst', 'Pastete',
      'Thunfisch', 'Lachs', 'Kabeljau', 'Sardine', 'Forelle', 'Makrele', 'Garnele', 'Muschel', 'Auster',
      'Tintenfisch', 'Walnuss', 'Haselnuss', 'Mandel', 'Erdnuss', 'Pistazie', 'Kokosnuss', 'Sesam',
      'Sonnenblumenkern', 'Rosine', 'Dattel', 'Backpflaume', 'Zitrone', 'Orange', 'Apfel', 'Birne', 'Banane',
      'Erdbeere', 'Himbeere', 'Heidelbeere', 'Weintraube', 'Pfirsich', 'Aprikose', 'Kirsche', 'Pflaume', 'Feige',
      'Ananas', 'Melone', 'Wassermelone', 'Kiwi', 'Mango', 'Wasser',
      'Nuss',
    ],
    es: [
      'sal', 'pimienta', 'harina', 'azúcar', 'mantequilla', 'aceite', 'aceite de oliva', 'leche', 'huevo', 'miel',
      'vinagre', 'mostaza', 'mayonesa', 'kétchup', 'chocolate', 'chocolate negro', 'cacao', 'vainilla', 'canela',
      'curry', 'comino', 'azafrán', 'nuez moscada', 'jengibre', 'perejil', 'albahaca', 'tomillo', 'romero',
      'salvia', 'orégano', 'menta', 'cebollino', 'eneldo', 'laurel', 'estragón', 'ajo', 'cebolla', 'chalota',
      'tomate', 'zanahoria', 'patata', 'champiñón', 'puerro', 'col', 'coliflor', 'brócoli', 'espinaca', 'lechuga',
      'calabacín', 'berenjena', 'pimiento', 'pepino', 'remolacha', 'nabo', 'rábano', 'apio', 'espárrago',
      'guisante', 'judía', 'garbanzo', 'lenteja', 'arroz', 'pasta', 'espagueti', 'sémola', 'pan', 'levadura',
      'bicarbonato', 'azúcar glas', 'jarabe', 'mermelada', 'queso', 'nata', 'yogur', 'tofu', 'caldo', 'salsa de tomate',
      'concentrado de tomate', 'aceituna', 'alcaparra', 'pepinillo', 'anchoa', 'pollo', 'ternera', 'cerdo',
      'cordero', 'ternera', 'pavo', 'pato', 'conejo', 'jamón', 'beicon', 'salchicha', 'morcilla', 'paté', 'atún',
      'salmón', 'bacalao', 'sardina', 'trucha', 'caballa', 'gamba', 'mejillón', 'ostra', 'calamar', 'nuez',
      'avellana', 'almendra', 'cacahuete', 'pistacho', 'coco', 'sésamo', 'semilla de girasol', 'pasa', 'dátil',
      'ciruela pasa', 'limón', 'naranja', 'manzana', 'pera', 'plátano', 'fresa', 'frambuesa', 'arándano', 'uva',
      'melocotón', 'albaricoque', 'cereza', 'ciruela', 'higo', 'piña', 'melón', 'sandía', 'kiwi', 'mango', 'agua',
      
    ],
    it: [
      'sale', 'pepe', 'farina', 'zucchero', 'burro', 'olio', 'olio d’oliva', 'latte', 'uovo', 'miele', 'aceto',
      'senape', 'maionese', 'ketchup', 'cioccolato', 'cioccolato fondente', 'cacao', 'vaniglia', 'cannella',
      'curry', 'cumino', 'zafferano', 'noce moscata', 'zenzero', 'prezzemolo', 'basilico', 'timo', 'rosmarino',
      'salvia', 'origano', 'menta', 'erba cipollina', 'aneto', 'alloro', 'dragoncello', 'aglio', 'cipolla',
      'scalogno', 'pomodoro', 'carota', 'patata', 'fungo', 'porro', 'cavolo', 'cavolfiore', 'broccolo', 'spinacio',
      'lattuga', 'zucchina', 'melanzana', 'peperone', 'cetriolo', 'barbabietola', 'rapa', 'ravanello', 'sedano',
      'asparago', 'pisello', 'fagiolo', 'cece', 'lenticchia', 'riso', 'pasta', 'spaghetti', 'semolino', 'pane',
      'lievito', 'bicarbonato', 'zucchero a velo', 'sciroppo', 'marmellata', 'formaggio', 'panna', 'yogurt',
      'tofu', 'brodo', 'salsa di pomodoro', 'concentrato di pomodoro', 'oliva', 'cappero', 'cetriolino', 'acciuga',
      'pollo', 'manzo', 'maiale', 'agnello', 'vitello', 'tacchino', 'anatra', 'coniglio', 'prosciutto', 'pancetta',
      'salsiccia', 'sanguinaccio', 'paté', 'tonno', 'salmone', 'merluzzo', 'sardina', 'trota', 'sgombro',
      'gambero', 'cozza', 'ostrica', 'calamaro', 'noce', 'nocciola', 'mandorla', 'arachide', 'pistacchio',
      'noce di cocco', 'sesamo', 'seme di girasole', 'uva passa', 'dattero', 'prugna secca', 'limone', 'arancia',
      'mela', 'pera', 'banana', 'fragola', 'lampone', 'mirtillo', 'uva', 'pesca', 'albicocca', 'ciliegia',
      'susina', 'fico', 'ananas', 'melone', 'anguria', 'kiwi', 'mango', 'acqua',
      
    ],
    nl: [
      'zout', 'peper', 'bloem', 'suiker', 'boter', 'olie', 'olijfolie', 'melk', 'ei', 'honing', 'azijn', 'mosterd',
      'mayonaise', 'ketchup', 'chocolade', 'pure chocolade', 'cacao', 'vanille', 'kaneel', 'kerrie', 'komijn',
      'saffraan', 'nootmuskaat', 'gember', 'peterselie', 'basilicum', 'tijm', 'rozemarijn', 'salie', 'oregano',
      'munt', 'bieslook', 'dille', 'laurier', 'dragon', 'knoflook', 'ui', 'sjalot', 'tomaat', 'wortel',
      'aardappel', 'champignon', 'prei', 'kool', 'bloemkool', 'broccoli', 'spinazie', 'sla', 'courgette',
      'aubergine', 'paprika', 'komkommer', 'biet', 'raap', 'radijs', 'selderij', 'asperge', 'erwt', 'boon',
      'kikkererwt', 'linze', 'rijst', 'pasta', 'spaghetti', 'griesmeel', 'brood', 'gist', 'zuiveringszout',
      'poedersuiker', 'siroop', 'jam', 'kaas', 'room', 'yoghurt', 'tofoe', 'bouillon', 'tomatensaus',
      'tomatenpuree', 'olijf', 'kappertje', 'augurk', 'ansjovis', 'kip', 'rundvlees', 'varkensvlees', 'lamsvlees',
      'kalfsvlees', 'kalkoen', 'eend', 'konijn', 'ham', 'spek', 'worst', 'bloedworst', 'paté', 'tonijn', 'zalm',
      'kabeljauw', 'sardien', 'forel', 'makreel', 'garnaal', 'mossel', 'oester', 'inktvis', 'walnoot',
      'hazelnoot', 'amandel', 'pinda', 'pistache', 'kokosnoot', 'sesam', 'zonnebloempit', 'rozijn', 'dadel',
      'gedroogde pruim', 'citroen', 'sinaasappel', 'appel', 'peer', 'banaan', 'aardbei', 'framboos', 'bosbes',
      'druif', 'perzik', 'abrikoos', 'kers', 'pruim', 'vijg', 'ananas', 'meloen', 'watermeloen', 'kiwi', 'mango',
      'water',
      'noot',
    ],
    pt: [
      'sal', 'pimenta', 'farinha', 'açúcar', 'manteiga', 'azeite', 'óleo', 'leite', 'ovo', 'mel', 'vinagre',
      'mostarda', 'maionese', 'ketchup', 'chocolate', 'chocolate preto', 'cacau', 'baunilha', 'canela', 'caril',
      'cominho', 'açafrão', 'noz-moscada', 'gengibre', 'salsa', 'manjericão', 'tomilho', 'alecrim', 'salva',
      'orégano', 'hortelã', 'cebolinho', 'endro', 'louro', 'estragão', 'alho', 'cebola', 'chalota', 'tomate',
      'cenoura', 'batata', 'cogumelo', 'alho-porro', 'repolho', 'couve-flor', 'brócolos', 'espinafre', 'alface',
      'courgette', 'beringela', 'pimento', 'pepino', 'beterraba', 'nabo', 'rabanete', 'aipo', 'espargo', 'ervilha',
      'feijão', 'grão-de-bico', 'lentilha', 'arroz', 'massa', 'esparguete', 'sêmola', 'pão', 'levedura',
      'bicarbonato', 'açúcar de confeiteiro', 'xarope', 'compota', 'queijo', 'nata', 'iogurte', 'tofu', 'caldo',
      'molho de tomate', 'polpa de tomate', 'azeitona', 'alcaparra', 'picles', 'anchova', 'frango', 'carne bovina',
      'carne de porco', 'carne de cordeiro', 'vitela', 'peru', 'pato', 'coelho', 'presunto', 'bacon', 'salsicha',
      'morcela', 'patê', 'atum', 'salmão', 'bacalhau', 'sardinha', 'truta', 'cavala', 'camarão', 'mexilhão',
      'ostra', 'lula', 'noz', 'avelã', 'amêndoa', 'amendoim', 'pistácio', 'coco', 'gergelim', 'semente de girassol',
      'passa', 'tâmara', 'ameixa seca', 'limão', 'laranja', 'maçã', 'pera', 'banana', 'morango', 'framboesa',
      'mirtilo', 'uva', 'pêssego', 'damasco', 'cereja', 'ameixa', 'figo', 'ananás', 'melão', 'melancia', 'kiwi',
      'manga', 'água',
      'porco', 'cordeiro', 'castanha',
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
    en: [
      'factory', 'bakery', 'town hall', 'swimming pool', 'park', 'square', 'garden', 'school', 'hospital',
      'station', 'airport', 'supermarket', 'market', 'bank', 'post office', 'restaurant', 'café', 'hotel', 'museum',
      'library', 'stadium', 'gym', 'church', 'cathedral', 'mosque', 'synagogue', 'castle', 'bridge', 'building',
      'house', 'flat', 'farm', 'mill', 'warehouse', 'workshop', 'garage', 'car park', 'pharmacy', 'bookshop',
      'butcher', 'fishmonger', 'cinema', 'theatre', 'prison', 'court', 'casino', 'cemetery', 'fountain', 'pub',
      'harbour', 'bakery shop', 'fire station', 'police station', 'city hall', 'town square', 'block of flats',
    ],
    de: [
      'Fabrik', 'Bäckerei', 'Rathaus', 'Schwimmbad', 'Park', 'Platz', 'Garten', 'Schule', 'Krankenhaus', 'Bahnhof',
      'Flughafen', 'Supermarkt', 'Markt', 'Bank', 'Post', 'Restaurant', 'Café', 'Hotel', 'Museum', 'Bibliothek',
      'Stadion', 'Turnhalle', 'Kirche', 'Dom', 'Moschee', 'Synagoge', 'Schloss', 'Brücke', 'Gebäude', 'Haus',
      'Wohnung', 'Bauernhof', 'Mühle', 'Lager', 'Werkstatt', 'Garage', 'Parkplatz', 'Apotheke', 'Buchhandlung',
      'Metzgerei', 'Fischgeschäft', 'Kino', 'Theater', 'Gefängnis', 'Gericht', 'Kasino', 'Friedhof', 'Brunnen',
      'Kneipe', 'Hafen', 'Feuerwehr', 'Polizeiwache', 'Universität', 'Kloster', 'Turm', 'Brücke',
    ],
    es: [
      'fábrica', 'panadería', 'ayuntamiento', 'piscina', 'parque', 'plaza', 'jardín', 'escuela', 'hospital',
      'estación', 'aeropuerto', 'supermercado', 'mercado', 'banco', 'correos', 'restaurante', 'café', 'hotel',
      'museo', 'biblioteca', 'estadio', 'gimnasio', 'iglesia', 'catedral', 'mezquita', 'sinagoga', 'castillo',
      'puente', 'edificio', 'casa', 'piso', 'granja', 'molino', 'almacén', 'taller', 'garaje', 'aparcamiento',
      'farmacia', 'librería', 'carnicería', 'pescadería', 'cine', 'teatro', 'cárcel', 'juzgado', 'casino',
      'cementerio', 'fuente', 'bar', 'puerto', 'parque de bomberos', 'comisaría', 'universidad', 'monasterio',
      'torre',
    ],
    it: [
      'fabbrica', 'panetteria', 'municipio', 'piscina', 'parco', 'piazza', 'giardino', 'scuola', 'ospedale',
      'stazione', 'aeroporto', 'supermercato', 'mercato', 'banca', 'posta', 'ristorante', 'caffè', 'albergo',
      'museo', 'biblioteca', 'stadio', 'palestra', 'chiesa', 'cattedrale', 'moschea', 'sinagoga', 'castello',
      'ponte', 'edificio', 'casa', 'appartamento', 'fattoria', 'mulino', 'magazzino', 'officina', 'garage',
      'parcheggio', 'farmacia', 'libreria', 'macelleria', 'pescheria', 'cinema', 'teatro', 'prigione',
      'tribunale', 'casinò', 'cimitero', 'fontana', 'bar', 'porto', 'caserma dei pompieri', 'questura',
      'università', 'monastero', 'torre',
    ],
    nl: [
      'fabriek', 'bakkerij', 'stadhuis', 'zwembad', 'park', 'plein', 'tuin', 'school', 'ziekenhuis', 'station',
      'vliegveld', 'supermarkt', 'markt', 'bank', 'postkantoor', 'restaurant', 'café', 'hotel', 'museum',
      'bibliotheek', 'stadion', 'sportschool', 'kerk', 'kathedraal', 'moskee', 'synagoge', 'kasteel', 'brug',
      'gebouw', 'huis', 'flat', 'boerderij', 'molen', 'pakhuis', 'werkplaats', 'garage', 'parkeerplaats',
      'apotheek', 'boekhandel', 'slagerij', 'viswinkel', 'bioscoop', 'theater', 'gevangenis', 'rechtbank',
      'casino', 'begraafplaats', 'fontein', 'kroeg', 'haven', 'brandweerkazerne', 'politiebureau', 'universiteit',
      'klooster', 'toren',
    ],
    pt: [
      'fábrica', 'padaria', 'prefeitura', 'piscina', 'parque', 'praça', 'jardim', 'escola', 'hospital', 'estação',
      'aeroporto', 'supermercado', 'mercado', 'banco', 'correios', 'restaurante', 'café', 'hotel', 'museu',
      'biblioteca', 'estádio', 'ginásio', 'igreja', 'catedral', 'mesquita', 'sinagoga', 'castelo', 'ponte',
      'edifício', 'casa', 'apartamento', 'fazenda', 'moinho', 'armazém', 'oficina', 'garagem', 'estacionamento',
      'farmácia', 'livraria', 'açougue', 'peixaria', 'cinema', 'teatro', 'prisão', 'tribunal', 'cassino',
      'cemitério', 'fonte', 'bar', 'porto', 'quartel dos bombeiros', 'delegacia', 'universidade', 'mosteiro',
      'torre',
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
