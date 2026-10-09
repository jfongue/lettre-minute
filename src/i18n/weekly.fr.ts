import type { WeeklyTrophyId } from '../domain/weekly'

const plural = (count: number, one: string, many: string) => (count > 1 ? many : one)
const seconds = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })

/** A weekly trophy's name, and its line from the value that won it, the word when one did, and the unit of the ranking. */
type Trophy = readonly [name: string, line: (value: number, word: string, unit: string) => string]

/**
 * Le défi du moment : la même partie pour tous, une semaine durant. Écrit à
 * part de `fr.ts` — qui le reprend sous `weekly` — pour que ses sept langues
 * tiennent dans un seul chantier.
 */
export const weeklyFr = {
  title: 'Défi du moment',
  /** Le temps qui reste avant dimanche 21 h : les jours, les heures, les minutes. */
  duration: (days: number, hours: number, minutes: number) =>
    days > 0 ? `${days} j ${hours} h` : hours > 0 ? `${hours} h ${minutes} min` : `${Math.max(1, minutes)} min`,
  ends: (left: string) => `Fin dans ${left}`,
  closed: 'Ce défi est clos',
  unitSeconds: 's',
  unitPoints: 'points',
  survival: 'Temps de survie',
  you: 'toi',
  card: {
    play: 'Jouer',
    attempts: (left: number) => (left > 0 ? `${left} ${plural(left, 'tentative', 'tentatives')} aujourd’hui` : 'Plus de tentative aujourd’hui'),
    attemptLabel: (state: 'used' | 'free' | 'locked'): string =>
      state === 'used' ? 'Tentative utilisée' : state === 'free' ? 'Tentative disponible' : 'Tentative verrouillée',
  },
  rules: {
    solo: 'La partie du jour, la même pour tous.',
    endurance: 'Trente secondes au départ, chaque mot te rend du temps. Tiens le plus longtemps possible.',
    delayed: 'La réponse attendue est celle de la question d’avant.',
    reversed: 'La lettre contraint la fin du mot : M accepte le Vietnam.',
  },
  screen: {
    back: 'Retour',
    best: 'Mon meilleur',
    rank: 'Mon rang',
    rankOf: (rank: number, players: number) => `${rank === 1 ? '1er' : `${rank}e`} sur ${players}`,
    noBest: 'Pas encore joué',
    attempts: 'Tes tentatives',
    intro: (count: number) => `Tu as ${count} tentatives aujourd’hui`,
    introAfter: (count: number) => `${count} tentatives jouées aujourd’hui`,
    introLeft: (left: number) => `Il t’en reste ${left}`,
    allUsed: 'Tu as joué toutes tes tentatives du jour. Reviens demain, elles reviennent à minuit.',
    attempt: (n: number) => `Tentative ${n}`,
    slot: {
      used: 'Jouée',
      free: 'Disponible',
      ad: 'Avec une pub',
      plus: 'Avec Premium',
      locked: 'Premium',
    },
    launch: (n: number) => `Lancer la tentative ${n}`,
    confirmTitle: (n: number) => `Lancer la tentative ${n} ?`,
    confirmBody: 'Une tentative sera utilisée, même si tu quittes en cours de route.',
    confirmGo: 'C’est parti',
    confirmCancel: 'Annuler',
    watchAd: 'Regarder une pub pour une tentative de plus',
    adBusy: 'La pub arrive…',
    adFailed: 'Pas de pub pour l’instant, réessaie dans un instant.',
    goPremium: 'Passer Premium : 5 tentatives par jour',
    tutorial: 'Revoir le tutoriel',
    results: 'Classement de la semaine',
    refused: 'Plus de tentative disponible pour aujourd’hui.',
    offline: 'Hors ligne : tes tentatives sont comptées sur cet appareil.',
    loading: 'Le défi arrive…',
    ready: 'Prêt ?',
    lineup: 'Au programme',
  },
  intro: {
    kicker: 'Ce défi',
    next: 'J’ai compris',
    try: 'Essayer d’abord',
    skip: 'Passer',
    endurance: {
      steps: [
        ['30 s', 'Tu pars avec trente secondes au chrono.'],
        ['+2 à 4 s', 'Chaque mot valide te rend du temps : plus il est rare, plus il t’en rend.'],
        ['Tant que ça tient', 'La partie dure tant que le chrono n’est pas à zéro.'],
      ],
      table: 'Ce que rend un mot',
      score: 'Ton score est ton temps de survie : le classement le mesure en secondes.',
    },
    delayed: {
      steps: [
        ['A puis B', 'Tu vois une question, tu la valides à vide : le chrono part.'],
        ['À retardement', 'À chaque question, tu réponds à celle d’avant.'],
        ['Soixante secondes', 'Revoir la question à remplir coûte trois secondes.'],
      ],
      score: 'Ton score se compte en points, comme un solo.',
    },
    reversed: {
      steps: [
        ['À l’envers', 'La lettre contraint la fin du mot, pas son début.'],
        ['M, Vietnam', 'Pour un M, un mot qui finit par M convient.'],
        ['Soixante secondes', 'Le reste est une partie comme les autres.'],
      ],
      score: 'Ton score se compte en points, comme un solo.',
    },
  },
  run: {
    survival: 'Survie',
    bonus: (value: number) => `+${seconds(value)} s`,
  },
  done: {
    record: 'Nouveau record !',
    noRecord: 'Pas de record cette fois',
    yours: 'Cette tentative',
    best: 'Ton record',
    rank: 'Rang provisoire',
    left: (left: number) => (left > 0 ? `${left} ${plural(left, 'tentative restante', 'tentatives restantes')} aujourd’hui` : 'Plus de tentative aujourd’hui'),
    again: 'Retour au défi',
    saving: 'Envoi de ta tentative…',
    notSent: 'Ta tentative n’a pas pu être envoyée. Elle ne comptera pas au classement.',
    words: (count: number) => `${count} ${plural(count, 'mot', 'mots')}`,
  },
  results: {
    title: 'Classement',
    provisional: 'Provisoire : la semaine continue',
    final: 'Résultat final',
    podium: 'Le podium',
    mine: 'Ma place',
    board: 'Tous les joueurs',
    trophies: 'Les trophées de la semaine',
    trophiesHint: 'Un trophée par joueur, jamais deux. Touche pour réagir.',
    noTrophies: 'Les trophées se décident quand assez de joueurs ont joué.',
    empty: 'Personne n’a encore joué cette semaine : à toi l’honneur.',
    loadFailed: 'Impossible de charger le classement pour l’instant.',
    retry: 'Réessayer',
    attempts: (count: number) => `${count} ${plural(count, 'tentative', 'tentatives')}`,
    players: (count: number) => `${count} ${plural(count, 'joueur', 'joueurs')}`,
    more: 'Voir plus de joueurs',
    react: 'Réagir',
    reactOnly: 'Seuls ceux qui ont joué cette semaine réagissent.',
    back: 'Retour',
    play: 'Jouer',
  },
  trophy: {
    'weekly-rarest': ['Le dénicheur', (_: number, word: string) => `« ${word} », le mot le plus rare de la semaine`],
    'weekly-original': ['L’original', (value: number) => `${value} ${plural(value, 'mot que personne d’autre n’a écrit', 'mots que personne d’autre n’a écrits')}`],
    'weekly-climber': ['Le grimpeur', (value: number, _: string, unit: string) => `+${seconds(value)} ${unit} entre sa première tentative et sa meilleure`],
    'weekly-streak': ['L’enchaîneur', (value: number) => `une série de ${value} mots`],
    'weekly-fastest': ['L’éclair', (value: number, word: string) => `« ${word} » en ${seconds(value)} s`],
    'weekly-persistent': ['Le têtu', (value: number) => `${value} tentatives en une semaine`],
    'weekly-longest': ['Le mot-fleuve', (value: number, word: string) => `« ${word} », ${value} lettres`],
    'weekly-sheep': ['Le mouton', (value: number) => `${value} ${plural(value, 'mot', 'mots')} en commun avec la foule`],
  } satisfies Record<WeeklyTrophyId, Trophy> as Record<WeeklyTrophyId, Trophy>,
  recap: {
    kicker: 'Défi du moment',
    title: 'Le défi est clos',
    curve: 'Ton record, tentative après tentative',
    rankCurve: 'Ton rang, jour après jour',
    rankDays: ['D', 'L', 'M', 'M', 'J', 'V', 'S'] as readonly string[],
    attempt: (n: number) => `T${n}`,
    finalRank: 'Rang final',
    rankOf: (rank: number, players: number) => `${rank === 1 ? '1er' : `${rank}e`} sur ${players}`,
    best: 'Ton meilleur',
    attempts: (count: number) => `${count} ${plural(count, 'tentative', 'tentatives')}`,
    trophy: 'Ton trophée',
    newOpen: 'Le nouveau défi est ouvert',
    go: 'Voir le nouveau défi',
    results: 'Voir les résultats',
    later: 'Plus tard',
    loading: 'Le récap arrive…',
  },
}

export type WeeklyMessages = typeof weeklyFr
