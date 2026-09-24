import type { Messages } from './fr'

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many)

export const it: Messages = {
  tag: 'it-IT',
  loading: 'Caricamento…',
  wait: 'Un attimo…',
  cancel: 'Annulla',
  loadFailed: 'Non è stato possibile caricare il dizionario. Riprova.',

  home: {
    tagline: (seconds) => `Una lettera · un tema · ${seconds} secondi`,
    play: 'Gioca',
    menu: 'Menu: profilo, amici, opzioni',
    level: (level) => `Livello ${level}`,
    bestScore: 'miglior punteggio',
    runs: (count) => plural(count, 'partita', 'partite'),
    wordsFound: 'parole trovate',
    bestCombo: 'serie migliore',
    myCategories: 'Le mie categorie',
    reserve: (perRun) => `Ogni partita ne pesca ${perRun}; le altre restano in riserva per uno scambio alla partenza.`,
    newEachLevel: 'Una nuova categoria da scegliere a ogni livello.',
  },

  countdown: {
    lineup: 'In programma',
    swapping: 'Scambio in corso…',
    swapHint: (reserve) => `Tocca un tema per scambiarlo · ${reserve} in riserva`,
  },

  run: {
    meta: (words, skips) =>
      `${words} ${plural(words, 'parola', 'parole')} · ${skips} ${plural(skips, 'saltata', 'saltate')}`,
    placeholder: (letter) => `una parola con ${letter}…`,
    fieldLabel: (letter, category) => `Parola con ${letter}, categoria ${category}`,
    skip: (seconds) => `Salta −${seconds} s`,
    submit: 'Conferma',
    approximate: 'ortografia approssimata',
    oneLetterOff: 'a una lettera…',
    startsWith: (letter) => `inizia con ${letter}`,
    already: 'già data',
    unknown: 'non è nel dizionario',
    proposed: 'proposta, grazie',
    propose: 'proponila',
  },

  offer: {
    title: 'Nuova categoria',
    more: (count) => `ancora ${count} da scegliere`,
    lead: 'Scegli quella che si aggiunge alle tue partite.',
    adNotice: 'Dopo la scelta parte una breve pubblicità: è ciò che sostiene chi ha creato il gioco. Grazie!',
  },

  over: {
    timeUp: 'Tempo scaduto',
    points: 'punti',
    empty: 'Nemmeno una parola. Capita.',
    next: 'Continua',
    earned: () => 'Novità per il tuo avatar',
    customize: 'Personalizza il mio avatar',
    words: (count) => plural(count, 'parola', 'parole'),
    bestCombo: 'serie migliore',
    newRecord: 'nuovo record',
    record: 'record',
    dayBoard: 'Classifica del giorno',
    keepTitle: 'Tieni questa partita',
    keepLead: 'Crea un account o accedi: questa partita e tutti i tuoi progressi ci entrano subito.',
    savedTo: ['Partita salvata sull’account ', ''],
    replay: 'Gioca ancora',
    home: 'Home',
    level: (level) => `Livello ${level}`,
    towards: (into, span, next) => `${into} / ${span} XP verso il livello ${next}`,
    levelUp: 'Livello superiore',
    levelReached: (level) => `Livello ${level} raggiunto`,
  },

  account: {
    register: 'Crea un account',
    logIn: 'Accedi',
    name: 'Nome dell’account',
    email: 'Indirizzo email',
    password: 'Password',
    submitRegister: 'Crea il mio account',
    submitLogIn: 'Accedi',
    confirmationSent: (email) => `Un link di conferma è partito verso ${email}.`,
    errors: {
      unreachable: 'Il server non risponde. Riprova tra un attimo.',
      'email-taken': 'Questo indirizzo ha già un account: accedi piuttosto.',
      'weak-password': 'Password troppo debole: almeno sei caratteri.',
      'short-password': 'Password troppo corta: almeno sei caratteri.',
      'wrong-credentials': 'Indirizzo o password errati.',
      'invalid-email': 'Questo indirizzo non è valido.',
      'rate-limited': 'Troppi tentativi di fila. Aspetta un minuto.',
      'name-length': 'Il nome va da 2 a 24 caratteri.',
      'name-reserved': 'Questo nome è riservato.',
      'name-taken': 'Questo nome è già preso.',
    },
  },

  boards: {
    title: 'Classifica',
    day: {
      label: 'Giorno',
      caption: 'Miglior partita di oggi',
      empty: 'Nessuno ha ancora giocato oggi.',
    },
    week: {
      label: 'Settimana',
      caption: 'Miglior partita della settimana',
      empty: 'Nessuno ha ancora giocato questa settimana.',
    },
    discoveries: {
      label: 'Scoperte',
      caption: 'Parole che nessuno aveva scritto da una settimana',
      empty: 'Nessuna scoperta questa settimana: tocca a te aprire le danze.',
    },
    words: (count) => plural(count, 'parola', 'parole'),
    ordinal: (rank) => `${rank}º`,
    entered: (place) => `Ingresso · ${place}`,
    climbed: (places, place) => `+${places} ${plural(places, 'posto', 'posti')} · ${place}`,
    held: (place) => `Sempre ${place}`,
  },

  menu: {
    title: 'Menu',
    close: 'Chiudi',
    panes: { profile: 'Profilo', social: 'Amici', options: 'Opzioni' },
    editAvatarLabel: 'Modifica il mio avatar',
    anonymous: 'Giocatore anonimo',
    standing: (level, record) => `Livello ${level} · record ${record}`,
    editAvatar: 'Modifica l’avatar',
    signedInAs: (email) => `Connesso con ${email}`,
    logOut: 'Esci',
    accountTitle: 'Il tuo account',
    accountLead: 'Le tue partite ti seguono da un dispositivo all’altro, il tuo nome entra in classifica e i tuoi amici possono trovarti.',
    offline: 'Offline: i tuoi progressi restano su questo dispositivo.',
  },

  social: {
    requests: {
      sent: (name) => `Richiesta inviata a ${name}.`,
      accepted: (name) => `${name} te l’aveva già chiesto: siete amici.`,
      already: () => 'Siete già amici, oppure la tua richiesta attende risposta.',
      self: () => 'È il tuo stesso nome.',
      unknown: () => 'Nessun account con questo nome.',
      anonymous: () => 'Crea un account per aggiungere amici.',
      unreachable: () => 'Il server non risponde. Riprova tra un attimo.',
    },
    noServer: 'Gli amici richiedono una connessione al server del gioco, per ora assente.',
    needAccount: 'Un amico ti trova dal nome dell’account: crealo prima, le partite già giocate ti seguono.',
    createAccount: 'Crea il mio account',
    add: 'Aggiungi un amico',
    addPlaceholder: 'Il suo nome dell’account',
    send: 'Invia la richiesta',
    yourName: ['Il tuo nome da condividere: ', ''],
    loadFailed: 'Impossibile caricare i tuoi amici per ora.',
    incoming: 'Richieste ricevute',
    accept: 'Accetta',
    decline: 'Rifiuta',
    friends: 'I miei amici',
    none: 'Ancora nessun amico. Invia una richiesta con il loro nome dell’account.',
    outgoing: 'In attesa di risposta',
    stats: (level, week, record) => `Liv. ${level} · settimana ${week} · record ${record}`,
    remove: 'Rimuovi',
    keep: 'Tieni',
  },

  options: {
    theme: 'Tema',
    themes: { system: 'Auto', light: 'Chiaro', dark: 'Scuro' },
    themeNote: '«Auto» segue l’impostazione del telefono.',
    sound: 'Suono',
    sounds: { effects: 'Effetti', keys: 'Tastiera', music: 'Musica', pulse: 'Pulsazione in partita' },
    soundNote: '«Pulsazione» aggiunge un ritmo sotto la partita che si infittisce ogni venti secondi.',
    mute: 'Disattiva l’audio',
    unmute: 'Riattiva l’audio',
    language: 'Lingua',
    privacy: 'Privacy',
    adPrivacy: 'Scelte pubblicitarie',
    erase: 'Cancella i miei dati',
    eraseWarning: 'Livello, record, amici e parole proposte andranno persi.',
    erasing: 'Cancellazione…',
    eraseAll: 'Cancella tutto',
    eraseFailed: 'Il server non ha risposto, non è stato cancellato nulla.',
    retry: 'Riprova',
    erased: 'Dati cancellati.',
  },

  avatar: {
    title: 'Il tuo avatar',
    owned: (designs, allDesigns, colours, allColours) =>
      `${designs} / ${allDesigns} forme · ${colours} / ${allColours} colori`,
    lead: 'Partite, serie e livelli ne sbloccano altri.',
    layers: { ground: 'Sfondo', shape: 'Forma', accent: 'Accento' },
    lockedColour: (colour) => `${colour}, bloccato`,
    design: (number) => `Avatar ${number}`,
    lockedDesign: (number) => `Avatar ${number}, bloccato`,
    unlockHint: (item, how) => `${item}: ${how}`,
    idle: 'Tocca una casella bloccata per sapere come ottenerla.',
    save: 'Tieni questo avatar',
    back: 'Indietro',
    milestone: (milestone) => {
      switch (milestone.stat) {
        case 'level':
          return `livello ${milestone.at}`
        case 'runs':
          return `${milestone.at} ${plural(milestone.at, 'partita', 'partite')}`
        case 'bestScore':
          return `un punteggio di ${milestone.at}`
        case 'wordsFound':
          return `${milestone.at} parole trovate`
        case 'bestCombo':
          return `una serie di ${milestone.at}`
      }
    },
  },

  tiers: { courant: 'comune', 'peu commun': 'poco comune', rare: 'rara', 'très rare': 'rarissima' },

  categories: {
    pays: ['Paesi', 'Stati del mondo, attuali o passati'],
    animaux: ['Animali', 'Nomi comuni, dal passero al tricheco'],
    couleurs: ['Colori', 'Tinte e sfumature'],
    'fruits-legumes': ['Frutta e verdura', 'Ciò che si mangia, crudo o cotto'],
    metiers: ['Mestieri', 'Professioni di ieri e di oggi'],
    sports: ['Sport', 'Discipline e pratiche'],
    'corps-humain': ['Parti del corpo', 'Dalla testa ai piedi'],
    matieres: ['Materiali', 'Legno, ferro, acciaio, sabbia…'],
    capitales: ['Capitali', 'Capitali del mondo'],
    marques: ['Marchi', 'Marchi noti'],
    insectes: ['Insetti', 'Insetti e bestioline'],
  },

  colours: {
    rouge: 'Rosso',
    bleu: 'Blu',
    jaune: 'Giallo',
    noir: 'Nero',
    creme: 'Crema',
    vert: 'Verde',
    rose: 'Rosa',
    orange: 'Arancione',
    ciel: 'Celeste',
    brique: 'Mattone',
    citron: 'Limone',
    marine: 'Blu marino',
    corail: 'Corallo',
    sauge: 'Salvia',
    moutarde: 'Senape',
    violet: 'Viola',
    turquoise: 'Turchese',
    ocre: 'Ocra',
    lavande: 'Lavanda',
    olive: 'Oliva',
    saumon: 'Salmone',
    canard: 'Ottanio',
    menthe: 'Menta',
    bordeaux: 'Bordeaux',
    sable: 'Sabbia',
    outremer: 'Oltremare',
    emeraude: 'Smeraldo',
    prune: 'Prugna',
    gris: 'Grigio',
    anthracite: 'Antracite',
  },
}
