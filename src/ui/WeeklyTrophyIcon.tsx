import type { ReactNode } from 'react'
import type { WeeklyTrophyId } from '../domain/weekly'
import type { Tint } from './motifs'

/** Dessinés dans la même boîte que les trophées des défis entre amis, avec les mêmes blocs de l'affiche. */
const ICONS: Record<WeeklyTrophyId, ReactNode> = {
  'weekly-rarest': (
    <>
      <path d="M50 2L58 22L78 14L70 34L92 40L72 52L84 72L62 68L56 92L50 74L44 92L38 68L16 72L28 52L8 40L30 34L22 14L42 22Z" opacity="0.35" />
      <path d="M30 34H70L84 48L50 88L16 48Z" />
      <path d="M30 34L40 48H60L70 34M40 48L50 88L60 48" fill="none" stroke="currentColor" strokeWidth="4" opacity="0.45" />
    </>
  ),
  'weekly-original': (
    <>
      <circle cx="18" cy="24" r="10" opacity="0.3" />
      <circle cx="82" cy="24" r="10" opacity="0.3" />
      <circle cx="18" cy="76" r="10" opacity="0.3" />
      <circle cx="82" cy="76" r="10" opacity="0.3" />
      <path d="M50 4L61 38L96 50L61 62L50 96L39 62L4 50L39 38Z" />
    </>
  ),
  'weekly-climber': (
    <>
      <rect x="4" y="68" width="22" height="26" opacity="0.4" />
      <rect x="28" y="50" width="22" height="44" opacity="0.6" />
      <rect x="52" y="32" width="22" height="62" opacity="0.8" />
      <rect x="76" y="14" width="20" height="80" />
      <path d="M10 52L44 22L58 30L88 4" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="square" />
    </>
  ),
  'weekly-streak': (
    <>
      <rect x="2" y="36" width="34" height="28" rx="14" opacity="0.5" />
      <rect x="33" y="36" width="34" height="28" rx="14" opacity="0.75" />
      <rect x="64" y="36" width="34" height="28" rx="14" />
      <path d="M50 4C50 16 40 18 40 28A10 10 0 0 0 60 28C60 22 56 20 56 14C62 18 66 24 66 30" opacity="0.7" />
    </>
  ),
  'weekly-fastest': (
    <>
      <path d="M58 2L12 56H44L34 98L88 38H56L68 2Z" />
      <rect x="2" y="66" width="26" height="9" opacity="0.5" />
      <rect x="8" y="82" width="20" height="9" opacity="0.3" />
    </>
  ),
  'weekly-persistent': (
    <>
      <path d="M14 30H86V42A8 8 0 0 0 86 58V70H14V58A8 8 0 0 0 14 42Z" opacity="0.4" />
      <path d="M10 40H82V52A8 8 0 0 0 82 68V80H10V68A8 8 0 0 0 10 52Z" opacity="0.7" />
      <path d="M6 50H78V62A8 8 0 0 0 78 78V90H6V78A8 8 0 0 0 6 62Z" />
      <path d="M62 22A24 24 0 1 1 38 14L44 4L26 14L40 30" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="square" />
    </>
  ),
  'weekly-longest': (
    <>
      <rect x="2" y="38" width="20" height="24" />
      <rect x="25" y="38" width="20" height="24" opacity="0.8" />
      <rect x="48" y="38" width="20" height="24" opacity="0.6" />
      <rect x="71" y="38" width="12" height="24" opacity="0.45" />
      <rect x="86" y="38" width="12" height="24" opacity="0.3" />
      <rect x="2" y="68" width="96" height="6" opacity="0.5" />
      <rect x="2" y="26" width="96" height="6" opacity="0.5" />
    </>
  ),
  'weekly-sheep': (
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
}

/** Une couleur d'affiche par trophée : le disque qui le porte la prend. */
export const WEEKLY_TROPHY_TINTS: Record<WeeklyTrophyId, Tint> = {
  'weekly-rarest': 'blue',
  'weekly-original': 'red',
  'weekly-climber': 'green',
  'weekly-streak': 'pink',
  'weekly-fastest': 'yellow',
  'weekly-persistent': 'blue',
  'weekly-longest': 'red',
  'weekly-sheep': 'pink',
}

export function WeeklyTrophyIcon({ id, tint, className = '' }: { id: WeeklyTrophyId; tint: Tint; className?: string }) {
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
