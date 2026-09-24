import type { Messages } from './fr'

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many)

export const nl: Messages = {
  tag: 'nl-NL',
  loading: 'Laden…',
  wait: 'Even geduld…',
  cancel: 'Annuleren',
  loadFailed: 'Het woordenboek kon niet worden geladen. Probeer het opnieuw.',

  home: {
    tagline: (seconds) => `Eén letter · één thema · ${seconds} seconden`,
    play: 'Spelen',
    menu: 'Menu: profiel, vrienden, opties',
    level: (level) => `Niveau ${level}`,
    bestScore: 'beste score',
    runs: (count) => plural(count, 'spel', 'spellen'),
    wordsFound: 'woorden gevonden',
    bestCombo: 'beste reeks',
    myCategories: 'Mijn categorieën',
    reserve: (perRun) => `Elk spel trekt er ${perRun}; de rest blijft in reserve om bij de start te ruilen.`,
    newEachLevel: 'Op elk niveau een nieuwe categorie om te kiezen.',
  },

  countdown: {
    lineup: 'Op het programma',
    swapping: 'Bezig met ruilen…',
    swapHint: (reserve) => `Tik op een thema om het te ruilen · ${reserve} in reserve`,
  },

  run: {
    meta: (words, skips) => `${words} ${plural(words, 'woord', 'woorden')} · ${skips} overgeslagen`,
    placeholder: (letter) => `een woord met ${letter}…`,
    fieldLabel: (letter, category) => `Woord met ${letter}, categorie ${category}`,
    skip: (seconds) => `Overslaan −${seconds} s`,
    submit: 'Bevestigen',
    approximate: 'bijna goed gespeld',
    oneLetterOff: 'één letter ernaast…',
    startsWith: (letter) => `begint met ${letter}`,
    already: 'al gegeven',
    unknown: 'niet in het woordenboek',
    proposed: 'voorgesteld, bedankt',
    propose: 'voorstellen',
  },

  offer: {
    title: 'Nieuwe categorie',
    more: (count) => `nog ${count} te kiezen`,
    lead: 'Kies de categorie die aan je spellen wordt toegevoegd.',
    adNotice: 'Na je keuze volgt een korte advertentie: zo steun je de maker van het spel. Bedankt!',
  },

  over: {
    timeUp: 'Tijd is om',
    points: 'punten',
    empty: 'Geen enkel woord. Dat gebeurt.',
    next: 'Verder',
    earned: () => 'Nieuw voor je avatar',
    customize: 'Mijn avatar aanpassen',
    words: (count) => plural(count, 'woord', 'woorden'),
    bestCombo: 'beste reeks',
    newRecord: 'nieuw record',
    record: 'record',
    dayBoard: 'Klassement van vandaag',
    keepTitle: 'Bewaar dit spel',
    keepLead: 'Maak een account of log in: dit spel en al je voortgang gaan er meteen in.',
    savedTo: ['Spel opgeslagen in het account ', ''],
    replay: 'Opnieuw spelen',
    home: 'Start',
    level: (level) => `Niveau ${level}`,
    towards: (into, span, next) => `${into} / ${span} XP naar niveau ${next}`,
    levelUp: 'Niveau omhoog',
    levelReached: (level) => `Niveau ${level} bereikt`,
  },

  account: {
    register: 'Account maken',
    logIn: 'Inloggen',
    name: 'Accountnaam',
    email: 'E-mailadres',
    password: 'Wachtwoord',
    submitRegister: 'Mijn account maken',
    submitLogIn: 'Log me in',
    confirmationSent: (email) => `Er is een bevestigingslink verstuurd naar ${email}.`,
    errors: {
      unreachable: 'De server reageert niet. Probeer het zo opnieuw.',
      'email-taken': 'Dit adres heeft al een account: log liever in.',
      'weak-password': 'Wachtwoord te zwak: minstens zes tekens.',
      'short-password': 'Wachtwoord te kort: minstens zes tekens.',
      'wrong-credentials': 'Onjuist adres of wachtwoord.',
      'invalid-email': 'Dit adres is niet geldig.',
      'rate-limited': 'Te veel pogingen tegelijk. Wacht een minuut.',
      'name-length': 'De naam telt 2 tot 24 tekens.',
      'name-reserved': 'Deze naam is gereserveerd.',
      'name-taken': 'Deze naam is al bezet.',
    },
  },

  boards: {
    title: 'Klassement',
    day: {
      label: 'Dag',
      caption: 'Beste spel van vandaag',
      empty: 'Nog niemand heeft vandaag gespeeld.',
    },
    week: {
      label: 'Week',
      caption: 'Beste spel van de week',
      empty: 'Nog niemand heeft deze week gespeeld.',
    },
    discoveries: {
      label: 'Ontdekkingen',
      caption: 'Woorden die een week lang niemand had geschreven',
      empty: 'Geen ontdekkingen deze week: aan jou de eer.',
    },
    words: (count) => plural(count, 'woord', 'woorden'),
    ordinal: (rank) => `${rank}e`,
    entered: (place) => `Binnengekomen · ${place}`,
    climbed: (places, place) => `+${places} ${plural(places, 'plek', 'plekken')} · ${place}`,
    held: (place) => `Nog steeds ${place}`,
  },

  menu: {
    title: 'Menu',
    close: 'Sluiten',
    panes: { profile: 'Profiel', social: 'Vrienden', options: 'Opties' },
    editAvatarLabel: 'Mijn avatar bewerken',
    anonymous: 'Anonieme speler',
    standing: (level, record) => `Niveau ${level} · record ${record}`,
    editAvatar: 'Avatar bewerken',
    signedInAs: (email) => `Ingelogd als ${email}`,
    logOut: 'Uitloggen',
    accountTitle: 'Je account',
    accountLead: 'Je spellen volgen je van het ene apparaat naar het andere, je naam komt in het klassement en je vrienden kunnen je vinden.',
    offline: 'Offline: je voortgang blijft op dit apparaat.',
  },

  social: {
    requests: {
      sent: (name) => `Verzoek verstuurd naar ${name}.`,
      accepted: (name) => `${name} had het jou al gevraagd: jullie zijn vrienden.`,
      already: () => 'Jullie zijn al vrienden, of je verzoek wacht nog op antwoord.',
      self: () => 'Dat is je eigen naam.',
      unknown: () => 'Geen account met die naam.',
      anonymous: () => 'Maak een account om vrienden toe te voegen.',
      unreachable: () => 'De server reageert niet. Probeer het zo opnieuw.',
    },
    noServer: 'Vrienden vragen een verbinding met de spelserver, die er nu niet is.',
    needAccount: 'Een vriend vindt je via je accountnaam: maak die eerst, je gespeelde spellen gaan mee.',
    createAccount: 'Mijn account maken',
    add: 'Vriend toevoegen',
    addPlaceholder: 'Zijn of haar accountnaam',
    send: 'Verzoek versturen',
    yourName: ['Jouw naam om te delen: ', ''],
    loadFailed: 'Je vrienden kunnen nu niet worden geladen.',
    incoming: 'Ontvangen verzoeken',
    accept: 'Accepteren',
    decline: 'Weigeren',
    friends: 'Mijn vrienden',
    none: 'Nog geen vrienden. Stuur een verzoek met hun accountnaam.',
    outgoing: 'Wacht op antwoord',
    stats: (level, week, record) => `Niv. ${level} · week ${week} · record ${record}`,
    remove: 'Verwijderen',
    keep: 'Houden',
  },

  options: {
    theme: 'Thema',
    themes: { system: 'Auto', light: 'Licht', dark: 'Donker' },
    themeNote: '‘Auto’ volgt de instelling van de telefoon.',
    language: 'Taal',
    privacy: 'Privacy',
    adPrivacy: 'Advertentiekeuzes',
    erase: 'Mijn gegevens wissen',
    eraseWarning: 'Niveau, records, vrienden en voorgestelde woorden gaan verloren.',
    erasing: 'Bezig met wissen…',
    eraseAll: 'Alles wissen',
    eraseFailed: 'De server reageerde niet, er is niets gewist.',
    retry: 'Opnieuw proberen',
    erased: 'Gegevens gewist.',
  },

  avatar: {
    title: 'Je avatar',
    owned: (designs, allDesigns, colours, allColours) =>
      `${designs} / ${allDesigns} vormen · ${colours} / ${allColours} kleuren`,
    lead: 'Spellen, reeksen en niveaus ontgrendelen er meer.',
    layers: { ground: 'Achtergrond', shape: 'Vorm', accent: 'Accent' },
    lockedColour: (colour) => `${colour}, vergrendeld`,
    design: (number) => `Avatar ${number}`,
    lockedDesign: (number) => `Avatar ${number}, vergrendeld`,
    unlockHint: (item, how) => `${item}: ${how}`,
    idle: 'Tik op een vergrendeld vakje om te zien hoe je het verdient.',
    save: 'Deze avatar houden',
    back: 'Terug',
    milestone: (milestone) => {
      switch (milestone.stat) {
        case 'level':
          return `niveau ${milestone.at}`
        case 'runs':
          return `${milestone.at} ${plural(milestone.at, 'spel', 'spellen')}`
        case 'bestScore':
          return `een score van ${milestone.at}`
        case 'wordsFound':
          return `${milestone.at} woorden gevonden`
        case 'bestCombo':
          return `een reeks van ${milestone.at}`
      }
    },
  },

  tiers: { courant: 'gewoon', 'peu commun': 'ongewoon', rare: 'zeldzaam', 'très rare': 'zeer zeldzaam' },

  categories: {
    pays: ['Landen', 'Staten van de wereld, nu of vroeger'],
    animaux: ['Dieren', 'Gewone namen, van mus tot walrus'],
    couleurs: ['Kleuren', 'Tinten en nuances'],
    'fruits-legumes': ['Groente en fruit', 'Wat je eet, rauw of gekookt'],
    metiers: ['Beroepen', 'Vakken van vroeger en nu'],
    sports: ['Sporten', 'Disciplines en bezigheden'],
    'corps-humain': ['Lichaamsdelen', 'Van top tot teen'],
    matieres: ['Materialen', 'Hout, ijzer, staal, zand…'],
    capitales: ['Hoofdsteden', 'Hoofdsteden van de wereld'],
    marques: ['Merken', 'Bekende merken'],
    insectes: ['Insecten', 'Insecten en kriebelbeestjes'],
  },

  colours: {
    rouge: 'Rood',
    bleu: 'Blauw',
    jaune: 'Geel',
    noir: 'Zwart',
    creme: 'Crème',
    vert: 'Groen',
    rose: 'Roze',
    orange: 'Oranje',
    ciel: 'Hemelsblauw',
    brique: 'Baksteen',
    citron: 'Citroen',
    marine: 'Marineblauw',
    corail: 'Koraal',
    sauge: 'Salie',
    moutarde: 'Mosterd',
    violet: 'Paars',
    turquoise: 'Turkoois',
    ocre: 'Oker',
    lavande: 'Lavendel',
    olive: 'Olijf',
    saumon: 'Zalm',
    canard: 'Petrol',
    menthe: 'Mint',
    bordeaux: 'Bordeaux',
    sable: 'Zand',
    outremer: 'Ultramarijn',
    emeraude: 'Smaragd',
    prune: 'Pruim',
    gris: 'Grijs',
    anthracite: 'Antraciet',
  },
}
