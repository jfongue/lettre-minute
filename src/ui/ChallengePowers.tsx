import { useState, type CSSProperties } from 'react'
import { MAX_EQUIPPED, POWER_CHARGES, type PowerId } from '../domain/powers'
import { useT } from '../i18n'
import { sound } from '../lib/sound'
import { onTint, POWER_TINTS, powerGround } from './motifs'
import { PowerIcon } from './PowerIcon'

interface ChallengePowersProps {
  /** The powers the challenge allows, Permutation left out. */
  allowed: readonly PowerId[]
  initial: readonly PowerId[]
  onStart(powers: readonly PowerId[]): void
  onClose(): void
}

/** Before a challenge, when the player owns more allowed powers than slots: two to take in. */
export function ChallengePowers({ allowed, initial, onStart, onClose }: ChallengePowersProps) {
  const t = useT()
  const [picked, setPicked] = useState<readonly PowerId[]>(initial)
  const toggle = (id: PowerId) =>
    setPicked((current) =>
      current.includes(id)
        ? current.filter((other) => other !== id)
        : // A third tap replaces the oldest pick rather than doing nothing.
          [...current, id].slice(-MAX_EQUIPPED),
    )

  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="challenge-powers-title">
      <div className="offer-pop-scrim" onClick={onClose} />
      <div className="offer-pop power-picker">
        <h2 id="challenge-powers-title" className="offer-pop-title">
          {t.challenge.powersTitle}
        </h2>
        <p className="note">{t.challenge.powersLead(MAX_EQUIPPED)}</p>
        <ul className="power-list">
          {allowed.map((id, index) => {
            const on = picked.includes(id)
            const [name, description] = t.powers.names[id]
            const uses = POWER_CHARGES[id]
            return (
              <li key={id} style={{ '--i': index } as CSSProperties}>
                <button
                  type="button"
                  className={`power-row power--${id}${on ? ' power-row--here' : ''}`}
                  aria-pressed={on}
                  onClick={() => {
                    if (!on) sound.power(id)
                    toggle(id)
                  }}
                >
                  <span className="power-row-icon" style={powerGround(id)}>
                    <PowerIcon id={id} tint={onTint(POWER_TINTS[id])} />
                  </span>
                  <span className="power-row-text">
                    <strong>
                      {name}
                      {on && <span className="tag tag--plain">{t.powers.worn}</span>}
                    </strong>
                    <span>{description}</span>
                    <span className="note">{uses ? t.powers.uses(uses) : t.powers.always}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="offer-pop-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="button" className="btn btn--blue" onClick={() => onStart(picked)}>
            {t.challenge.powersStart}
          </button>
        </div>
      </div>
    </div>
  )
}
