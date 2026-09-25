import { PALETTE, type Milestone } from '../domain/avatar'
import { CATALOGUE } from '../domain/catalogue'
import type { TrophyId } from '../domain/challenge'
import type { PowerId, Spell } from '../domain/powers'
import type { RarityTier } from '../domain/rarity'
import type { AuthError, ChallengeInviteOutcome, FriendRequestOutcome, InviteOutcome, VoteOutcome } from '../lib/cloud'

const plural = (count: number, one: string, many: string) => (count > 1 ? many : one)
/** A trophy's name, and its line from the value that won it and the word, when one did. */
type Trophy = readonly [name: string, line: (value: number, word: string) => string]

const seconds = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })

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
      `Chaque partie en tire ${perRun} ; les autres restent en réserve, et le pouvoir Permutation en échange deux au lancement.`,
    links: { profile: 'Profil', stats: 'Statistiques', requests: 'Mes demandes', categories: 'Catégories' },
    accountLead: 'Garde tes scores et défie tes amis.',
    news: (count: number) => `${count} ${plural(count, 'nouveauté', 'nouveautés')}`,
  },

  tutorial: {
    ask: 'Tape une couleur en',
    hint: (word: string) => `Indice : « ${word} »`,
    solved: 'Bravo !',
    next: (seconds: number) => `Maintenant : ${seconds} s pour un max de mots`,
    skip: 'Passer',
  },

  countdown: {
    lineup: 'Au programme',
    swapping: 'Échange en cours…',
    swapHint: (swaps: number, reserve: number) => `Permutation : touche un thème pour l’échanger · ${swaps} ${plural(swaps, 'échange', 'échanges')} · ${reserve} en réserve`,
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
    adNotice: 'Une courte pub suivra ton choix : c’est elle qui soutient le créateur du jeu. Merci !',
    confirm: 'Valider',
    pickFirst: 'Touche une carte',
    joined: 'rejoint tes parties',
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

  support: {
    title: 'Un petit coup de pouce ?',
    lead: 'Je suis un petit développeur français qui propose des expériences faites avec le cœur. Tu peux me soutenir avec un (tout petit) don ou un 5 étoiles sur le store.',
    donate: 'Faire un petit don',
    rate: 'Mettre 5 étoiles',
    /** Shown atop the Buy Me a Coffee form framed in a browser. */
    frameDescription: 'Merci de soutenir Lettre Minute !',
    close: 'Fermer',
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
    google: 'Continuer avec Google',
    or: 'ou',
    forgot: 'Mot de passe oublié ?',
    resetLead: 'Entre l’adresse de ton compte : un code t’y attend.',
    sendCode: 'Recevoir un code',
    codeSent: (email: string) => `Code envoyé à ${email}. Il reste valable une heure.`,
    code: 'Code reçu par mail',
    newPassword: 'Nouveau mot de passe',
    submitReset: 'Changer le mot de passe',
    backToLogIn: 'Retour à la connexion',
    nameLead: 'Dernière étape : le nom sous lequel le classement t’affiche et tes amis te trouvent.',
    submitName: 'Valider ce nom',
    errors: {
      unreachable: 'Le serveur ne répond pas. Réessaie dans un instant.',
      'email-taken': 'Cette adresse a déjà un compte : connecte-toi plutôt.',
      'weak-password': 'Mot de passe trop faible : six caractères au moins.',
      'short-password': 'Mot de passe trop court : six caractères au moins.',
      'wrong-credentials': 'Adresse ou mot de passe incorrect.',
      'invalid-email': 'Cette adresse n’est pas valide.',
      'wrong-code': 'Code incorrect ou expiré.',
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
    moderator: 'modérateur',
    elect: 'Élire modérateur',
    electLabel: (name: string) => `Proposer à ${name} de devenir modérateur`,
    invites: {
      sent: (name: string) => `${name} reçoit ta proposition de devenir modérateur.`,
      already: (name: string) => `${name} est déjà modérateur, ou a déjà reçu la proposition.`,
      'not-friend': (name: string) => `${name} doit être ton ami, avec un compte nommé.`,
      forbidden: () => 'Seul un modérateur peut en élire un autre.',
      unreachable: () => 'Le serveur ne répond pas. Réessaie dans un instant.',
    } satisfies Record<InviteOutcome, (name: string) => string> as Record<InviteOutcome, (name: string) => string>,
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
    timePerWord: (seconds: string) => `${seconds} s en moyenne pour trouver un mot`,
    bestWord: (word: string, points: number) => `Meilleur mot : ${word} · ${points} pts`,
    points: 'pts',
  },

  requests: {
    offline: 'Sans serveur, tes propositions attendent sur cet appareil.',
    loadFailed: 'Impossible de charger tes demandes pour l’instant.',
    empty: 'Aucune demande pour l’instant. En partie, un mot inconnu du dictionnaire se propose d’une touche.',
    added: 'Ajoutés grâce à toi',
    addedNote: (xp: number) => `${xp} XP gagnés pour chacun.`,
    noneAdded: 'Aucun encore : un mot entre quand trois modérateurs l’ont validé.',
    fresh: 'nouveau',
    locked: 'en cours de modération',
    pending: 'En attente',
    queued: 'pas encore envoyé',
    rejected: (count: number) => `Refusées (${count})`,
    correct: 'Corriger',
    correctLabel: (word: string) => `Corriger « ${word} »`,
    withdraw: 'Retirer',
    save: 'Enregistrer',
    failed: 'Le serveur n’a pas répondu. Réessaie.',
  },

  moderation: {
    title: 'Modération',
    superTitle: 'Super modérateur',
    lead: 'Tu juges les mots proposés par les joueurs : trois « correct » font entrer un mot, deux « incorrect » le bloquent.',
    superLead: 'Ta parole suffit : un mot que tu dis correct entre aussitôt, et les cas spéciaux n’attendent que les super modérateurs.',
    progress: (done: number, needed: number) =>
      `${Math.min(done, needed)} / ${needed} mots validés sans contestation pour devenir super modérateur`,
    waiting: (count: number) =>
      count === 0 ? 'Aucun mot n’attend pour l’instant.' : `${count} ${plural(count, 'mot attend', 'mots attendent')} ton avis`,
    start: (size: number) => `Lancer une session · ${size} mots`,
    offer: {
      title: 'Deviens modérateur !',
      level: (level: number) => `Niveau ${level} : tu connais le jeu par cœur. Tu nous aides à trier les mots proposés par les joueurs ?`,
      words: 'Trois de tes mots sont entrés au dictionnaire : tu as l’œil. Tu nous aides à juger ceux des autres ?',
      friend: (name: string) => `${name} te propose de rejoindre les modérateurs.`,
      how: 'Une session, c’est cinq mots à juger d’un geste : correct, je ne sais pas, incorrect.',
      accept: 'J’en suis !',
      decline: 'Non merci',
      needAccount: 'Il te faut d’abord un compte nommé : tes parties te suivent.',
      createAccount: 'Créer mon compte',
      later: 'Plus tard',
      welcome: 'Bienvenue chez les modérateurs !',
      welcomeLead: 'Tes sessions se lancent depuis « Mes demandes ».',
      open: 'Juger mes premiers mots',
      close: 'Fermer',
      failed: 'Le serveur n’a pas répondu. Réessaie.',
    },
    screen: {
      quit: 'Quitter la session',
      counter: (index: number, total: number) => `Mot ${index} sur ${total}`,
      proposedBy: (count: number) => `proposé par ${count} ${plural(count, 'joueur', 'joueurs')}`,
      question: 'A-t-il sa place dans cette catégorie ?',
      hint: 'Glisse la carte : à droite correct, à gauche incorrect, vers le haut je ne sais pas.',
      verdicts: { correct: 'Correct', unsure: 'Je ne sais pas', incorrect: 'Incorrect', special: 'Cas spécial' },
      respell: 'Corriger l’orthographe',
      respellLead: 'Ta validation comptera, mais il faudra un modérateur de plus.',
      respellLabel: 'Orthographe corrigée',
      respellConfirm: 'Valider cette orthographe',
      specialLead: 'Synonyme, deux orthographes, doute… Seuls les super modérateurs trancheront.',
      specialPlaceholder: 'Pourquoi ? (facultatif)',
      specialConfirm: 'Envoyer aux super modérateurs',
      back: 'Retour',
      outcomes: {
        pending: 'Vote compté',
        special: 'Transmis aux super modérateurs',
        accepted: 'Entré au dictionnaire !',
        rejected: 'Bloqué',
        gone: 'Réglé entre-temps',
        unreachable: 'Le serveur n’a pas répondu. Réessaie.',
      } satisfies Record<VoteOutcome, string> as Record<VoteOutcome, string>,
      empty: 'Rien à juger pour l’instant. Reviens plus tard !',
      offline: 'Le serveur ne répond pas. Réessaie dans un instant.',
      done: 'Session terminée',
      judged: (count: number) => `${count} ${plural(count, 'mot jugé', 'mots jugés')}, merci !`,
      entered: (count: number) => `${count} ${plural(count, 'mot entré', 'mots entrés')} au dictionnaire grâce à toi`,
      finish: 'Retour à mes demandes',
    },
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

  powers: {
    /** Name and what the power does, by `PowerId`. */
    names: {
      permutation: ['Permutation', 'Au lancement, touche un thème pour l’échanger contre un de ta réserve. Deux fois.'],
      joker: ['Tricherie', 'Une fois par partie, écris « Joker » et valide : le jeu écrit un mot juste à ta place, payé au tarif de base.'],
      dodge: ['Esquive', 'Passer ne coûte que 3 secondes au lieu de 5.'],
      magic: ['Magie', 'Deux fois par partie, touche la lettre proposée pour en tirer une autre.'],
      hush: ['Silence', 'Une fois par partie, écris « chut » et valide : le chrono s’arrête jusqu’à ton prochain mot, dix secondes au plus.'],
      dyslexia: ['Dyslexie', 'Deux fautes passent sur les mots de six lettres et plus, payés au tarif de base.'],
      divination: ['Divination', 'Tu vois la catégorie et la lettre qui viennent ensuite.'],
      complication: ['Complication', 'Les mots peu communs valent ×1,15, les rares ×1,3.'],
      celerity: ['Célérité', 'Un mot juste se valide tout seul, sans appuyer sur Entrée.'],
      professor: ['Professeur', 'Quand tu passes, on te souffle ce que tu aurais pu répondre, et la fin de partie te fait la leçon.'],
    } satisfies Record<PowerId, readonly [string, string]> as Record<PowerId, readonly [name: string, description: string]>,
    /** What the player types to cast a spell; the first is the one the descriptions name. */
    spells: { joker: ['joker'], hush: ['chut'] } satisfies Record<Spell, readonly string[]> as Record<Spell, readonly string[]>,
    title: 'Pouvoirs',
    empty: 'Libre',
    slot: (index: number, name: string | null) => `Pouvoir ${index} : ${name ?? 'libre'}`,
    pickTitle: 'Choisis un pouvoir',
    remove: 'Retirer',
    close: 'Fermer',
    worn: 'équipé',
    uses: (count: number) => `${count} ${plural(count, 'fois', 'fois')} par partie`,
    always: 'toute la partie',
    offerTitle: 'Nouveau pouvoir',
    joined: 'rejoint tes pouvoirs',
    castJoker: 'Joker ! Valide pour tirer un mot',
    castHush: 'Chut… valide pour arrêter le chrono',
    joker: 'mot du joker',
    hushed: 'Chrono suspendu · respire',
    /** What the game says, typed live, while Silence holds the clock. */
    hushLines: [
      'Okay, ça va ?',
      'Respire, tu gères.',
      'Tout va bien se passer.',
      'T’es pas loin de trouver !',
      'Cool, ce pouvoir, non ?',
      'Prends ton temps, je t’attends.',
      'Le chrono dort. Pas toi.',
      'Un mot, et on repart.',
    ],
    twoLettersOff: 'à deux lettres près…',
    next: 'Ensuite',
    reroll: (letter: string, left: number) => `Changer la lettre ${letter} · encore ${left}`,
    boost: (factor: number) => `×${factor.toLocaleString('fr-FR')}`,
    auto: 'validé tout seul',
    /** Professeur, under the field after a skip, then on the summary. */
    whisper: 'On aurait pu dire',
    missed: 'Ce que tu aurais pu dire',
  },

  challenge: {
    title: 'Défis entre amis',
    create: 'Défier des amis',
    createLead: (max: number) =>
      `Jusqu’à ${max} amis. Tout le monde joue les mêmes lettres, chacun quand il veut, dans les 24 heures.`,
    noFriends: 'Pas encore d’amis à défier : ajoute-les depuis l’onglet Social.',
    launch: (count: number) => `Lancer le défi · ${count} ${plural(count, 'ami', 'amis')}`,
    pickFirst: 'Choisis au moins un ami',
    full: (max: number) => `${max} au plus`,
    createFailed: 'Le défi n’a pas pu s’ouvrir. Réessaie.',
    by: (name: string) => `Défi de ${name}`,
    mine: 'Ton défi',
    playedCount: (played: number, players: number) => `${played} / ${players} ont joué`,
    hoursLeft: (hours: number) => `encore ${hours} h`,
    status: { 'to-play': 'À jouer', waiting: 'En cours', finished: 'Terminé', missed: 'Manqué' },
    play: 'Jouer',
    view: 'Voir',
    recap: 'Bilan',
    invitePop: {
      title: (name: string) => `${name} te défie !`,
      lead: (players: number, hours: number) =>
        `${players} joueurs, les mêmes lettres pour tous. Encore ${hours} h pour jouer.`,
      later: 'Plus tard',
      play: 'Jouer',
    },
    overPop: {
      title: 'Défi terminé !',
      lead: (name: string) => `Tout le monde a joué au défi de ${name} : le bilan t’attend.`,
      later: 'Plus tard',
      open: 'Voir le bilan',
    },
    powersTitle: 'Tes pouvoirs pour ce défi',
    powersLead: (max: number) =>
      `Choisis-en ${max}. Permutation reste au vestiaire : tout le monde joue les mêmes thèmes.`,
    powersStart: 'Lancer la partie',
    race: 'La course',
    you: 'Toi',
    sending: 'Envoi de ta partie…',
    pushFailed: 'Ta partie n’a pas pu rejoindre le défi.',
    provisional: 'Classement provisoire',
    final: 'Classement final',
    rules: 'Petit Bac : un mot qu’un autre joueur a aussi trouvé ne vaut que la moitié.',
    waitingFor: (count: number, hours: number) =>
      `${count} ${plural(count, 'joueur n’a', 'joueurs n’ont')} pas encore joué · clôture dans ${hours} h au plus`,
    notYet: 'pas encore joué',
    raw: (points: string) => `${points} avant partage`,
    yourWords: 'Tes mots',
    yourWordsHint: 'Touche un mot pour voir ce que les autres ont mis.',
    nothing: 'rien trouvé',
    shared: (count: number) => `aussi chez ${count}`,
    alone: 'toi seul',
    inviteMore: 'Inviter d’autres amis',
    inviteTitle: 'Inviter au défi',
    inviteSend: (count: number) => `Inviter ${count} ${plural(count, 'ami', 'amis')}`,
    invites: {
      sent: 'Invitation envoyée.',
      full: 'Le défi est complet : huit joueurs au plus.',
      finished: 'Le défi est terminé, trop tard pour inviter.',
      forbidden: 'Seul le chef du défi invite.',
      unreachable: 'Le serveur ne répond pas. Réessaie dans un instant.',
    } satisfies Record<ChallengeInviteOutcome, string> as Record<ChallengeInviteOutcome, string>,
    mostShared: 'Les plus répétés',
    mostUnique: 'Les plus uniques',
    trophiesTitle: 'Trophées',
    trophies: {
      original: ['L’original', (value: number) => `${value} ${plural(value, 'mot que personne d’autre n’a trouvé', 'mots que personne d’autre n’a trouvés')}`],
      rarest: ['Le dénicheur', (_: number, word: string) => `« ${word} », le mot le plus rare`],
      fastest: ['L’éclair', (value: number, word: string) => `« ${word} » en ${seconds(value)} s`],
      slowest: ['La tortue', (value: number, word: string) => `« ${word} » après ${seconds(value)} s de réflexion`],
      streak: ['L’enchaîneur', (value: number) => `une série de ${value}`],
      sheep: ['Le mouton', (value: number) => `${value} ${plural(value, 'mot', 'mots')} en commun avec les autres`],
      skipper: ['Le zappeur', (value: number) => `${value} ${plural(value, 'passe', 'passes')}`],
      typos: ['Les gros doigts', (value: number) => `${value} ${plural(value, 'mot rattrapé', 'mots rattrapés')} à une lettre près`],
    } satisfies Record<TrophyId, Trophy> as Record<TrophyId, Trophy>,
    rematch: 'Revanche',
    joinRematch: 'Rejoindre la revanche',
    rematchFailed: 'La revanche n’a pas pu s’ouvrir. Réessaie.',
    loadFailed: 'Impossible de charger ce défi pour l’instant.',
    xpBonus: (percent: number) => `dont +${percent} % de bonus défi`,
    home: 'Accueil',
    back: 'Retour',
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
