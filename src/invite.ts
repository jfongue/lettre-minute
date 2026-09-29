import '@fontsource-variable/jost/index.css'

/**
 * The page a shared link or the invitation mail opens (invite.html), outside
 * the game: it says who invites and how to get the game. Android is a closed
 * test on Play, open to whoever joins its public Google group
 * (VITE_TESTER_GROUP_URL); until that group exists, the page only offers the
 * web version, since the Play links answer « application unavailable » to
 * anyone who is not a tester.
 */

interface PageText {
  appName: string
  lead: readonly [string, string]
  leadAnonymous: string
  category: string
  words: readonly [string, string, string]
  play: string
  android: string
  join: string
  tester: string
  install: string
  elsewhere: string
  addFriend(inviter: string): string
}

const TEXTS: Record<string, PageText> = {
  fr: {
    appName: 'Lettre Minute',
    lead: ['', ' t’invite à jouer.'],
    leadAnonymous: 'Viens jouer à Lettre Minute.',
    category: 'Animaux',
    words: ['Baleine', 'Blaireau', 'Bison'],
    play: 'Jouer maintenant',
    android: 'Sur Android',
    join: 'Rejoindre les testeurs',
    tester: 'Devenir testeur',
    install: 'Installer le jeu',
    elsewhere: 'Pas sur Android ? Joue dans ton navigateur :',
    addFriend: (inviter) => `Dans le jeu, ajoute ${inviter} en ami : Social → Ajouter un ami.`,
  },
  en: {
    appName: 'Letter Minute',
    lead: ['', ' invites you to play.'],
    leadAnonymous: 'Come play Letter Minute.',
    category: 'Animals',
    words: ['Bear', 'Beaver', 'Bison'],
    play: 'Play now',
    android: 'On Android',
    join: 'Join the testers',
    tester: 'Become a tester',
    install: 'Install the game',
    elsewhere: 'Not on Android? Play in your browser:',
    addFriend: (inviter) => `In the game, add ${inviter} as a friend: Friends → Add a friend.`,
  },
  de: {
    appName: 'Letter Minute',
    lead: ['', ' lädt dich zum Spielen ein.'],
    leadAnonymous: 'Spiel Letter Minute.',
    category: 'Tiere',
    words: ['Bär', 'Biber', 'Bison'],
    play: 'Jetzt spielen',
    android: 'Auf Android',
    join: 'Testergruppe beitreten',
    tester: 'Tester werden',
    install: 'Spiel installieren',
    elsewhere: 'Kein Android? Spiel im Browser:',
    addFriend: (inviter) => `Im Spiel fügst du ${inviter} als Freund hinzu: Freunde → Freund hinzufügen.`,
  },
  es: {
    appName: 'Letra Minuto',
    lead: ['', ' te invita a jugar.'],
    leadAnonymous: 'Ven a jugar a Letra Minuto.',
    category: 'Animales',
    words: ['Ballena', 'Búho', 'Burro'],
    play: 'Jugar ahora',
    android: 'En Android',
    join: 'Unirme a los testers',
    tester: 'Hacerme tester',
    install: 'Instalar el juego',
    elsewhere: '¿No tienes Android? Juega en el navegador:',
    addFriend: (inviter) => `En el juego, añade a ${inviter} como amigo: Amigos → Añadir un amigo.`,
  },
  it: {
    appName: 'Lettera Minuto',
    lead: ['', ' ti invita a giocare.'],
    leadAnonymous: 'Vieni a giocare a Lettera Minuto.',
    category: 'Animali',
    words: ['Balena', 'Bruco', 'Bisonte'],
    play: 'Gioca ora',
    android: 'Su Android',
    join: 'Entra tra i tester',
    tester: 'Diventa tester',
    install: 'Installa il gioco',
    elsewhere: 'Non hai Android? Gioca nel browser:',
    addFriend: (inviter) => `Nel gioco, aggiungi ${inviter} come amico: Amici → Aggiungi un amico.`,
  },
  nl: {
    appName: 'Letter Minuut',
    lead: ['', ' nodigt je uit om te spelen.'],
    leadAnonymous: 'Kom Letter Minuut spelen.',
    category: 'Dieren',
    words: ['Beer', 'Bever', 'Bizon'],
    play: 'Nu spelen',
    android: 'Op Android',
    join: 'Word lid van de testers',
    tester: 'Word tester',
    install: 'Spel installeren',
    elsewhere: 'Geen Android? Speel in je browser:',
    addFriend: (inviter) => `Voeg ${inviter} in het spel toe als vriend: Vrienden → Vriend toevoegen.`,
  },
  pt: {
    appName: 'Letra Minuto',
    lead: ['', ' convida você para jogar.'],
    leadAnonymous: 'Venha jogar Letra Minuto.',
    category: 'Animais',
    words: ['Baleia', 'Búfalo', 'Burro'],
    play: 'Jogar agora',
    android: 'No Android',
    join: 'Entrar nos testadores',
    tester: 'Virar testador',
    install: 'Instalar o jogo',
    elsewhere: 'Não usa Android? Jogue no navegador:',
    addFriend: (inviter) => `No jogo, adicione ${inviter} como amigo: Amigos → Adicionar um amigo.`,
  },
}

const TESTING_URL = 'https://play.google.com/apps/testing/fr.lettreminute.app'
const STORE_URL = 'https://play.google.com/store/apps/details?id=fr.lettreminute.app'
const GAME_URL = './'

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const lang = navigator.languages.map((tag) => tag.slice(0, 2)).find((tag) => tag in TEXTS) ?? 'fr'
const t = TEXTS[lang]!
// A name typed by the inviter, shown back to a stranger: short, and escaped.
const inviter = (new URLSearchParams(location.search).get('from') ?? '').trim().slice(0, 24)
const group = import.meta.env.VITE_TESTER_GROUP_URL || null
const android = /android/i.test(navigator.userAgent)

const button = (href: string, label: string, main = false) =>
  `<a class="btn${main ? ' btn--main' : ''}" href="${href}">${escapeHtml(label)}</a>`

const androidSteps = group
  ? `<section class="steps">
      <p class="label">${escapeHtml(t.android)}</p>
      ${button(group, t.join, android)}
      ${button(TESTING_URL, t.tester)}
      ${button(STORE_URL, t.install)}
    </section>`
  : ''

document.documentElement.lang = lang
document.title = inviter ? `${inviter}${t.lead[1]} · ${t.appName}` : t.appName
document.getElementById('invite')!.innerHTML = `
  <p class="brand">${escapeHtml(t.appName)}</p>
  <h1>${inviter ? `${escapeHtml(t.lead[0])}<span>${escapeHtml(inviter)}</span>${escapeHtml(t.lead[1])}` : escapeHtml(t.leadAnonymous)}</h1>
  <div class="round" aria-hidden="true">
    <span class="letter">B</span>
    <span><b>${escapeHtml(t.category)}</b><small>${t.words.map(escapeHtml).join(' · ')}</small></span>
    <span class="clock">0:42</span>
  </div>
  ${
    android && group
      ? `${androidSteps}<p class="other">${escapeHtml(t.elsewhere)} <a href="${GAME_URL}">${escapeHtml(t.play)}</a></p>`
      : `${button(GAME_URL, t.play, true)}${androidSteps}`
  }
  ${inviter ? `<p class="note">${escapeHtml(t.addFriend(inviter))}</p>` : ''}
`
