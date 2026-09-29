/**
 * Adds the addresses players invite by e-mail (tester_invites, 0034) to the
 * Google group the Play closed test takes as testers, so the invitee finds
 * the test open without joining it: a consumer group has no API, so this
 * drives groups.google.com in a headless Chrome signed in to the group's
 * owner (~/.cache/lettre-minute-play-chrome).
 *
 *   npm run group:invites                  add what waits, once
 *   npm run group:invites -- --login       open Chrome to sign in, once
 *   npm run group:invites -- --install     run every ten minutes (launchd)
 *   npm run group:invites -- --uninstall
 *
 * `listed_at` marks an address the group holds. One that already has an
 * account (`joined_by` set by `invite_tester`) is left alone: its player
 * already found the game.
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PROFILE = join(homedir(), '.cache', 'lettre-minute-play-chrome')
const MEMBERS_URL = 'https://groups.google.com/g/lettre-minute/members'
const PORT = 9343
const AGENT = 'fr.lettreminute.group-invites'
const PLIST = join(homedir(), 'Library', 'LaunchAgents', `${AGENT}.plist`)
const ROOT = resolve(import.meta.dirname, '..')
// The CLI keeps its state outside the sandbox otherwise (see CLAUDE.local.md).
const SUPABASE_ENV = { ...process.env, SUPABASE_HOME: join(ROOT, '.cache', 'supabase-home') }

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))

interface Invite {
  id: string
  email: string
}

// ------------------------------------------------------------ the database --

function query<T>(sql: string): T[] {
  const output = execFileSync('supabase', ['db', 'query', '--linked', '-o', 'json', sql], {
    cwd: ROOT,
    env: SUPABASE_ENV,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  })
  const parsed = JSON.parse(output) as { rows: T[] } | T[]
  return Array.isArray(parsed) ? parsed : parsed.rows
}

function pendingInvites(): Invite[] {
  return query<Invite>(`
    select id, email from public.tester_invites
     where listed_at is null and joined_by is null and created_at > now() - interval '30 days'
     order by created_at
     limit 20`)
}

function markListed(ids: string[]) {
  const list = ids.map((id) => `'${id.replace(/[^0-9a-f-]/g, '')}'`).join(',')
  if (ids.length > 0) query(`update public.tester_invites set listed_at = now() where id in (${list})`)
}

// ------------------------------------------------------------- the browser --

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
    return new Promise((done) => this.pending.set(id, done as (value: unknown) => void))
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

  /** A real click where the element sits: Groups' Material controls ignore synthetic events. */
  async click(expression: string): Promise<boolean> {
    const box = await this.eval<{ x: number; y: number } | null>(`(() => {
      const el = ${expression}
      if (!el) return null
      el.scrollIntoView({ block: 'center' })
      const r = el.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })()`)
    if (!box) return false
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
      await this.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 })
    await sleep(800)
    return true
  }
}

