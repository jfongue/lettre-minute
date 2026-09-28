import { Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { MODERATION_MIN_QUEUE, MODERATION_SESSION_SIZE, SUPER_MODERATOR_VALIDATIONS } from '../domain/moderation'
import { SUBMISSION_REWARD_XP } from '../domain/progression'
import {
  cancelSubmission,
  correctSubmission,
  fetchMySubmissions,
  markRequestsSeen,
  submitIdea,
  type ModerationStatus,
  type Submission,
} from '../lib/cloud'
import { categoryText, useT } from '../i18n'
import { loadSubmissions, saveSubmissions, type PendingSubmission } from '../state/storage'
import { categoryMotif } from './motifs'
import { CategoryIcon } from './CategoryIcon'
import { VerdictMark } from './VerdictMark'
import { RespellField, respellValid } from './RespellField'
import { availableCategoryIds, loadPack } from '../data/packs'
import { useHiddenTaps } from './useHiddenTaps'
import { lazyScreen } from './lazyScreen'
import { spelledExactly } from '../domain/words'

// The owner's inbox, behind five taps: no player should download it.
const IdeasAdmin = lazyScreen(() => import('../debug/IdeasAdmin').then((module) => module.IdeasAdmin))

/**
 * A request as the page lists it: still on the device, waiting for the next
 * connection, or already on the server with the status it was given there.
 */
export type RequestEntry =
  | { source: 'queued'; key: string; categoryId: string; display: string; queued: PendingSubmission }
  | { source: 'server'; key: string; categoryId: string; display: string; submission: Submission }

type Entry = RequestEntry

// Long enough to read « Déjà existant ! » before the row goes.
const EXISTS_MS = 1600

/** Ce que « Ajoutés grâce à toi » montre avant son « Voir plus » : les dix derniers. */
const ADDED_SHOWN = 10

const langOf = (entry: Entry) => (entry.source === 'queued' ? (entry.queued.lang ?? 'fr') : entry.submission.lang)

interface RequestsPageProps {
  /** Null without a server, or before it answered. */
  moderation: ModerationStatus | null
  onModerate(): void
  /** The accepted words have been seen: the home screen's badge can go. */
  onSeen(): void
  /** Once per visit: the moderation queue may be topped up. */
  onOpen(): void
}

export function RequestsPage({ moderation, onModerate, onSeen, onOpen }: RequestsPageProps) {
  const t = useT()
  const [server, setServer] = useState<Submission[] | null | 'loading'>('loading')
  const [queue, setQueue] = useState<PendingSubmission[]>(loadSubmissions)
  const [failed, setFailed] = useState(false)
  // La liste des mots entrés se replie sur ses dix derniers : la queue de
  // l'archive n'intéresse personne.
  const [allAdded, setAllAdded] = useState(false)
  // Read once, on arrival: the words accepted since the last visit keep their
  // highlight for the whole visit, though the server forgets them at once.
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())

  const refresh = useCallback(() => {
    setQueue(loadSubmissions())
    return fetchMySubmissions().then(setServer)
  }, [])

  useEffect(onOpen, [onOpen])

  useEffect(() => {
    fetchMySubmissions().then((found) => {
      setServer(found)
      const news = (found ?? []).filter((submission) => submission.fresh)
      if (news.length === 0) return
      setFresh(new Set(news.map((submission) => submission.id)))
      markRequestsSeen().then((seen) => seen && onSeen())
    })
  }, [onSeen])

  const rewrite = (next: PendingSubmission[]) => {
    saveSubmissions(next)
    setQueue(next)
  }

  const act = async (work: Promise<boolean>) => {
    const ok = await work
    setFailed(!ok)
    await refresh()
    return ok
  }

  const withdraw = (entry: Entry) =>
    entry.source === 'queued'
      ? rewrite(queue.filter((item) => item !== entry.queued))
      : act(cancelSubmission(entry.submission.id))

  const correct = async (entry: Entry, display: string): Promise<boolean> => {
    if (entry.source === 'queued') {
      rewrite(queue.map((item) => (item === entry.queued ? { ...item, word: display } : item)))
      return true
    }
    return act(correctSubmission(entry.submission, display))
  }

  const submissions = server === 'loading' || server === null ? [] : server
  const fromServer = (submission: Submission): Entry => ({
    source: 'server',
    key: submission.id,
    categoryId: submission.categoryId,
    display: submission.display,
    submission,
  })
  const pending: Entry[] = [
    ...queue.map(
      (queued): Entry => ({
        source: 'queued',
        key: `queued-${queued.at}-${queued.word}`,
        categoryId: queued.categoryId,
        display: queued.word,
        queued,
      }),
    ),
    ...submissions.filter((submission) => submission.status === 'pending').map(fromServer),
  ]
  const accepted = submissions.filter((submission) => submission.status === 'accepted').map(fromServer)
  const added = allAdded ? accepted : accepted.slice(0, ADDED_SHOWN)
  const rejected = submissions.filter((submission) => submission.status === 'rejected').map(fromServer)
  const nothing = server !== 'loading' && pending.length === 0 && accepted.length === 0 && rejected.length === 0

  // A proposal the dictionary now spells letter for letter asks for nothing:
  // it says so, then leaves the list on its own.
  const [existing, setExisting] = useState<ReadonlySet<string>>(new Set())
  const probe = pending.map((entry) => `${entry.key}\u0000${langOf(entry)}\u0000${entry.categoryId}\u0000${entry.display}`).join('\u0001')
  const pendingNow = useRef(pending)
  useEffect(() => {
    pendingNow.current = pending
  })
  useEffect(() => {
    let live = true
    const entries = pendingNow.current
    Promise.all(
      entries.map(async (entry) => {
        const lang = langOf(entry)
        if (!availableCategoryIds(lang).includes(entry.categoryId)) return false
        return spelledExactly(await loadPack(lang, entry.categoryId), entry.display)
      }),
    ).then((known) => {
      const hits = entries.filter((_, index) => known[index])
      if (!live || hits.length === 0) return
      setExisting(new Set(hits.map((entry) => entry.key)))
      setTimeout(async () => {
        const queuedHits = new Set(hits.flatMap((entry) => (entry.source === 'queued' ? [entry.queued] : [])))
        const next = loadSubmissions().filter((item) => ![...queuedHits].some((hit) => hit.at === item.at && hit.word === item.word))
        saveSubmissions(next)
        await Promise.all(hits.flatMap((entry) => (entry.source === 'server' ? [cancelSubmission(entry.submission.id)] : [])))
        await refresh()
        setExisting(new Set())
      }, EXISTS_MS)
    })
    return () => {
      live = false
    }
  }, [probe, refresh])

  return (
    <>
      {moderation?.moderator && moderation.queue >= MODERATION_MIN_QUEUE && <ModerationPanel status={moderation} onModerate={onModerate} />}
      {server === 'loading' && <p className="note">{t.loading}</p>}
      {server === null && <p className="note">{t.requests.offline}</p>}
      {failed && <p className="note note--warn">{t.requests.failed}</p>}
      {nothing && <p className="note">{t.requests.empty}</p>}

      {server !== 'loading' && !nothing && (
        <section className="stack">
          <div className="spread">
            <p className="section-title">{t.requests.added}</p>
            <p className="note">{accepted.length}</p>
          </div>
          {accepted.length === 0 ? (
            <p className="note">{t.requests.noneAdded}</p>
          ) : (
            <>
              <ul className="requests requests--added">
                {added.map((entry) => (
                  <RequestRow key={entry.key} entry={entry} fresh={fresh.has(entry.key)} />
                ))}
              </ul>
              {accepted.length > ADDED_SHOWN && (
                <button type="button" className="btn btn--quiet" onClick={() => setAllAdded(!allAdded)}>
                  {allAdded ? t.requests.less : t.requests.more(accepted.length - ADDED_SHOWN)}
                </button>
              )}
              <p className="note">{t.requests.addedNote(SUBMISSION_REWARD_XP)}</p>
            </>
          )}
        </section>
      )}

      {pending.length > 0 && (
        <section className="stack">
          <div className="spread">
            <p className="section-title">{t.requests.pending}</p>
            <p className="note">{pending.length}</p>
          </div>
          <ul className="requests">
            {pending.map((entry) => (
              <RequestRow
                key={entry.key}
                entry={entry}
                exists={existing.has(entry.key)}
                onWithdraw={() => withdraw(entry)}
                onCorrect={(display) => correct(entry, display)}
              />
            ))}
          </ul>
        </section>
      )}

      {rejected.length > 0 && (
        <details className="requests-archive">
          <summary className="section-title">{t.requests.rejected(rejected.length)}</summary>
          <ul className="requests requests--rejected">
            {rejected.map((entry) => (
              <RequestRow key={entry.key} entry={entry} />
            ))}
          </ul>
        </details>
      )}

      <IdeaBox />
    </>
  )
}

