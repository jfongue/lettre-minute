import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { BONUS_CAPS, bonusCount, isBonusId, type BonusId } from '../domain/bonus'
import type { Profile } from '../domain/progression'
import { useT } from '../i18n'
import { tapFeedback } from '../lib/native'
import { sound } from '../lib/sound'
import { Burst, Shape } from './bauhaus'
import { onTint, type Tint } from './motifs'
import { EyeIcon, LockIcon, SlotIcon } from './premium'
import { reducedMotion } from './useCountUp'

interface BonusOfferScreenProps {
  offer: readonly string[]
  /** Bonuses still owed, this one included. */
  owed: number
  /** The level this run reached, when it crossed one. */
  level: number | null
  /** What the player already holds: the card says which one of how many this would be. */
  profile: Profile
  onChoose(bonusId: string): void
  onDone(): void
}

const LEAVE_MS = 420
const SEALED_MS = 2600

type Phase = 'choosing' | 'leaving' | 'sealed'

/** Each bonus keeps one colour, as each power does. */
const TINTS: Record<BonusId, Tint> = { filter: 'red', slot: 'blue', reveal: 'yellow', moderator: 'green' }

function CheckIcon() {
  return (
    <svg className="pi" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle className="pi-body" cx="12" cy="12" r="9" />
      <path className="pi-detail" d="M7.5 12.5l3 3 6-7" />
    </svg>
  )
}

const ICONS: Record<BonusId, ReactNode> = {
  filter: <LockIcon />,
  slot: <SlotIcon />,
  reveal: <EyeIcon />,
  moderator: <CheckIcon />,
}

function ground(id: BonusId): CSSProperties {
  const tint = TINTS[id]
  return { background: `var(--${tint})`, color: `var(--${onTint(tint)})` }
}

/**
 * A level bonus: two cards, one kept for good. Staged like the power offer —
 * the loser falls away, the kept card takes the screen — so a bonus feels like
 * the reward it is, whatever it turns out to be.
 */
export function BonusOfferScreen({ onChoose, onDone, ...dealt }: BonusOfferScreenProps) {
  const t = useT()
  // Read once: the pick empties the offer, and the celebration still shows the cards.
  const [{ offer, owed, level, profile }] = useState(dealt)
  const cards = offer.filter(isBonusId)
  const [selected, setSelected] = useState<BonusId | null>(null)
  const [phase, setPhase] = useState<Phase>('choosing')

  const finish = useRef(onDone)
  useEffect(() => {
    finish.current = onDone
  })
  useEffect(() => {
    if (phase === 'choosing') return
    const fast = reducedMotion()
    const timer =
      phase === 'leaving'
        ? setTimeout(() => setPhase('sealed'), fast ? 0 : LEAVE_MS)
        : setTimeout(() => finish.current(), fast ? 1200 : SEALED_MS)
    return () => clearTimeout(timer)
  }, [phase])

  const pick = (id: BonusId) => {
    if (phase !== 'choosing') return
    setSelected(id)
    tapFeedback()
    sound.click()
  }

  // Keep the pick before the celebration: leaving now must not cost the bonus.
  const confirm = () => {
    if (!selected || phase !== 'choosing') return
    onChoose(selected)
    tapFeedback('medium')
    sound.levelUp()
    setPhase('leaving')
  }

  return (
    <div
      className={`sheet unlock-screen power-offer bonus-offer unlock-screen--${phase}`}
      onClick={phase === 'sealed' ? () => finish.current() : undefined}
      role="presentation"
    >
      <header className="unlock-head power-offer-head">
        <Shape kind="sun" tint="yellow" className="unlock-head-sun" />
        <p className="eyebrow">{level !== null ? t.over.levelReached(level) : t.over.levelUp}</p>
        <h1 className="unlock-title">{t.bonus.title}</h1>
        <p className="power-offer-lead">{t.bonus.lead}</p>
        {owed > 1 && <p className="power-offer-queue">{t.offer.more(owed - 1)}</p>}
      </header>

      {phase === 'sealed' && selected ? (
        <div className="unlock-seal power-seal bonus-seal" style={ground(selected)}>
          <span className="bonus-seal-icon">{ICONS[selected]}</span>
          <span className="unlock-seal-burst">
            <Burst />
          </span>
          <p className="unlock-seal-label">{t.bonus.kinds[selected][0]}</p>
          <p className="unlock-seal-joined">{t.bonus.joined}</p>
          <span className="unlock-seal-stamp">
            <Shape kind="circle" tint="ink" />
            <span>✓</span>
          </span>
        </div>
      ) : (
        <ul className="unlock-cards power-cards">
          {cards.map((id, index) => {
            const [name, description] = t.bonus.kinds[id]
            const cap = BONUS_CAPS[id]
            const state = id === selected ? ' unlock-card--selected' : selected ? ' unlock-card--dim' : ''
            return (
              <li
                key={id}
                style={{ '--i': index } as CSSProperties}
                className={phase === 'leaving' ? (id === selected ? 'unlock-card-keep' : 'unlock-card-drop') : ''}
              >
                <button
                  type="button"
                  className={`offer-card unlock-card power-card bonus-card bonus--${id}${state}`}
                  aria-pressed={id === selected}
                  style={ground(id)}
                  onClick={() => pick(id)}
                >
                  <span className="power-card-art bonus-card-art" key={id === selected ? 'on' : 'off'}>
                    {ICONS[id]}
                  </span>
                  <strong>{name}</strong>
                  <span>{description}</span>
                  {cap > 1 && <span className="power-card-uses">{t.bonus.total(bonusCount(profile, id) + 1, cap)}</span>}
                  {id === selected && (
                    <span className="unlock-card-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {phase === 'choosing' && (
        <div className="stack unlock-actions power-offer-actions">
          <button type="button" className="btn btn--play btn--block" disabled={!selected} onClick={confirm}>
            <span>{selected ? t.offer.confirm : t.offer.pickFirst}</span>
            <span className="play-glyph unlock-glyph" aria-hidden="true">
              <Shape kind="circle" tint="yellow" />
              <span className="motion play-triangle">
                <Shape kind="triangle" tint="red" />
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
