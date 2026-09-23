import type { CSSProperties, ReactNode } from 'react'
import { onTint, type Motif, type ShapeKind, type Tint } from './motifs'

const PATHS: Record<ShapeKind, ReactNode> = {
  circle: <circle cx="50" cy="50" r="50" />,
  square: <rect width="100" height="100" />,
  quarter: <path d="M0 0H100A100 100 0 0 1 0 100Z" />,
  arch: <path d="M0 100V50A50 50 0 0 1 100 50V100Z" />,
  half: <path d="M0 50A50 50 0 0 0 100 50Z" />,
  triangle: <path d="M50 0L100 100H0Z" />,
  corner: <path d="M0 0L100 100H0Z" />,
  ring: <circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" strokeWidth="28" />,
  diamond: <path d="M50 0L100 50L50 100L0 50Z" />,
  bars: (
    <>
      <rect y="0" width="100" height="20" />
      <rect y="40" width="100" height="20" />
      <rect y="80" width="100" height="20" />
    </>
  ),
  sun: (
    <>
      <circle cx="50" cy="50" r="20" />
      <g stroke="currentColor" strokeWidth="5" strokeLinecap="round">
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1="50" y1="4" x2="50" y2="20" transform={`rotate(${i * 30} 50 50)`} />
        ))}
      </g>
    </>
  ),
}

interface ShapeProps {
  kind: ShapeKind
  tint: Tint
  className?: string
  style?: CSSProperties
}

export function Shape({ kind, tint, className = '', style }: ShapeProps) {
  return (
    <svg
      className={`shape ${className}`}
      viewBox="0 0 100 100"
      fill="currentColor"
      aria-hidden="true"
      style={{ color: `var(--${tint})`, ...style }}
    >
      {PATHS[kind]}
    </svg>
  )
}

/** A letter set in a coloured shape: the game's one recurring glyph. */
export function LetterMark({ letter, motif, size }: { letter: string; motif: Motif; size: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`mark mark--${size} mark--${motif.kind}`} style={{ color: `var(--${onTint(motif.tint)})` }}>
      <Shape kind={motif.kind} tint={motif.tint} />
      <span className="mark-letter">{letter}</span>
    </span>
  )
}

const TIER_TINTS: Record<string, Tint> = { 'peu commun': 'blue', rare: 'red', 'très rare': 'yellow' }

export function TierTag({ tier }: { tier: string }) {
  const tint = TIER_TINTS[tier]
  return (
    <span
      className={`tag${tint ? '' : ' tag--plain'}`}
      style={tint ? { background: `var(--${tint})`, color: `var(--${onTint(tint)})` } : undefined}
    >
      {tier === 'très rare' && <Shape kind="sun" tint="ink" className="tag-sun" />}
      {tier}
    </span>
  )
}

const BURST: readonly Motif[] = [
  { kind: 'circle', tint: 'red' },
  { kind: 'square', tint: 'blue' },
  { kind: 'triangle', tint: 'yellow' },
  { kind: 'circle', tint: 'green' },
  { kind: 'diamond', tint: 'pink' },
  { kind: 'square', tint: 'red' },
  { kind: 'circle', tint: 'blue' },
  { kind: 'triangle', tint: 'green' },
]

/** A handful of shapes thrown outwards; re-key it to throw again. */
export function Burst() {
  return (
    <span className="burst" aria-hidden="true">
      {BURST.map((piece, index) => (
        <Shape
          key={index}
          kind={piece.kind}
          tint={piece.tint}
          className="burst-piece"
          style={{ '--angle': `${index * 45 + 20}deg`, '--reach': `${2.4 + (index % 3) * 0.6}rem` } as CSSProperties}
        />
      ))}
    </span>
  )
}

/** A figure set on a flat block of colour, as a poster would print it. */
export function Figure({ value, label, tint }: { value: string | number; label: string; tint: Tint }) {
  return (
    <div className="figure" style={{ background: `var(--${tint})`, color: `var(--${onTint(tint)})` }}>
      <span className="figure-value">{value}</span>
      <span className="figure-label">{label}</span>
    </div>
  )
}
