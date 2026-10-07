/**
 * Les fonctionnalités paramétrables : ce que chaque public — tout le monde,
 * les modérateurs, les joueurs Premium, les super modérateurs — peut ouvrir.
 * Une case dit `on` (dispo), `off` (bloqué) ou `neutral` (ne se prononce pas).
 *
 * La règle : une seule case `on` parmi les publics d'un joueur suffit ; sinon
 * une case `off` ferme ; une ligne toute neutre pour lui retombe sur les
 * valeurs du code ci-dessous. Un super modérateur est aussi modérateur.
 *
 * Les super modérateurs règlent la table depuis le jeu (`set_feature_flag`,
 * 0045) ; chaque appareil la lit au démarrage et ne l'applique qu'au suivant,
 * pour qu'un réglage ne change jamais un écran sous les doigts d'un joueur.
 * Les identifiants sont ceux des lignes du serveur : en renommer un orpheline
 * son réglage.
 */

export type FlagValue = 'on' | 'off' | 'neutral'
export type Audience = 'everyone' | 'moderator' | 'premium' | 'superModerator'

export const AUDIENCES: readonly Audience[] = ['everyone', 'moderator', 'premium', 'superModerator']

export type FlagRow = Readonly<Record<Audience, FlagValue>>

export interface FeatureDef {
  id: string
  /** Le nom de la fonctionnalité dans le tableau des réglages, outil de développeur. */
  label: string
  /** Ce qu'elle recouvre, en une ligne. */
  note: string
  defaults: FlagRow
}

const open: FlagRow = { everyone: 'on', moderator: 'neutral', premium: 'neutral', superModerator: 'neutral' }
const moderators: FlagRow = { everyone: 'off', moderator: 'on', premium: 'neutral', superModerator: 'on' }
const supers: FlagRow = { everyone: 'off', moderator: 'off', premium: 'off', superModerator: 'on' }
const closed: FlagRow = { everyone: 'off', moderator: 'neutral', premium: 'neutral', superModerator: 'neutral' }

