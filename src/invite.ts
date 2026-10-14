import '@fontsource-variable/jost/index.css'

/**
 * The page a shared link or the invitation mail opens (invite.html), outside
 * the game: it says who invites and how to get the game. Android is on the
 * Play Store for everyone now, so one button leads there, straight to the
 * game's page: the testers' group and the « become a tester » step it needed
 * while the game was a closed test are gone.
 */

interface PageText {
  appName: string
  lead: readonly [string, string]
  leadAnonymous: string
  category: string
  /** Around the letter, set in red: the game's own way of asking. */
  find: readonly [string, string]
  android: string
  install: string
  /**
  * Under the step to take next, since it leaves for a page of Google's own:
  * what to do there, and to come back to this tab.
   */
   hints: { install: string }
  /** A quiet line under the steps: the web version, for everyone not on Android. */
  iphone: readonly [string, string]
  /** What the buttons leave on the clipboard, for the app to read at its first launch. */
  clip(inviter: string, code: string): string
}

const TEXTS: Record<string, PageText> = {
  fr: {
    appName: 'Lettre Minute',
    lead: ['', ' t’invite à jouer.'],
    leadAnonymous: 'Viens jouer à Lettre Minute.',
    category: 'Couleurs',
    find: ['Trouve une couleur en ', ''],
    android: 'Sur Android',
    install: 'Installer le jeu',
    hints: {
      install: 'Installe le jeu depuis le Play Store, puis ouvre-le.',
    },
    iphone: ['Tu as un iPhone ? ', 'Clique ici'],
    clip: (inviter, code) => `Invitation Lettre Minute${inviter ? ` de ${inviter}` : ''} : ${code}`,
  },
  en: {
    appName: 'Letter Minute',
    lead: ['', ' invites you to play.'],
    leadAnonymous: 'Come play Letter Minute.',
    category: 'Colours',
    find: ['Find a colour starting with ', ''],
    android: 'On Android',
    install: 'Install the game',
    hints: {
      install: 'Install the game from the Play Store, then open it.',
    },
    iphone: ['Got an iPhone? ', 'Tap here'],
    clip: (inviter, code) => `Letter Minute invitation${inviter ? ` from ${inviter}` : ''}: ${code}`,
  },
  de: {
    appName: 'Letter Minute',
    lead: ['', ' lädt dich zum Spielen ein.'],
    leadAnonymous: 'Spiel Letter Minute.',
    category: 'Farben',
    find: ['Finde eine Farbe mit ', ''],
    android: 'Auf Android',
    install: 'Spiel installieren',
    hints: {
      install: 'Installiere das Spiel aus dem Play Store und öffne es.',
    },
    iphone: ['Du hast ein iPhone? ', 'Hier tippen'],
    clip: (inviter, code) => `Letter-Minute-Einladung${inviter ? ` von ${inviter}` : ''}: ${code}`,
  },
  es: {
    appName: 'Letra Minuto',
    lead: ['', ' te invita a jugar.'],
    leadAnonymous: 'Ven a jugar a Letra Minuto.',
    category: 'Colores',
    find: ['Encuentra un color con ', ''],
    android: 'En Android',
    install: 'Instalar el juego',
    hints: {
      install: 'Instala el juego desde Play Store y ábrelo.',
    },
    iphone: ['¿Tienes un iPhone? ', 'Pulsa aquí'],
    clip: (inviter, code) => `Invitación a Letra Minuto${inviter ? ` de ${inviter}` : ''}: ${code}`,
  },
  it: {
    appName: 'Lettera Minuto',
    lead: ['', ' ti invita a giocare.'],
    leadAnonymous: 'Vieni a giocare a Lettera Minuto.',
    category: 'Colori',
    find: ['Trova un colore con la ', ''],
    android: 'Su Android',
    install: 'Installa il gioco',
    hints: {
      install: 'Installa il gioco dal Play Store, poi aprilo.',
    },
    iphone: ['Hai un iPhone? ', 'Tocca qui'],
    clip: (inviter, code) => `Invito a Lettera Minuto${inviter ? ` di ${inviter}` : ''}: ${code}`,
  },
  nl: {
    appName: 'Letter Minuut',
    lead: ['', ' nodigt je uit om te spelen.'],
    leadAnonymous: 'Kom Letter Minuut spelen.',
    category: 'Kleuren',
    find: ['Vind een kleur met een ', ''],
    android: 'Op Android',
    install: 'Spel installeren',
    hints: {
      install: 'Installeer het spel via de Play Store en open het.',
    },
    iphone: ['Heb je een iPhone? ', 'Tik hier'],
    clip: (inviter, code) => `Uitnodiging voor Letter Minuut${inviter ? ` van ${inviter}` : ''}: ${code}`,
  },
  pt: {
    appName: 'Letra Minuto',
    lead: ['', ' convida você para jogar.'],
    leadAnonymous: 'Venha jogar Letra Minuto.',
    category: 'Cores',
    find: ['Encontra uma cor com ', ''],
    android: 'No Android',
    install: 'Instalar o jogo',
    hints: {
      install: 'Instale o jogo pela Play Store e abra.',
    },
    iphone: ['Tem um iPhone? ', 'Toque aqui'],
    clip: (inviter, code) => `Convite para Letra Minuto${inviter ? ` de ${inviter}` : ''}: ${code}`,
  },
}

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
// way in: Play's install referrer, the web version's address, the clipboard.
// Whichever arrives, the account made next befriends the inviter.
const ref = /^[0-9a-f]{12}$/.test(query.get('ref') ?? '') ? query.get('ref')! : null

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

