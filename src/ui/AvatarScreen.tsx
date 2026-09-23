import { useEffect, useState } from 'react'
import {
  AVATARS,
  colourUnlock,
  describeMilestone,
  designUnlock,
  PALETTE,
  reached,
  type AvatarChoice,
} from '../domain/avatar'
import type { Profile } from '../domain/progression'
import { Avatar } from './Avatar'

interface AvatarScreenProps {
  profile: Profile
  avatar: AvatarChoice
  onSave(avatar: AvatarChoice): void
  onBack(): void
}

type Layer = 'ground' | 'shape' | 'accent'

const LAYERS: readonly [Layer, string][] = [
  ['ground', 'Fond'],
  ['shape', 'Forme'],
  ['accent', 'Accent'],
]

export function AvatarScreen({ profile, avatar, onSave, onBack }: AvatarScreenProps) {
  const [draft, setDraft] = useState(avatar)
  const [layer, setLayer] = useState<Layer>('shape')
  const [hint, setHint] = useState<string | null>(null)

  // Opened from the bottom of a long screen, the editor would start mid-grid.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const design = AVATARS[draft.design]
  const ownedDesigns = AVATARS.filter((entry) => reached(profile, designUnlock(entry.id))).length
  const ownedColours = PALETTE.filter((colour) => reached(profile, colourUnlock(colour.id))).length
  // Without an accent the third layer paints nothing: offering it would look broken.
  const activeLayer = layer === 'accent' && !design.accent ? 'shape' : layer

  return (
    <div className="sheet cascade">
      <header className="avatar-head">
        <Avatar choice={draft} size="lg" />
        <div className="stack">
          <h1 className="section-title">Ton avatar</h1>
          <p className="note">
            {ownedDesigns} / {AVATARS.length} formes · {ownedColours} / {PALETTE.length} couleurs
          </p>
          <p className="note">Les parties, les séries et les niveaux en débloquent d’autres.</p>
        </div>
      </header>

      <section className="stack">
        <div className="layer-tabs" role="tablist">
          {LAYERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeLayer === id}
              className={`layer-tab${activeLayer === id ? ' layer-tab--on' : ''}`}
              disabled={id === 'accent' && !design.accent}
              onClick={() => setLayer(id)}
            >
              <span className="swatch-dot" style={{ background: PALETTE.find((c) => c.id === draft[id])?.hex }} />
              {label}
            </button>
          ))}
        </div>

        <div className="swatches">
          {PALETTE.map((colour) => {
            const goal = colourUnlock(colour.id)
            const owned = reached(profile, goal)
            return (
              <button
                key={colour.id}
                type="button"
                className={`swatch${owned ? '' : ' swatch--locked'}${draft[activeLayer] === colour.id ? ' swatch--on' : ''}`}
                style={owned ? { background: colour.hex } : undefined}
                aria-label={owned ? colour.label : `${colour.label}, verrouillée`}
                onClick={() => {
                  if (owned) {
                    setDraft({ ...draft, [activeLayer]: colour.id })
                    setHint(null)
                  } else if (goal) {
                    setHint(`${colour.label} : ${describeMilestone(goal)}`)
                  }
                }}
              />
            )
          })}
        </div>
      </section>

      <p className={`note avatar-hint${hint ? '' : ' avatar-hint--idle'}`} aria-live="polite">
        {hint ?? 'Touche une case verrouillée pour savoir comment la gagner.'}
      </p>

      <div className="avatar-grid">
        {AVATARS.map((entry) => {
          const goal = designUnlock(entry.id)
          const owned = reached(profile, goal)
          return (
            <button
              key={entry.id}
              type="button"
              className={`avatar-cell${draft.design === entry.id ? ' avatar-cell--on' : ''}`}
              aria-label={owned ? `Avatar ${entry.id + 1}` : `Avatar ${entry.id + 1}, verrouillé`}
              onClick={() => {
                if (owned) {
                  setDraft({ ...draft, design: entry.id })
                  setHint(null)
                } else if (goal) {
                  setHint(`Avatar ${entry.id + 1} : ${describeMilestone(goal)}`)
                }
              }}
            >
              <Avatar choice={{ ...draft, design: entry.id }} size="fill" locked={!owned} />
            </button>
          )
        })}
      </div>

      <div className="stack">
        <button type="button" className="btn btn--blue btn--block" onClick={() => onSave(draft)}>
          Garder cet avatar
        </button>
        <button type="button" className="btn btn--ghost btn--block" onClick={onBack}>
          Retour
        </button>
      </div>
    </div>
  )
}
