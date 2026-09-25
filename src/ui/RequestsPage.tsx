import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { MODERATION_MIN_QUEUE, MODERATION_SESSION_SIZE, SUPER_MODERATOR_VALIDATIONS } from '../domain/moderation'
import { SUBMISSION_REWARD_XP } from '../domain/progression'
import {
  cancelSubmission,
  correctSubmission,
  fetchMySubmissions,
  markRequestsSeen,
  type ModerationStatus,
  type Submission,
} from '../lib/cloud'
import { categoryText, useT } from '../i18n'
import { loadSubmissions, saveSubmissions, type PendingSubmission } from '../state/storage'
import { categoryMotif } from './motifs'
import { CategoryIcon } from './CategoryIcon'
import { VerdictMark } from './VerdictMark'

/**
 * A request as the page lists it: still on the device, waiting for the next
 * connection, or already on the server with the status it was given there.
 */
type Entry =
  | { source: 'queued'; key: string; categoryId: string; display: string; queued: PendingSubmission }
  | { source: 'server'; key: string; categoryId: string; display: string; submission: Submission }

interface RequestsPageProps {
  /** Null without a server, or before it answered. */
  moderation: ModerationStatus | null
  onModerate(): void
  /** The accepted words have been seen: the home screen's badge can go. */
  onSeen(): void
}

export function RequestsPage({ moderation, onModerate, onSeen }: RequestsPageProps) {
  const t = useT()
  const [server, setServer] = useState<Submission[] | null | 'loading'>('loading')
  const [queue, setQueue] = useState<PendingSubmission[]>(loadSubmissions)
  const [failed, setFailed] = useState(false)
  // Read once, on arrival: the words accepted since the last visit keep their
  // highlight for the whole visit, though the server forgets them at once.
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())

  const refresh = useCallback(() => {
    setQueue(loadSubmissions())
    return fetchMySubmissions().then(setServer)
  }, [])

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
  const rejected = submissions.filter((submission) => submission.status === 'rejected').map(fromServer)
  const nothing = server !== 'loading' && pending.length === 0 && accepted.length === 0 && rejected.length === 0

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
                {accepted.map((entry) => (
                  <RequestRow key={entry.key} entry={entry} fresh={fresh.has(entry.key)} />
                ))}
              </ul>
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
    </>
  )
}

interface RequestRowProps {
  entry: Entry
  /** Accepted since the last visit. */
  fresh?: boolean
  /** Only a request still waiting can be taken back or respelled. */
  onWithdraw?(): void
  onCorrect?(display: string): Promise<boolean>
}

function RequestRow({ entry, fresh, onWithdraw, onCorrect }: RequestRowProps) {
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
    setBusy(true)
    const ok = await onCorrect(next)
    setBusy(false)
    if (ok) setEditing(false)
  }

  return (
    <li className={`request${fresh ? ' request--fresh' : ''}`}>
      <CategoryIcon categoryId={entry.categoryId} tint={motif.tint} className="category-shape" />
      {editing ? (
        <form className="request-edit" onSubmit={save}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label={t.requests.correctLabel(entry.display)}
            autoComplete="off"
            autoFocus
            maxLength={60}
          />
          <button type="submit" className="btn btn--quiet" disabled={busy || draft.trim() === ''}>
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
            </span>
          </span>
          {fresh && <span className="request-fresh">{t.requests.fresh}</span>}
          {onWithdraw && onCorrect && (
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
      <p className="moderation-panel-waiting">{t.moderation.waiting(status.queue)}</p>
      <button type="button" className="btn btn--blue btn--block" onClick={onModerate}>
        {t.moderation.start(Math.min(MODERATION_SESSION_SIZE, status.queue))}
      </button>
    </section>
  )
}
