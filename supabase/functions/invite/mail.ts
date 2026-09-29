/**
 * The invitation a player sends a friend by e-mail (migration 0034), in the
 * inviter's language. One button, to the invitation page (invite.html) that
 * sorts out Android's closed test from the web version: the mail stays short.
 * Mail clients strip <style> and web fonts: tables and inline styles only.
 * No Deno API here, so Node renders it too.
 */

export const WEB_URL = 'https://jfongue.github.io/lettre-minute/'

/**
 * The page a shared link or the mail's button opens, naming who invites. The
 * code (`my_invite_code`, 0034) lets the game befriend them once the invitee
 * has an account; without it the page still names the inviter.
 */
export function invitePage(inviter: string, code: string | null): string {
  const query = new URLSearchParams({ from: inviter })
  if (code) query.set('ref', code)
  return `${WEB_URL}invite.html?${query}`
}

const PAPER = '#f2ecdf'
const PAPER_2 = '#e6ddca'
const INK = '#151515'
const INK_FAINT = '#8a8478'
const RED = '#e0402a'
const FONT = "Jost, Futura, 'Century Gothic', 'Trebuchet MS', Arial, sans-serif"

interface MailText {
  appName: string
  subject(inviter: string): string
  /** Around the inviter's name, set in red. */
  lead: readonly [string, string]
  category: string
  /** Around the letter, set in red: the game's own way of asking. */
  find: readonly [string, string]
  cta: string
  /** Around the invited address, set in bold. */
  account: readonly [string, string]
  footer: string
}