// Steps already taken, kept on this browser: each opens in a tab of its own
// so this page stays underneath, and the next step is the one to press when
// the invitee comes back — from a mail app, going back leaves the page.
const DONE_KEY = 'invite-steps'
function loadDone(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
function markDone(id: string) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...loadDone(), id]))
  } catch {
    // A step shown again costs a tap.
  }
}

const STEPS = [{ id: 'install', href: storeUrl, label: t.install } as const]

function androidSteps(): string {
  const done = loadDone()
  const next = STEPS.find((step) => !done.has(step.id))?.id
  return `<section class="steps">
      <p class="label">${escapeHtml(t.android)}</p>
      ${STEPS.map(
        (step) =>
          `<a class="btn${step.id === next ? ' btn--main' : ''}${done.has(step.id) ? ' btn--done' : ''}" href="${step.href}" target="_blank" rel="noopener" data-step="${step.id}">${escapeHtml(step.label)}</a>${
            step.id === next ? `<p class="hint">${escapeHtml(t.hints[step.id])}</p>` : ''
          }`,
      ).join('')}
    </section>`
}

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
  <div id="steps">${androidSteps()}</div>
  <p class="other">${escapeHtml(t.iphone[0])}<a href="${gameUrl}">${escapeHtml(t.iphone[1])}</a></p>
`

const refreshSteps = () => (document.getElementById('steps')!.innerHTML = androidSteps())
window.addEventListener('pageshow', refreshSteps)
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refreshSteps())

// Every way off the page leaves the code on the clipboard as well: the app
// reads it at its first launch, whatever route its install took.
document.getElementById('invite')!.addEventListener('click', (event) => {
  const link = (event.target as Element).closest('a')
  if (!link) return
  if (link.dataset.step) {
    markDone(link.dataset.step)
    // Marked now, drawn once the new tab has taken over: this page is what
    // the invitee comes back to.
    setTimeout(refreshSteps, 500)
  }
  if (!ref || !navigator.clipboard) return
  const text = t.clip(inviter, `LM-${ref}`)
  if (link.target === '_blank') {
    void navigator.clipboard.writeText(text).catch(() => {})
    return
  }
  event.preventDefault()
  const go = () => (window.location.href = link.href)
  navigator.clipboard.writeText(text).then(go, go)
})
