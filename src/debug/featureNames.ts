/**
 * Toutes les fonctions que le client sait rapporter (`trackFeature`, plus les
 * parties par mode), rangées par usage et nommées en français : le tableau de
 * bord les lit sous leur libellé et dit « jamais utilisée » pour celles que le
 * relevé ne voit pas sur la période, ce qui est justement l'information. Un nom
 * de plus côté client entre ici, sinon il tombe sous « Autres ».
 *
 * La fiche d'espionnage lit la même table : les fonctions y sortaient sous leur
 * identifiant brut, « swap », « theme ».
 */
export const FEATURE_GROUPS: { title: string; items: [name: string, label: string][] }[] = [
  {
    title: 'En partie',
    items: [
      ['run_solo', 'Partie solo lancée'],
      ['run_challenge', 'Partie de défi lancée'],
      ['run_weekly', 'Partie du défi du moment lancée'],
      ['power_used', 'Pouvoir joué en partie'],
      ['swap', 'Échange de catégorie'],
      ['hidden_words_peek', 'Mots cachés révélés'],
      ['hidden_words_ad', 'Mots cachés par une pub'],
    ],
  },
  {
    title: 'Progression et réglages de jeu',
    items: [
      ['category_chosen', 'Catégorie choisie'],
      ['power_chosen', 'Pouvoir choisi'],
      ['bonus_chosen', 'Bonus choisi'],
      ['power_equipped', 'Pouvoirs portés changés'],
      ['category_ban', 'Catégorie bannie'],
      ['category_unban', 'Catégorie rétablie'],
      ['avatar_saved', 'Avatar changé'],
      ['avatar_keep_asked', 'Avatar gardé ou non, à la question'],
    ],
  },
  {
    title: 'Amis et invitations',
    items: [
      ['friend_request', 'Demande d’ami envoyée'],
      ['friend_accept', 'Demande d’ami acceptée'],
      ['friend_decline', 'Demande d’ami refusée'],
      ['friend_opened', 'Page d’un ami ouverte'],
      ['friend_remove', 'Ami retiré'],
      ['friend_block', 'Joueur bloqué'],
      ['friend_unblock', 'Joueur débloqué'],
      ['invite_shared', 'Invitation partagée (lien)'],
      ['invite_mail', 'Invitation envoyée par e-mail'],
      ['invite_accepted', 'Invitation d’un ami acceptée'],
      ['reaction', 'Réaction donnée'],
    ],
  },
  {
    title: 'Défis, défi du moment et duel',
    items: [
      ['challenge_created', 'Défi créé'],
      ['challenge_rematch', 'Revanche'],
      ['weekly_attempt', 'Tentative du défi du moment'],
      ['duel_created', 'Table de duel ouverte'],
      ['duel_matched', 'Duel apparié (file)'],
      ['duel_joined', 'Duel rejoint (invitation)'],
    ],
  },
  {
    title: 'Modération',
    items: [
      ['moderation_session', 'Session de modération menée au bout'],
      ['moderation_vote', 'Vote de modération'],
      ['word_proposed', 'Mot proposé'],
    ],
  },
  {
    title: 'Options et système',
    items: [
      ['theme', 'Thème changé'],
      ['language', 'Langue choisie'],
      ['sound_changed', 'Son réglé'],
      ['push_accepted', 'Notifications acceptées'],
      ['store_update', 'Mise à jour Play'],
    ],
  },
  {
    title: 'Premium et pubs',
    items: [
      ['premium_opened', 'Offre Premium ouverte'],
      ['premium_joined', 'Premium activé'],
      ['ad', 'Pub ouverte'],
    ],
  },
]

/** The labels the dashboard and the spy profile read a feature's name with. */
export const FEATURES: Record<string, string> = Object.fromEntries(FEATURE_GROUPS.flatMap((group) => group.items))