async function withChrome<T>(headless: boolean, work: (tab: Tab) => Promise<T>): Promise<T> {
  mkdirSync(PROFILE, { recursive: true })
  const chrome = spawn(
    CHROME,
    [
      ...(headless ? ['--headless=new'] : []),
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${PROFILE}`,
      '--window-size=1280,1400',
      '--no-first-run',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )
  try {
    let target: { type: string; webSocketDebuggerUrl: string } | undefined
    for (let attempt = 0; attempt < 40 && !target; attempt++) {
      await sleep(500)
      try {
        const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()) as (typeof target & {})[]
        target = pages.find((page) => page.type === 'page')
      } catch {
        // Chrome is still starting.
      }
    }
    if (!target) throw new Error('Chrome ne répond pas.')
    const socket = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((done) => socket.addEventListener('open', done))
    const tab = new Tab(socket)
    try {
      return await work(tab)
    } catch (failure) {
      // What the page showed when it went wrong, to read in the morning.
      const shot = await tab.send<{ data: string }>('Page.captureScreenshot', { format: 'png' })
      writeFileSync(join(ROOT, '.cache', 'group-invites-error.png'), Buffer.from(shot.data, 'base64'))
      throw failure
    } finally {
      socket.close()
    }
  } finally {
    chrome.kill()
  }
}

const visibleDialog = `[...document.querySelectorAll('[role=dialog]')].find(d => d.getBoundingClientRect().height > 0 && d.innerText.includes('Membres du groupe'))`

async function openMembers(tab: Tab) {
  await tab.send('Page.navigate', { url: MEMBERS_URL })
  if (!(await tab.until(`[...document.querySelectorAll('button,[role=button]')].some(b => b.innerText.trim() === 'Ajouter')`, 30))) {
    throw new Error('Page des membres introuvable : la session Google a peut-être expiré (--login).')
  }
}

/** The group's addresses, lower-cased, as its members page lists them. */
async function members(tab: Tab): Promise<Set<string>> {
  const text = await tab.eval<string>('document.body.innerText')
  return new Set((text.match(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi) ?? []).map((email) => email.toLowerCase()))
}

/** Adds the addresses in one go; resolves to whether Groups took them. */
async function addToGroup(tab: Tab, emails: string[]): Promise<boolean> {
  await tab.click(`[...document.querySelectorAll('button,[role=button]')].find(b => b.innerText.trim() === 'Ajouter')`)
  if (!(await tab.until(visibleDialog, 10))) throw new Error('La fenêtre « Ajouter » ne s’ouvre pas.')

  await tab.click(`${visibleDialog}.querySelector('input')`)
  // Enter turns the typed address into a chip; a comma leaves it plain text,
  // and the button stays greyed.
  for (const email of emails) {
    await tab.send('Input.insertText', { text: email })
    for (const type of ['keyDown', 'keyUp'])
      await tab.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 })
    await sleep(400)
  }
  // Checked, the button reads « Ajouter » and no invitation waits for an answer.
  const checked = `${visibleDialog}.querySelector('input[type=checkbox]')`
  if (!(await tab.eval<boolean>(`${checked}?.checked === true`))) {
    await tab.click(`${visibleDialog}.querySelector('input[type=checkbox]')`)
  }
  await sleep(600)
  const submit = `[...${visibleDialog}.querySelectorAll('button,[role=button]')].find(b => /^(Ajouter|Envoyer des invitations)$/.test(b.innerText.trim()) && !b.disabled && b.getAttribute('aria-disabled') !== 'true')`
  if (!(await tab.click(submit))) throw new Error('Bouton d’ajout introuvable ou désactivé.')
  return tab.until(`!(${visibleDialog})`, 20)
}

// -------------------------------------------------------------- the runs --

async function run() {
  const invites = pendingInvites()
  if (invites.length === 0) return console.log(`${new Date().toISOString()} Aucune adresse à ajouter.`)
  await withChrome(true, async (tab) => {
    await openMembers(tab)
    const known = await members(tab)
    const already = invites.filter((invite) => known.has(invite.email.toLowerCase()))
    const fresh = invites.filter((invite) => !known.has(invite.email.toLowerCase()))
    markListed(already.map((invite) => invite.id))
    if (already.length > 0) console.log(`Déjà dans le groupe : ${already.map((invite) => invite.email).join(', ')}`)
    if (fresh.length === 0) return
    if (!(await addToGroup(tab, fresh.map((invite) => invite.email)))) {
      throw new Error('Groups n’a pas fermé la fenêtre : rien n’est marqué, la passe suivante réessaiera.')
    }
    markListed(fresh.map((invite) => invite.id))
    console.log(`${new Date().toISOString()} Ajoutées au groupe : ${fresh.map((invite) => invite.email).join(', ')}`)
  })
}

async function login() {
  await withChrome(false, async (tab) => {
    await tab.send('Page.navigate', { url: MEMBERS_URL })
    console.log('Connecte-toi avec le compte propriétaire du groupe, puis ferme Chrome.')
    await new Promise<void>((done) => {
      const timer = setInterval(async () => {
        try {
          await fetch(`http://127.0.0.1:${PORT}/json`)
        } catch {
          clearInterval(timer)
          done()
        }
      }, 1000)
    })
  })
  console.log(`Session enregistrée dans ${PROFILE}.`)
}

function install() {
  const log = join(ROOT, '.cache', 'group-invites.log')
  mkdirSync(join(homedir(), 'Library', 'LaunchAgents'), { recursive: true })
  writeFileSync(
    PLIST,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${AGENT}</string>
  <key>WorkingDirectory</key><string>${ROOT}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>--experimental-strip-types</string>
    <string>${join(ROOT, 'scripts', 'group-invites.ts')}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StartInterval</key><integer>600</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${log}</string>
  <key>StandardErrorPath</key><string>${log}</string>
</dict>
</plist>
`,
  )
}

function uninstall(quiet = false) {
  try {
    execFileSync('launchctl', ['bootout', `gui/${process.getuid!()}/${AGENT}`], { stdio: 'ignore' })
  } catch {
    // Not loaded.
  }
  if (existsSync(PLIST)) rmSync(PLIST)
  if (!quiet) console.log('Tâche retirée.')
}

const flag = process.argv[2]
if (flag === '--login') await login()
else if (flag === '--install') {
  uninstall(true)
  install()
  execFileSync('launchctl', ['bootstrap', `gui/${process.getuid!()}`, PLIST])
  console.log(`Toutes les dix minutes, journal dans .cache/group-invites.log (${PLIST}).`)
} else if (flag === '--uninstall') uninstall()
else await run()
