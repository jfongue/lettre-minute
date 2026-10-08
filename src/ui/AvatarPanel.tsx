import { useState } from 'react'
import {
  AVATARS,
  colourUnlock,
  designUnlock,
  PALETTE,
  reached,
  sameAvatar,
  type AvatarChoice,
} from '../domain/avatar'
import type { Profile } from '../domain/progression'
import { useT } from '../i18n'
import { Avatar } from './Avatar'

interface AvatarPanelProps {
  profile: Profile
  avatar: AvatarChoice
  onSave(avatar: AvatarChoice): void
}

type Layer = 'ground' | 'shape' | 'accent'

const LAYERS: readonly Layer[] = ['ground', 'shape', 'accent']

/**
 * L'éditeur d'avatar, dans la page « Avatar & succès » : l'aperçu, le rayon des
 * couleurs, puis la grille des tuiles. Il ne se referme pas lui-même — c'est la
 * page qui porte son bouton retour.
 */
export function AvatarPanel({ profile, avatar, onSave }: AvatarPanelProps) {
  const t = useT()
  const [draft, setDraft] = useState(avatar)
  const [layer, setLayer] = useState<Layer>('shape')
  const [hint, setHint] = useState<string | null>(null)

  const design = AVATARS[draft.design]
  const ownedDesigns = AVATARS.filter((entry) => reached(profile, designUnlock(entry.id))).length
  const ownedColours = PALETTE.filter((colour) => reached(profile, colourUnlock(colour.id))).length
  // Without an accent the third layer paints nothing: offering it would look broken.
  const layers = design.accent ? LAYERS : LAYERS.filter((id) => id !== 'accent')
  const activeLayer = layers.includes(layer) ? layer : 'shape'

  return (
    <div className="avatar-editor cascade">
      <header className="avatar-head">
        <Avatar choice={draft} size="lg" />
        <div className="stack">
          <h2 className="section-title">{t.avatar.title}</h2>
          <p className="note">
            {t.avatar.owned(ownedDesigns, AVATARS.length, ownedColours, PALETTE.length)}
          </p>
          <p className="note">{t.avatar.lead}</p>
        </div>
      </header>

      <section className="stack">
        <div className="layer-tabs" role="tablist">
          {layers.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeLayer === id}
              className={`layer-tab${activeLayer === id ? ' layer-tab--on' : ''}`}
              onClick={() => setLayer(id)}
            >
              <span className="swatch-dot" style={{ background: PALETTE.find((c) => c.id === draft[id])?.hex }} />
              {t.avatar.layers[id]}
            </button>
          ))}
        </div>

        <div className="swatches">
          {PALETTE.map((colour) => {
            const goal = colourUnlock(colour.id)
            const owned = reached(profile, goal)
            const label = t.colours[colour.id] ?? colour.label
            return (
              <button
                key={colour.id}
                type="button"
                className={`swatch${owned ? '' : ' swatch--locked'}${draft[activeLayer] === colour.id ? ' swatch--on' : ''}`}
                style={owned ? { background: colour.hex } : undefined}
                aria-label={owned ? label : t.avatar.lockedColour(label)}
                onClick={() => {
                  if (owned) {
                    setDraft({ ...draft, [activeLayer]: colour.id })
                    setHint(goal ? t.avatar.earnedHint(label, t.avatar.milestone(goal)) : null)
                  } else if (goal) {
                    setHint(t.avatar.unlockHint(label, t.avatar.milestone(goal)))
                  }
                }}
              />
            )
          })}
        </div>
      </section>

      <p className={`note avatar-hint${hint ? '' : ' avatar-hint--idle'}`} aria-live="polite">
        {hint ?? t.avatar.idle}
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
              aria-label={owned ? t.avatar.design(entry.id + 1) : t.avatar.lockedDesign(entry.id + 1)}
              onClick={() => {
                if (owned) {
                  setDraft({ ...draft, design: entry.id })
                  setHint(goal ? t.avatar.earnedHint(t.avatar.design(entry.id + 1), t.avatar.milestone(goal)) : null)
                } else if (goal) {
                  setHint(t.avatar.unlockHint(t.avatar.design(entry.id + 1), t.avatar.milestone(goal)))
                }
              }}
            >
              <Avatar choice={{ ...draft, design: entry.id }} size="fill" locked={!owned} />
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="btn btn--blue btn--block"
        disabled={sameAvatar(draft, avatar)}
        onClick={() => onSave(draft)}
      >
        {t.avatar.save}
      </button>
    </div>
  )
}
