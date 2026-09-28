import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { tapFeedback } from '../lib/native'
import { sound } from '../lib/sound'
import { Shape } from './bauhaus'
import { useBackDismiss } from './useBackDismiss'

/** How long the pretend payment « processes », then how long the welcome stays. */
const PAYING_MS = 1300
const WELCOME_MS = 1100

/**
 * A pretend checkout, for Premium while it is free: the order, a total of
 * zero, one button. It asks for no card and sends nothing — it is there so
 * that joining feels like joining, not like a switch flipped.
 */
export function Checkout({ onPaid, onCancel }: { onPaid(): void; onCancel(): void }) {
  const t = useT()
  const [step, setStep] = useState<'order' | 'paying' | 'done'>('order')
  useBackDismiss(step === 'order' ? onCancel : null)
  const paid = useRef(onPaid)
  useEffect(() => {
    paid.current = onPaid
  })

  useEffect(() => {
    if (step === 'paying') {
      const timer = setTimeout(() => {
        setStep('done')
        tapFeedback('heavy')
        sound.levelUp()
      }, PAYING_MS)
      return () => clearTimeout(timer)
    }
    if (step === 'done') {
      const timer = setTimeout(() => paid.current(), WELCOME_MS)
      return () => clearTimeout(timer)
    }
  }, [step])

  return (
    <div className="checkout-layer" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <div className="checkout">
        <header className="checkout-head">
          <svg className="checkout-lock" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="1.5" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <h2 id="checkout-title">{t.checkout.title}</h2>
        </header>

        {step === 'done' ? (
          <div className="checkout-done">
            <span className="checkout-done-art" aria-hidden="true">
              <Shape kind="sun" tint="yellow" />
            </span>
            <p className="offer-pop-title">{t.checkout.done}</p>
          </div>
        ) : (
          <>
            <section className="checkout-order">
              <div className="spread">
                <strong className="checkout-plan">{t.checkout.plan}</strong>
                <span>{t.checkout.price}</span>
              </div>
              <ul className="checkout-perks">
                <li>{t.checkout.perkBans}</li>
                <li>{t.checkout.perkPeeks}</li>
              </ul>
              <p className="note">{t.checkout.period}</p>
            </section>
            <div className="spread checkout-total">
              <span>{t.checkout.total}</span>
              <strong>{t.checkout.price}</strong>
            </div>
            <p className="note">{t.checkout.note}</p>
            <button
              type="button"
              className="btn btn--blue btn--block checkout-pay"
              disabled={step === 'paying'}
              onClick={() => setStep('paying')}
            >
              {step === 'paying' ? (
                <>
                  <span className="checkout-spinner" aria-hidden="true" />
                  {t.checkout.paying}
                </>
              ) : (
                t.checkout.pay
              )}
            </button>
            {step === 'order' && (
              <button type="button" className="btn btn--quiet btn--muted" onClick={onCancel}>
                {t.checkout.cancel}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
