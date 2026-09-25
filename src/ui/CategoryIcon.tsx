import type { ReactNode } from 'react'
import { Shape } from './bauhaus'
import { categoryMotif, type Tint } from './motifs'

const ring = { fill: 'none', stroke: 'currentColor' } as const
const hole = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`

/**
 * Each category drawn from the same circles, squares and triangles as the rest
 * of the poster, but arranged into its subject. One colour, a lighter second
 * layer for depth: the icon sits on a block of colour as often as on paper.
 */
const ICONS: Record<string, ReactNode> = {
  pays: (
    <>
      <circle cx="50" cy="50" r="42" {...ring} strokeWidth="8" />
      <ellipse cx="50" cy="50" rx="17" ry="42" {...ring} strokeWidth="7" />
      <path d="M8 50H92" {...ring} strokeWidth="7" />
      <path d="M15 29H85M15 71H85" {...ring} strokeWidth="5" opacity="0.55" />
    </>
  ),
  animaux: (
    <path
      fillRule="evenodd"
      d={`M12 94V34L28 8L44 30H56L72 8L88 34V94Z${hole(36, 56, 7)}${hole(64, 56, 7)}M44 70H56L50 79Z`}
    />
  ),
  couleurs: (
    <>
      <path d="M46 46H4A42 42 0 0 1 46 4Z" />
      <path d="M54 46V4A42 42 0 0 1 96 46Z" opacity="0.75" />
      <path d="M54 54H96A42 42 0 0 1 54 96Z" opacity="0.5" />
      <path d="M46 54V96A42 42 0 0 1 4 54Z" opacity="0.25" />
    </>
  ),
  'fruits-legumes': (
    <>
      <circle cx="37" cy="62" r="30" />
      <circle cx="63" cy="62" r="30" />
      <rect x="47" y="14" width="6" height="22" />
      <path d="M53 30C53 14 64 6 84 6C84 22 72 30 53 30Z" opacity="0.6" />
    </>
  ),
  metiers: (
    <>
      <path d="M12 10H70L88 24V36H12Z" />
      <rect x="40" y="36" width="16" height="58" opacity="0.6" />
    </>
  ),
  sports: (
    <>
      <path d="M20 4H42L60 40H38Z" opacity="0.6" />
      <path d="M80 4H58L40 40H62Z" opacity="0.6" />
      <path fillRule="evenodd" d={`${hole(50, 66, 30)}${hole(50, 66, 16)}`} />
      <circle cx="50" cy="66" r="9" />
    </>
  ),
  'corps-humain': (
    <>
      <path fillRule="evenodd" d={`M4 50C24 16 76 16 96 50C76 84 24 84 4 50Z${hole(50, 50, 20)}`} />
      <circle cx="50" cy="50" r="10" />
    </>
  ),
  matieres: (
    <>
      <rect x="4" y="8" width="44" height="24" />
      <rect x="52" y="8" width="44" height="24" />
      <g opacity="0.6">
        <rect x="4" y="38" width="20" height="24" />
        <rect x="28" y="38" width="44" height="24" />
        <rect x="76" y="38" width="20" height="24" />
      </g>
      <rect x="4" y="68" width="44" height="24" />
      <rect x="52" y="68" width="44" height="24" />
    </>
  ),
  capitales: (
    <>
      <path d="M50 6L96 30H4Z" />
      <g opacity="0.6">
        {[12, 32, 56, 76].map((x) => (
          <rect key={x} x={x} y="36" width="12" height="44" />
        ))}
      </g>
      <rect x="4" y="86" width="92" height="10" />
    </>
  ),
  marques: <path fillRule="evenodd" d={`M6 6H54L94 46L46 94L6 54Z${hole(28, 28, 9)}`} />,
  prenoms: (
    <>
      <path fillRule="evenodd" d="M4 22H96V90H4ZM40 30V38H60V30Z" />
      <rect x="44" y="6" width="12" height="20" />
      <g opacity="0.55">
        <rect x="16" y="52" width="68" height="10" />
        <rect x="16" y="70" width="44" height="10" />
      </g>
    </>
  ),
  objets: (
    <>
      <path d="M10 22H70V82A12 12 0 0 1 58 94H22A12 12 0 0 1 10 82Z" />
      <path d="M70 36H80A12 12 0 0 1 80 72H70" {...ring} strokeWidth="9" />
      <path d="M24 4V14M40 4V14M56 4V14" {...ring} strokeWidth="6" opacity="0.55" />
    </>
  ),
  plantes: (
    <>
      <path fillRule="evenodd" d="M50 4C84 24 84 58 50 78C16 58 16 24 50 4ZM47 20V66H53V20Z" />
      <rect x="47" y="76" width="6" height="18" opacity="0.55" />
      <rect x="26" y="90" width="48" height="6" opacity="0.55" />
    </>
  ),
}

interface CategoryIconProps {
  categoryId: string
  tint: Tint
  className?: string
}

/** A category's own picture; one the set does not draw yet falls back to its plain shape. */
export function CategoryIcon({ categoryId, tint, className = '' }: CategoryIconProps) {
  const icon = ICONS[categoryId]
  if (!icon) return <Shape kind={categoryMotif(categoryId).kind} tint={tint} className={className} />
  return (
    <svg
      className={`shape category-icon ${className}`}
      viewBox="0 0 100 100"
      fill="currentColor"
      aria-hidden="true"
      style={{ color: `var(--${tint})` }}
    >
      {icon}
    </svg>
  )
}
