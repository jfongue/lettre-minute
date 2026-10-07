import type { ReactNode } from 'react'
import type { PowerId } from '../domain/powers'
import { onTint, POWER_TINTS, powerGround, type Tint } from './motifs'

const hole = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`

/** Drawn from the poster's own blocks, like the category icons, each arranged into what the power does. */
const ICONS: Record<PowerId, ReactNode> = {
  permutation: (
    <>
      <path d="M6 20H66V6L94 30L66 54V40H6Z" />
      <path d="M94 60H34V46L6 70L34 94V80H94Z" opacity="0.6" />
    </>
  ),
  joker: (
    <>
      <rect x="10" y="14" width="44" height="64" transform="rotate(-14 32 46)" opacity="0.5" />
      <path fillRule="evenodd" d="M40 18H88V92H40ZM64 36L76 55L64 74L52 55Z" />
    </>
  ),
  dodge: (
    <>
      <path d="M48 12L94 50L48 88Z" />
      <rect x="4" y="26" width="34" height="10" opacity="0.45" />
      <rect x="14" y="45" width="30" height="10" opacity="0.75" />
      <rect x="4" y="64" width="34" height="10" opacity="0.45" />
    </>
  ),
  magic: (
    <>
      <path d="M40 8L50 40L82 50L50 60L40 92L30 60L0 50L30 40Z" />
      <path d="M80 4L85 16L97 21L85 26L80 38L75 26L63 21L75 16Z" opacity="0.6" />
    </>
  ),
  hush: (
    <>
      <path d="M56 6A44 44 0 1 0 94 70A36 36 0 0 1 56 6Z" />
      <circle cx="80" cy="18" r="6" opacity="0.6" />
      <circle cx="90" cy="38" r="4" opacity="0.4" />
    </>
  ),
  dyslexia: (
    <>
      <rect x="8" y="34" width="36" height="36" transform="rotate(-12 26 52)" />
      <rect x="56" y="38" width="36" height="36" transform="rotate(14 74 56)" opacity="0.6" />
      <path d="M20 24Q50 0 80 26" fill="none" stroke="currentColor" strokeWidth="7" />
    </>
  ),
  divination: (
    <>
      <path fillRule="evenodd" d={`${hole(50, 42, 36)}${hole(38, 30, 8)}`} />
      <path d="M22 84L32 74H68L78 84V94H22Z" opacity="0.6" />
    </>
  ),
  complication: (
    <>
      <path d="M20 10H80L96 34L50 92L4 34Z" opacity="0.5" />
      <path d="M20 10H80L64 34H36Z" />
      <path d="M36 34H64L50 92Z" />
    </>
  ),
  celerity: <path d="M58 2L12 56H44L34 98L88 38H56L68 2Z" />,
  professor: (
    <>
      <path d="M50 10L98 34L50 58L2 34Z" />
      <path d="M22 46V70C22 80 78 80 78 70V46L50 60Z" opacity="0.6" />
      <path d="M86 40V74" fill="none" stroke="currentColor" strokeWidth="5" />
      <circle cx="86" cy="80" r="7" />
    </>
  ),

  'latecomer': <path d="M50 8V50L78 66M50 8A42 42 0 1 0 92 50" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />,
'double-skip': (
<>
<path d="M8 25H76V9L96 29L76 49V33H8Z" />
<path d="M8 67H76V51L96 71L76 91V75H8Z" opacity="0.65" />
</>
),
flawless: (
<>
<path d="M50 5L62 37L95 50L62 63L50 95L38 63L5 50L38 37Z" />
<circle cx="80" cy="20" r="7" opacity="0.6" />
</>
),
chatter: (
    <>
      <path fillRule="evenodd" d={`M8 12H92V70H44L22 90V70H8Z${hole(30, 41, 7)}${hole(50, 41, 7)}${hole(70, 41, 7)}`} />
    </>
  ),
}

interface PowerIconProps {
  id: PowerId
  tint: Tint
  className?: string
}

export function PowerIcon({ id, tint, className = '' }: PowerIconProps) {
  return (
    <svg
      className={`shape power-icon ${className}`}
      viewBox="0 0 100 100"
      fill="currentColor"
      aria-hidden="true"
      style={{ color: `var(--${tint})` }}
    >
      {ICONS[id]}
    </svg>
  )
}

/** A power's icon on its own colour, with what is left of it this run when it counts its uses. */
export function PowerBadge({ id, left, className = '' }: { id: PowerId; left?: number; className?: string }) {
  return (
    <span className={`power-badge power--${id}${left === 0 ? ' power-badge--spent' : ''} ${className}`} style={powerGround(id)}>
      <PowerIcon id={id} tint={onTint(POWER_TINTS[id])} className="power-badge-icon" />
      {left !== undefined && (
        <span className="power-badge-dots" aria-hidden="true">
          {Array.from({ length: Math.max(left, 0) }, (_, index) => (
            <span key={index} />
          ))}
        </span>
      )}
    </span>
  )
}
