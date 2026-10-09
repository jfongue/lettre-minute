import type { CSSProperties } from 'react'
import type { GameMode } from '../domain/modes'
import { useT } from '../i18n'
import { onTint } from './motifs'
import { MODE_TINTS, ModeGlyph, Ticket, timeLeft, useNow } from './WeeklyParts'

/**
 * L'entrée du défi du moment, sous « Jouer » : le mode de la semaine en
 * grand, le temps qui reste avant dimanche 21 h, et les deux billets du jour
 * — pleins tant qu'ils ne sont pas joués, barrés après.
 */
export function WeeklyCard({
  mode,
  closesAt,
  used,
  free,
  now,
  onOpen,
}: {
  mode: GameMode
  closesAt: number
  /** Tentatives jouées aujourd'hui. */
  used: number
  /** Tentatives que le joueur a droit de jouer sans rien débloquer. */
  free: number
  /** Fixée par la planche debug ; sinon l'horloge. */
  now?: number
  onOpen(): void
}) {
  const t = useT()
  const clock = useNow(now)
  const tint = MODE_TINTS[mode]
  const left = Math.max(0, free - used)
  const tickets = Array.from({ length: free }, (_, index) => (index < used ? 'used' : 'free') as 'used' | 'free')
  return (
    <button type="button" className="wk-card" onClick={onOpen} data-track="weekly-card">
      <span className="wk-card-mark" style={{ background: `var(--${tint})`, color: `var(--${onTint(tint)})` } as CSSProperties}>
        <ModeGlyph mode={mode} />
      </span>
      <span className="wk-card-text">
        <span className="wk-kicker">{t.weekly.title}</span>
        <strong className="wk-card-mode">{t.modes[mode]}</strong>
        <span className="wk-card-meta">
          <span>{t.weekly.ends(timeLeft(t, clock, closesAt))}</span>
        </span>
        <span className="wk-card-tickets" role="img" aria-label={t.weekly.card.attempts(left)}>
          {tickets.map((look, index) => (
            <Ticket key={index} look={look} size={26} />
          ))}
          <span className="wk-card-count">{t.weekly.card.attempts(left)}</span>
        </span>
      </span>
      <span className="wk-card-go" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </button>
  )
}
