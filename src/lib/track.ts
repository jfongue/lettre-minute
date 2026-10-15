import { host, PLATFORM } from '../platform'
import { setFeatureSink } from './feature'
import { connect, supabase } from './supabase'
import { testClient } from './testClient'

/**
 * What players do with the app, for the owner's dashboard (`analytics_snapshot`,
 * 0029): opens, screens, taps, features, runs, errors. Queued on the device and
 * sent in batches — an event is never worth a request of its own, nor a run
 * stalled on the network. Like `cloud.ts`, nothing here may throw: a lost
 * event costs a line on a chart, never a tap.
 */

// Versioned: an entry queued by a build that knew nothing of `test` is dropped
// rather than sent, or the server's not-null column would refuse the batch.
const QUEUE_KEY = 'lettre-minute.events.v2'
const DEVICE_KEY = 'lettre-minute.device.v1'
// Set while the app is on screen, cleared when it hides: still there at the
// next launch, the last session ended in the foreground — a crash, or the
// system killing the app in front of the player.
const ALIVE_KEY = 'lettre-minute.alive.v1'
// A main-thread task this long is a freeze the player feels, not a slow frame.
const FREEZE_MS = 500
const FLUSH_MS = 20_000
const BATCH = 100
// Past this, the oldest go: a device offline for weeks must not fill its storage.
const MAX_QUEUED = 1000
// Hidden longer than this, the next return counts as another opening.
const NEW_SESSION_AFTER_MS = 30 * 60_000

export type Props = Record<string, string | number | boolean | null | readonly (string | number)[]>

interface QueuedEvent {
  device: string
  session: string
  kind: string
  props: Props
  lang: string
  platform: string
  version: string
  at: string
  /** A client that plays by itself: the relevé leaves its events out (0040). */
  test: boolean
}

function randomId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  }
}

function deviceId(): string {
  try {
    const known = localStorage.getItem(DEVICE_KEY)
    if (known) return known
    const made = randomId()
    localStorage.setItem(DEVICE_KEY, made)
    return made
  } catch {
    return 'no-storage'
  }
}

function readQueue(): QueuedEvent[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as QueuedEvent[]) : []
  } catch {
    return []
  }
}

function writeQueue(queue: readonly QueuedEvent[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUED)))
  } catch {
    /* storage full or blocked: the events are lost, the game is not */
  }
}

const device = deviceId()
let session = randomId()
let lang = 'fr'
let screen = 'home'
let sessionStart = Date.now()
let sessionRuns = 0
let hiddenAt: number | null = null
// Main-thread tasks over 50 ms since the session's last report (`longtask`,
// where the WebView knows it): how often the game stutters, and how badly.
let longTasks = 0
let longMs = 0
let longMax = 0
let freezes = 0
let started = false
let flushing: Promise<void> | null = null
// Kept in memory as well: localStorage is read once, not at every tap.
let queue: QueuedEvent[] = []
const platform = PLATFORM
const version = import.meta.env.DEV ? 'dev' : (import.meta.env.VITE_APP_VERSION ?? 'dev')
// The dev server talks to the real project: its events stay queued on the
// machine unless asked for, or every test session would count as a player.
const sending = !import.meta.env.DEV || readFlag('lettre-minute.track-dev')

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

/** Records one event. Cheap: a push and, at most once a frame, a write. */
export function track(kind: string, props: Props = {}): void {
  // Before `startTracking`, or on a host that never calls it, nothing is ever
  // sent: queuing would only fill the device's storage.
  if (!started) return
  if (kind === 'run_start') sessionRuns += 1
  queue.push({ device, session, kind, props, lang, platform, version, at: new Date().toISOString(), test: testClient() })
  scheduleSave()
}

/** A feature the player used: counted by name on the dashboard. */
export function trackFeature(name: string, props: Props = {}): void {
  track('feature', { name, ...props })
}

let saveQueued = false
function scheduleSave(): void {
  if (saveQueued) return
  saveQueued = true
  queueMicrotask(() => {
    saveQueued = false
    writeQueue(queue)
  })
}

