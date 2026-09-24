import { PALETTE, type Milestone } from '../domain/avatar'
import { CATALOGUE } from '../domain/catalogue'
import type { RarityTier } from '../domain/rarity'
import type { AuthError, FriendRequestOutcome } from '../lib/cloud'

const plural = (count: number, one: string, many: string) => (count > 1 ? many : one)

/**
 * The reference wording: every other language is typed against it, so a key
 * added here and forgotten elsewhere fails the build rather than the player.
 */
export const fr = {
  /** BCP 47 tag, for numbers and for `<html lang>`. */
  tag: 'fr-FR',
  /** Stacked in two lines on the home screen, hence two words. */
  appName: ['Lettre', 'Minute'] as [string, string],
  loading: 'Chargement…',
  wait: 'Un instant…',
  cancel: 'Annuler',
  loadFailed: 'Le dictionnaire n’a pas pu être chargé. Réessaie.',

  home: {
    tagline: (seconds: number) => `Une lettre · un thème · ${seconds} secondes`,
    play: 'Jouer',
    menu: 'Menu : profil, amis, options',
    level: (level: number) => `Niveau ${level}`,
    bestScore: 'meilleur score',
    runs: (count: number) => plural(count, 'partie', 'parties'),
    wordsFound: 'mots trouvés',
    bestCombo: 'meilleure série',
    myCategories: 'Mes catégories',
    reserve: (perRun: number) =>
      `Chaque partie en tire ${perRun} ; les autres restent en réserve pour un échange au lancement.`,
    links: { profile: 'Profil', stats: 'Statistiques', requests: 'Mes demandes', categories: 'Catégories' },
  },

  countdown: {
    lineup: 'Au programme',
    swapping: 'Échange en cours…',
    swapHint: (reserve: number) => `Touche un thème pour l’échanger · ${reserve} en réserve`,
  },

  run: {
    meta: (words: number, skips: number) =>
      `${words} ${plural(words, 'mot', 'mots')} · ${skips} ${plural(skips, 'passé', 'passés')}`,
    placeholder: (letter: string) => `un mot en ${letter}…`,
    fieldLabel: (letter: string, category: string) => `Mot en ${letter}, catégorie ${category}`,
    skip: (seconds: number) => `Passer −${seconds} s`,
    submit: 'Valider',
    approximate: 'orthographe approchée',
    oneLetterOff: 'à une lettre près…',
    startsWith: (letter: string) => `commence par ${letter}`,
    already: 'déjà donné',
    unknown: 'inconnu du dictionnaire',
    proposed: 'proposé, merci',
    propose: 'le proposer',
  },

  offer: {
    title: 'Nouvelle catégorie',
    more: (count: number) => `encore ${count} à choisir`,
    lead: 'Choisis celle qui rejoint tes parties.',
    adNotice: 'Une courte pub suivra ton choix : c’est elle qui soutient le créateur du jeu. Merci !',
  },

  over: {
    timeUp: 'Temps écoulé',
    points: 'points',
    empty: 'Pas un seul mot. Ça arrive.',
    next: 'Continuer',
    earned: (count: number) => plural(count, 'Nouveauté pour ton avatar', 'Nouveautés pour ton avatar'),
    customize: 'Personnaliser mon avatar',
    words: (count: number) => plural(count, 'mot', 'mots'),
    bestCombo: 'meilleure série',
    newRecord: 'nouveau record',
    record: 'record',
    dayBoard: 'Classement du jour',
    keepTitle: 'Garde cette partie',
    keepLead: 'Crée un compte ou connecte-toi : cette partie et toute ta progression y entrent tout de suite.',
    /** Around the account name, which is set in bold. */
    savedTo: ['Partie enregistrée sur le compte ', ''] as readonly [string, string],
    replay: 'Rejouer',
    home: 'Accueil',
    level: (level: number) => `Niveau ${level}`,
    towards: (into: number, span: number, next: number) => `${into} / ${span} XP vers le niveau ${next}`,
    levelUp: 'Niveau supérieur',
    levelReached: (level: number) => `Niveau ${level} atteint`,
  },

  account: {
    register: 'Créer un compte',
    logIn: 'Se connecter',
    name: 'Nom de compte',
    email: 'Adresse mail',
    password: 'Mot de passe',
    submitRegister: 'Créer mon compte',
    submitLogIn: 'Me connecter',
    confirmationSent: (email: string) => `Un lien de confirmation est parti à ${email}.`,
    errors: {
      unreachable: 'Le serveur ne répond pas. Réessaie dans un instant.',
      'email-taken': 'Cette adresse a déjà un compte : connecte-toi plutôt.',
      'weak-password': 'Mot de passe trop faible : six caractères au moins.',
      'short-password': 'Mot de passe trop court : six caractères au moins.',
      'wrong-credentials': 'Adresse ou mot de passe incorrect.',
      'invalid-email': 'Cette adresse n’est pas valide.',
      'rate-limited': 'Trop d’essais d’un coup. Patiente une minute.',
      'name-length': 'Le nom fait entre 2 et 24 caractères.',
      'name-reserved': 'Ce nom est réservé.',
      'name-taken': 'Ce nom est déjà pris.',
    } satisfies Record<AuthError, string> as Record<AuthError, string>,
  },

  boards: {
    title: 'Classement',
    day: {
      label: 'Jour',
      caption: 'Meilleure partie d’aujourd’hui',
      empty: 'Personne n’a encore joué aujourd’hui.',
    },
    week: {
      label: 'Semaine',
      caption: 'Meilleure partie de la semaine',
      empty: 'Personne n’a encore joué cette semaine.',
    },
    discoveries: {
      label: 'Découvertes',
      caption: 'Mots que personne n’avait écrits depuis une semaine',
      empty: 'Aucune découverte cette semaine : à toi d’ouvrir le bal.',
    },
    words: (count: number) => plural(count, 'mot', 'mots'),
    /** « 1er », « 2e », « 17e » : a place on the board, as a French poster prints it. */
    ordinal: (rank: number) => (rank === 1 ? '1er' : `${rank}e`),
    entered: (place: string) => `Entrée · ${place}`,
    climbed: (places: number, place: string) => `+${places} ${plural(places, 'place', 'places')} · ${place}`,
    held: (place: string) => `Toujours ${place}`,
  },

  menu: {
    title: 'Menu',
    close: 'Fermer',
    panes: { profile: 'Profil', social: 'Social', options: 'Options' },
    editAvatarLabel: 'Modifier mon avatar',
    anonymous: 'Joueur anonyme',
    standing: (level: number, record: string) => `Niveau ${level} · record ${record}`,
    editAvatar: 'Modifier l’avatar',
    signedInAs: (email: string) => `Connecté avec ${email}`,
    logOut: 'Se déconnecter',
    accountTitle: 'Ton compte',
    accountLead:
      'Tes parties te suivent d’un appareil à l’autre, ton nom entre au classement et tes amis peuvent te trouver.',
    offline: 'Hors ligne : ta progression reste sur cet appareil.',
    back: 'Retour',
    pages: { stats: 'Statistiques', requests: 'Mes demandes', categories: 'Mes catégories' },
  },

  social: {
    requests: {
      sent: (name: string) => `Demande envoyée à ${name}.`,
      accepted: (name: string) => `${name} t’avait déjà demandé : vous êtes amis.`,
      already: () => 'Vous êtes déjà amis, ou ta demande attend sa réponse.',
      self: () => 'C’est ton propre nom.',
      unknown: () => 'Aucun compte à ce nom.',
      anonymous: () => 'Crée un compte pour ajouter des amis.',
      unreachable: () => 'Le serveur ne répond pas. Réessaie dans un instant.',
    } satisfies Record<FriendRequestOutcome, (name: string) => string> as Record<
      FriendRequestOutcome,
      (name: string) => string
    >,
    noServer: 'Les amis demandent une connexion au serveur du jeu, absente pour l’instant.',
    needAccount: 'Un ami te trouve par ton nom de compte : crée-le d’abord, tes parties déjà jouées te suivent.',
    createAccount: 'Créer mon compte',
    add: 'Ajouter un ami',
    addPlaceholder: 'Son nom de compte',
    send: 'Envoyer la demande',
    /** Around the player's own account name, which is set in bold. */
    yourName: ['Ton nom à donner : ', ''] as readonly [string, string],
    loadFailed: 'Impossible de charger tes amis pour l’instant.',
    incoming: 'Demandes reçues',
    accept: 'Accepter',
    decline: 'Refuser',
    friends: 'Mes amis',
    none: 'Pas encore d’amis. Envoie une demande avec leur nom de compte.',
    outgoing: 'En attente de réponse',
    stats: (level: number, week: string, record: string) => `Niv. ${level} · semaine ${week} · record ${record}`,
    remove: 'Retirer',
    keep: 'Garder',
  },

  stats: {
    empty: 'Joue une partie : tes statistiques commencent ici.',
    partial: 'Le détail compte les parties jouées sur cet appareil depuis cette mise à jour.',
    average: 'moyenne récente',
    best: 'record',
    trend: 'vs les 10 d’avant',
    recent: 'Parties récentes',
    history: (count: number) => `Tout l’historique (${count})`,
    hideHistory: 'Replier l’historique',
    more: 'Afficher plus',
    runLine: (words: number, combo: number) => `${words} ${plural(words, 'mot', 'mots')} · série de ${combo}`,
    topWords: 'Mots les plus dits',
    times: (count: number) => `${count} fois`,
    byCategory: 'Par catégorie',
    categoryLine: (runs: number, words: number) =>
      `${runs} ${plural(runs, 'partie', 'parties')} · ${words} ${plural(words, 'mot', 'mots')}`,
    perWord: (points: string) => `${points} pts/mot`,
    bestWord: (word: string, points: number) => `Meilleur mot : ${word} · ${points} pts`,
    points: 'pts',
  },

  requests: {
    offline: 'Sans serveur, tes propositions attendent sur cet appareil.',
    loadFailed: 'Impossible de charger tes demandes pour l’instant.',
    empty: 'Aucune demande pour l’instant. En partie, un mot inconnu du dictionnaire se propose d’une touche.',
    added: 'Ajoutés grâce à toi',
    addedNote: (xp: number) => `${xp} XP gagnés pour chacun.`,
    noneAdded: 'Aucun encore : un mot entre quand trois joueurs l’ont proposé.',
    pending: 'En attente',
    queued: 'pas encore envoyé',
    rejected: (count: number) => `Refusées (${count})`,
    correct: 'Corriger',
    correctLabel: (word: string) => `Corriger « ${word} »`,
    withdraw: 'Retirer',
    save: 'Enregistrer',
    failed: 'Le serveur n’a pas répondu. Réessaie.',
  },

  options: {
    theme: 'Thème',
    themes: { system: 'Auto', light: 'Clair', dark: 'Sombre' },
    themeNote: '« Auto » suit le réglage du téléphone.',
    sound: 'Son',
    sounds: { master: 'Général', effects: 'Effets', keys: 'Clavier', music: 'Musique' },
    soundNote: '« Général » règle tout d’un coup. La musique comprend la pulsation sous la partie, qui se densifie toutes les vingt secondes.',
    soundOff: 'Coupé',
    mute: 'Couper le son',
    unmute: 'Rétablir le son',
    language: 'Langue',
    privacy: 'Confidentialité',
    adPrivacy: 'Choix publicitaires',
    erase: 'Effacer mes données',
    eraseWarning: 'Niveau, records, amis et mots proposés seront perdus.',
    erasing: 'Effacement…',
    eraseAll: 'Tout effacer',
    eraseFailed: 'Le serveur n’a pas répondu, rien n’a été effacé.',
    retry: 'Réessayer',
    erased: 'Données effacées.',
  },

  avatar: {
    title: 'Ton avatar',
    owned: (designs: number, allDesigns: number, colours: number, allColours: number) =>
      `${designs} / ${allDesigns} formes · ${colours} / ${allColours} couleurs`,
    lead: 'Les parties, les séries et les niveaux en débloquent d’autres.',
    layers: { ground: 'Fond', shape: 'Forme', accent: 'Accent' },
    lockedColour: (colour: string) => `${colour}, verrouillée`,
    design: (number: number) => `Avatar ${number}`,
    lockedDesign: (number: number) => `Avatar ${number}, verrouillé`,
    unlockHint: (item: string, how: string) => `${item} : ${how}`,
    idle: 'Touche une case verrouillée pour savoir comment la gagner.',
    save: 'Garder cet avatar',
    back: 'Retour',
    milestone: (milestone: Milestone): string => {
      switch (milestone.stat) {
        case 'level':
          return `niveau ${milestone.at}`
        case 'runs':
          return `${milestone.at} ${plural(milestone.at, 'partie', 'parties')}`
        case 'bestScore':
          return `score de ${milestone.at}`
        case 'wordsFound':
          return `${milestone.at} mots trouvés`
        case 'bestCombo':
          return `série de ${milestone.at}`
      }
    },
  },

  tiers: {
    courant: 'courant',
    'peu commun': 'peu commun',
    rare: 'rare',
    'très rare': 'très rare',
  } satisfies Record<RarityTier, string> as Record<RarityTier, string>,

  /** By category id. French reads the catalogue itself, which stays the source of truth. */
  categories: Object.fromEntries(CATALOGUE.map((category) => [category.id, [category.label, category.hint]])) as Record<
    string,
    readonly [label: string, hint: string]
  >,

  /** By palette id. */
  colours: Object.fromEntries(PALETTE.map((colour) => [colour.id, colour.label])) as Record<string, string>,
}

export type Messages = typeof fr
