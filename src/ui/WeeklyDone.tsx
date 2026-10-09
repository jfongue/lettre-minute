import { useEffect } from 'react'
import type { GameMode } from '../domain/modes'
import { metricOf } from '../domain/weekly'
import { useT } from '../i18n'
import { sound } from '../lib/sound'
import { Burst } from './bauhaus'
import { ModeGlyph, Ticket, WeeklyStat, valueText } from './WeeklyParts'

/**
 * La fin d'une tentative : ce qu'elle a rendu, si elle bat le record, combien
 * de tentatives restent et la place provisoire — puis le retour au défi.
 */
export function WeeklyDone({
  mode,
  value,
  previousBest,
  words,
  left,
  total,
  rank,
  players,
  sending,
  onBack,
}: {
  mode: GameMode
  value: number
  /** Le meilleur d'avant cette tentative ; null à la première. */
  previousBest: number | null
  words: number
  /** Tentatives qu'il reste, et celles du jour au total. */
  left: number
  total: number
  /** Null tant que le serveur n'a pas rangé la tentative. */
  rank: number | null
  players: number
  sending: 'sending' | 'sent' | 'failed'
  onBack(): void
}) {
  const t = useT()
  const metric = metricOf(mode)
  const record = previousBest === null || value > previousBest
  const best = Math.max(value, previousBest ?? 0)

  useEffect(() => {
    if (record && value > 0) sound.crowned(true)
    else sound.go()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="sheet cascade wk-done">
      <section className={`wk-done-hero${record ? ' wk-done-hero--record' : ''}`}>
        {record && value > 0 && <Burst />}
        <span className="wk-done-mark">
          <ModeGlyph mode={mode} />
        </span>
        <div className="wk-done-text">
          <span className="wk-kicker">{t.weekly.done.yours}</span>
          <strong className="wk-done-value">{valueText(t, value, metric)}</strong>
          <span className="wk-done-words">{t.weekly.done.words(words)}</span>
        </div>
      </section>

      <p className={`wk-done-verdict${record ? ' wk-done-verdict--record' : ''}`}>{record ? t.weekly.done.record : t.weekly.done.noRecord}</p>

      <div className="wk-stats">
        <WeeklyStat label={t.weekly.done.best}>{valueText(t, best, metric)}</WeeklyStat>
        <WeeklyStat label={t.weekly.done.rank}>
          {rank === null ? <span className="wk-none">{sending === 'failed' ? '—' : '…'}</span> : t.weekly.screen.rankOf(rank, Math.max(players, rank))}
        </WeeklyStat>
      </div>

      <div className="wk-done-left">
        <span className="wk-card-tickets" aria-hidden="true">
          {Array.from({ length: total }, (_, index) => (
            <Ticket key={index} look={index < total - left ? 'used' : 'free'} size={30} />
          ))}
        </span>
        <p className="wk-heading">{t.weekly.done.left(left)}</p>
      </div>

      {sending === 'sending' && (
        <p className="note" role="status">
          {t.weekly.done.saving}
        </p>
      )}
      {sending === 'failed' && (
        <p className="note note--warn" role="alert">
          {t.weekly.done.notSent}
        </p>
      )}

      <button type="button" className="btn btn--blue btn--block" onClick={onBack}>
        {t.weekly.done.again}
      </button>
    </div>
  )
}
