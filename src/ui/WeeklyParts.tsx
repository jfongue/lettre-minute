import { useEffect, useState, type ReactNode } from 'react'
import type { GameMode } from '../domain/modes'
import type { WeeklyMetric } from '../domain/weekly'
import { formatNumber, type Messages } from '../i18n'
import type { Tint } from './motifs'
import '../weekly.css'

/** La couleur de chaque mode : le même repère sur la carte, l'écran et le tutoriel. */
export const MODE_TINTS: Record<GameMode, Tint> = {
  solo: 'yellow',
  endurance: 'red',
  delayed: 'blue',
  reversed: 'green',
}

const MINUTE_MS = 60_000

/** L'heure, relue chaque minute : le temps restant ne se lit pas plus fin. */
export function useNow(initial?: number): number {
  const [now, setNow] = useState(() => initial ?? Date.now())
  useEffect(() => {
    if (initial !== undefined) return
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS)
    return () => clearInterval(timer)
  }, [initial])
  return now
}

export function timeLeft(t: Messages, now: number, closesAt: number): string {
  const minutes = Math.max(0, Math.ceil((closesAt - now) / MINUTE_MS))
  return t.weekly.duration(Math.floor(minutes / 1440), Math.floor((minutes % 1440) / 60), minutes % 60)
}

/** Une valeur du classement : des secondes tenues, ou des points. */
export function valueText(t: Messages, value: number, metric: WeeklyMetric): string {
  return metric === 'survival'
    ? `${value.toLocaleString(t.tag, { maximumFractionDigits: 1 })} ${t.weekly.unitSeconds}`
    : formatNumber(t, value)
}

/**
 * Le dessin d'un mode, tracé comme les formes de l'affiche : le chrono qui se
 * vide pour l'endurance, deux questions décalées pour le retard, une flèche
 * qui revient sur la lettre pour le renversé.
 */
export function ModeGlyph({ mode, className = '' }: { mode: GameMode; className?: string }) {
  return (
    <svg className={`wk-glyph ${className}`} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {mode === 'endurance' ? (
        <>
          <rect x="42" y="4" width="16" height="10" />
          <path d="M50 18A38 38 0 1 0 50 94A38 38 0 1 0 50 18Z" fill="none" stroke="currentColor" strokeWidth="9" />
          <path d="M50 56V30A26 26 0 0 1 76 56Z" />
          <circle cx="50" cy="56" r="6" />
        </>
      ) : mode === 'delayed' ? (
        <>
          <rect x="6" y="10" width="52" height="52" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="12 8" />
          <rect x="38" y="38" width="56" height="56" />
          <path d="M20 34L34 34M30 24L40 34L30 44" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="square" />
        </>
      ) : mode === 'reversed' ? (
        <>
          <rect x="70" y="14" width="22" height="72" />
          <path d="M60 50H12M32 28L10 50L32 72" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="square" strokeLinejoin="miter" />
        </>
      ) : (
        <>
          <circle cx="50" cy="50" r="40" />
          <path d="M40 32L72 50L40 68Z" fill="var(--paper)" />
        </>
      )}
    </svg>
  )
}

/** Un bloc de chiffre : la valeur en grand, sa légende en petit. */
export function WeeklyStat({ label, children, tone }: { label: string; children: ReactNode; tone?: 'plain' | 'ink' }) {
  return (
    <div className={`wk-stat${tone === 'ink' ? ' wk-stat--ink' : ''}`}>
      <span className="wk-stat-label">{label}</span>
      <strong className="wk-stat-value">{children}</strong>
    </div>
  )
}

export type SlotLook = 'used' | 'free'

/** Un billet de tentative, dessiné aux mêmes traits que l'icône Premium. */
export function Ticket({ look, size = 28 }: { look: SlotLook | 'ad' | 'locked'; size?: number }) {
  return (
    <svg className={`wk-ticket wk-ticket--${look}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <path
        className="wk-ticket-body"
        d="M4 6h16a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4V7a1 1 0 0 1 1-1Z"
      />
      {look === 'used' ? (
        <path className="wk-ticket-mark" d="M8 12.2l2.6 2.6L16 9.4" />
      ) : look === 'ad' ? (
        <path className="wk-ticket-mark wk-ticket-fill" d="M10 8.8L15 12L10 15.2Z" />
      ) : (
        <path className="wk-ticket-mark wk-ticket-dash" d="M14.5 8.5v7" />
      )}
    </svg>
  )
}
