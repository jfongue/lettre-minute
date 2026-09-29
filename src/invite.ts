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
  /** Around the letter, set in red: the game's own way of asking. */
  find: readonly [string, string]
  android: string
  join: string
  tester: string
  install: string
  /** A quiet line under the steps: the web version, for everyone not on Android. */
  iphone: readonly [string, string]
}

const TEXTS: Record<string, PageText> = {
  fr: {
    appName: 'Lettre Minute',
    lead: ['', ' t’invite à jouer.'],
    leadAnonymous: 'Viens jouer à Lettre Minute.',
    category: 'Couleurs',
    find: ['Trouve une couleur en ', ''],
    android: 'Sur Android',
    join: 'Rejoindre les testeurs',
    tester: 'Devenir testeur',
    install: 'Installer le jeu',
    iphone: ['Tu as un iPhone ? ', 'Clique ici'],
  },
  en: {
    appName: 'Letter Minute',
    lead: ['', ' invites you to play.'],
    leadAnonymous: 'Come play Letter Minute.',
    category: 'Colours',
    find: ['Find a colour starting with ', ''],
    android: 'On Android',
    join: 'Join the testers',
    tester: 'Become a tester',
    install: 'Install the game',
    iphone: ['Got an iPhone? ', 'Tap here'],
  },
  de: {
    appName: 'Letter Minute',
    lead: ['', ' lädt dich zum Spielen ein.'],
    leadAnonymous: 'Spiel Letter Minute.',
    category: 'Farben',
    find: ['Finde eine Farbe mit ', ''],
    android: 'Auf Android',
    join: 'Testergruppe beitreten',
    tester: 'Tester werden',
    install: 'Spiel installieren',
    iphone: ['Du hast ein iPhone? ', 'Hier tippen'],
  },
  es: {
    appName: 'Letra Minuto',
    lead: ['', ' te invita a jugar.'],
    leadAnonymous: 'Ven a jugar a Letra Minuto.',
    category: 'Colores',
    find: ['Encuentra un color con ', ''],
    android: 'En Android',
    join: 'Unirme a los testers',
    tester: 'Hacerme tester',
    install: 'Instalar el juego',
    iphone: ['¿Tienes un iPhone? ', 'Pulsa aquí'],
  },
  it: {
    appName: 'Lettera Minuto',
    lead: ['', ' ti invita a giocare.'],
    leadAnonymous: 'Vieni a giocare a Lettera Minuto.',
    category: 'Colori',
    find: ['Trova un colore con la ', ''],
    android: 'Su Android',
    join: 'Entra tra i tester',
    tester: 'Diventa tester',
    install: 'Installa il gioco',
    iphone: ['Hai un iPhone? ', 'Tocca qui'],
  },
  nl: {
    appName: 'Letter Minuut',
    lead: ['', ' nodigt je uit om te spelen.'],
    leadAnonymous: 'Kom Letter Minuut spelen.',
    category: 'Kleuren',
    find: ['Vind een kleur met een ', ''],
    android: 'Op Android',
    join: 'Word lid van de testers',
    tester: 'Word tester',
    install: 'Spel installeren',
    iphone: ['Heb je een iPhone? ', 'Tik hier'],
  },
  pt: {
    appName: 'Letra Minuto',
    lead: ['', ' convida você para jogar.'],
    leadAnonymous: 'Venha jogar Letra Minuto.',
    category: 'Cores',
    find: ['Encontra uma cor com ', ''],
    android: 'No Android',
    join: 'Entrar nos testadores',
    tester: 'Virar testador',
    install: 'Instalar o jogo',
    iphone: ['Tem um iPhone? ', 'Toque aqui'],
  },
}

const TESTING_URL = 'https://play.google.com/apps/testing/fr.lettreminute.app'
const STORE_URL = 'https://play.google.com/store/apps/details?id=fr.lettreminute.app'

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const lang = navigator.languages.map((tag) => tag.slice(0, 2)).find((tag) => tag in TEXTS) ?? 'fr'
const t = TEXTS[lang]!
const query = new URLSearchParams(location.search)
// A name typed by the inviter, shown back to a stranger: short, and escaped.
const inviter = (query.get('from') ?? '').trim().slice(0, 24)
// The inviter's code (`my_invite_code`, 0034) travels on to the game by every
// way in: Play's install referrer, the app's own link, the web version's
// address. Whichever arrives, the account made next befriends the inviter.
const ref = /^[0-9a-f]{12}$/.test(query.get('ref') ?? '') ? query.get('ref')! : null
const group = import.meta.env.VITE_TESTER_GROUP_URL || null

const gameUrl = ref ? `./?ref=${ref}` : './'
const storeUrl = ref ? `${STORE_URL}&referrer=${encodeURIComponent(`ref=${ref}`)}` : STORE_URL

// The home poster's first row, its menu tile given back its quarter disc: the
// same shapes as src/ui/paths.tsx, drawn without React.
const POSTER: readonly [shape: string, tint: string, ground: string, motion: string][] = [
  ['<path d="M0 0H100A100 100 0 0 1 0 100Z"/>', 'yellow', 'blue', 'turn'],
  ['<circle cx="50" cy="50" r="50"/>', 'red', 'paper', 'pulse'],
  ['<rect width="100" height="20"/><rect y="40" width="100" height="20"/><rect y="80" width="100" height="20"/>', 'ink', 'pink', ''],
  ['<path d="M0 100V50A50 50 0 0 1 100 50V100Z"/>', 'green', 'yellow', 'turn'],
  ['<path d="M50 0L100 100H0Z"/>', 'blue', 'paper', 'turn'],
]
const poster = POSTER.map(
  ([shape, tint, ground, motion], index) =>
    `<span class="tile" style="background:var(--${ground});--i:${index}"><span class="motion${motion ? ` motion-${motion}` : ''}"><svg viewBox="0 0 100 100" fill="currentColor" style="color:var(--${tint})">${shape}</svg></span></span>`,
).join('')

const button = (href: string, label: string, main = false) =>
  `<a class="btn${main ? ' btn--main' : ''}" href="${href}">${escapeHtml(label)}</a>`

const androidSteps = group
  ? `<section class="steps">
      <p class="label">${escapeHtml(t.android)}</p>
      ${button(group, t.join, true)}
      ${button(TESTING_URL, t.tester)}
      ${button(storeUrl, t.install)}
    </section>`
  : ''


document.documentElement.lang = lang
document.title = inviter ? `${inviter}${t.lead[1].replace(/\.$/, '')} · ${t.appName}` : t.appName
document.getElementById('invite')!.innerHTML = `
  <div class="poster" aria-hidden="true">${poster}</div>
  <p class="brand">${escapeHtml(t.appName)}</p>
  <h1>${inviter ? `${escapeHtml(t.lead[0])}<span>${escapeHtml(inviter)}</span>${escapeHtml(t.lead[1])}` : escapeHtml(t.leadAnonymous)}</h1>
  <div class="round" aria-hidden="true">
    <span class="letter">R</span>
    <span><small>${escapeHtml(t.category)}</small><b>${escapeHtml(t.find[0])}<em>R</em>${escapeHtml(t.find[1])}</b></span>
  </div>
  ${androidSteps}
  <p class="other">${escapeHtml(t.iphone[0])}<a href="${gameUrl}">${escapeHtml(t.iphone[1])}</a></p>
`
