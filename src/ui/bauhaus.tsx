import type { CSSProperties } from 'react'
import type { RarityTier } from '../domain/rarity'
import { useT } from '../i18n'
import { onTint, type Motif, type ShapeKind, type Tint } from './motifs'
import { PATHS } from './paths'

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

export function TierTag({ tier }: { tier: RarityTier }) {
  const t = useT()
  const tint = TIER_TINTS[tier]
  return (
    <span
      className={`tag${tint ? '' : ' tag--plain'}`}
      style={tint ? { background: `var(--${tint})`, color: `var(--${onTint(tint)})` } : undefined}
    >
      {tier === 'très rare' && <Shape kind="sun" tint="ink" className="tag-sun" />}
      {t.tiers[tier]}
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