interface RequestRowProps {
  entry: Entry
  /** Accepted since the last visit. */
  fresh?: boolean
  /** Spelled this way in the dictionary already: on its way out. */
  exists?: boolean
  /** A word of its own where the queue and the moderation would write one. */
  note?: string
  /** Only a request still waiting can be taken back or respelled. */
  onWithdraw?(): void
  onCorrect?(display: string): Promise<boolean>
}

/** A request as « Mes demandes » and the last screen of a run both list it. */
export function RequestRow({ entry, fresh, exists, note, onWithdraw, onCorrect }: RequestRowProps) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.display)
  const [busy, setBusy] = useState(false)
  const motif = categoryMotif(entry.categoryId)
  // Once a moderator has voted, the spelling they judged is the one that stays.
  const locked = entry.source === 'server' && entry.submission.status === 'pending' && entry.submission.locked

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const next = draft.trim()
    if (!onCorrect || next === '' || next === entry.display) return setEditing(false)
    if (!respellValid(next, entry.display)) return
    setBusy(true)
    const ok = await onCorrect(next)
    setBusy(false)
    if (ok) setEditing(false)
  }

  return (
    <li className={`request${fresh ? ' request--fresh' : ''}${exists ? ' request--exists' : ''}`}>
      <CategoryIcon categoryId={entry.categoryId} tint={motif.tint} className="category-shape" />
      {editing ? (
        <form className="request-edit" onSubmit={save}>
          <RespellField
            value={draft}
            onChange={setDraft}
            original={entry.display}
            aria-label={t.requests.correctLabel(entry.display)}
            autoComplete="off"
            autoFocus
            maxLength={60}
          />
          <button type="submit" className="btn btn--quiet" disabled={busy || !respellValid(draft, entry.display)}>
            {busy ? t.wait : t.requests.save}
          </button>
          <button type="button" className="btn btn--quiet btn--muted" onClick={() => setEditing(false)}>
            {t.cancel}
          </button>
        </form>
      ) : (
        <>
          <span className="request-word">
            {entry.display}
            <span className="note">
              {categoryText(t, entry.categoryId).label}
              {entry.source === 'queued' && ` · ${t.requests.queued}`}
              {locked && ` · ${t.requests.locked}`}
              {note && ` · ${note}`}
            </span>
          </span>
          {fresh && <span className="request-fresh">{t.requests.fresh}</span>}
          {exists && <span className="request-exists">{t.requests.exists}</span>}
          {onWithdraw && onCorrect && !exists && (
            <span className="friend-actions">
              {!locked && (
                <button type="button" className="btn btn--quiet" onClick={() => setEditing(true)}>
                  {t.requests.correct}
                </button>
              )}
              <button type="button" className="btn btn--quiet btn--muted" onClick={onWithdraw}>
                {t.requests.withdraw}
              </button>
            </span>
          )}
        </>
      )}
    </li>
  )
}

