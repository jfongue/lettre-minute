import { useEffect } from 'react'
import type { AvatarChoice } from '../domain/avatar'
import { useT } from '../i18n'
import { armSound, sound } from '../lib/sound'
import { Avatar } from './Avatar'
import { useBackDismiss } from './useBackDismiss'

/**
 * Huit avatars que tout oppose — forme, fond, couleurs —, pour montrer en un
 * regard jusqu'où l'éditeur mène plutôt que l'avatar de départ qu'on y fuit.
 */
const SHOWCASE: readonly AvatarChoice[] = [
  { design: 6, ground: 'noir', shape: 'jaune', accent: 'rouge' },
  { design: 21, ground: 'rose', shape: 'bleu', accent: 'creme' },
  { design: 9, ground: 'ciel', shape: 'rouge', accent: 'noir' },
  { design: 35, ground: 'vert', shape: 'creme', accent: 'orange' },
  { design: 13, ground: 'jaune', shape: 'noir', accent: 'rose' },
  { design: 44, ground: 'marine', shape: 'corail', accent: 'ciel' },
  { design: 30, ground: 'creme', shape: 'brique', accent: 'bleu' },
  { design: 50, ground: 'orange', shape: 'marine', accent: 'jaune' },
]

/**
 * L'éditeur d'avatar proposé une fois à qui porte encore la tuile de départ
 * alors qu'il a gagné de quoi en changer : ce qu'un avatar peut devenir, ce
 * qu'il a débloqué, et de quoi ouvrir l'éditeur.
 */
export function AvatarNudgePop({
  count,
  onOpen,
  onLater,
}: {
  count: number
  onOpen(): void
  onLater(): void
}) {
  const t = useT()
  useBackDismiss(onLater)
  useEffect(() => sound.news(), [])
  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="avatar-nudge-title">
      <div className="offer-pop-scrim" onClick={onLater} />
      <div className="offer-pop avatar-nudge">
        <ul className="avatar-nudge-showcase" aria-hidden="true">
          {SHOWCASE.map((choice) => (
            <li key={choice.design}>
              <Avatar choice={choice} />
            </li>
          ))}
        </ul>
        <h2 id="avatar-nudge-title" className="offer-pop-title">
          {t.avatar.nudge.title}
        </h2>
        <p className="note">{t.avatar.nudge.body(count)}</p>
        <div className="offer-pop-actions">
          <button type="button" className="btn btn--ghost" onClick={onLater}>
            {t.avatar.nudge.later}
          </button>
          <button
            type="button"
            className="btn btn--blue"
            onClick={() => {
              armSound()
              onOpen()
            }}
          >
            {t.avatar.nudge.yes}
          </button>
        </div>
      </div>
    </div>
  )
}
