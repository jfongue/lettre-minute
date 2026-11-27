import { memo, type CSSProperties } from 'react'
import { AVATARS, colourHex, TINTED, type AvatarChoice } from '../domain/avatar'
import { PATHS } from './paths'

interface AvatarProps {
  choice: AvatarChoice
  size?: 'sm' | 'md' | 'lg' | 'fill'
  /** A tile the player has not earned yet: drawn in greys, so the grid still shows what is to win. */
  locked?: boolean
}

/** A poster tile worn as a portrait: a ground, a shape, and sometimes an accent in a corner. */
function AvatarArt({ choice, size = 'md', locked = false }: AvatarProps) {
  const design = AVATARS[choice.design] ?? AVATARS[0]
  const ground = locked ? 'var(--paper-2)' : colourHex(choice.ground)
  const shape = locked ? 'var(--ink-faint)' : colourHex(choice.shape)
  const accent = locked ? 'var(--ink-soft)' : colourHex(choice.accent)
  const detail = TINTED[design.shape]

  return (
    <span
      className={`avatar avatar--${size}${locked ? ' avatar--locked' : ''}`}
      style={{ background: ground, '--i': design.id } as CSSProperties}
      aria-hidden="true"
    >
      <span className={`motion avatar-art motion-${design.motion}`}>
        <svg viewBox="0 0 100 100">
          <g transform={`rotate(${design.turn * 90} 50 50)`}>
            <g fill="currentColor" style={{ color: shape }}>
              {PATHS[design.shape]}
            </g>
            {/* Le coin teinté porte sa propre pièce : un mouvement peut ainsi ne
                déplacer que lui, sans emmener la figure. */}
            {design.accent && (
              <g fill="currentColor" style={{ color: accent }} transform="translate(66 4) scale(0.3)">
                <g className="avatar-accent">{PATHS[design.accent]}</g>
              </g>
            )}
          </g>
          {/* Le détail teinté reste droit : tourné avec la forme, l'aiguille du
              cadran annoncerait une autre heure à chaque quart de tour. */}
          {detail && (
            <g className="avatar-detail" fill="currentColor" style={{ color: accent }}>
              {PATHS[detail]}
            </g>
          )}
        </svg>
      </span>
    </span>
  )
}

const same = (a: AvatarProps, b: AvatarProps) =>
  a.size === b.size &&
  a.locked === b.locked &&
  a.choice.design === b.choice.design &&
  a.choice.ground === b.choice.ground &&
  a.choice.shape === b.choice.shape &&
  a.choice.accent === b.choice.accent

/** Redrawn only when the tile changes: a challenge's race lists one per rival and re-renders ten times a second. */
export const Avatar = memo(AvatarArt, same)
