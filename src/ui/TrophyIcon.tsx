import type { ReactNode } from 'react'
import type { TrophyId } from '../domain/challenge'
import type { Tint } from './motifs'

const hole = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`

/** Drawn from the poster's own blocks, like the power and category icons, each arranged into what the trophy rewards. */
const ICONS: Record<TrophyId, ReactNode> = {
  slowest: (
    <>
      <path fillRule="evenodd" d={`M50 20A34 34 0 0 1 84 54A34 34 0 0 1 16 54A34 34 0 0 1 50 20Z${hole(50, 54, 20)}`} />
      <circle cx="18" cy="46" r="9" />
      <path d="M8 70L24 62L30 76L14 84Z" opacity="0.6" />
      <path d="M92 70L76 62L70 76L86 84Z" opacity="0.6" />
      <path d="M30 92L38 78H62L70 92Z" opacity="0.45" />
    </>
  ),
  fastest: (
    <>
      <path d="M58 2L12 56H44L34 98L88 38H56L68 2Z" />
      <rect x="2" y="66" width="26" height="9" opacity="0.5" />
      <rect x="8" y="82" width="20" height="9" opacity="0.3" />
    </>
  ),
  skipper: (
    <>
      <path d="M4 14L44 50L4 86Z" />
      <path d="M50 14L90 50L50 86Z" opacity="0.6" />
      <rect x="92" y="14" width="8" height="72" opacity="0.4" />
    </>
  ),
  original: (
    <>
      <circle cx="20" cy="26" r="12" opacity="0.3" />
      <circle cx="20" cy="74" r="12" opacity="0.3" />
      <circle cx="80" cy="26" r="12" opacity="0.3" />
      <circle cx="80" cy="74" r="12" opacity="0.3" />
      <path d="M50 6L60 38L92 48L60 58L50 90L40 58L8 48L40 38Z" />
    </>
  ),
  sheep: (
    <>
      <circle cx="30" cy="34" r="20" opacity="0.7" />
      <circle cx="54" cy="24" r="24" opacity="0.7" />
      <circle cx="78" cy="36" r="18" opacity="0.7" />
      <circle cx="50" cy="46" r="24" />
      <rect x="26" y="64" width="10" height="26" />
      <rect x="46" y="68" width="10" height="26" />
      <rect x="66" y="64" width="10" height="26" />
    </>
  ),
  rarest: (
    <>
      <path d="M50 4L78 30H22Z" opacity="0.6" />
      <path d="M22 30H78L96 44L50 96L4 44Z" />
      <path d="M22 30L38 44H62L78 30" fill="none" stroke="currentColor" strokeWidth="4" opacity="0.5" />
    </>
  ),
  streak: (
    <>
      <path d="M50 4C50 24 30 30 30 52A20 20 0 0 0 70 52C70 42 62 38 62 30C74 38 82 52 82 66A32 32 0 0 1 18 66C18 40 40 32 50 4Z" />
    </>
  ),
  typos: (
    <>
      <rect x="6" y="20" width="30" height="30" transform="rotate(-16 21 35)" />
      <rect x="38" y="46" width="30" height="30" transform="rotate(11 53 61)" opacity="0.7" />
      <rect x="66" y="14" width="24" height="24" transform="rotate(-8 78 26)" opacity="0.45" />
      <path d="M64 72L92 44L98 50L70 78ZM60 82L64 72L70 78Z" />
    </>
  ),
}

/** One nice poster colour per trophy; the disc it sits on is drawn with this tint elsewhere. */
export const TROPHY_TINTS: Record<TrophyId, Tint> = {
  slowest: 'green',
  fastest: 'yellow',
  skipper: 'blue',
  original: 'red',
  sheep: 'pink',
  rarest: 'blue',
  streak: 'red',
  typos: 'yellow',
}

interface TrophyIconProps {
  id: TrophyId
  tint: Tint
  className?: string
}

export function TrophyIcon({ id, tint, className = '' }: TrophyIconProps) {
  return (
    <svg
      className={`shape trophy-icon ${className}`}
      viewBox="0 0 100 100"
      fill="currentColor"
      aria-hidden="true"
      style={{ color: `var(--${tint})` }}
    >
      {ICONS[id]}
    </svg>
  )
}
