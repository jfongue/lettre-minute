import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { isPowerId, POWER_CHARGES, type PowerId } from '../domain/powers'
import { useT } from '../i18n'
import { tapFeedback } from '../lib/native'
import { sound } from '../lib/sound'
import { Burst, Shape } from './bauhaus'
import { onTint, POWER_TINTS, powerGround } from './motifs'
import { PowerIcon } from './PowerIcon'
import { reducedMotion } from './useCountUp'

interface PowerOfferScreenProps {
  offer: readonly string[]
  /** Power picks still owed, this one included. */
  owed: number
  /** The level this run reached, when it crossed one. */
  level: number | null
  onChoose(powerId: string): void
  onDone(): void
}

const LEAVE_MS = 420
const SEALED_MS = 2600

type Phase = 'choosing' | 'leaving' | 'sealed'

/**
 * The categories' ritual, with two cards instead of three. Touching a card
 * plays the power's own sound and shows its own motion: the player hears and
 * sees what it will do in a run before keeping it.
 */
export function PowerOfferScreen({ onChoose, onDone, ...dealt }: PowerOfferScreenProps) {
  const t = useT()
  // Read once: the pick empties the offer, and the celebration still shows the cards.
  const [{ offer, owed, level }] = useState(dealt)
  const cards = offer.filter(isPowerId)
  const [selected, setSelected] = useState<PowerId | null>(null)
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

  const pick = (id: PowerId) => {
    if (phase !== 'choosing') return
    setSelected(id)
    tapFeedback()
    sound.power(id)
  }

  // Kept before anything plays, as for a category: leaving now must not cost the power.
  const confirm = () => {
    if (!selected || phase !== 'choosing') return
    onChoose(selected)
    tapFeedback('medium')
    sound.levelUp()
    setPhase('leaving')
  }

  return (
    <div
      className={`sheet unlock-screen power-offer unlock-screen--${phase}`}
      onClick={phase === 'sealed' ? () => finish.current() : undefined}
      role="presentation"
    >
      <header className="unlock-head">
        <Shape kind="sun" tint="yellow" className="unlock-head-sun" />
        <p className="eyebrow">
          {level !== null ? t.over.levelReached(level) : t.over.levelUp}
          {owed > 1 && ` · ${t.offer.more(owed - 1)}`}
        </p>
        <h1 className="unlock-title">{t.powers.offerTitle}</h1>
      </header>

      {phase === 'sealed' && selected ? (
        <div className={`unlock-seal power-seal power--${selected}`} style={powerGround(selected)}>
          <PowerIcon id={selected} tint={onTint(POWER_TINTS[selected])} className="unlock-seal-shape power-seal-icon" />
          <span className="unlock-seal-burst">
            <Burst />
          </span>
          <p className="unlock-seal-label">{t.powers.names[selected][0]}</p>
          <p className="unlock-seal-joined">{t.powers.joined}</p>
          <span className="unlock-seal-stamp">
            <Shape kind="circle" tint="ink" />
            <span>✓</span>
          </span>
        </div>
      ) : (
        <ul className="unlock-cards power-cards">
          {cards.map((id, index) => {
            const [name, description] = t.powers.names[id]
            const uses = POWER_CHARGES[id]
            const state = id === selected ? ' unlock-card--selected' : selected ? ' unlock-card--dim' : ''
            return (
              <li
                key={id}
                style={{ '--i': index } as CSSProperties}
                className={phase === 'leaving' ? (id === selected ? 'unlock-card-keep' : 'unlock-card-drop') : ''}
              >
                <button
                  type="button"
                  className={`offer-card unlock-card power-card power--${id}${state}`}
                  aria-pressed={id === selected}
                  style={powerGround(id)}
                  onClick={() => pick(id)}
                >
                  <span className="power-card-art" key={id === selected ? 'on' : 'off'}>
                    <PowerIcon id={id} tint={onTint(POWER_TINTS[id])} className="offer-shape unlock-card-shape" />
                  </span>
                  <strong>{name}</strong>
                  <span>{description}</span>
                  <span className="power-card-uses">{uses ? t.powers.uses(uses) : t.powers.always}</span>
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
        <div className="stack unlock-actions">
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
