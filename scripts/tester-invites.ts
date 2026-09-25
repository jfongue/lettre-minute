/**
 * Sends the invitations players typed as an e-mail in the friend field
 * (migration 0020): lists each address as a tester in the Play Console, then
 * mails it the invitation (scripts/tester-mail.ts) through Resend.
 *
 *   npm run testers:invite                 list and mail what waits
 *   npm run testers:invite -- --login      open Chrome to sign in to the Play Console, once
 *   npm run testers:invite -- --watch      again every ten minutes, until stopped
 *   npm run testers:invite -- --preview    write the mail in every language under .cache/, send nothing
 *
 * Play has no API for e-mail lists, only for Google Groups: the script drives
 * Google Chrome headless over the DevTools protocol, in a profile of its own
 * signed in to the developer's account (~/.cache/lettre-minute-play-chrome).
 * The Resend key: RESEND_API_KEY, or ~/cles/resend.txt. The sender needs a
 * domain verified in Resend (INVITE_FROM): onboarding@resend.dev only
 * delivers to the Resend account's own address.
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { testerMail } from './tester-mail.ts'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PROFILE = join(homedir(), '.cache', 'lettre-minute-play-chrome')
const PORT = 9334
const DEVELOPER = '5987887774389787372'
/** The « Amis » list, the one the closed testing track lets in. */
const EMAIL_LIST = process.env.PLAY_EMAIL_LIST ?? '5794392898854860272'
const LIST_URL = `https://play.google.com/console/u/1/developers/${DEVELOPER}/email-lists/${EMAIL_LIST}/update-email-list`
const SAVE_LABELS = ['Enregistrer les modifications', 'Save changes']
const WATCH_MINUTES = 10

const args = process.argv.slice(2)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface Invite {
  id: string
  email: string
  lang: string | null
  inviter: string
  listed: boolean
}

// ------------------------------------------------------------ the database --

function query<T>(sql: string): T[] {
  const output = execFileSync('supabase', ['db', 'query', '--linked', '-o', 'json', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  })
  return (JSON.parse(output) as { rows: T[] }).rows
}

const quoteIds = (ids: string[]) => ids.map((id) => `'${id.replace(/[^0-9a-f-]/g, '')}'`).join(',')

function pendingInvites(): Invite[] {
  return query<Invite>(`
    select i.id, i.email, i.lang, coalesce(p.display_name, '') as inviter, i.listed_at is not null as listed
      from public.tester_invites i
      left join public.profiles p on p.id = i.invited_by
     where i.mailed_at is null
     order by i.created_at
     limit 50`)
}

function mark(column: 'listed_at' | 'mailed_at', ids: string[]) {
  if (ids.length > 0) query(`update public.tester_invites set ${column} = now() where id in (${quoteIds(ids)})`)
}

// ------------------------------------------------------ the Play Console --

class Tab {
  private next = 1
  private pending = new Map<number, (value: unknown) => void>()
  private socket: WebSocket
  constructor(socket: WebSocket) {
    this.socket = socket
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: unknown }
      if (message.id && this.pending.has(message.id)) {
        this.pending.get(message.id)!(message.result)
        this.pending.delete(message.id)
      }
    })
  }
  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.next++
    this.socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve) => this.pending.set(id, resolve as (value: unknown) => void))
  }
  async eval<T>(expression: string): Promise<T> {
    const { result } = await this.send<{ result: { value: T } }>('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    return result.value
  }
  async until(expression: string, seconds: number): Promise<boolean> {
    for (let waited = 0; waited < seconds * 2; waited++) {
      if (await this.eval<boolean>(`Boolean(${expression})`)) return true
      await sleep(500)
    }
    return false
  }
  async go(url: string) {
    await this.send('Page.navigate', { url })
    await sleep(1500)
  }
}

async function launchChrome(headless: boolean) {
  mkdirSync(PROFILE, { recursive: true })
  const chrome = spawn(CHROME, [
    ...(headless ? ['--headless=new'] : []),
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--no-first-run',
    '--no-default-browser-check',
    // Headless Chrome says so in its user agent, and Google then refuses the session.
    ...(headless
      ? ['--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36']
      : []),
    headless ? 'about:blank' : LIST_URL,
  ])
  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(500)
    try {
      await fetch(`http://127.0.0.1:${PORT}/json/version`)
      return chrome
    } catch {
      // Chrome is still starting.
    }
  }
  chrome.kill()
  throw new Error('Chrome ne répond pas sur le port de débogage.')
}

async function openTab(): Promise<Tab> {
  const target = (await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()) as {
    webSocketDebuggerUrl: string
  }
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve) => socket.addEventListener('open', resolve))
  const tab = new Tab(socket)
  await tab.send('Page.enable')
  await tab.send('Runtime.enable')
  return tab
}

const EMAIL_INPUT = `document.querySelector('input[type=email]')`
const SAVE_BUTTON = `[...document.querySelectorAll('button')].find((b) => ${JSON.stringify(SAVE_LABELS)}.some((l) => b.textContent.includes(l)))`

