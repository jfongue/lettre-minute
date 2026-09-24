import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { SUBMISSION_REWARD_XP } from '../domain/progression'
import { cancelSubmission, correctSubmission, fetchMySubmissions, type Submission } from '../lib/cloud'
import { categoryText, useT } from '../i18n'
import { loadSubmissions, saveSubmissions, type PendingSubmission } from '../state/storage'
import { Shape } from './bauhaus'
import { categoryMotif } from './motifs'

/**
 * A request as the page lists it: still on the device, waiting for the next
 * connection, or already on the server with the status it was given there.
 */
type Entry =
  | { source: 'queued'; key: string; categoryId: string; display: string; queued: PendingSubmission }
  | { source: 'server'; key: string; categoryId: string; display: string; submission: Submission }

export function RequestsPage() {
  const t = useT()
  const [server, setServer] = useState<Submission[] | null | 'loading'>('loading')
  const [queue, setQueue] = useState<PendingSubmission[]>(loadSubmissions)
  const [failed, setFailed] = useState(false)

  const refresh = useCallback(() => {
    setQueue(loadSubmissions())
    return fetchMySubmissions().then(setServer)
  }, [])

  useEffect(() => {
    fetchMySubmissions().then(setServer)
  }, [])

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
                  <RequestRow key={entry.key} entry={entry} />
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
  /** Only a request still waiting can be taken back or respelled. */
  onWithdraw?(): void
  onCorrect?(display: string): Promise<boolean>
}

function RequestRow({ entry, onWithdraw, onCorrect }: RequestRowProps) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.display)
  const [busy, setBusy] = useState(false)
  const motif = categoryMotif(entry.categoryId)

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
    <li className="request">
      <Shape kind={motif.kind} tint={motif.tint} className="category-shape" />
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
            </span>
          </span>
          {onWithdraw && onCorrect && (
            <span className="friend-actions">
              <button type="button" className="btn btn--quiet" onClick={() => setEditing(true)}>
                {t.requests.correct}
              </button>
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
