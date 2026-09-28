import { useState } from 'react'
import { useT } from '../i18n'
import { Checkout } from './Checkout'
import { Shape } from './bauhaus'
import { useBackDismiss } from './useBackDismiss'

/** What the player reached for past the free share: a second ban, or a sixth hidden word. */
export type PlusReason = 'ban' | 'peek'

/** Premium is free for now: the offer says so, and joining goes through a pretend checkout. */
export function PlusPop({ reason, onJoin, onClose }: { reason: PlusReason; onJoin(): void; onClose(): void }) {
  const t = useT()
  const [paying, setPaying] = useState(false)
  useBackDismiss(paying ? null : onClose)
  if (paying) return <Checkout onPaid={onJoin} onCancel={() => setPaying(false)} />
  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="plus-pop-title">
      <div className="offer-pop-scrim" onClick={onClose} />
      <div className="offer-pop plus-pop">
        <span className="offer-pop-art" aria-hidden="true">
          <span className="offer-pop-shape offer-pop-shape--circle">
            <Shape kind="sun" tint="yellow" />
          </span>
        </span>
        <h2 id="plus-pop-title" className="offer-pop-title">
          {t.plus.title}
        </h2>
        <p>{t.plus[reason]}</p>
        <div className="offer-pop-actions plus-pop-actions">
          <button type="button" className="btn btn--blue plus-join" onClick={() => setPaying(true)}>
            <span>{t.plus.join}</span>
            <span className="plus-free">{t.plus.free}</span>
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t.plus.later}
          </button>
        </div>
      </div>
    </div>
  )
}
