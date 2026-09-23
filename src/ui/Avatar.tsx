import type { CSSProperties } from 'react'
import { AVATARS, colourHex, type AvatarChoice } from '../domain/avatar'
import { PATHS } from './paths'

interface AvatarProps {
  choice: AvatarChoice
  size?: 'sm' | 'md' | 'lg' | 'fill'
  /** A tile the player has not earned yet: drawn in greys, so the grid still shows what is to win. */
  locked?: boolean
}

/** A poster tile worn as a portrait: a ground, a shape, and sometimes an accent in a corner. */
export function Avatar({ choice, size = 'md', locked = false }: AvatarProps) {
  const design = AVATARS[choice.design] ?? AVATARS[0]
  const ground = locked ? 'var(--paper-2)' : colourHex(choice.ground)
  const shape = locked ? 'var(--ink-faint)' : colourHex(choice.shape)
  const accent = locked ? 'var(--ink-soft)' : colourHex(choice.accent)

  return (
    <span
      className={`avatar avatar--${size}${locked ? ' avatar--locked' : ''}`}
      style={{ background: ground, '--i': design.id } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" className={`avatar-art motion-${design.motion}`}>
        <g transform={`rotate(${design.turn * 90} 50 50)`}>
          <g fill="currentColor" style={{ color: shape }}>
            {PATHS[design.shape]}
          </g>
          {design.accent && (
            <g fill="currentColor" style={{ color: accent }} transform="translate(66 4) scale(0.3)">
              {PATHS[design.accent]}
            </g>
          )}
        </g>
      </svg>
    </span>
  )
}
