import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { equippedPowers, MAX_EQUIPPED, ownedPowers, POWER_CHARGES, slotsOf, type PowerId } from '../domain/powers'
import type { Profile } from '../domain/progression'
import { useT } from '../i18n'
import { tapFeedback } from '../lib/native'
import { sound } from '../lib/sound'
import { Shape } from './bauhaus'
import { onTint, POWER_TINTS, powerGround } from './motifs'
import { PowerIcon } from './PowerIcon'
import { SlotIcon } from './premium'
import { useBackDismiss } from './useBackDismiss'

/**
 * Entre « Jouer » et la partie, pour qui a des pouvoirs : les emplacements en
 * grand, tous les pouvoirs possédés à côté, une touche pour en prendre ou en
 * reposer un (`wearOrDrop`). Entrée lance la partie, Échap revient.
 */
export function PowerLoadout({
  profile,
  onWear,
  onPlay,
  onBack,
}: {
  profile: Profile
  onWear(powerId: PowerId): void
  onPlay(): void
  onBack(): void
}) {
  const t = useT()
  const text = t.powers.loadout
  const owned = ownedPowers(profile)
  const worn = equippedPowers(profile)
  const slots = slotsOf(profile)
  // Le dernier pouvoir pris rejoue son entrée dans l'emplacement, pas les autres.
  const [landed, setLanded] = useState<PowerId | null>(null)

  useBackDismiss(onBack)
  const keys = useRef({ onPlay, onBack })
  useEffect(() => {
    keys.current = { onPlay, onBack }
  })
  useEffect(() => {
    // Entrée sur une tuile atteinte par Tab la prend ; partout ailleurs — une
    // tuile qui garde le focus d'un clic comprise — elle lance la partie.
    let tabbing = false
    const point = () => {
      tabbing = false
    }
    const press = (event: KeyboardEvent) => {
      if (event.key === 'Tab') tabbing = true
      else if (event.key === 'Enter' && !(tabbing && event.target instanceof HTMLButtonElement)) {
        event.preventDefault()
        keys.current.onPlay()
      } else if (event.key === 'Escape') keys.current.onBack()
    }
    window.addEventListener('pointerdown', point)
    window.addEventListener('keydown', press)
    return () => {
      window.removeEventListener('pointerdown', point)
      window.removeEventListener('keydown', press)
    }
  }, [])

  const tap = (id: PowerId) => {
    const taking = !worn.includes(id)
    setLanded(taking ? id : null)
    if (taking) sound.power(id)
    tapFeedback()
    onWear(id)
  }

  return (
    <div className="sheet loadout">
      <header className="loadout-head">
        <button type="button" className="subpage-back" onClick={onBack} aria-label={text.back}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="loadout-heading">
          <p className="eyebrow">{text.kicker}</p>
          <h1 className="loadout-title">{text.title}</h1>
        </div>
      </header>

      <div className="loadout-side">
        <p className="loadout-lead">{text.lead(slots)}</p>
        <div className="loadout-slots">
          {Array.from({ length: MAX_EQUIPPED }, (_, slot) => {
            const id = worn[slot] ?? null
            if (slot >= slots) {
              return (
                <div key={slot} className="loadout-slot loadout-slot--locked" role="img" aria-label={`${t.powers.slotLocked} : ${t.powers.slotLockedHow}`}>
                  <SlotIcon className="loadout-slot-lock" size={30} />
                  <span className="loadout-slot-how">{t.powers.slotLockedHow}</span>
                </div>
              )
            }
            if (!id) {
              return (
                <div key={slot} className="loadout-slot loadout-slot--empty" aria-label={t.powers.slot(slot + 1, null)} role="img">
                  <span className="loadout-slot-plus" aria-hidden="true">
                    +
                  </span>
                  <span className="loadout-slot-name">{t.powers.empty}</span>
                </div>
              )
            }
            const uses = POWER_CHARGES[id]
            return (
              <button
                key={`${slot}-${id}`}
                type="button"
                className={`loadout-slot power--${id}${landed === id ? ' loadout-slot--landed' : ''}`}
                style={powerGround(id)}
                aria-label={t.powers.slot(slot + 1, t.powers.names[id][0])}
                onClick={() => tap(id)}
              >
                <PowerIcon id={id} tint={onTint(POWER_TINTS[id])} className="loadout-slot-icon" />
                <span className="loadout-slot-name">{t.powers.names[id][0]}</span>
                <span className="loadout-slot-uses">{uses ? t.powers.uses(uses) : t.powers.always}</span>
              </button>
            )
          })}
        </div>

        <div className="loadout-actions">
          <button type="button" className="btn btn--play btn--block" onClick={onPlay}>
            <span>{worn.length > 0 ? text.play : text.playBare}</span>
            <span className="play-glyph" aria-hidden="true">
              <Shape kind="circle" tint="yellow" />
              <span className="motion play-triangle">
                <Shape kind="triangle" tint="red" />
              </span>
            </span>
          </button>
          <p className="loadout-hint">{text.hint}</p>
        </div>
      </div>

      <ul className="loadout-grid" aria-label={t.powers.title}>
        {owned.map((id, index) => {
          const on = worn.includes(id)
          const [name, description] = t.powers.names[id]
          return (
            <li key={id} style={{ '--i': index } as CSSProperties}>
              <button type="button" className={`loadout-tile power--${id}${on ? ' loadout-tile--on' : ''}`} aria-pressed={on} onClick={() => tap(id)}>
                <span className="loadout-tile-icon" style={powerGround(id)}>
                  <PowerIcon id={id} tint={onTint(POWER_TINTS[id])} />
                </span>
                <span className="loadout-tile-text">
                  <strong>{name}</strong>
                  <span>{description}</span>
                </span>
                {on && (
                  <span className="loadout-tile-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