function flush(): Promise<void> {
  if (!supabase || !sending || flushing || queue.length === 0) return flushing ?? Promise.resolve()
  const client = supabase
  const batch = queue.slice(0, BATCH)
  flushing = (async () => {
    try {
      // A portal guest has no account (CrazyGames): its events go under the
      // `anon` role, which `track` accepts for that host alone (0084).
      if (!(await connect()) && host.anonymousAccounts) return
      const { error } = await client.rpc('track', { p_events: batch })
      // Refused or not deployed yet: dropped all the same, or the queue would only grow.
      if (error && error.code !== 'PGRST202') console.warn('track', error.message)
      queue = queue.slice(batch.length)
      writeQueue(queue)
    } catch {
      /* offline: the queue waits for the next flush */
    } finally {
      flushing = null
    }
  })()
  return flushing
}

/** The interface language, stamped on every event. */
export function setTrackLang(next: string): void {
  lang = next
}

/** The screen taps are attributed to, and a `screen` event when it changes. */
export function setTrackScreen(next: string): void {
  if (next === screen) return
  screen = next
  track('screen', { name: next })
}

/** What a tap is called on the dashboard: the button's own words, first. */
function labelOf(target: Element): string {
  const named = target.getAttribute('data-track') ?? target.getAttribute('aria-label') ?? ''
  const text = named || (target.textContent ?? '').replace(/\s+/g, ' ').trim()
  return text.slice(0, 48) || target.className.toString().split(' ')[0] || target.tagName.toLowerCase()
}

function setAlive(on: boolean): void {
  try {
    if (on) localStorage.setItem(ALIVE_KEY, '1')
    else localStorage.removeItem(ALIVE_KEY)
  } catch {
    /* no storage: abrupt exits go uncounted */
  }
}

function watchLongTasks(): void {
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks += 1
        longMs += entry.duration
        longMax = Math.max(longMax, entry.duration)
        if (entry.duration >= FREEZE_MS) freezes += 1
      }
    }).observe({ type: 'longtask', buffered: true })
  } catch {
    /* not supported: the session reports no long task */
  }
}

/** The stutters since the last report, then a fresh count. */
function takeLongTasks(): Props {
  const props = { long_tasks: longTasks, long_ms: Math.round(longMs), long_max: Math.round(longMax), freezes }
  longTasks = 0
  longMs = 0
  longMax = 0
  freezes = 0
  return props
}

/**
 * Starts the session: one `open`, every tap on a button or link, errors, and
 * the session's end when the page hides. Called once, before the first render.
 */
export function startTracking(): void {
  if (started || !supabase) return
  started = true
  queue = readQueue()
  setFeatureSink(trackFeature)
  track('open', { cold: true, runs: 0, unclean: readFlag(ALIVE_KEY) })
  setAlive(true)
  watchLongTasks()

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target.closest('button, a, [role="button"]') : null
      if (target) track('tap', { label: labelOf(target), screen })
    },
    true,
  )

  window.addEventListener('error', (event) => {
    track('error', { message: String(event.message).slice(0, 200), source: `${event.filename ?? ''}:${event.lineno ?? ''}`, screen })
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason
    track('error', { message: String(reason instanceof Error ? reason.message : reason).slice(0, 200), source: 'promise', screen })
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
      track('hide', { seconds: Math.round((hiddenAt - sessionStart) / 1000), runs: sessionRuns, screen, ...takeLongTasks() })
      setAlive(false)
      writeQueue(queue)
      void flush()
      return
    }
    if (hiddenAt !== null && Date.now() - hiddenAt > NEW_SESSION_AFTER_MS) {
      session = randomId()
      sessionStart = Date.now()
      sessionRuns = 0
      track('open', { cold: false, runs: 0 })
    }
    hiddenAt = null
    setAlive(true)
    void flush()
  })

  setInterval(() => void flush(), FLUSH_MS)
  setTimeout(() => void flush(), 3000)
}

/** How long the home screen took to show its content, from the page's start. */
export function trackReady(): void {
  track('ready', { ms: Math.round(performance.now()) })
}
