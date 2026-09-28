import { useT } from '../i18n'
import { Shape } from './bauhaus'
import { useBackDismiss } from './useBackDismiss'

/** Before the phone's own question: said once a friendship lets challenges come in. */
export function PushOffer({ onNo, onYes }: { onNo(): void; onYes(): void }) {
  const t = useT()
  // The gesture is the same answer as the scrim: « non », and the next friend asks again.
  useBackDismiss(onNo)
  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="push-offer-title">
      <div className="offer-pop-scrim" onClick={onNo} />
      <div className="offer-pop">
        <span className="offer-pop-art" aria-hidden="true">
          <span className="offer-pop-shape offer-pop-shape--circle">
            <Shape kind="sun" tint="yellow" />
          </span>
        </span>
        <h2 id="push-offer-title" className="offer-pop-title">
          {t.pushOffer.title}
        </h2>
        <p>{t.pushOffer.lead}</p>
        <div className="offer-pop-actions">
          <button type="button" className="btn btn--ghost" onClick={onNo}>
            {t.pushOffer.no}
          </button>
          <button type="button" className="btn btn--blue" onClick={onYes}>
            {t.pushOffer.yes}
          </button>
        </div>
      </div>
    </div>
  )
}
