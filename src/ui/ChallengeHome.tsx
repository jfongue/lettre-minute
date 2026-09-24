import type { CSSProperties } from 'react'
import { useT } from '../i18n'
import type { ChallengeSummary } from '../lib/cloud'
import { Burst, Shape } from './bauhaus'
import { CategoryIcon } from './CategoryIcon'
import { challengeStatus, challengeTitle, hoursLeft } from '../state/challenges'
import { categoryMotif, onTint } from './motifs'

interface ChallengeListProps {
  challenges: readonly ChallengeSummary[]
  onOpen(id: string): void
  onCreate(): void
}

/** Under « Jouer »: the challenges under way and those just over, and the way to start one. */
export function ChallengeList({ challenges, onOpen, onCreate }: ChallengeListProps) {
  const t = useT()
  return (
    <section className="panel challenges">
      <div className="spread">
        <p className="section-title">{t.challenge.title}</p>
        <button type="button" className="btn btn--quiet" onClick={onCreate}>
          {t.challenge.create}
        </button>
      </div>
      {challenges.length > 0 && (
        <ul className="challenge-rows">
          {challenges.map((challenge, index) => {
            const status = challengeStatus(challenge)
            const fresh = (status === 'to-play' && !challenge.seenInvite) || (status === 'finished' && !challenge.seenRecap)
            const lead = challenge.categoryIds[0] ?? ''
            const motif = categoryMotif(lead)
            return (
              <li key={challenge.id} style={{ '--i': index } as CSSProperties}>
                <button type="button" className={`challenge-row challenge-row--${status}`} onClick={() => onOpen(challenge.id)}>
                  <span className="challenge-row-mark" style={{ background: `var(--${motif.tint})` }} aria-hidden="true">
                    <CategoryIcon categoryId={lead} tint={onTint(motif.tint)} />
                  </span>
                  <span className="challenge-row-text">
                    <strong>{challengeTitle(t, challenge)}</strong>
                    <span className="note">
                      {t.challenge.status[status]} · {t.challenge.playedCount(challenge.played, challenge.players)}
                      {!challenge.finished && ` · ${t.challenge.hoursLeft(hoursLeft(challenge.expiresAt))}`}
                    </span>
                  </span>
                  <span className={`challenge-row-action${status === 'to-play' ? ' challenge-row-action--play' : ''}`}>
                    {status === 'to-play' ? t.challenge.play : status === 'waiting' ? t.challenge.view : t.challenge.recap}
                    {fresh && <span className="badge-dot" aria-hidden="true" />}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

interface ChallengeNoticeProps {
  challenge: ChallengeSummary
  kind: 'invite' | 'recap'
  onLater(): void
  onGo(): void
}

/** The in-app notification: the challenge a friend just sent, or the one whose recap is ready. */
export function ChallengeNotice({ challenge, kind, onLater, onGo }: ChallengeNoticeProps) {
  const t = useT()
  const invite = kind === 'invite'
  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="challenge-notice-title">
      <div className="offer-pop-scrim" onClick={onLater} />
      <div className="offer-pop challenge-notice">
        <span className="offer-pop-art" aria-hidden="true">
          <span className="offer-pop-shape offer-pop-shape--circle">
            <Shape kind={invite ? 'triangle' : 'sun'} tint={invite ? 'red' : 'yellow'} />
          </span>
          {!invite && <Burst />}
        </span>
        <h2 id="challenge-notice-title" className="offer-pop-title">
          {invite ? t.challenge.invitePop.title(challenge.ownerName) : t.challenge.overPop.title}
        </h2>
        <p>
          {invite
            ? t.challenge.invitePop.lead(challenge.players, hoursLeft(challenge.expiresAt))
            : t.challenge.overPop.lead(challenge.ownerName)}
        </p>
        <div className="offer-pop-actions">
          <button type="button" className="btn btn--ghost" onClick={onLater}>
            {invite ? t.challenge.invitePop.later : t.challenge.overPop.later}
          </button>
          <button type="button" className="btn btn--blue" onClick={onGo}>
            {invite ? t.challenge.invitePop.play : t.challenge.overPop.open}
          </button>
        </div>
      </div>
    </div>
  )
}
