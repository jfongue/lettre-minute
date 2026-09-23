import type { ReactNode } from 'react'
import type { ShapeKind } from './motifs'

export const PATHS: Record<ShapeKind, ReactNode> = {
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
