import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { tapFeedback } from '../lib/native'
import { sound } from '../lib/sound'
import { Burst } from './bauhaus'
import { PlusSeal, ResourceGlyph, InfinityMark, type ResourceIcon } from './premium'
import { useBackDismiss } from './useBackDismiss'

/** What the player reached for when the sheet opened: its line leads the list. */
export type PremiumReason = 'filter' | 'reveal' | 'attempt' | 'premiere' | 'ads' | 'slot' | 'menu'

export type PremiumStatus = 'idle' | 'loading' | 'success' | 'error' | 'cancelled'

/** Premium's allowances, as the sheet promises them. */
const FILTERS = 6
const ATTEMPTS = 5

type BenefitId = 'filter' | 'reveal' | 'attempt' | 'premiere' | 'ads' | 'indie' | 'lifetime'

const BENEFITS: readonly { id: BenefitId; icon: ResourceIcon; value: 'filters' | 'infinity' | 'attempts' | null }[] = [
  { id: 'filter', icon: 'lock', value: 'filters' },
  { id: 'reveal', icon: 'eye', value: 'infinity' },
  { id: 'attempt', icon: 'ticket', value: 'attempts' },
  { id: 'premiere', icon: 'premiere', value: null },
  { id: 'ads', icon: 'noads', value: null },
  { id: 'indie', icon: 'heart', value: null },
  { id: 'lifetime', icon: 'forever', value: null },
]

const LEAD: Partial<Record<PremiumReason, BenefitId>> = {
  filter: 'filter',
  reveal: 'reveal',
  attempt: 'attempt',
  premiere: 'premiere',
  ads: 'ads',
}

/** Held on the welcome long enough for the arpeggio and the burst to land. */
const WELCOME_BEAT_MS = 450

/**
 * The one Premium offer, opened from anywhere: the seal, the allowances, one
 * purchase. `status` pins a state for the debug board; left out, the sheet
 * runs its own — idle, then loading while the store answers.
 */
export function PremiumSheet({
  reason,
  price,
  onBuy,
  onRestore,
  onClose,
  status: pinned,
}: {
  reason: PremiumReason
  /** The store's localised price; null while it has not answered. */
  price: string | null
  onBuy(): Promise<'ok' | 'cancel' | 'error'>
  onRestore(): void
  onClose(): void
  status?: PremiumStatus
}) {
  const t = useT()
  const [own, setOwn] = useState<PremiumStatus>('idle')
  const status = pinned ?? own
  useBackDismiss(status === 'loading' ? null : onClose)

  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    if (status === 'idle') sound.plus()
  }, [status])

  const welcomed = useRef(false)
  useEffect(() => {
    if (status !== 'success' || welcomed.current) return
    welcomed.current = true
    tapFeedback('heavy')
    const timer = setTimeout(() => sound.plusWelcome(), WELCOME_BEAT_MS / 3)
    return () => clearTimeout(timer)
  }, [status])

  const buy = async () => {
    setOwn('loading')
    const result = await onBuy().catch(() => 'error' as const)
    if (!alive.current) return
    setOwn(result === 'ok' ? 'success' : result === 'cancel' ? 'cancelled' : 'error')
  }

  const lead = LEAD[reason]
  const benefits = [...BENEFITS].sort((a, b) => Number(b.id === lead) - Number(a.id === lead))
  const text = t.premium.benefits
  const line = (id: BenefitId): string =>
    id === 'filter'
      ? text.filter(FILTERS)
      : id === 'attempt'
        ? text.attempt(ATTEMPTS)
        : text[id]

  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="premium-title">
      <div className="offer-pop-scrim" onClick={status === 'loading' ? undefined : onClose} />
      <div className="psheet">
        {status === 'success' ? (
          <div className="psheet-done">
            <span className="psheet-done-art">
              <PlusSeal size="lg" animated />
              <Burst />
            </span>
            <h2 id="premium-title" className="psheet-welcome">
              {t.premium.welcome}
            </h2>
            <p className="psheet-note">{t.premium.welcomeNote}</p>
            <button type="button" className="btn psheet-buy" onClick={onClose}>
              {t.premium.continue}
            </button>
          </div>
        ) : (
          <>
            <header className="psheet-head">
              <PlusSeal size="lg" animated />
              <div className="psheet-heading">
                <h2 id="premium-title">{t.premium.title}</h2>
                <span className="psheet-lifetime">{t.premium.lifetime}</span>
              </div>
            </header>

            <ul className="psheet-list">
              {benefits.map((benefit) => (
                <li key={benefit.id} className={benefit.id === lead ? 'psheet-benefit psheet-benefit--lead' : 'psheet-benefit'}>
                  <ResourceGlyph icon={benefit.icon} plus />
                  <span className="psheet-benefit-text">{line(benefit.id)}</span>
                  {benefit.value && (
                    <span className="psheet-value">
                      {benefit.value === 'filters' ? FILTERS : benefit.value === 'attempts' ? ATTEMPTS : <InfinityMark />}
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {status === 'error' && (
              <p className="psheet-note psheet-note--error" role="alert">
                {t.premium.error}
              </p>
            )}
            {status === 'cancelled' && <p className="psheet-note">{t.premium.cancelled}</p>}

            <button type="button" className="btn psheet-buy" disabled={status === 'loading'} onClick={buy}>
              {status === 'loading' ? (
                <>
                  <span className="psheet-spinner" aria-hidden="true" />
                  {t.premium.loading}
                </>
              ) : status === 'error' ? (
                t.premium.retry
              ) : (
                t.premium.buy(price ?? t.premium.fallbackPrice)
              )}
            </button>
            <div className="psheet-links">
              <button type="button" className="psheet-link" disabled={status === 'loading'} onClick={onRestore}>
                {t.premium.restore}
              </button>
              <button type="button" className="psheet-link" disabled={status === 'loading'} onClick={onClose}>
                {t.premium.later}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
