import { useState } from 'react'
import { MODERATOR_LEVEL, type ModeratorOfferReason } from '../domain/moderation'
import { answerModeratorOffer } from '../lib/cloud'
import { useT } from '../i18n'
import { Burst, Shape } from './bauhaus'
import { VerdictMark } from './VerdictMark'

interface ModeratorOfferProps {
  reason: ModeratorOfferReason
  invitedBy: string | null
  /** A moderator needs a named account: the anonymous player is sent to create one first. */
  anonymous: boolean
  onAccount(): void
  /** Answered, either way: the caller refreshes what the server now says. */
  onAnswered(accepted: boolean): void
  /** Closed without answering: offered again next time. */
  onLater(): void
  onModerate(): void
  /** The server call, replaced on the debug board so an answer there changes nothing. */
  answerOffer?: typeof answerModeratorOffer
}

/** A small card that asks, never insists: « Non merci » is as large as « J’en suis ». */
export function ModeratorOffer({ reason, invitedBy, anonymous, onAccount, onAnswered, onLater, onModerate, answerOffer = answerModeratorOffer }: ModeratorOfferProps) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [welcomed, setWelcomed] = useState(false)

  const answer = async (accept: boolean) => {
    setBusy(true)
    const ok = await answerOffer(reason, accept)
    setBusy(false)
    setFailed(!ok)
    if (!ok) return
    if (accept) setWelcomed(true)
    else onAnswered(false)
  }

  const lead =
    reason === 'friend' && invitedBy
      ? t.moderation.offer.friend(invitedBy)
      : reason === 'words'
        ? t.moderation.offer.words
        : t.moderation.offer.level(MODERATOR_LEVEL)

  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="moderator-offer-title">
      <div className="offer-pop-scrim" onClick={welcomed ? () => onAnswered(true) : onLater} />
      <div className="offer-pop">
        <span className="offer-pop-art" aria-hidden="true">
          <span className="offer-pop-shape offer-pop-shape--circle">
            <Shape kind="circle" tint="yellow" />
          </span>
          <span className="offer-pop-shape offer-pop-shape--tick">
            <VerdictMark verdict="correct" />
          </span>
          {welcomed && <Burst />}
        </span>

        {welcomed ? (
          <>
            <h2 id="moderator-offer-title" className="offer-pop-title">
              {t.moderation.offer.welcome}
            </h2>
            <p>{t.moderation.offer.welcomeLead}</p>
            <div className="offer-pop-actions">
              <button type="button" className="btn btn--ghost" onClick={() => onAnswered(true)}>
                {t.moderation.offer.close}
              </button>
              <button
                type="button"
                className="btn btn--blue"
                onClick={() => {
                  onAnswered(true)
                  onModerate()
                }}
              >
                {t.moderation.offer.open}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="moderator-offer-title" className="offer-pop-title">
              {t.moderation.offer.title}
            </h2>
            <p>{lead}</p>
            <p className="note">{t.moderation.offer.how}</p>
            {anonymous && <p className="note note--warn">{t.moderation.offer.needAccount}</p>}
            {failed && <p className="note note--warn">{t.moderation.offer.failed}</p>}
            <div className="offer-pop-actions">
              {anonymous ? (
                <>
                  <button type="button" className="btn btn--ghost" onClick={onLater}>
                    {t.moderation.offer.later}
                  </button>
                  <button type="button" className="btn btn--blue" onClick={onAccount}>
                    {t.moderation.offer.createAccount}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn--ghost" onClick={() => answer(false)} disabled={busy}>
                    {t.moderation.offer.decline}
                  </button>
                  <button type="button" className="btn btn--blue" onClick={() => answer(true)} disabled={busy}>
                    {busy ? t.wait : t.moderation.offer.accept}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
