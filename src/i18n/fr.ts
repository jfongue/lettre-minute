import { PALETTE, type Milestone } from '../domain/avatar'
import { announcedCategories } from '../domain/catalogue'
import type { TrophyId } from '../domain/challenge'
import type { FaceOff } from '../domain/rivalry'
import type { StatId } from '../domain/leaderboards'
import type { PowerId, Spell } from '../domain/powers'
import type { RarityTier } from '../domain/rarity'
import type { AuthError, BlockOutcome, ChallengeInviteOutcome, FriendRequestOutcome, InviteOutcome, TesterInviteOutcome, VoteOutcome } from '../lib/cloud'
import type { PushState } from '../lib/native'

interface LeaderboardText {
  label: string
  caption: string
  unit: (count: number) => string
}

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
    friendRequests: (count: number) => (count === 1 ? 'une demande d’ami' : `${count} demandes d’ami`),
    level: (level: number) => `Niveau ${level}`,
    bestScore: 'meilleur score',
    runs: (count: number) => plural(count, 'partie', 'parties'),
    wordsFound: 'mots trouvés',
    bestCombo: 'meilleure série',
    myCategories: 'Mes catégories',
    comingSoon: 'Bientôt…',
    links: { profile: 'Profil', stats: 'Statistiques', requests: 'Mes demandes', categories: 'Catégories' },
    accountLead: 'Garde tes scores et défie tes amis.',
    news: (count: number) => `${count} ${plural(count, 'nouveauté', 'nouveautés')}`,
    queueWaiting: 'Des mots attendent ton avis',
  },

  tutorial: {
    hello: 'Laisse-moi t’expliquer le principe…',
    letter: 'Une lettre',
    theme: 'Un thème',
    ask: 'Tape une couleur en',
    hint: (word: string) => `Indice : « ${word} »`,
    solved: 'Bravo !',
    next: 'Place à la vraie partie…',
    skip: 'Passer',
  },

  countdown: {
    lineup: 'Au programme',
    swapping: 'Échange en cours…',
    swapHint: (swaps: number, reserve: number) => `Échange : touche un thème pour l’échanger · ${swaps} ${plural(swaps, 'échange', 'échanges')} · ${reserve} en réserve`,
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
    mineNote: (count: number) =>
      `dont ${count} ${plural(count, 'mot que tu as fait entrer au dictionnaire', 'mots que tu as fait entrer au dictionnaire')}`,
    proposals: 'Mots proposés',
    proposalsLead: 'Tu les as proposés pendant cette partie : tant qu’ils attendent, tu peux corriger leur orthographe ou retirer la demande.',
    keepTitle: 'Garde cette partie',
    keepLead: 'Crée un compte ou connecte-toi : cette partie et toute ta progression y entrent tout de suite.',
    /** Around the account name, which is set in bold. */
    savedTo: ['Partie enregistrée sur le compte ', ''] as readonly [string, string],
    replay: 'Rejouer',
    home: 'Accueil',
    level: (level: number) => `Niveau ${level}`,
    towards: (into: number, span: number, next: number) => `${into} / ${span} XP vers le niveau ${next}`,
    recordBonus: (xp: number) => `dont +${xp} XP pour ton record`,
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
    hello:
      'Coucou, moi c’est Jérémy !\nJe suis un développeur français indépendant et je crée Lettre Minute sur mon temps libre.\nSi le jeu t’a plu, ton soutien m’aiderait énormément, même 1 € compte.\nMerci du fond du cœur !',
    photo: 'Jérémy, le créateur du jeu',
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
    more: (count: number) => `Voir le classement complet (${count})`,
    less: 'Voir moins',
    all: 'Tous les classements',
    plus: 'Plus…',
  },

  leaderboards: {
    periods: { day: 'Jour', week: 'Semaine', all: 'Total' },
    stats: {
      best: { label: 'Meilleure partie', caption: 'Le plus gros score en une partie', unit: () => 'pts' },
      points: { label: 'Points', caption: 'Tous les points marqués, partie après partie', unit: () => 'pts' },
      runs: { label: 'Parties', caption: 'Le nombre de parties jouées', unit: (count: number) => plural(count, 'partie', 'parties') },
      words: { label: 'Mots trouvés', caption: 'Tous les mots justes, partie après partie', unit: (count: number) => plural(count, 'mot', 'mots') },
      discoveries: { label: 'Découvertes', caption: 'Mots que personne n’avait écrits depuis une semaine', unit: (count: number) => plural(count, 'mot', 'mots') },
      combo: { label: 'Série', caption: 'La plus longue série de mots d’affilée', unit: (count: number) => plural(count, 'mot', 'mots') },
      added: { label: 'Mots ajoutés', caption: 'Mots proposés, puis validés par les modérateurs', unit: (count: number) => plural(count, 'mot', 'mots') },
    } satisfies Record<StatId, LeaderboardText> as Record<StatId, LeaderboardText>,
    empty: { day: 'Personne n’y figure encore aujourd’hui.', week: 'Personne n’y figure encore cette semaine.', all: 'Personne n’y figure encore.' },
    offline: 'Le classement ne répond pas pour l’instant.',
    retry: 'Réessayer',
    you: 'Ta place',
    absent: 'Tu n’y figures pas encore : à toi de jouer.',
    anonymous: 'Crée un compte pour figurer aux classements.',
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
    pages: { stats: 'Statistiques', requests: 'Mes demandes', categories: 'Mes catégories', boards: 'Classements' },
    support: 'Soutenir le créateur',
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
    /** The Social tab's card: what a friend types to find you. */
    nameLabel: 'Ton nom de joueur',
    share: 'Partager',
    shareName: (name: string) => `Ajoute-moi en ami sur Lettre Minute : mon nom de joueur est ${name}.`,
    incomingCount: (count: number) => `${count} ${plural(count, 'demande', 'demandes')}`,
    wantsFriend: 'veut être ton ami',
    sortLabel: 'Trier tes amis',
    sortRecord: 'Record',
    sortAlpha: 'A–Z',
    level: (level: number) => `Niv. ${level}`,
    noRecord: 'pas encore joué',
    elsewhere: (sent: number, blocked: number) =>
      [sent > 0 && `${sent} ${plural(sent, 'demande envoyée', 'demandes envoyées')}`, blocked > 0 && `${blocked} ${plural(blocked, 'bloqué', 'bloqués')}`]
        .filter(Boolean)
        .join(' · '),
    hasGame: 'A déjà le jeu',
    noGame: 'N’a pas le jeu',
    namePlaceholder: 'Son nom de joueur',
    inviteLead: 'Envoie-lui le lien du jeu, ou une invitation par e-mail : s’il crée son compte avec cette adresse, vous serez amis tout de suite.',
    /** What a chat app receives: the invitation page names who sent it. */
    inviteText: (link: string) => `Viens jouer à Lettre Minute avec moi ! ${link}`,
    otherApps: 'Autre…',
    discordCopied: 'Lien copié : colle-le dans Discord.',
    byEmail: 'Par e-mail',
    emailPlaceholder: 'Son adresse e-mail',
    testerInvites: {
      sent: (email: string) => `${email} reçoit ton invitation. S’il crée son compte avec cette adresse, vous serez amis.`,
      already: (email: string) => `${email} a déjà été invité.`,
      invalid: () => 'Cette adresse e-mail ne semble pas valide.',
      limit: () => 'Cinq invitations par jour au plus : réessaie demain.',
      anonymous: () => 'Crée un compte pour inviter tes amis.',
      unreachable: () => 'Le serveur ne répond pas. Réessaie dans un instant.',
    } satisfies Record<TesterInviteOutcome, (email: string) => string> as Record<TesterInviteOutcome, (email: string) => string>,
    copied: 'Copié : colle-le dans un message.',
    shareFailed: 'Le partage n’a pas marché. Réessaie.',
    sendInvite: 'Envoyer l’invitation',
    send: 'Envoyer la demande',
    loadFailed: 'Impossible de charger tes amis pour l’instant.',
    incoming: 'Demandes reçues',
    accept: 'Accepter',
    decline: 'Refuser',
    friends: 'Mes amis',
    none: 'Pas encore d’amis. Ajoute-les par leur nom de joueur, ou invite-les.',
    outgoing: 'En attente de réponse',
    stats: (level: number, week: string, record: string) => `Niv. ${level} · semaine ${week} · record ${record}`,
    remove: 'Retirer',
    keep: 'Garder',
    moderator: 'modérateur',
    moderatorShort: 'M',
    shareNews: {
      title: 'Invite tes amis',
      lead: 'Il est maintenant possible de partager le jeu avec tes amis : soutiens-nous et invite des amis (uniquement sur mobile Android).',
      later: 'Plus tard',
      ok: 'Okay !',
    },
    elect: 'Élire modérateur',
    electLabel: (name: string) => `Proposer à ${name} de devenir modérateur`,
    invites: {
      sent: (name: string) => `${name} reçoit ta proposition de devenir modérateur.`,
      already: (name: string) => `${name} est déjà modérateur, ou a déjà reçu la proposition.`,
      'not-friend': (name: string) => `${name} doit être ton ami, avec un compte nommé.`,
      forbidden: () => 'Seul un modérateur peut en élire un autre.',
      unreachable: () => 'Le serveur ne répond pas. Réessaie dans un instant.',
    } satisfies Record<InviteOutcome, (name: string) => string> as Record<InviteOutcome, (name: string) => string>,
    blocked: 'Bloqués',
    unblock: 'Débloquer',
    openFriend: (name: string) => `Voir la fiche de ${name}`,
    faceOff: 'Face à face',
    won: (count: number) => plural(count, 'victoire', 'victoires'),
    tied: (count: number) => plural(count, 'égalité', 'égalités'),
    lost: (count: number) => plural(count, 'défaite', 'défaites'),
    myPoints: 'tes points',
    theirPoints: 'ses points',
    together: 'Défis ensemble',
    togetherNone: 'Pas encore de défi ensemble.',
    settling: 'Calcul du bilan…',
    historyFailed: 'Impossible de charger vos défis pour l’instant.',
    players: (count: number) => `${count} ${plural(count, 'joueur', 'joueurs')}`,
    outcomes: { won: 'Gagné', lost: 'Perdu', tie: 'Égalité', open: 'En cours', void: 'Non compté' } satisfies Record<FaceOff, string> as Record<FaceOff, string>,
    rank: (rank: number) => (rank === 1 ? '1er' : `${rank}e`),
    you: 'Toi',
    notPlayed: (name: string) => `${name} n’a pas joué`,
    youNotPlayed: 'Tu n’as pas joué',
    challengeFriend: 'Lancer un défi',
    removeNamed: (name: string) => `Retirer ${name}`,
  },

  stats: {
    empty: 'Joue une partie : tes statistiques commencent ici.',
    partial: 'Le détail ne remonte pas à toutes tes parties.',
    average: 'moyenne récente',
    best: 'record',
    trend: 'vs les 10 d’avant',
    recent: 'Parties récentes',
    hideHistory: 'Replier l’historique',
    more: 'Voir plus',
    oldChallenges: (count: number) => `Anciens défis (${count})`,
    wonBy: (name: string) => `${name} a gagné`,
    youWon: 'Tu as gagné',
    noWinner: 'Personne n’a joué',
    runLine: (words: number, combo: number) => `${words} ${plural(words, 'mot', 'mots')} · série de ${combo}`,
    topWords: 'Mots les plus dits',
    times: (count: number) => `${count} fois`,
    byCategory: 'Par catégorie',
    categoryLine: (runs: number, words: number) =>
      `${runs} ${plural(runs, 'partie', 'parties')} · ${words} ${plural(words, 'mot', 'mots')}`,
    perWord: (points: string) => `${points} pts/mot`,
    secondsPerWord: (seconds: string) => `${seconds} s/mot`,
    passRate: (percent: string) => `${percent} % passés`,
    bestWord: (word: string, points: number) => `Meilleur mot : ${word} · ${points} pts`,
    recapWords: 'Mots dits',
    points: 'pts',
  },

  requests: {
    exists: 'Déjà existant !',
    newsTitle: (count: number) => (count === 1 ? 'Ton mot est entré au dictionnaire !' : `${count} de tes mots sont entrés au dictionnaire !`),
    newsLead: 'Merci ! Tout le monde peut désormais les jouer.',
    newsOk: 'Super !',
    newsOpen: 'Mes demandes',
    offline: 'Sans serveur, tes propositions attendent sur cet appareil.',
    loadFailed: 'Impossible de charger tes demandes pour l’instant.',
    empty: 'Aucune demande pour l’instant. En partie, un mot inconnu du dictionnaire se propose d’une touche.',
    added: 'Ajoutés grâce à toi',
    addedNote: (xp: number) => `${xp} XP gagnés pour chacun.`,
    noneAdded: 'Aucun encore : un mot entre quand trois modérateurs l’ont validé.',
    /** « Ajoutés grâce à toi » se replie sur ses dix derniers. */
    more: (count: number) => `Voir plus (${count})`,
    less: 'Voir moins',
    fresh: 'nouveau',
    locked: 'en cours de modération',
    pending: 'En attente',
    mine: 'ton mot',
    entered: 'entré au dictionnaire',
    queued: 'pas encore envoyé',
    rejected: (count: number) => `Refusées (${count})`,
    correct: 'Corriger',
    correctLabel: (word: string) => `Corriger « ${word} »`,
    sameLetter: (letter: string) => `Le mot doit toujours commencer par ${letter}.`,
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
      proposedByFriends: (names: readonly string[], others: number) =>
        `proposé par ${names.join(', ')}${others > 0 ? ` et ${others} ${others > 1 ? 'autres' : 'autre'}` : ''}`,
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
    sound: 'Son',
    sounds: { master: 'Général', effects: 'Effets', keys: 'Clavier', music: 'Musique' },
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
    notifications: 'Notifications',
    push: {
      on: 'Activées : tu es prévenu quand un ami te défie et quand le bilan d’un défi est prêt.',
      off: 'Désactivées : tu ne sauras qu’un ami te défie qu’en ouvrant le jeu.',
      ask: 'Pas encore autorisées : active-les pour être prévenu quand un ami te défie.',
    } satisfies Record<PushState, string> as Record<PushState, string>,
    pushAllow: 'Activer les notifications',
    pushSettings: 'Ouvrir les réglages du téléphone',
    pushAccount: 'Crée un compte pour être prévenu quand un ami te défie.',
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
    earnedHint: (item: string, how: string) => `${item} · gagné avec : ${how}`,
    idle: 'Touche une case pour savoir comment elle se gagne.',
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
        case 'wordsAdded':
          return `${milestone.at} ${plural(milestone.at, 'mot ajouté', 'mots ajoutés')}`
      }
    },
  },

  powers: {
    castChatter: 'Bavardage ! La lettre reste',
doubleSkipFree: 'Passe-passe · passage gratuit',
    chatterLeft: (left: number) => `Bavardage · encore ${left} ${plural(left, 'mot', 'mots')}`,
    chatterLeave: 'Changer',
    giftTitle: 'Nouveau pouvoir !',
    giftLead: 'Trois de tes mots sont entrés au dictionnaire : ce pouvoir est pour toi.',
    giftOk: 'Merci !',
    /** Name and what the power does, by `PowerId`. */
    names: {
      permutation: ['Échange', 'Au lancement, touche un thème pour l’échanger contre un de ta réserve. Deux fois.'],
      joker: ['Tricherie', 'Une fois par partie, écris « Joker » et valide : le jeu écrit un mot juste à ta place.'],
      dodge: ['Esquive', 'Passer ne coûte que 3 secondes au lieu de 5.'],
      magic: ['Magie', 'Deux fois par partie, touche la lettre proposée pour en tirer une autre.'],
      hush: ['Silence', 'Une fois par partie, écris « chut » : le chrono s’arrête jusqu’à ton prochain mot, dix secondes au plus.'],
      dyslexia: ['Dyslexie', 'Deux fautes passent sur les mots de six lettres et plus.'],
      divination: ['Divination', 'Tu vois la catégorie et la lettre qui viennent ensuite.'],
      complication: ['Challenge', 'Les mots peu communs valent ×1,15, les rares ×1,3.'],
      celerity: ['Célérité', 'Un mot se valide tout seul, sans appuyer sur Entrée, même avec une faute de frappe.'],
      chatter: ['Bavardage', 'Une fois par partie, ajoute « ... » à un mot : la lettre et le thème restent pour trois mots de plus.'],
latecomer: ['Retardataire', 'Valide un mot dans les 5 dernières secondes : +1 seconde, jusqu’à 5 secondes gagnées par partie.'],
'double-skip': ['Passe-passe', 'Une fois par partie, après un passage, passe immédiatement au thème suivant sans coût.'],

flawless: ['Sans faute', 'Tous les trois mots valides écrits sans faute de frappe, gagne immédiatement 10 points bonus.'],

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
      laterHint: 'Tu pourras aussi le lancer plus tard depuis « Défis entre amis », sous « Jouer ».',
    },
    overPop: {
      title: 'Défi terminé !',
      lead: (name: string) => `Tout le monde a joué au défi de ${name} : le bilan t’attend.`,
      later: 'Plus tard',
      open: 'Voir le bilan',
    },
    powersTitle: 'Tes pouvoirs pour ce défi',
    powersLead: (max: number) =>
      `Choisis-en ${max}. Échange reste au vestiaire : tout le monde joue les mêmes thèmes.`,
    powersStart: 'Lancer la partie',
    race: 'La course',
    you: 'Toi',
    sending: 'Envoi de ta partie…',
    pushFailed: 'Ta partie n’a pas pu rejoindre le défi.',
    provisional: 'Classement provisoire',
    final: 'Classement final',
    rules: 'Un mot que personne d’autre n’a trouvé rapporte 25 % de plus.',
    share: 'Partager',
    soon: 'bientôt',
    drumroll: 'Et la victoire revient à…',
    waitingFor: (count: number, hours: number) =>
      `${count} ${plural(count, 'joueur n’a', 'joueurs n’ont')} pas encore joué · clôture dans ${hours} h au plus`,
    notYet: 'pas encore joué',
    raw: (points: string) => `${points} avant bonus`,
    bonus: (percent: number) => `+${percent} %`,
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
    ignore: 'Ignorer',
    raceTitle: 'La course',
    raceHint: 'Glisse le doigt sur la courbe',
    raceAt: (second: number) => `à ${second} s`,
    reactLabel: 'Réagir',
    reactHint: 'Touche un trophée ou un mot pour réagir.',
    moreStats: 'Plus de stats',
    lessStats: 'Moins de stats',
    setupName: 'Nom du défi',
    setupNamePlaceholder: 'Facultatif',
    setupCategories: 'Catégories',
    setupPowers: 'Pouvoirs autorisés',
    setupNoPowers: 'Tu n’as pas encore de pouvoir.',
  },

  player: {
    open: (name: string) => `Que faire avec ${name} ?`,
    befriend: 'Ajouter en ami',
    challenge: 'Lancer un défi',
    requestSent: 'Demande envoyée. En attente de sa réponse.',
    block: 'Bloquer',
    blockConfirm: 'Bloquer',
    blockWarning: (name: string) =>
      `Bloquer ${name} ? Tu ne recevras plus ses demandes d’ami ni ses défis, et votre amitié prend fin.`,
    blocked: {
      blocked: (name: string) => `${name} est bloqué.`,
      self: () => 'C’est toi !',
      unknown: (name: string) => `Aucun compte ne s’appelle ${name}.`,
      anonymous: () => 'Crée un compte pour bloquer un joueur.',
      unreachable: () => 'Serveur injoignable. Réessaie.',
    } satisfies Record<BlockOutcome, (name: string) => string>,
    close: 'Fermer',
  },

  ideas: {
    open: 'Boîte à idées',
    title: 'Boîte à idées',
    lead: 'Une idée pour le jeu, une catégorie qui manque, un souci ? Le créateur lit tout.',
    placeholder: 'Ton idée…',
    send: 'Envoyer',
    sent: 'Merci ! Ton idée est partie.',
    failed: 'L’idée n’est pas partie. Vérifie ta connexion et réessaie.',
    close: 'Fermer',
  },

  pushOffer: {
    title: 'Veux-tu activer les notifications ?',
    lead: 'On ne t’enverra pas de notification, promis : c’est seulement pour les propositions de défi de tes amis !',
    no: 'Non merci',
    yes: 'Oui, activer',
  },

  namePrompt: {
    title: 'Ton nom de joueur',
    lead: 'Ton compte est prêt grâce à Play Games. Garde ce nom ou choisis-en un autre : c’est lui que le classement affiche et que tes amis cherchent.',
    later: 'Plus tard',
  },


  feedback: {
    title: 'Ton avis compte !',
    lead: 'Tu as bien joué ces dernières parties. Qu’est-ce qui te plaît, qu’est-ce qui manque, qu’est-ce qui agace ? Le créateur lit tout.',
    placeholder: 'Ce que tu en penses…',
    send: 'Envoyer',
    later: 'Plus tard',
    sent: 'Merci ! Ton avis est parti.',
    failed: 'Ton avis n’est pas parti. Vérifie ta connexion et réessaie.',
  },

  bans: {
    introTitle: 'Nouveau : bannir une catégorie',
    introLead: 'Tu as sept catégories. Il y en a une qui t’ennuie ? Bannis-la : elle ne sortira plus dans tes parties. Tu peux changer d’avis quand tu veux, ici même.',
    introOk: 'Compris',
    lead: 'Une catégorie bannie ne sort plus dans tes parties (les défis gardent les leurs). Glisse-la pour la bannir ou la rétablir.',
    ban: 'Bannir',
    unban: 'Rétablir',
    banned: 'Bannie',
    floor: 'Il faut garder au moins six catégories en jeu.',
    max: 'Cinq catégories bannies au plus.',
  },

  plus: {
    title: 'Réservé aux membres Premium',
    ban: 'Bannir plus d’une catégorie est réservé aux membres Premium.',
    peek: 'Révéler plus de mots est réservé aux membres Premium.',
    join: 'Passer Premium pour 0 €',
    free: '(pour l’instant c’est gratuit !)',
    later: 'Plus tard',
    badge: 'Premium',
  },

  peek: {
    title: 'Ce que tu aurais pu écrire',
    reveal: (category: string, letter: string) => `Révéler un mot en ${letter} : ${category}`,
  },

  checkout: {
    title: 'Paiement sécurisé',
    plan: 'Premium',
    perkBans: 'Bannir autant de catégories que tu veux',
    perkPeeks: 'Révéler tous les mots cachés',
    perkCategories: 'Des catégories exclusives',
    perkEvents: 'Des modes de jeu événements',
    price: '0,00 €',
    period: 'sans engagement',
    total: 'Total',
    pay: 'Payer 0,00 €',
    paying: 'Paiement en cours…',
    done: 'Bienvenue en Premium !',
    note: 'Aucune carte demandée : pour l’instant, c’est gratuit.',
    cancel: 'Annuler',
  },

  premiumThanks: {
    title: 'Merci de t’être abonné Premium !',
    lead: 'Pour l’instant c’est gratuit… En échange, est-ce que tu veux bien me donner ton avis sur cette version du jeu ?',
    yes: 'Avec plaisir',
    later: 'Plus tard',
  },

  update: {
    title: 'Nouvelle version',
    lead: 'Une version plus récente de Lettre Minute t’attend sur le Play Store.',
    later: 'Plus tard',
    go: 'Mettre à jour',
  },

  tiers: {
    courant: 'courant',
    'peu commun': 'peu commun',
    rare: 'rare',
    'très rare': 'très rare',
  } satisfies Record<RarityTier, string> as Record<RarityTier, string>,

  /** By category id. French reads the catalogue itself, which stays the source of truth. */
  categories: Object.fromEntries(announcedCategories().map((category) => [category.id, [category.label, category.hint]])) as Record<
    string,
    readonly [label: string, hint: string]
  >,

  /** By palette id. */
  colours: Object.fromEntries(PALETTE.map((colour) => [colour.id, colour.label])) as Record<string, string>,
}

export type Messages = typeof fr