const IDEA_MAX = 2000

/** A folded corner at the foot of the page: what the player would like the game to do. */
function IdeaBox() {
  const t = useT()
  const [open, setOpen] = useState(false)
  // Cinq tapes sur « Boîte à idées » — le bouton qui l'ouvre compte pour la
  // première — ouvrent les idées reçues, pour l'administrateur seul.
  const tap = useHiddenTaps()
  const [reading, setReading] = useState(false)
  const [draft, setDraft] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'failed'>('idle')

  const send = async (event: FormEvent) => {
    event.preventDefault()
    if (draft.trim().length < 3) return
    setState('busy')
    const ok = await submitIdea(draft, t.tag.slice(0, 2))
    setState(ok ? 'sent' : 'failed')
    if (ok) setDraft('')
  }

  if (reading)
    return (
      <Suspense fallback={null}>
        <IdeasAdmin onClose={() => setReading(false)} />
      </Suspense>
    )
  if (!open) {
    return (
      <button
        type="button"
        className="btn btn--quiet idea-open"
        onClick={() => {
          tap()
          setOpen(true)
        }}
      >
        {t.ideas.open}
      </button>
    )
  }
  return (
    <form className="idea-box stack" onSubmit={send}>
      <p className="section-title" onClick={() => tap() && setReading(true)}>
        {t.ideas.title}
      </p>
      <p className="note">{t.ideas.lead}</p>
      <textarea
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value)
          if (state !== 'busy') setState('idle')
        }}
        placeholder={t.ideas.placeholder}
        aria-label={t.ideas.title}
        maxLength={IDEA_MAX}
        rows={4}
      />
      {state === 'sent' && <p className="note">{t.ideas.sent}</p>}
      {state === 'failed' && <p className="note note--warn">{t.ideas.failed}</p>}
      <div className="spread">
        <button type="button" className="btn btn--quiet btn--muted" onClick={() => setOpen(false)}>
          {t.ideas.close}
        </button>
        <button type="submit" className="btn btn--blue" disabled={state === 'busy' || draft.trim().length < 3}>
          {state === 'busy' ? t.wait : t.ideas.send}
        </button>
      </div>
    </form>
  )
}

/** The moderator's corner of the page: their standing, and the button that deals the next five words. */
function ModerationPanel({ status, onModerate }: { status: ModerationStatus; onModerate(): void }) {
  const t = useT()
  return (
    <section className={`moderation-panel${status.super ? ' moderation-panel--super' : ''}`}>
      <div className="moderation-panel-head">
        <span className="moderation-panel-badge" aria-hidden="true">
          <VerdictMark verdict="correct" />
        </span>
        <div className="stack">
          <p className="section-title">{status.super ? t.moderation.superTitle : t.moderation.title}</p>
          <p className="note">{status.super ? t.moderation.superLead : t.moderation.lead}</p>
        </div>
      </div>
      {!status.super && (
        <div className="stack">
          <div className="progress">
            <span style={{ '--ratio': Math.min(1, status.validated / SUPER_MODERATOR_VALIDATIONS) } as CSSProperties} />
          </div>
          <p className="note">{t.moderation.progress(status.validated, SUPER_MODERATOR_VALIDATIONS)}</p>
        </div>
      )}
      <button type="button" className="btn btn--blue btn--block" onClick={onModerate}>
        {t.moderation.start(Math.min(MODERATION_SESSION_SIZE, status.queue))}
      </button>
    </section>
  )
}
