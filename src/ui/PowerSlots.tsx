import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { equippedPowers, MAX_EQUIPPED, ownedPowers, POWER_CHARGES, type PowerId } from '../domain/powers'
import type { Profile } from '../domain/progression'
import { useT } from '../i18n'
import { sound } from '../lib/sound'
import { onTint, POWER_TINTS, powerGround } from './motifs'
import { PowerIcon } from './PowerIcon'
import { reducedMotion } from './useCountUp'
import { useBackDismiss } from './useBackDismiss'

/** Long enough to see and hear the power land in its slot, short enough not to wait for it. */
const WEAR_MS = 650

interface PowerSlotsProps {
  profile: Profile
  disabled: boolean
  onEquip(slot: number, powerId: PowerId | null): void
}

/** Under « Jouer »: the two powers the next run carries, each a tap away from being changed. */
export function PowerSlots({ profile, disabled, onEquip }: PowerSlotsProps) {
  const t = useT()
  const [open, setOpen] = useState<number | null>(null)
  const owned = ownedPowers(profile)
  const worn = equippedPowers(profile)
  if (owned.length === 0) return null

  return (
    <section className="power-slots" aria-label={t.powers.title}>
      <p className="section-title">{t.powers.title}</p>
      <div className="power-slots-row">
        {Array.from({ length: MAX_EQUIPPED }, (_, slot) => {
          const id = worn[slot] ?? null
          return (
            <button
              key={slot}
              type="button"
              className={`power-slot${id ? ` power--${id}` : ' power-slot--empty'}`}
              style={id ? powerGround(id) : undefined}
              disabled={disabled}
              aria-label={t.powers.slot(slot + 1, id ? t.powers.names[id][0] : null)}
              onClick={() => setOpen(slot)}
            >
              {id ? (
                <>
                  <PowerIcon id={id} tint={onTint(POWER_TINTS[id])} className="power-slot-icon" />
                  <span className="power-slot-name">{t.powers.names[id][0]}</span>
                </>
              ) : (
                <>
                  <span className="power-slot-plus" aria-hidden="true">+</span>
                  <span className="power-slot-name">{t.powers.empty}</span>
                </>
              )}
            </button>
          )
        })}
      </div>
      {open !== null && (
        <PowerPicker
          owned={owned}
          worn={worn}
          slot={open}
          onPick={(id) => {
            onEquip(open, id)
            setOpen(null)
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}

function PowerPicker({
  owned,
  worn,
  slot,
  onPick,
  onClose,
}: {
  owned: readonly PowerId[]
  worn: readonly PowerId[]
  slot: number
  onPick(id: PowerId | null): void
  onClose(): void
}) {
  const t = useT()
  // One tap wears the power: its sound and gesture play, then the picker closes on its own.
  const [chosen, setChosen] = useState<PowerId | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('keydown', escape)
      clearTimeout(timer.current)
    }
  }, [onClose])
  useBackDismiss(onClose)

  const wear = (id: PowerId) => {
    if (chosen) return
    if (id === worn[slot]) return onClose()
    setChosen(id)
    sound.power(id)
    timer.current = setTimeout(() => onPick(id), reducedMotion() ? 0 : WEAR_MS)
  }

  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="power-picker-title">
      <div className="offer-pop-scrim" onClick={onClose} />
      <div className="offer-pop power-picker">
        <h2 id="power-picker-title" className="offer-pop-title">
          {t.powers.pickTitle}
        </h2>
        <p className="power-picker-lead">{t.powers.pickLead}</p>
        <ul className="power-list">
          {owned.map((id, index) => {
            const at = worn.indexOf(id)
            const [name, description] = t.powers.names[id]
            const uses = POWER_CHARGES[id]
            return (
              <li key={id} style={{ '--i': index } as CSSProperties}>
                <button
                  type="button"
                  className={`power-row power--${id}${
                    id === chosen ? ' power-row--selected power-row--chosen' : chosen ? ' power-row--dim' : ''
                  }`}
                  aria-pressed={id === (chosen ?? worn[slot])}
                  onClick={() => wear(id)}
                >
                  <span className="power-row-icon" style={powerGround(id)} key={id === chosen ? 'on' : 'off'}>
                    <PowerIcon id={id} tint={onTint(POWER_TINTS[id])} />
                  </span>
                  <span className="power-row-text">
                    <strong>
                      {name}
                      {at >= 0 && <span className="tag tag--plain">{t.powers.worn}</span>}
                    </strong>
                    <span>{description}</span>
                    <span className="note">{uses ? t.powers.uses(uses) : t.powers.always}</span>
                  </span>
                  {id === chosen && (
                    <span className="power-row-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="offer-pop-actions">
          {worn[slot] ? (
            <button type="button" className="btn btn--ghost" onClick={() => onPick(null)}>
              {t.powers.remove}
            </button>
          ) : (
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {t.powers.close}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
