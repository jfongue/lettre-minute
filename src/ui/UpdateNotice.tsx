import { useEffect } from 'react'
import { useT } from '../i18n'
import { sound } from '../lib/sound'
import { Shape } from './bauhaus'
import { useBackDismiss } from './useBackDismiss'

/** The Play Store has a newer build: the way there, or later — once per launch. */
export function UpdateNotice({ onLater, onUpdate }: { onLater(): void; onUpdate(): void }) {
  const t = useT()
  useBackDismiss(onLater)
  useEffect(() => sound.pop(), [])
  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="update-notice-title">
      <div className="offer-pop-scrim" onClick={onLater} />
      <div className="offer-pop">
        <span className="offer-pop-art" aria-hidden="true">
          <span className="offer-pop-shape offer-pop-shape--circle">
            <Shape kind="triangle" tint="blue" />
          </span>
        </span>
        <h2 id="update-notice-title" className="offer-pop-title">
          {t.update.title}
        </h2>
        <p>{t.update.lead}</p>
        <div className="offer-pop-actions">
          <button type="button" className="btn btn--ghost" onClick={onLater}>
            {t.update.later}
          </button>
          <button type="button" className="btn btn--blue" onClick={onUpdate}>
            {t.update.go}
          </button>
        </div>
      </div>
    </div>
  )
}
