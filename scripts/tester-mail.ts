/**
 * The invitation a player sends a friend by e-mail (scripts/tester-invites.ts),
 * in the inviter's language. Mail clients strip <style> and web fonts: the
 * layout is tables and inline styles, the colours those of styles.css.
 */

export const OPT_IN_URL = 'https://play.google.com/apps/testing/fr.lettreminute.app'
export const STORE_URL = 'https://play.google.com/store/apps/details?id=fr.lettreminute.app'
const ICON_URL = 'https://jfongue.github.io/lettre-minute/icon-512.png'

const PAPER = '#f2ecdf'
const PAPER_2 = '#e6ddca'
const INK = '#151515'
const INK_SOFT = '#4d4943'
const RED = '#e0402a'
const FONT = "Jost, 'Futura', 'Century Gothic', 'Helvetica Neue', Arial, sans-serif"

interface MailText {
  subject(inviter: string): string
  /** Around the inviter's name, set in bold. */
  lead: readonly [string, string]
  pitch: string
  steps: readonly [string, string]
  join: string
  install: string
  account: string
  friend(inviter: string): string
  footer: string
}

const TEXTS: Record<string, MailText> = {
  fr: {
    subject: (inviter) => `${inviter} t’invite à jouer à Lettre Minute`,
    lead: ['', ' t’invite à jouer à Lettre Minute.'],
    pitch: 'Le Petit Bac express : une lettre, un thème, 60 secondes. Défie tes amis !',
    steps: [
      'Le jeu est encore en test sur Google Play : ton adresse vient d’être ajoutée à la liste des testeurs.',
      'Rejoins le test, puis installe le jeu depuis le Play Store.',
    ],
    join: 'Rejoindre le test',
    install: 'Installer le jeu',
    account: 'Sur Android, connecte-toi au Play Store avec le compte Google de cette adresse.',
    friend: (inviter) => `Une fois dans le jeu, ajoute ${inviter} en ami pour vous défier.`,
    footer: 'Tu reçois ce mail parce qu’un joueur a saisi ton adresse dans Lettre Minute. Sans suite de ta part, tu n’en recevras pas d’autre.',
  },
  en: {
    subject: (inviter) => `${inviter} invites you to play Lettre Minute`,
    lead: ['', ' invites you to play Lettre Minute.'],
    pitch: 'The classic categories game, fast: one letter, 60 seconds. Challenge friends!',
    steps: [
      'The game is still in testing on Google Play: your address has just been added to the testers’ list.',
      'Join the test, then install the game from the Play Store.',
    ],
    join: 'Join the test',
    install: 'Install the game',
    account: 'On Android, sign in to the Play Store with the Google account of this address.',
    friend: (inviter) => `Once in the game, add ${inviter} as a friend to challenge each other.`,
    footer: 'You are getting this e-mail because a player entered your address in Lettre Minute. If you do nothing, you will not get another one.',
  },
  es: {
    subject: (inviter) => `${inviter} te invita a jugar a Lettre Minute`,
    lead: ['', ' te invita a jugar a Lettre Minute.'],
    pitch: 'El Stop exprés: una letra, un tema, 60 segundos. ¡Reta a tus amigos!',
    steps: [
      'El juego aún está en pruebas en Google Play: tu dirección acaba de añadirse a la lista de testers.',
      'Únete a la prueba y luego instala el juego desde Play Store.',
    ],
    join: 'Unirme a la prueba',
    install: 'Instalar el juego',
    account: 'En Android, inicia sesión en Play Store con la cuenta de Google de esta dirección.',
    friend: (inviter) => `Ya en el juego, añade a ${inviter} como amigo para retaros.`,
    footer: 'Recibes este correo porque un jugador escribió tu dirección en Lettre Minute. Si no haces nada, no recibirás otro.',
  },
  de: {
    subject: (inviter) => `${inviter} lädt dich zu Lettre Minute ein`,
    lead: ['', ' lädt dich zu Lettre Minute ein.'],
    pitch: 'Stadt-Land-Fluss im Turbogang: ein Buchstabe, 60 Sekunden. Fordere Freunde!',
    steps: [
      'Das Spiel ist bei Google Play noch im Test: Deine Adresse wurde gerade in die Testerliste aufgenommen.',
      'Tritt dem Test bei und installiere das Spiel dann aus dem Play Store.',
    ],
    join: 'Dem Test beitreten',
    install: 'Spiel installieren',
    account: 'Melde dich auf Android mit dem Google-Konto dieser Adresse im Play Store an.',
    friend: (inviter) => `Im Spiel fügst du ${inviter} als Freund hinzu, um euch herauszufordern.`,
    footer: 'Du bekommst diese E-Mail, weil jemand deine Adresse in Lettre Minute eingegeben hat. Wenn du nichts tust, bekommst du keine weitere.',
  },
  it: {
    subject: (inviter) => `${inviter} ti invita a giocare a Lettre Minute`,
    lead: ['', ' ti invita a giocare a Lettre Minute.'],
    pitch: 'Nomi, cose, città in versione lampo: una lettera, 60 secondi. Sfida gli amici!',
    steps: [
      'Il gioco è ancora in test su Google Play: il tuo indirizzo è appena stato aggiunto alla lista dei tester.',
      'Unisciti al test, poi installa il gioco dal Play Store.',
    ],
    join: 'Unisciti al test',
    install: 'Installa il gioco',
    account: 'Su Android, accedi al Play Store con l’account Google di questo indirizzo.',
    friend: (inviter) => `Una volta nel gioco, aggiungi ${inviter} come amico per sfidarvi.`,
    footer: 'Ricevi questa e-mail perché un giocatore ha inserito il tuo indirizzo in Lettre Minute. Se non fai nulla, non ne riceverai altre.',
  },
  nl: {
    subject: (inviter) => `${inviter} nodigt je uit om Lettre Minute te spelen`,
    lead: ['', ' nodigt je uit om Lettre Minute te spelen.'],
    pitch: 'Stad-land-rivier in sneltreinvaart: één letter, 60 seconden. Daag vrienden uit!',
    steps: [
      'Het spel is nog in test op Google Play: je adres is net toegevoegd aan de lijst met testers.',
      'Doe mee aan de test en installeer het spel daarna via de Play Store.',
    ],
    join: 'Meedoen aan de test',
    install: 'Spel installeren',
    account: 'Log op Android in de Play Store in met het Google-account van dit adres.',
    friend: (inviter) => `Eenmaal in het spel voeg je ${inviter} toe als vriend om elkaar uit te dagen.`,
    footer: 'Je krijgt deze e-mail omdat een speler je adres in Lettre Minute heeft ingevuld. Als je niets doet, krijg je er geen meer.',
  },
  pt: {
    subject: (inviter) => `${inviter} convida você para jogar Lettre Minute`,
    lead: ['', ' convida você para jogar Lettre Minute.'],
    pitch: 'O bom e velho Stop, turbinado: uma letra, 60 segundos. Desafie seus amigos!',
    steps: [
      'O jogo ainda está em teste no Google Play: seu endereço acabou de ser adicionado à lista de testadores.',
      'Entre no teste e depois instale o jogo pela Play Store.',
    ],
    join: 'Entrar no teste',
    install: 'Instalar o jogo',
    account: 'No Android, entre na Play Store com a conta Google deste endereço.',
    friend: (inviter) => `Já no jogo, adicione ${inviter} como amigo para se desafiarem.`,
    footer: 'Você recebe este e-mail porque um jogador digitou seu endereço no Lettre Minute. Se não fizer nada, não receberá outro.',
  },
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function button(href: string, label: string, filled: boolean): string {
  const colours = filled
    ? `background:${RED};color:#ffffff;border:2px solid ${RED};`
    : `background:transparent;color:${INK};border:2px solid ${INK};`
  return `<a href="${href}" style="display:block;${colours}border-radius:999px;padding:14px 20px;font-family:${FONT};font-size:17px;font-weight:600;text-decoration:none;text-align:center;">${escapeHtml(label)}</a>`
}

function step(number: number, body: string): string {
  return `<tr>
  <td width="36" valign="top" style="padding:0 0 14px 0;"><div style="width:26px;height:26px;border-radius:13px;background:${INK};color:${PAPER};font-family:${FONT};font-size:14px;font-weight:700;line-height:26px;text-align:center;">${number}</div></td>
  <td valign="top" style="padding:3px 0 14px 0;font-family:${FONT};font-size:15px;line-height:22px;color:${INK_SOFT};">${escapeHtml(body)}</td>
</tr>`
}

export function testerMail(lang: string | null, inviter: string): { subject: string; html: string; text: string } {
  const t = TEXTS[lang ?? ''] ?? TEXTS.fr!
  const who = inviter.trim() || 'Lettre Minute'
  const subject = t.subject(who)

  const html = `<!doctype html>
<html lang="${lang ?? 'fr'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${PAPER_2};">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(t.pitch)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER_2};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${PAPER};border-radius:24px;">
    <tr><td style="height:8px;background:${RED};border-radius:24px 24px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td align="center" style="padding:36px 32px 8px 32px;">
      <img src="${ICON_URL}" width="88" height="88" alt="Lettre Minute" style="display:block;border:0;border-radius:20px;">
    </td></tr>
    <tr><td align="center" style="padding:16px 32px 4px 32px;font-family:${FONT};font-size:26px;line-height:32px;font-weight:700;color:${INK};">
      ${escapeHtml(t.lead[0])}<span style="color:${RED};">${escapeHtml(who)}</span>${escapeHtml(t.lead[1])}
    </td></tr>
    <tr><td align="center" style="padding:8px 32px 28px 32px;font-family:${FONT};font-size:16px;line-height:24px;color:${INK_SOFT};">
      ${escapeHtml(t.pitch)}
    </td></tr>
    <tr><td style="padding:0 32px 8px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${step(1, t.steps[0])}
        ${step(2, t.steps[1])}
      </table>
    </td></tr>
    <tr><td style="padding:4px 32px 12px 32px;">${button(OPT_IN_URL, t.join, true)}</td></tr>
    <tr><td style="padding:0 32px 20px 32px;">${button(STORE_URL, t.install, false)}</td></tr>
    <tr><td align="center" style="padding:0 32px 8px 32px;font-family:${FONT};font-size:13px;line-height:19px;color:${INK_SOFT};">${escapeHtml(t.account)}</td></tr>
    <tr><td align="center" style="padding:0 32px 36px 32px;font-family:${FONT};font-size:13px;line-height:19px;color:${INK_SOFT};">${escapeHtml(t.friend(who))}</td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
    <tr><td align="center" style="padding:20px 24px 0 24px;font-family:${FONT};font-size:11px;line-height:16px;color:${INK_SOFT};">${escapeHtml(t.footer)}</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`

  const text = [
    `${t.lead[0]}${who}${t.lead[1]}`,
    t.pitch,
    '',
    `1. ${t.steps[0]}`,
    `2. ${t.steps[1]}`,
    '',
    t.join,
    OPT_IN_URL,
    t.install,
    STORE_URL,
    '',
    t.account,
    t.friend(who),
    '',
    t.footer,
  ].join('\n')

  return { subject, html, text }
}
