import type { Messages } from './fr'

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many)

export const de: Messages = {
  tag: 'de-DE',
  loading: 'Wird geladen…',
  wait: 'Einen Moment…',
  cancel: 'Abbrechen',
  loadFailed: 'Das Wörterbuch konnte nicht geladen werden. Versuch es noch einmal.',

  home: {
    tagline: (seconds) => `Ein Buchstabe · ein Thema · ${seconds} Sekunden`,
    play: 'Spielen',
    menu: 'Menü: Profil, Freunde, Optionen',
    level: (level) => `Level ${level}`,
    bestScore: 'Bestwert',
    runs: (count) => plural(count, 'Partie', 'Partien'),
    wordsFound: 'Wörter gefunden',
    bestCombo: 'beste Serie',
    myCategories: 'Meine Kategorien',
    reserve: (perRun) => `Jede Partie zieht ${perRun}; die übrigen bleiben in Reserve, zum Tauschen beim Start.`,
    newEachLevel: 'Auf jedem Level eine neue Kategorie zur Wahl.',
  },

  countdown: {
    lineup: 'Auf dem Programm',
    swapping: 'Wird getauscht…',
    swapHint: (reserve) => `Tippe auf ein Thema, um es zu tauschen · ${reserve} in Reserve`,
  },

  run: {
    meta: (words, skips) => `${words} ${plural(words, 'Wort', 'Wörter')} · ${skips} übersprungen`,
    placeholder: (letter) => `ein Wort mit ${letter}…`,
    fieldLabel: (letter, category) => `Wort mit ${letter}, Kategorie ${category}`,
    skip: (seconds) => `Überspringen −${seconds} s`,
    submit: 'Bestätigen',
    approximate: 'fast richtig geschrieben',
    oneLetterOff: 'ein Buchstabe daneben…',
    startsWith: (letter) => `beginnt mit ${letter}`,
    already: 'schon genannt',
    unknown: 'nicht im Wörterbuch',
    proposed: 'vorgeschlagen, danke',
    propose: 'vorschlagen',
  },

  offer: {
    title: 'Neue Kategorie',
    more: (count) => `noch ${count} zu wählen`,
    lead: 'Wähle die, die zu deinen Partien dazukommt.',
    adNotice: 'Nach deiner Wahl kommt eine kurze Werbung – so unterstützt du den Macher des Spiels. Danke!',
  },

  over: {
    timeUp: 'Zeit ist um',
    points: 'Punkte',
    empty: 'Kein einziges Wort. Kommt vor.',
    next: 'Weiter',
    earned: () => 'Neu für deinen Avatar',
    customize: 'Meinen Avatar anpassen',
    words: (count) => plural(count, 'Wort', 'Wörter'),
    bestCombo: 'beste Serie',
    newRecord: 'neuer Rekord',
    record: 'Rekord',
    dayBoard: 'Tagesrangliste',
    keepTitle: 'Behalte diese Partie',
    keepLead: 'Erstelle ein Konto oder melde dich an: Diese Partie und dein ganzer Fortschritt landen sofort darin.',
    savedTo: ['Partie im Konto ', ' gespeichert'],
    replay: 'Nochmal spielen',
    home: 'Start',
    level: (level) => `Level ${level}`,
    towards: (into, span, next) => `${into} / ${span} XP bis Level ${next}`,
    levelUp: 'Level aufgestiegen',
    levelReached: (level) => `Level ${level} erreicht`,
  },

  account: {
    register: 'Konto erstellen',
    logIn: 'Anmelden',
    name: 'Kontoname',
    email: 'E-Mail-Adresse',
    password: 'Passwort',
    submitRegister: 'Mein Konto erstellen',
    submitLogIn: 'Anmelden',
    confirmationSent: (email) => `Ein Bestätigungslink ist an ${email} unterwegs.`,
    errors: {
      unreachable: 'Der Server antwortet nicht. Versuch es gleich noch einmal.',
      'email-taken': 'Für diese Adresse gibt es schon ein Konto: Melde dich lieber an.',
      'weak-password': 'Passwort zu schwach: mindestens sechs Zeichen.',
      'short-password': 'Passwort zu kurz: mindestens sechs Zeichen.',
      'wrong-credentials': 'Adresse oder Passwort falsch.',
      'invalid-email': 'Diese Adresse ist ungültig.',
      'rate-limited': 'Zu viele Versuche auf einmal. Warte eine Minute.',
      'name-length': 'Der Name hat 2 bis 24 Zeichen.',
      'name-reserved': 'Dieser Name ist reserviert.',
      'name-taken': 'Dieser Name ist schon vergeben.',
    },
  },

  boards: {
    title: 'Rangliste',
    day: {
      label: 'Tag',
      caption: 'Beste Partie von heute',
      empty: 'Heute hat noch niemand gespielt.',
    },
    week: {
      label: 'Woche',
      caption: 'Beste Partie der Woche',
      empty: 'Diese Woche hat noch niemand gespielt.',
    },
    discoveries: {
      label: 'Entdeckungen',
      caption: 'Wörter, die seit einer Woche niemand geschrieben hatte',
      empty: 'Keine Entdeckung diese Woche: Du darfst anfangen.',
    },
    words: (count) => plural(count, 'Wort', 'Wörter'),
    ordinal: (rank) => `${rank}.`,
    entered: (place) => `Neu dabei · ${place}`,
    climbed: (places, place) => `+${places} ${plural(places, 'Platz', 'Plätze')} · ${place}`,
    held: (place) => `Weiter ${place}`,
  },

  menu: {
    title: 'Menü',
    close: 'Schließen',
    panes: { profile: 'Profil', social: 'Freunde', options: 'Optionen' },
    editAvatarLabel: 'Meinen Avatar bearbeiten',
    anonymous: 'Anonymer Spieler',
    standing: (level, record) => `Level ${level} · Rekord ${record}`,
    editAvatar: 'Avatar bearbeiten',
    signedInAs: (email) => `Angemeldet als ${email}`,
    logOut: 'Abmelden',
    accountTitle: 'Dein Konto',
    accountLead: 'Deine Partien begleiten dich von Gerät zu Gerät, dein Name kommt in die Rangliste und deine Freunde können dich finden.',
    offline: 'Offline: Dein Fortschritt bleibt auf diesem Gerät.',
  },

  social: {
    requests: {
      sent: (name) => `Anfrage an ${name} gesendet.`,
      accepted: (name) => `${name} hatte dich schon gefragt: Ihr seid jetzt Freunde.`,
      already: () => 'Ihr seid schon Freunde, oder deine Anfrage wartet auf Antwort.',
      self: () => 'Das ist dein eigener Name.',
      unknown: () => 'Kein Konto mit diesem Namen.',
      anonymous: () => 'Erstelle ein Konto, um Freunde hinzuzufügen.',
      unreachable: () => 'Der Server antwortet nicht. Versuch es gleich noch einmal.',
    },
    noServer: 'Freunde brauchen eine Verbindung zum Spielserver, die gerade fehlt.',
    needAccount: 'Ein Freund findet dich über deinen Kontonamen: Erstelle ihn zuerst, deine gespielten Partien kommen mit.',
    createAccount: 'Mein Konto erstellen',
    add: 'Freund hinzufügen',
    addPlaceholder: 'Sein oder ihr Kontoname',
    send: 'Anfrage senden',
    yourName: ['Dein Name zum Weitergeben: ', ''],
    loadFailed: 'Deine Freunde können gerade nicht geladen werden.',
    incoming: 'Erhaltene Anfragen',
    accept: 'Annehmen',
    decline: 'Ablehnen',
    friends: 'Meine Freunde',
    none: 'Noch keine Freunde. Schick eine Anfrage mit ihrem Kontonamen.',
    outgoing: 'Wartet auf Antwort',
    stats: (level, week, record) => `Lv. ${level} · Woche ${week} · Rekord ${record}`,
    remove: 'Entfernen',
    keep: 'Behalten',
  },

  options: {
    theme: 'Design',
    themes: { system: 'Auto', light: 'Hell', dark: 'Dunkel' },
    themeNote: '„Auto“ folgt der Einstellung des Telefons.',
    language: 'Sprache',
    privacy: 'Datenschutz',
    adPrivacy: 'Werbeeinstellungen',
    erase: 'Meine Daten löschen',
    eraseWarning: 'Level, Rekorde, Freunde und vorgeschlagene Wörter gehen verloren.',
    erasing: 'Wird gelöscht…',
    eraseAll: 'Alles löschen',
    eraseFailed: 'Der Server hat nicht geantwortet, nichts wurde gelöscht.',
    retry: 'Erneut versuchen',
    erased: 'Daten gelöscht.',
  },

  avatar: {
    title: 'Dein Avatar',
    owned: (designs, allDesigns, colours, allColours) =>
      `${designs} / ${allDesigns} Formen · ${colours} / ${allColours} Farben`,
    lead: 'Partien, Serien und Level schalten weitere frei.',
    layers: { ground: 'Hintergrund', shape: 'Form', accent: 'Akzent' },
    lockedColour: (colour) => `${colour}, gesperrt`,
    design: (number) => `Avatar ${number}`,
    lockedDesign: (number) => `Avatar ${number}, gesperrt`,
    unlockHint: (item, how) => `${item}: ${how}`,
    idle: 'Tippe auf ein gesperrtes Feld, um zu sehen, wie du es freischaltest.',
    save: 'Diesen Avatar behalten',
    back: 'Zurück',
    milestone: (milestone) => {
      switch (milestone.stat) {
        case 'level':
          return `Level ${milestone.at}`
        case 'runs':
          return `${milestone.at} ${plural(milestone.at, 'Partie', 'Partien')}`
        case 'bestScore':
          return `ein Ergebnis von ${milestone.at}`
        case 'wordsFound':
          return `${milestone.at} gefundene Wörter`
        case 'bestCombo':
          return `eine Serie von ${milestone.at}`
      }
    },
  },

  tiers: { courant: 'gängig', 'peu commun': 'ungewöhnlich', rare: 'selten', 'très rare': 'sehr selten' },

  categories: {
    pays: ['Länder', 'Staaten der Welt, heutige oder frühere'],
    animaux: ['Tiere', 'Gängige Namen, vom Spatz bis zum Walross'],
    couleurs: ['Farben', 'Farbtöne und Nuancen'],
    'fruits-legumes': ['Obst und Gemüse', 'Was man isst, roh oder gekocht'],
    metiers: ['Berufe', 'Berufe von gestern und heute'],
    sports: ['Sportarten', 'Disziplinen und Aktivitäten'],
    'corps-humain': ['Körperteile', 'Von Kopf bis Fuß'],
    matieres: ['Materialien', 'Holz, Eisen, Stahl, Sand…'],
    capitales: ['Hauptstädte', 'Hauptstädte der Welt'],
    marques: ['Marken', 'Bekannte Marken'],
    insectes: ['Insekten', 'Insekten und Krabbeltiere'],
  },

  colours: {
    rouge: 'Rot',
    bleu: 'Blau',
    jaune: 'Gelb',
    noir: 'Schwarz',
    creme: 'Creme',
    vert: 'Grün',
    rose: 'Rosa',
    orange: 'Orange',
    ciel: 'Himmelblau',
    brique: 'Ziegelrot',
    citron: 'Zitrone',
    marine: 'Marineblau',
    corail: 'Koralle',
    sauge: 'Salbei',
    moutarde: 'Senf',
    violet: 'Violett',
    turquoise: 'Türkis',
    ocre: 'Ocker',
    lavande: 'Lavendel',
    olive: 'Oliv',
    saumon: 'Lachs',
    canard: 'Petrol',
    menthe: 'Minze',
    bordeaux: 'Bordeaux',
    sable: 'Sand',
    outremer: 'Ultramarin',
    emeraude: 'Smaragd',
    prune: 'Pflaume',
    gris: 'Grau',
    anthracite: 'Anthrazit',
  },
}
