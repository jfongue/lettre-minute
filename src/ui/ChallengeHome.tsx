import { useRef, useState, type CSSProperties, type ReactNode, type TouchEvent } from 'react'
import { useT } from '../i18n'
import type { ChallengeSummary } from '../lib/cloud'
import { Burst, Shape } from './bauhaus'
import { CategoryIcon } from './CategoryIcon'
import {
  challengeStatus,
  challengeTitle,
  hideChallenge,
  hoursLeft,
  isHidden,
} from '../state/challenges'
import { categoryMotif, onTint } from './motifs'
import { useHiddenChallenges } from '../state/useHiddenChallenges'
import { useBackDismiss } from './useBackDismiss'

interface ChallengeListProps {
  challenges: readonly ChallengeSummary[]
  onOpen(id: string): void
  onCreate(): void
  /** To the old challenges, at the bottom of the statistics. */
  onPast(): void
}

/** Under « Jouer »: the challenges under way and those just over, and the way to start one. */
export function ChallengeList({ challenges, onOpen, onCreate, onPast }: ChallengeListProps) {
  const t = useT()
  const hidden = useHiddenChallenges()
  const shown = challenges.filter((challenge) => !isHidden(hidden, challenge))
  return (
    <section className="panel challenges">
      <div className="spread">
        {challenges.length > shown.length ? (
          <button type="button" className="section-title challenge-past" onClick={onPast}>
            {t.challenge.title}
          </button>
        ) : (
          <p className="section-title">{t.challenge.title}</p>
        )}
        <button type="button" className="btn btn--quiet" onClick={onCreate}>
          {t.challenge.create}
        </button>
      </div>
      {shown.length > 0 && (
        <ul className="challenge-rows">
          {shown.map((challenge, index) => {
            const status = challengeStatus(challenge)
            const fresh = (status === 'to-play' && !challenge.seenInvite) || (status === 'finished' && !challenge.seenRecap)
            const lead = challenge.categoryIds[0] ?? ''
            const motif = categoryMotif(lead)
            const row = (open: () => void) => (
                <button type="button" className={`challenge-row challenge-row--${status}`} onClick={open}>
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
            )
            return (
              <li key={challenge.id} style={{ '--i': index } as CSSProperties}>
                {challenge.finished ? (
                  <Dismissable label={t.challenge.ignore} onDismiss={() => hideChallenge(hidden, challenge)}>
                    {(open) => row(open(() => onOpen(challenge.id)))}
                  </Dismissable>
                ) : (
                  row(() => onOpen(challenge.id))
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

const REVEAL_DISTANCE = 50
const LONG_PRESS_MS = 550

/**
 * A finished challenge slides left, or answers a long press, to show
 * « Ignorer ». While it shows, a tap on the row puts it back rather than
 * opening the challenge.
 */
function Dismissable({
  label,
  onDismiss,
  children,
}: {
  label: string
  onDismiss(): void
  children(open: (go: () => void) => () => void): ReactNode
}) {
  const [revealed, setRevealed] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const press = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pressed = useRef(false)

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0]
    start.current = touch ? { x: touch.clientX, y: touch.clientY } : null
    pressed.current = false
    press.current = setTimeout(() => {
      pressed.current = true
      setRevealed(true)
    }, LONG_PRESS_MS)
  }
  const onTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0]
    const from = start.current
    if (!touch || !from) return
    const dx = touch.clientX - from.x
    if (Math.abs(dx) > 8 || Math.abs(touch.clientY - from.y) > 8) clearTimeout(press.current)
    if (dx < -REVEAL_DISTANCE && Math.abs(touch.clientY - from.y) < Math.abs(dx) / 2) setRevealed(true)
    else if (dx > REVEAL_DISTANCE) setRevealed(false)
  }
  const onTouchEnd = () => clearTimeout(press.current)

  return (
    <div
      className={`dismissable${revealed ? ' dismissable--revealed' : ''}`}
      data-no-swipe
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onContextMenu={(event) => {
        // The long press already answered: no browser menu on top of it.
        event.preventDefault()
        setRevealed(true)
      }}
    >
      <div className="dismissable-row">
        {children((go) => () => {
          // The click that ends a long press is not a tap on the row.
          if (pressed.current) {
            pressed.current = false
            return
          }
          if (revealed) setRevealed(false)
          else go()
        })}
      </div>
      <button type="button" className="dismissable-action" tabIndex={revealed ? 0 : -1} onClick={onDismiss}>
        {label}
      </button>
      {/* With a mouse there is no swipe: the row shows its own cross on hover. */}
      <button type="button" className="dismissable-cross" aria-label={label} title={label} onClick={onDismiss}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}

interface ChallengeNoticeProps {
  challenge: Pick<ChallengeSummary, 'ownerName' | 'players' | 'expiresAt'>
  kind: 'invite' | 'recap'
  onLater(): void
  onGo(): void
}

/** The in-app notification: the challenge a friend just sent, or the one whose recap is ready. */
export function ChallengeNotice({ challenge, kind, onLater, onGo }: ChallengeNoticeProps) {
  const t = useT()
  useBackDismiss(onLater)
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
        {invite && <p className="note">{t.challenge.invitePop.laterHint}</p>}
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