const TEXTS: Record<string, MailText> = {
  fr: {
    appName: 'Lettre Minute',
    subject: (inviter) => `${inviter} t’invite à jouer à Lettre Minute`,
    lead: ['', ' t’invite à jouer.'],
    category: 'Couleurs',
    find: ['Trouve une couleur en ', ''],
    cta: 'Accepter l’invitation',
    account: ['Crée ton compte avec ', ' : vous serez amis tout de suite.'],
    footer: 'Un joueur a saisi ton adresse dans Lettre Minute. Tu ne recevras pas d’autre mail.',
  },
  en: {
    appName: 'Letter Minute',
    subject: (inviter) => `${inviter} invites you to play Letter Minute`,
    lead: ['', ' invites you to play.'],
    category: 'Colours',
    find: ['Find a colour starting with ', ''],
    cta: 'Accept the invitation',
    account: ['Create your account with ', ' and you will be friends straight away.'],
    footer: 'A player entered your address in Letter Minute. You will not get another e-mail.',
  },
  de: {
    appName: 'Letter Minute',
    subject: (inviter) => `${inviter} lädt dich zu Letter Minute ein`,
    lead: ['', ' lädt dich zum Spielen ein.'],
    category: 'Farben',
    find: ['Finde eine Farbe mit ', ''],
    cta: 'Einladung annehmen',
    account: ['Erstelle dein Konto mit ', ', dann seid ihr sofort befreundet.'],
    footer: 'Jemand hat deine Adresse in Letter Minute eingegeben. Du bekommst keine weitere E-Mail.',
  },
  es: {
    appName: 'Letra Minuto',
    subject: (inviter) => `${inviter} te invita a jugar a Letra Minuto`,
    lead: ['', ' te invita a jugar.'],
    category: 'Colores',
    find: ['Encuentra un color con ', ''],
    cta: 'Aceptar la invitación',
    account: ['Crea tu cuenta con ', ' y seréis amigos al instante.'],
    footer: 'Un jugador escribió tu dirección en Letra Minuto. No recibirás otro correo.',
  },
  it: {
    appName: 'Lettera Minuto',
    subject: (inviter) => `${inviter} ti invita a giocare a Lettera Minuto`,
    lead: ['', ' ti invita a giocare.'],
    category: 'Colori',
    find: ['Trova un colore con la ', ''],
    cta: 'Accetta l’invito',
    account: ['Crea il tuo account con ', ' e sarete subito amici.'],
    footer: 'Un giocatore ha inserito il tuo indirizzo in Lettera Minuto. Non riceverai altre e-mail.',
  },
  nl: {
    appName: 'Letter Minuut',
    subject: (inviter) => `${inviter} nodigt je uit voor Letter Minuut`,
    lead: ['', ' nodigt je uit om te spelen.'],
    category: 'Kleuren',
    find: ['Vind een kleur met een ', ''],
    cta: 'Uitnodiging aannemen',
    account: ['Maak je account aan met ', ', dan zijn jullie meteen vrienden.'],
    footer: 'Een speler heeft je adres in Letter Minuut ingevuld. Je krijgt geen andere e-mail.',
  },
  pt: {
    appName: 'Letra Minuto',
    subject: (inviter) => `${inviter} convida você para jogar Letra Minuto`,
    lead: ['', ' convida você para jogar.'],
    category: 'Cores',
    find: ['Encontra uma cor com ', ''],
    cta: 'Aceitar o convite',
    account: ['Crie sua conta com ', ' e vocês serão amigos na hora.'],
    footer: 'Um jogador digitou seu endereço no Letra Minuto. Você não receberá outro e-mail.',
  },
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const type = (size: number, weight: number, colour: string, extra = '') =>
  `font-family:${FONT};font-size:${size}px;font-weight:${weight};color:${colour};${extra}`

export function inviteMail(lang: string | null, inviter: string, email: string, code: string | null = null): { subject: string; html: string; text: string } {
  const t = TEXTS[lang ?? ''] ?? TEXTS.fr!
  const who = inviter.trim() || t.appName
  const subject = t.subject(who)
  const link = invitePage(who, code)

  const html = `<!doctype html>
<html lang="${lang ?? 'fr'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
<tr><td align="center" style="padding:40px 24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;">
    <tr><td style="padding:0 0 32px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:10px;height:10px;background:${RED};font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding-left:9px;${type(11, 700, INK, 'letter-spacing:3px;text-transform:uppercase;')}">${escapeHtml(t.appName)}</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:0 0 28px 0;${type(28, 800, INK, 'line-height:33px;')}">
      ${escapeHtml(t.lead[0])}<span style="color:${RED};">${escapeHtml(who)}</span>${escapeHtml(t.lead[1])}
    </td></tr>
    <tr><td style="padding:0 0 32px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid ${INK};border-bottom:2px solid ${INK};"><tr>
        <td width="58" style="padding:14px 0;">
          <div style="width:44px;height:44px;background:${RED};${type(28, 800, PAPER, 'line-height:44px;text-align:center;')}">R</div>
        </td>
        <td style="padding:14px 0;">
          <div style="${type(10, 700, INK_FAINT, 'letter-spacing:2px;text-transform:uppercase;')}">${escapeHtml(t.category)}</div>
          <div style="${type(17, 800, INK, 'padding-top:2px;')}">${escapeHtml(t.find[0])}<span style="color:${RED};">R</span>${escapeHtml(t.find[1])}</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:0 0 20px 0;">
      <a href="${link}" style="display:block;background:${INK};padding:16px 18px;${type(13, 700, PAPER, 'letter-spacing:2px;text-transform:uppercase;text-decoration:none;text-align:center;')}">${escapeHtml(t.cta)}</a>
    </td></tr>
    <tr><td style="padding:0 0 40px 0;${type(14, 400, INK, 'line-height:21px;')}">
      ${escapeHtml(t.account[0])}<strong>${escapeHtml(email)}</strong>${escapeHtml(t.account[1])}
    </td></tr>
    <tr><td style="border-top:1px solid ${PAPER_2};padding-top:14px;${type(11, 400, INK_FAINT, 'line-height:16px;')}">${escapeHtml(t.footer)}</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`

  const text = [`${t.lead[0]}${who}${t.lead[1]}`, '', `${t.cta} : ${link}`, '', `${t.account[0]}${email}${t.account[1]}`, '', t.footer].join('\n')

  return { subject, html, text }
}
