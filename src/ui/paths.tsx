import type { ReactNode } from 'react'
import type { DetailKind, ShapeKind } from './motifs'

export const PATHS: Record<ShapeKind | DetailKind, ReactNode> = {
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
  cross: <path d="M35 0H65V35H100V65H65V100H35V65H0V35H35Z" />,
  lens: <path d="M50 0A62 62 0 0 1 50 100A62 62 0 0 1 50 0Z" />,
  moon: <path d="M62 2A50 50 0 1 0 62 98A40 48 0 0 1 62 2Z" />,
  pill: <rect x="20" width="60" height="100" rx="30" />,
  hexagon: <path d="M25 6H75L100 50L75 94H25L0 50Z" />,
  steps: <path d="M0 100V67H33V33H67V0H100V100Z" />,
  wave: <path d="M0 38Q25 8 50 38T100 38V68Q75 98 50 68T0 68Z" />,
  zigzag: <path d="M0 25L25 50L50 25L75 50L100 25V60L75 85L50 60L25 85L0 60Z" />,
  chevron: <path d="M0 15L50 55L100 15V50L50 90L0 50Z" />,
  hourglass: <path d="M0 0H100L50 50L100 100H0L50 50Z" />,
  flower: (
    <>
      <circle cx="30" cy="30" r="28" />
      <circle cx="70" cy="30" r="28" />
      <circle cx="30" cy="70" r="28" />
      <circle cx="70" cy="70" r="28" />
    </>
  ),
  dots: (
    <>
      {[18, 50, 82].flatMap((cy) => [18, 50, 82].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="13" />))}
    </>
  ),
  checker: (
    <>
      <rect width="50" height="50" />
      <rect x="50" y="50" width="50" height="50" />
    </>
  ),
  star: <path d="M50 0L62 36H100L69 58L81 95L50 72L19 95L31 58L0 36H38Z" />,
  drop: <path d="M50 0C62 22 88 44 88 64A38 38 0 0 1 12 64C12 44 38 22 50 0Z" />,
  frame: <path fillRule="evenodd" d="M0 0H100V100H0Z M24 24V76H76V24Z" />,
  target: <path fillRule="evenodd" d="M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z M50 18A32 32 0 1 0 50 82A32 32 0 1 0 50 18Z M50 36A14 14 0 1 1 50 64A14 14 0 1 1 50 36Z" />,
  heart: <path d="M50 92L9 52A24 24 0 0 1 50 18A24 24 0 0 1 91 52Z" />,
  domes: <path d="M0 50A50 50 0 0 1 100 50Z M0 100A50 50 0 0 1 100 100Z" />,
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
  ringbroken: (
    <>
      <path d="M92.7 26.7A46 46 0 0 1 26.7 92.7" fill="none" stroke="currentColor" strokeWidth="26" />
      <path d="M7.3 73.3A46 46 0 0 1 73.3 7.3" fill="none" stroke="currentColor" strokeWidth="26" />
    </>
  ),
  comma: <path d="M50 0A42 42 0 0 1 92 42C92 68 72 88 46 100C46 84 38 70 26 56C16 44 8 34 8 24A24 24 0 0 1 50 0Z" />,
  bang: <path d="M39 0H61L55 58H45Z" />,
  eclipse: <path fillRule="evenodd" d="M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z M50 0A50 50 0 0 0 50 100Z" />,
  bloom: (
    <>
      {[0, 72, 144, 216, 288].map((angle) => (
        <circle key={angle} cx="50" cy="23" r="19" transform={`rotate(${angle} 50 50)`} />
      ))}
    </>
  ),
  archway: <path d="M0 52A52 52 0 0 1 100 52V100H66V80A16 16 0 0 0 34 80V100H0Z" />,
  dial: <circle cx="50" cy="50" r="40" />,
  bangDot: <circle cx="50" cy="86" r="12" />,
  dialHand: <rect x="47" y="6" width="6" height="44" rx="3" transform="rotate(45 50 50)" />,
}
