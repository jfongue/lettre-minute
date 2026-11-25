import { useEffect, useState } from 'react'
import { fetchProfileQueue, judgeProfile, type ProfileOutcome, type ProfileReview, type SubmissionStatus } from '../lib/cloud'
import { categoryText, useT } from '../i18n'
import { sound } from '../lib/sound'
import { Figure } from './bauhaus'
import { CategoryIcon } from './CategoryIcon'
import { VerdictMark } from './VerdictMark'
import { categoryMotif } from './motifs'

const MARK: Record<SubmissionStatus, 'correct' | 'incorrect' | 'unsure'> = {
  accepted: 'correct',
  rejected: 'incorrect',
  pending: 'unsure',
}

interface ProfileReviewScreenProps {
  /** Back to « Mes demandes ». */
  onDone(): void
  /** The profiles, from the debug board: no call, no server. */
  profiles?: readonly ProfileReview[]
  /** The verdict, replaced on the debug board so that nothing is written. */
  judge?: typeof judgeProfile
}

/**
 * A super moderator reads, one player at a time, the words of those the queue
 * refuses too often (0116), and bans them from proposing or lets them be. A
 * player banned on the spot comes here too: the ban is confirmed or lifted.
 */
export function ProfileReviewScreen({ onDone, profiles, judge = judgeProfile }: ProfileReviewScreenProps) {
  const t = useT()
  const text = t.moderation.profiles
  const [queue, setQueue] = useState<ProfileReview[] | null | 'loading'>(() => (profiles ? [...profiles] : 'loading'))
  const [index, setIndex] = useState(0)
  const [arming, setArming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
    if (profiles) return
    fetchProfileQueue().then(setQueue)
  }, [profiles])

  const list = queue === 'loading' || queue === null ? [] : queue
  const profile = list[index] ?? null

  const decide = async (ban: boolean) => {
    if (!profile || busy) return
    setBusy(true)
    const outcome: ProfileOutcome = await judge(profile.id, ban)
    setBusy(false)
    setFailed(outcome === 'unreachable')
    if (outcome === 'unreachable') return sound.refused()
    if (outcome === 'banned') sound.skipped()
    else sound.recognized()
    setArming(false)
    setIndex((at) => at + 1)
    window.scrollTo(0, 0)
  }

  const head = (
    <header className="moderation-head">
      <h1 className="section-title">{text.title}</h1>
      <button type="button" className="moderation-quit" onClick={onDone} aria-label={text.back} title={text.back}>
        <VerdictMark verdict="incorrect" />
      </button>
    </header>
  )

  if (queue === 'loading') {
    return (
      <div className="sheet moderation">
        <p className="note" role="status">{t.loading}</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="sheet moderation cascade">
        {head}
        <div className="moderation-empty">
          <span className="moderation-empty-art" aria-hidden="true">
            <VerdictMark verdict="correct" />
          </span>
          <p>{queue === null ? text.offline : text.empty}</p>
        </div>
        <button type="button" className="btn btn--block" onClick={onDone}>
          {t.moderation.screen.finish}
        </button>
      </div>
    )
  }

  return (
    <div className="sheet moderation profile-review cascade" key={profile.id}>
      {head}
      <p className="note">{text.lead}</p>

      <section className="profile-review-card stack">
        <div className="profile-review-name">
          <p className="word-card-word">{profile.name}</p>
          {profile.banned && <p className="tag word-card-kind word-card-kind--ban">{text.auto}</p>}
        </div>
        <div className="figures figures--three">
          <Figure tint="green" value={profile.accepted} label={text.statuses.accepted} />
          <Figure tint="red" value={profile.rejected} label={text.statuses.rejected} />
          <Figure tint="yellow" value={profile.pending} label={text.statuses.pending} />
        </div>

        <p className="section-title">{text.latest}</p>
        <ul className="requests profile-review-words">
          {profile.words.map((word) => (
            <li key={`${word.lang}:${word.categoryId}:${word.display}:${word.at}`} className={`request profile-review-word profile-review-word--${word.status}`}>
              <CategoryIcon categoryId={word.categoryId} tint={categoryMotif(word.categoryId).tint} className="category-shape" />
              <span className="request-word">
                {word.display}
                <span className="note">
                  {categoryText(t, word.categoryId).label}
                  {word.lang !== 'fr' && ` · ${word.lang.toUpperCase()}`}
                </span>
                {word.reasons.map((reason, at) => (
                  <span key={at} className="note profile-review-reason">
                    {reason}
                  </span>
                ))}
              </span>
              <span className={`profile-review-mark profile-review-mark--${word.status}`} title={text.statuses[word.status]}>
                <VerdictMark verdict={MARK[word.status]} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      {failed && <p className="note note--warn">{text.failed}</p>}
      <p className="note">{profile.banned ? text.autoLead : text.banLead}</p>
      <div className="moderation-form-actions profile-review-actions">
        <button type="button" className="btn btn--green" onClick={() => decide(false)} disabled={busy}>
          {profile.banned ? text.lift : text.clear}
        </button>
        {arming ? (
          <button type="button" className="btn btn--red" onClick={() => decide(true)} disabled={busy}>
            {busy ? t.wait : text.confirmBan}
          </button>
        ) : (
          <button type="button" className="btn btn--red" onClick={() => setArming(true)} disabled={busy}>
            {profile.banned ? text.keepBan : text.ban}
          </button>
        )}
      </div>
    </div>
  )
}
