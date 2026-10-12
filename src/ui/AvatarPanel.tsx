import { useEffect, useRef, useState } from 'react'
import {
  colourWinner,
  designWinner,
  isNamed,
  ownedColours,
  ownedDesigns,
  unseenColours,
  unseenDesigns,
  type Achievement,
} from '../domain/achievements'
import { AVATARS, PALETTE, sameAvatar, type AvatarChoice } from '../domain/avatar'
import type { Profile } from '../domain/progression'
import { loadSeenColours, loadSeenDesigns, saveSeenColours, saveSeenDesigns } from '../state/storage'
import { useT } from '../i18n'
import { Avatar } from './Avatar'
import { achievementText } from './achievementText'

interface AvatarPanelProps {
  profile: Profile
  avatar: AvatarChoice
  /** Ce que le serveur a compté comme découvertes, s'il a répondu. */
  discoveries?: number
  onSave(avatar: AvatarChoice): void
  /** Le design touché au bilan : l'éditeur ouvre dessus, sa tuile secoue. */
  focus?: number | null
}

type Layer = 'ground' | 'shape' | 'accent'

const LAYERS: readonly Layer[] = ['ground', 'shape', 'accent']

/**
 * L'éditeur d'avatar, dans la page « Avatar & succès » : l'aperçu, le rayon des
 * couleurs, puis la grille des tuiles. Chaque case et chaque couleur porte le
 * succès qui l'ouvre, et c'est lui qui dit comment la gagner. Il ne se referme
 * pas lui-même — c'est la page qui porte son bouton retour.
 */
export function AvatarPanel({ profile, avatar, discoveries, onSave, focus = null }: AvatarPanelProps) {
  const t = useT()
  const [draft, setDraft] = useState(() => (focus === null ? avatar : { ...avatar, design: focus }))
  const [layer, setLayer] = useState<Layer>('shape')
  const [hint, setHint] = useState<string | null>(null)
  // Ce que l'éditeur a déjà montré : un gagné porte un cadre rouge jusqu'à ce
  // qu'on le touche, et sortir de la page range les deux listes — un cadre vu,
  // même sans être touché, ne revient pas à l'ouverture suivante.
  const [seen, setSeen] = useState<readonly number[]>(loadSeenDesigns)
  const [seenInks, setSeenInks] = useState<readonly string[]>(loadSeenColours)
  const [shaking, setShaking] = useState<number | null>(focus)
  const cell = useRef<HTMLButtonElement>(null)

  useEffect(
    () => () => {
      saveSeenDesigns(ownedDesigns(profile, discoveries).map((design) => design.id))
      saveSeenColours(ownedColours(profile, discoveries).map((colour) => colour.id))
    },
    [profile, discoveries],
  )

  useEffect(() => {
    if (focus === null) return
    cell.current?.scrollIntoView({ block: 'center' })
    const timer = setTimeout(() => setShaking(null), 700)
    return () => clearTimeout(timer)
  }, [focus])

  const design = AVATARS[draft.design]
  const ownedIds = ownedDesigns(profile, discoveries).map((entry) => entry.id)
  const tiles = new Set(ownedIds)
  const inks = new Set(ownedColours(profile, discoveries).map((colour) => colour.id))
  const news = unseenDesigns(profile, seen, discoveries)
  const fresh = new Set(unseenColours(profile, seenInks, discoveries))
  // Sans accent, la troisième couche ne peint rien : l'offrir aurait l'air cassé.
  const layers = design.accent ? LAYERS : LAYERS.filter((id) => id !== 'accent')
  const activeLayer = layers.includes(layer) ? layer : 'shape'

  /**
   * Ce qu'une case ou une couleur dit quand on la touche : le succès qui
   * l'ouvre — son nom quand il en a un, comme « Coup d'œil » —, puis ce qu'il
   * demande. Une case ne se nomme pas elle-même ; une couleur met la sienne
   * devant.
   */
  const tell = (item: string | null, winner: Achievement | null): string | null => {
    if (winner === null) return null
    const how = t.ach.how(winner.goal)
    const earned = isNamed(winner.id) ? t.avatar.hint(achievementText(t, winner).name, how) : how
    return item === null ? earned : t.avatar.hint(item, earned)
  }

  return (
    <div className="avatar-editor cascade">
      <header className="avatar-head">
        <Avatar choice={draft} size="lg" />
        <div className="stack">
          <h2 className="section-title">{t.avatar.title}</h2>
          <p className="note">
            {t.avatar.owned(tiles.size, AVATARS.length, inks.size, PALETTE.length)}
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
            const owned = inks.has(colour.id)
            const label = t.colours[colour.id] ?? colour.label
            const how = tell(label, colourWinner(colour.id))
            return (
              <button
                key={colour.id}
                type="button"
                className={`swatch${owned ? '' : ' swatch--locked'}${
                  draft[activeLayer] === colour.id ? ' swatch--on' : ''
                }${fresh.has(colour.id) ? ' swatch--new' : ''}`}
                style={owned ? { background: colour.hex } : undefined}
                aria-label={owned ? label : t.avatar.lockedColour(label)}
                onClick={() => {
                  if (fresh.has(colour.id)) setSeenInks((current) => [...current, colour.id])
                  if (owned) setDraft({ ...draft, [activeLayer]: colour.id })
                  setHint(how)
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
          const isNew = news.includes(entry.id)
          const how = tell(null, designWinner(entry.id))
          return (
            <button
              key={entry.id}
              ref={entry.id === focus ? cell : undefined}
              type="button"
              className={`avatar-cell${draft.design === entry.id ? ' avatar-cell--on' : ''}${
                shaking === entry.id ? ' avatar-cell--shake' : ''
              }${isNew ? ' avatar-cell--new' : ''}`}
              aria-label={how === null ? t.avatar.offered : owned ? how : t.avatar.lockedTile(how)}
              onClick={() => {
                if (isNew) setSeen((current) => [...current, entry.id])
                if (owned) setDraft({ ...draft, design: entry.id })
                setHint(how)
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