/** Toutes les fonctionnalités qu'un joueur peut atteindre, groupées comme dans le jeu. */
export const FEATURES: readonly FeatureDef[] = [
  // Jouer ensemble
  { id: 'challenges', label: 'Défis 24h entre amis', note: 'La liste de l’accueil, la création, l’écran et le bilan d’un défi', defaults: open },
  { id: 'duel', label: 'Duel en direct', note: 'Tables de deux à quatre, en ligne, avec les joueurs maison', defaults: { ...supers, moderator: 'neutral', premium: 'neutral' } },
  { id: 'friends', label: 'Amis', note: 'L’onglet Social, les demandes, la fiche d’un joueur', defaults: open },
  { id: 'friendInvite', label: 'Inviter un ami', note: 'Lien, e-mail, et la proposition de partager le jeu', defaults: open },
  { id: 'rivalry', label: 'Face-à-face', note: 'Victoires et défaites contre chaque ami', defaults: open },
  { id: 'reactions', label: 'Réactions', note: 'Les emojis sur les trophées et les mots d’un bilan de défi', defaults: open },
  // Progresser
  { id: 'leaderboards', label: 'Classements', note: 'La section de l’accueil et la page des classements', defaults: open },
  { id: 'stats', label: 'Statistiques', note: 'La page des statistiques et les parties passées', defaults: open },
  { id: 'powers', label: 'Pouvoirs', note: 'Leur offre après une partie, le cadeau, leurs emplacements', defaults: open },
  { id: 'categoryBans', label: 'Bannir une catégorie', note: 'Dans « Mes catégories »', defaults: open },
  { id: 'hiddenWords', label: 'Mots cachés du bilan', note: 'Les réponses que la partie aurait acceptées', defaults: open },
  { id: 'premium', label: 'Premium', note: 'Son offre et son paiement', defaults: open },
  { id: 'avatar', label: 'Avatar et couleurs', note: 'L’écran de l’avatar', defaults: open },
 { id: 'achievements', label: 'Succès', note: 'La page des succès, ses barres, et l’annonce au bilan', defaults: open },
  { id: 'tutorial', label: 'Tutoriel', note: 'La première partie guidée', defaults: open },
  { id: 'gameModes', label: 'Modes de jeu', note: 'La réserve de modes derrière « Jouer » : retard, endurance, renversé, sans pouvoir', defaults: supers },
  // Les mots
  { id: 'proposeWord', label: 'Proposer un mot', note: 'Pendant la partie, et la correction au bilan', defaults: open },
  { id: 'myRequests', label: 'Mes demandes', note: 'La page et sa tuile d’accueil', defaults: open },
  { id: 'wordsNews', label: 'Annonce des mots acceptés', note: 'La fenêtre qui dit qu’un mot est entré', defaults: open },
  { id: 'moderation', label: 'Modération', note: 'La file de mots à juger', defaults: moderators },
  { id: 'moderatorOffer', label: 'Offre de modérer', note: 'La fenêtre qui propose de devenir modérateur', defaults: open },
  { id: 'electModerator', label: 'Élire un ami modérateur', note: 'Sur la fiche d’un ami', defaults: moderators },
  { id: 'wordFlag', label: 'Signaler un mot à retirer', note: 'Appui long sur un mot du bilan', defaults: moderators },
  // Fenêtres et messages
  { id: 'ideasBox', label: 'Boîte à idées', note: 'Au pied de « Mes demandes »', defaults: open },
  { id: 'feedback', label: 'Question d’avis', note: 'Après la dixième partie, puis toutes les trente', defaults: open },
  { id: 'support', label: 'Demande de note', note: 'Au bilan, sur un bon score', defaults: open },
  { id: 'pushOffer', label: 'Proposer les notifications', note: 'Après une nouvelle amitié, sur téléphone', defaults: open },
  { id: 'powerGift', label: 'Pouvoir offert', note: 'La fenêtre du pouvoir Complication', defaults: open },
  { id: 'storeUpdate', label: 'Annonce de mise à jour', note: 'Quand le Play Store a une version plus récente', defaults: open },
  { id: 'playGames', label: 'Play Games', note: 'Connexion discrète et succès, sur Android', defaults: open },
  { id: 'ads', label: 'Publicités', note: 'Aussi éteintes dans le code (ADS_ENABLED)', defaults: closed },
  // Outils
  { id: 'wordsBoard', label: 'Tableau des mots', note: 'Cinq tapes sur « Mes catégories »', defaults: supers },
  { id: 'dashboard', label: 'Tableau de bord', note: 'Cinq tapes sur « Classement »', defaults: supers },
  { id: 'ideasAdmin', label: 'Idées reçues', note: 'Cinq tapes sur « Boîte à idées »', defaults: supers },
  { id: 'debugBoard', label: 'Planche debug', note: 'Cinq tapes sur la tuile de l’affiche, ou #debug', defaults: supers },
]

export type FeatureId = (typeof FEATURES)[number]['id']

export interface Roles {
  moderator: boolean
  superModerator: boolean
  premium: boolean
}

export const NO_ROLES: Roles = { moderator: false, superModerator: false, premium: false }

/** Les publics d'un joueur : tout le monde, plus ses rôles. Un super modérateur est modérateur. */
export function audiencesOf(roles: Roles): readonly Audience[] {
  return AUDIENCES.filter(
    (audience) =>
      audience === 'everyone' ||
      (audience === 'moderator' && (roles.moderator || roles.superModerator)) ||
      (audience === 'premium' && roles.premium) ||
      (audience === 'superModerator' && roles.superModerator),
  )
}

function decide(row: FlagRow, audiences: readonly Audience[]): boolean | null {
  const said = audiences.map((audience) => row[audience])
  if (said.includes('on')) return true
  if (said.includes('off')) return false
  return null
}

/** Ce que la table et ses rôles ouvrent à un joueur, fonctionnalité par fonctionnalité. */
export function enabledFeatures(flags: Readonly<Record<string, FlagRow>>, roles: Roles): ReadonlySet<string> {
  const audiences = audiencesOf(roles)
  const enabled = new Set<string>()
  for (const feature of FEATURES) {
    const row = flags[feature.id] ?? feature.defaults
    if (decide(row, audiences) ?? decide(feature.defaults, audiences) ?? false) enabled.add(feature.id)
  }
  return enabled
}

/** Tout ouvert : la planche debug montre chaque écran, sans table ni rôle. */
export const ALL_FEATURES: ReadonlySet<string> = new Set(FEATURES.map((feature) => feature.id))
