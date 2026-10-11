import { useEffect } from 'react'
import { useT } from '../i18n'
import { storeUrl } from '../lib/native'
import { sound } from '../lib/sound'
import { Burst, Shape } from './bauhaus'
import { useBackDismiss } from './useBackDismiss'

/**
 * The five-star ask, on the way home after the tenth run: « Plus tard »
 * leaves the next one twenty runs away, « Okay » opens the store page and
 * ends the asks for good. Without a store page — an iPhone — there is no ask.
 */
export function RatingPop({ onLater, onRate }: { onLater(): void; onRate(): void }) {
  const t = useT()
  const store = storeUrl()
  useBackDismiss(onLater)
  useEffect(() => sound.news(), [])
  if (!store) return null
  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="rating-pop-title">
      <div className="offer-pop-scrim" onClick={onLater} />
      <div className="offer-pop">
        <span className="offer-pop-art" aria-hidden="true">
          <span className="offer-pop-shape offer-pop-shape--circle">
            <Shape kind="sun" tint="yellow" />
          </span>
          <Burst />
        </span>
        <h2 id="rating-pop-title" className="offer-pop-title">
          {t.support.title}
        </h2>
        <p className="note">{t.support.lead}</p>
        <div className="offer-pop-actions">
          <button type="button" className="btn btn--ghost" onClick={onLater}>
            {t.support.later}
          </button>
          <a className="btn btn--blue" href={store} target="_blank" rel="noopener noreferrer" onClick={onRate}>
            {t.support.ok}
          </a>
        </div>
      </div>
    </div>
  )
}
