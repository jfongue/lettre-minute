import { useEffect, useState } from 'react'
import { dailyBonusXp, dailyNumber, liveStreak, playedOn, streakAfter, type DailyRecord } from '../domain/daily'
import { useT } from '../i18n'
import { localDay, nextLocalMidnight } from '../state/daily'
import { Shape } from './bauhaus'

const MINUTE_MS = 60_000

/** L'heure, relue chaque minute : le temps avant la partie suivante ne se lit pas plus fin. */
function useMinuteClock(fixed?: number): number {
  const [now, setNow] = useState(() => fixed ?? Date.now())
  useEffect(() => {
    if (fixed !== undefined) return
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS)
    return () => clearInterval(timer)
  }, [fixed])
  return fixed ?? now
}

/**
 * L'entrée du défi du jour, sous « Jouer » : sa série de jours en grand, et ce
 * qu'elle rapporte tant que la partie du jour reste à jouer ; une fois jouée,
 * son score et le temps avant la suivante, sans rien à toucher.
 */
export function DailyCard({
  record,
  now,
  disabled,
  onPlay,
}: {
  record: DailyRecord
  /** Fixée par la planche debug ; sinon l'horloge. */
  now?: number
  disabled?: boolean
  onPlay(): void
}) {
  const t = useT()
  const text = t.daily.app
  const clock = useMinuteClock(now)
  // Relu de l'horloge : passé minuit, la carte ouvre la partie suivante sans attendre l'accueil.
  const today = localDay(clock)
  const done = playedOn(record, today)
  const streak = liveStreak(record, today)
  const kicker = `${text.kicker} · ${t.daily.number(dailyNumber(today))}`
  const mark = (
    <span className={`daily-card-mark${streak > 0 ? ' daily-card-mark--lit' : ''}`} aria-hidden="true">
      {streak > 0 ? <strong>{streak}</strong> : <Shape kind="sun" tint="yellow" />}
    </span>
  )

  if (done) {
    const minutes = Math.max(1, Math.ceil((nextLocalMidnight(clock) - clock) / MINUTE_MS))
    return (
      <div className="daily-card daily-card--done" role="status">
        {mark}
        <span className="daily-card-text">
          <span className="daily-card-kicker">{kicker}</span>
          <strong className="daily-card-main">{text.done(record.score)}</strong>
          <span className="daily-card-meta">
            {streak > 0 && <span>{text.streak(streak)}</span>}
            <span>{text.next(text.time(Math.floor(minutes / 60), minutes % 60))}</span>
          </span>
        </span>
      </div>
    )
  }

  return (
    <button type="button" className="daily-card" onClick={onPlay} disabled={disabled} data-track="daily-card">
      {mark}
      <span className="daily-card-text">
        <span className="daily-card-kicker">{kicker}</span>
        <strong className="daily-card-main">{streak > 0 ? text.streak(streak) : text.same}</strong>
        <span className="daily-card-meta">
          {streak > 0 && <span>{text.keep}</span>}
          <span className="daily-card-bonus">{text.bonus(dailyBonusXp(streakAfter(record, today)))}</span>
        </span>
      </span>
      <span className="daily-card-go" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </button>
  )
}
