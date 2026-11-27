import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { OFFER_SECONDS, stakes } from '../domain/ranked'
import { useT } from '../i18n'
import { tapFeedback } from '../lib/native'
import { armSound, sound } from '../lib/sound'
import type { DuelQueue, FoundOffer } from '../state/duelQueue'
import { loadAccount, loadAvatar } from '../state/storage'
import { Avatar } from './Avatar'
import { LeagueChip } from './League'
import { reducedMotion } from './useCountUp'
import '../ranked.css'

/**
 * Un adversaire est trouvé : par-dessus n'importe quel écran — l'accueil, la
 * table des joueurs ordinateur —, les deux places face à face, l'enjeu au
 * classement, et vingt secondes pour accepter qui se consument sous les yeux.
 * Accepter ne lance rien tant que l'autre n'a pas accepté aussi : sa place le
 * dit. Ne rien faire, c'est laisser passer, et sortir de la file.
 */
export function MatchFound({ queue }: { queue: DuelQueue }) {
  const t = useT()
  const { state, now } = queue
  const offer: FoundOffer | null = state.kind === 'found' ? state.offer : null
  const deadline = state.kind === 'found' ? state.deadline : 0
  const sending = state.kind === 'found' && state.sending
  const me = useMemo(() => ({ avatar: loadAccount()?.avatar ?? loadAvatar(), name: loadAccount()?.name?.trim() || '' }), [])
  const accept = useRef<HTMLButtonElement>(null)
  const table = offer?.table ?? null

  // L'arrivée se sent et s'entend, une fois par proposition.
  useEffect(() => {
    if (!table) return
    armSound()
    sound.go()
    tapFeedback('heavy')
    accept.current?.focus()
  }, [table])

  // La mèche se règle une fois par proposition : la relancer à chaque seconde
  // la ferait repartir de plus haut qu'elle n'était.
  const lit = useRef<{ table: string; from: number; left: number } | null>(null)
  if (table && lit.current?.table !== table) {
    const remaining = Math.max(0, deadline - now)
    lit.current = { table, from: Math.min(1, remaining / OFFER_SECONDS), left: remaining }
  }

  if (!offer) return null
  const left = Math.max(0, deadline - now)
  const them = offer.opponent
  const stake = them ? stakes(offer.me, them) : null
  const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : '0')
  const still = reducedMotion()
  const fuse = (still ? { '--from': Math.min(1, left / OFFER_SECONDS) } : { '--from': lit.current?.from ?? 1, '--left': `${lit.current?.left ?? OFFER_SECONDS}s` }) as unknown as CSSProperties

  return (
    <div className="match-found" role="alertdialog" aria-modal="true" aria-labelledby="match-found-title" aria-describedby="match-found-stakes" data-no-swipe>
      <div className="match-found__card">
        <p className="eyebrow">{t.ranked.foundEyebrow}</p>
        <h2 id="match-found-title" className="match-found__title">
          {t.ranked.foundTitle}
        </h2>
        <div className="match-found__versus">
          <span className={`match-found__seat match-found__seat--me${offer.accepted ? ' match-found__seat--ready' : ''}`}>
            <Avatar choice={me.avatar} size="md" />
            <b>{me.name || t.duel.you}</b>
            <LeagueChip rating={offer.me.rating} games={offer.me.games} compact />
            {offer.accepted ? <span className="match-found__ready">{t.ranked.accepted}</span> : null}
          </span>
          <span className="match-found__vs">{t.ranked.vs}</span>
          <span className={`match-found__seat match-found__seat--them${them?.accepted ? ' match-found__seat--ready' : ''}`}>
            {them ? <Avatar choice={them.avatar} size="md" /> : null}
            <b>{them?.name ?? '…'}</b>
            {them ? <LeagueChip rating={them.rating} games={them.games} compact /> : null}
            {them?.accepted ? <span className="match-found__ready">{t.ranked.accepted}</span> : null}
          </span>
        </div>
        <p id="match-found-stakes" className="match-found__stakes">
          {offer.ranked && stake ? (
            <>
              <span className="match-found__tag">{t.ranked.ranked}</span>
              <span>{t.ranked.stakes(signed(stake.win), signed(stake.loss))}</span>
            </>
          ) : (
            <span className="match-found__tag match-found__tag--friendly">{t.ranked.friendly}</span>
          )}
        </p>
        <div className="match-found__fuse" aria-hidden="true">
          <i key={table} className={still ? 'match-found__fuse--still' : ''} style={fuse} />
        </div>
        <p className="match-found__count" aria-live="off">
          {t.ranked.countdown(Math.ceil(left))}
        </p>
        {offer.accepted ? (
          <p className="match-found__waiting" role="status">
            {t.ranked.waitingFor(them?.name ?? '…')}
            <span className="duel-notice__dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </p>
        ) : (
          <div className="stack match-found__actions">
            <button
              ref={accept}
              type="button"
              className="btn btn--play btn--block match-found__accept"
              disabled={sending}
              onClick={() => {
                armSound()
                sound.go()
                queue.accept()
              }}
            >
              <span>{t.ranked.accept}</span>
              <span className="match-found__accept-count clock" aria-hidden="true">
                {Math.ceil(left)}
              </span>
            </button>
            <button type="button" className="btn btn--ghost btn--block" disabled={sending} onClick={queue.decline}>
              {t.ranked.decline}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