/** The addresses the list holds, as the page renders them in its delete buttons. */
const LISTED = `[...document.querySelectorAll('button[aria-label]')].map((b) => (/"([^"]+@[^"]+)"/.exec(b.getAttribute('aria-label')) || [])[1]).filter(Boolean).map((e) => e.toLowerCase())`

/**
 * Adds the addresses to the Play Console e-mail list: typed comma-separated,
 * confirmed with Enter, then saved. Answers the ones the reloaded page shows.
 */
async function listTesters(emails: string[]): Promise<Set<string>> {
  const chrome = await launchChrome(true)
  try {
    const tab = await openTab()
    await tab.go(LIST_URL)
    if (!(await tab.until(EMAIL_INPUT, 30))) {
      const url = await tab.eval<string>('location.href')
      throw new Error(
        url.includes('accounts.google.com')
          ? 'Session Play Console expirée : relancer avec --login.'
          : `Champ d’adresses introuvable sur ${url} — la Play Console a changé ?`,
      )
    }
    // The grid renders its rows a moment after the field.
    await sleep(3000)
    const before = new Set(await tab.eval<string[]>(LISTED))
    const fresh = emails.filter((email) => !before.has(email))
    if (fresh.length > 0) {
      await tab.eval(`${EMAIL_INPUT}.focus()`)
      await tab.send('Input.insertText', { text: fresh.join(', ') })
      for (const type of ['keyDown', 'keyUp']) {
        await tab.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
      }
      if (!(await tab.until(`${SAVE_BUTTON} && !${SAVE_BUTTON}.disabled`, 10))) {
        throw new Error('La Play Console n’a pas accepté les adresses (bouton d’enregistrement resté grisé).')
      }
      await tab.eval(`${SAVE_BUTTON}.click()`)
      if (!(await tab.until(`${SAVE_BUTTON} && ${SAVE_BUTTON}.disabled`, 20))) {
        throw new Error('L’enregistrement de la liste n’a pas abouti.')
      }
      await sleep(2000)
      await tab.go(LIST_URL)
      await tab.until(EMAIL_INPUT, 30)
      await sleep(3000)
    }
    const after = new Set(await tab.eval<string[]>(LISTED))
    // The grid may not render every row of a long list: a save that went
    // through is proof enough for the addresses just typed.
    return new Set(emails.filter((email) => after.has(email) || before.has(email) || fresh.includes(email)))
  } finally {
    chrome.kill()
  }
}

async function login() {
  console.log('Connecte-toi à la Play Console dans la fenêtre Chrome, puis ferme-la.')
  const chrome = await launchChrome(false)
  await new Promise((resolve) => chrome.on('exit', resolve))
  console.log(`Session enregistrée dans ${PROFILE}.`)
}

// -------------------------------------------------------------- the mail --

function resendKey(): string {
  const file = join(homedir(), 'cles', 'resend.txt')
  const key = process.env.RESEND_API_KEY ?? (existsSync(file) ? readFileSync(file, 'utf8').trim() : '')
  if (!key) throw new Error('Clé Resend absente : RESEND_API_KEY, ou ~/cles/resend.txt.')
  return key
}

async function sendMail(key: string, invite: Invite): Promise<boolean> {
  const mail = testerMail(invite.lang, invite.inviter)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.INVITE_FROM ?? 'Lettre Minute <onboarding@resend.dev>',
      to: invite.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  })
  if (!response.ok) console.warn(`! ${invite.email} : ${response.status} ${await response.text()}`)
  return response.ok
}

// -------------------------------------------------------------------------

async function pass() {
  const invites = pendingInvites()
  if (invites.length === 0) {
    console.log('Aucune invitation en attente.')
    return
  }
  const key = resendKey()

  const unlisted = invites.filter((invite) => !invite.listed)
  if (unlisted.length > 0) {
    const listed = await listTesters(unlisted.map((invite) => invite.email))
    const ids = unlisted.filter((invite) => listed.has(invite.email)).map((invite) => invite.id)
    mark('listed_at', ids)
    for (const invite of unlisted) {
      invite.listed = listed.has(invite.email)
      console.log(`${invite.listed ? '→ testeur' : '! pas inscrit'} : ${invite.email}`)
    }
  }

  const mailed: string[] = []
  for (const invite of invites.filter((invite) => invite.listed)) {
    if (await sendMail(key, invite)) {
      mailed.push(invite.id)
      console.log(`→ invité : ${invite.email} (${invite.inviter || '?'}, ${invite.lang ?? 'fr'})`)
    }
  }
  mark('mailed_at', mailed)
}

function preview() {
  mkdirSync('.cache/tester-mail', { recursive: true })
  for (const lang of ['fr', 'en', 'es', 'de', 'it', 'nl', 'pt']) {
    const path = `.cache/tester-mail/${lang}.html`
    writeFileSync(path, testerMail(lang, 'Demontoon').html)
    console.log(`· ${path}`)
  }
}

if (args.includes('--preview')) {
  preview()
} else if (args.includes('--login')) {
  await login()
} else if (args.includes('--watch')) {
  for (;;) {
    try {
      await pass()
    } catch (error) {
      console.error(`! ${(error as Error).message}`)
    }
    await sleep(WATCH_MINUTES * 60_000)
  }
} else {
  await pass()
}
