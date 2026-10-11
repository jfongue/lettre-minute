import { useState } from 'react'
import { colourWinner, designWinner, ownedColours, ownedDesigns } from '../domain/achievements'
import { AVATARS, PALETTE, sameAvatar, type AvatarChoice } from '../domain/avatar'
import type { Profile } from '../domain/progression'
import { useT } from '../i18n'
import { Avatar } from './Avatar'
import { achievementText } from './achievementText'

interface AvatarPanelProps {
  profile: Profile
  avatar: AvatarChoice
  /** Ce que le serveur a compté comme découvertes, s'il a répondu. */
  discoveries?: number
  onSave(avatar: AvatarChoice): void
}

type Layer = 'ground' | 'shape' | 'accent'

const LAYERS: readonly Layer[] = ['ground', 'shape', 'accent']

/**
 * L'éditeur d'avatar, dans la page « Avatar & succès » : l'aperçu, le rayon des
 * couleurs, puis la grille des tuiles. Chaque case et chaque couleur porte le
 * succès qui l'ouvre, et c'est lui qui dit comment la gagner. Il ne se referme
 * pas lui-même — c'est la page qui porte son bouton retour.
 */
export function AvatarPanel({ profile, avatar, discoveries, onSave }: AvatarPanelProps) {
  const t = useT()
  const [draft, setDraft] = useState(avatar)
  const [layer, setLayer] = useState<Layer>('shape')
  const [hint, setHint] = useState<string | null>(null)

  const design = AVATARS[draft.design]
  const tiles = new Set(ownedDesigns(profile, discoveries).map((entry) => entry.id))
  const inks = new Set(ownedColours(profile, discoveries).map((colour) => colour.id))
  // Sans accent, la troisième couche ne peint rien : l'offrir aurait l'air cassé.
  const layers = design.accent ? LAYERS : LAYERS.filter((id) => id !== 'accent')
  const activeLayer = layers.includes(layer) ? layer : 'shape'

  return (
    <div className="avatar-editor cascade">
      <header className="avatar-head">
        <Avatar choice={draft} size="lg" />
        <div className="stack">
          <h2 className="section-title">{t.avatar.title}</h2>
          <p className="note">{t.avatar.owned(tiles.size, AVATARS.length, inks.size, PALETTE.length)}</p>
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
            const owned = inks.has(colour.id)
            const winner = colourWinner(colour.id)
            const how = winner === null ? null : achievementText(t, winner).name
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
                    setHint(how ? t.avatar.earnedHint(label, how) : null)
                  } else if (how) {
                    setHint(t.avatar.unlockHint(label, how))
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
          const owned = tiles.has(entry.id)
          const winner = designWinner(entry.id)
          const how = winner === null ? null : achievementText(t, winner).name
          const name = t.avatar.design(entry.id + 1)
          return (
            <button
              key={entry.id}
              type="button"
              className={`avatar-cell${draft.design === entry.id ? ' avatar-cell--on' : ''}`}
              aria-label={owned ? name : t.avatar.lockedDesign(entry.id + 1)}
              onClick={() => {
                if (owned) {
                  setDraft({ ...draft, design: entry.id })
                  setHint(how ? t.avatar.earnedHint(name, how) : null)
                } else if (how) {
                  setHint(t.avatar.unlockHint(name, how))
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
