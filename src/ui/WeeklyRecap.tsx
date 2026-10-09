import { useEffect, useState, type CSSProperties } from 'react'
import type { GameMode } from '../domain/modes'
import { awardWeeklyTrophies, metricOf, recordCurve, type WeeklyTrophy } from '../domain/weekly'
import { capitalized } from '../domain/text'
import { useT } from '../i18n'
import { fetchWeeklyBoard, fetchWeeklyMeasures, fetchWeeklyRecap, type WeeklyRecap as RecapData, type WeeklyRecapRank } from '../lib/cloud'
import { sound } from '../lib/sound'
import { Burst } from './bauhaus'
import { onTint } from './motifs'
import { useBackDismiss } from './useBackDismiss'
import { MODE_TINTS, ModeGlyph, valueText } from './WeeklyParts'
import { WEEKLY_TROPHY_TINTS, WeeklyTrophyIcon } from './WeeklyTrophyIcon'

/** La courbe du record, tentative après tentative : une marche à chaque nouveau record. */
function RecordCurve({ values, mode }: { values: readonly (number | null)[]; mode: GameMode }) {
  const t = useT()
  const metric = metricOf(mode)
  const curve = recordCurve(values)
  const top = Math.max(1, ...curve)
  const width = 300
  const height = 130
  const left = 8
  const right = 20
  const step = curve.length > 1 ? (width - left - right) / (curve.length - 1) : 0
  const x = (index: number) => (curve.length > 1 ? left + index * step : width / 2)
  const y = (value: number) => 14 + (1 - value / top) * (height - 34)
  // Une marche : le record tient jusqu'à la tentative qui le bat.
  const path = curve.map((value, index) => `${index === 0 ? 'M' : 'H'}${x(index)}${index === 0 ? ` ${y(value)}` : ` V${y(value)}`}`).join(' ')
  const area = `${path} V${height - 20} H${x(0)} Z`
  return (
    <figure className="wk-curve">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t.weekly.recap.curve}>
        <line x1={left} x2={width - right + 6} y1={height - 20} y2={height - 20} className="wk-curve-axis" />
        <path d={area} className="wk-curve-area" />
        <path d={path} className="wk-curve-line" />
        {curve.map((value, index) => (
          <g key={index}>
            <circle cx={x(index)} cy={y(value)} r={values[index] !== null && values[index] === value ? 5.5 : 3.5} className={values[index] === value ? 'wk-curve-dot wk-curve-dot--record' : 'wk-curve-dot'} />
            <text x={x(index)} y={height - 5} textAnchor="middle" className="wk-curve-label">
              {t.weekly.recap.attempt(index + 1)}
            </text>
          </g>
        ))}
        <text x={x(curve.length - 1)} y={y(top) - 7} textAnchor="end" className="wk-curve-top">
          {valueText(t, top, metric)}
        </text>
      </svg>
      <figcaption className="note">{t.weekly.recap.curve}</figcaption>
    </figure>
  )
}

/** Le rang à la fin de chaque jour joué : le 1er est en haut du cadre. */
function RankCurve({ ranks }: { ranks: readonly WeeklyRecapRank[] }) {
  const t = useT()
  const width = 300
  const height = 130
  const left = 16
  const right = 20
  const worst = Math.max(2, ...ranks.map((entry) => entry.rank))
  const step = ranks.length > 1 ? (width - left - right) / (ranks.length - 1) : 0
  const x = (index: number) => (ranks.length > 1 ? left + index * step : width / 2)
  const y = (rank: number) => 24 + ((rank - 1) / (worst - 1)) * (height - 54)
  const path = ranks.map((entry, index) => `${index === 0 ? 'M' : 'L'}${x(index)} ${y(entry.rank)}`).join(' ')
  return (
    <figure className="wk-curve">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t.weekly.recap.rankCurve}>
        <line x1={left - 8} x2={width - right + 6} y1={height - 20} y2={height - 20} className="wk-curve-axis" />
        {ranks.length > 1 && <path d={path} className="wk-curve-line" />}
        {ranks.map((entry, index) => (
          <g key={entry.day}>
            <circle cx={x(index)} cy={y(entry.rank)} r={index === ranks.length - 1 ? 5.5 : 3.5} className={index === ranks.length - 1 ? 'wk-curve-dot wk-curve-dot--record' : 'wk-curve-dot'} />
            <text x={x(index)} y={y(entry.rank) - 9} textAnchor="middle" className="wk-curve-top">
              {entry.rank}
            </text>
            <text x={x(index)} y={height - 5} textAnchor="middle" className="wk-curve-label">
              {t.weekly.recap.rankDays[new Date(`${entry.day}T00:00:00Z`).getUTCDay()]}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="note">{t.weekly.recap.rankCurve}</figcaption>
    </figure>
  )
}

export interface WeeklyRecapViewProps {
  mode: GameMode
  recap: RecapData | null
  trophy: WeeklyTrophy | null
  onGo(): void
  onResults(): void
  onLater(): void
}

/**
 * Le récap d'une semaine qui vient de se clore : la courbe du record, le rang
 * final, le trophée s'il y en a un, puis l'invitation au nouveau défi.
 */
export function WeeklyRecapView({ mode, recap, trophy, onGo, onResults, onLater }: WeeklyRecapViewProps) {
  const t = useT()
  useBackDismiss(onLater)
  const tint = MODE_TINTS[mode]
  const metric = metricOf(mode)
  const rank = recap?.rank ?? null
  useEffect(() => {
    if (recap) sound.crowned(rank !== null && rank <= 3)
  }, [recap, rank])
  const values = recap ? recap.attempts.map((attempt) => (attempt.finished ? attempt.value : null)) : []
  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="wk-recap-title">
      <div className="offer-pop-scrim" onClick={onLater} />
      <div className="wk-recap">
        <header className="wk-recap-head" style={{ background: `var(--${tint})`, color: `var(--${onTint(tint)})` } as CSSProperties}>
          <span className="wk-recap-mark">
            <ModeGlyph mode={mode} />
          </span>
          <div>
            <span className="wk-kicker">{t.weekly.recap.kicker}</span>
            <h2 id="wk-recap-title">{t.weekly.recap.title}</h2>
          </div>
        </header>

        {recap === null ? (
          <p className="note" role="status">
            {t.weekly.recap.loading}
          </p>
        ) : (
          <>
            <div className="wk-recap-rank">
              {rank !== null && rank <= 3 && <Burst />}
              <span className="wk-kicker">{t.weekly.recap.finalRank}</span>
              <strong>{rank === null ? '—' : t.weekly.recap.rankOf(rank, Math.max(recap.players, rank))}</strong>
              <span className="note">
                {recap.best !== null && `${t.weekly.recap.best} ${valueText(t, recap.best, metric)} · `}
                {t.weekly.recap.attempts(recap.attempts.length)}
              </span>
            </div>
            {values.some((value) => value !== null) && <RecordCurve values={values} mode={mode} />}
            {recap.ranks.length > 0 && <RankCurve ranks={recap.ranks} />}
            {trophy && (
              <div className="trophy wk-recap-trophy">
                <span className="trophy-mark" style={{ background: `var(--${WEEKLY_TROPHY_TINTS[trophy.id]})` }} aria-hidden="true">
                  <WeeklyTrophyIcon id={trophy.id} tint={onTint(WEEKLY_TROPHY_TINTS[trophy.id])} />
                </span>
                <span className="trophy-text">
                  <span className="wk-kicker">{t.weekly.recap.trophy}</span>
                  <strong>{t.weekly.trophy[trophy.id][0]}</strong>
                  <span className="note">
                    {t.weekly.trophy[trophy.id][1](trophy.value, capitalized(trophy.word ?? ''), metric === 'survival' ? t.weekly.unitSeconds : t.weekly.unitPoints)}
                  </span>
                </span>
              </div>
            )}
          </>
        )}

        <p className="wk-recap-new">{t.weekly.recap.newOpen}</p>
        <button type="button" className="btn btn--blue btn--block" onClick={onGo}>
          {t.weekly.recap.go}
        </button>
        <div className="wk-recap-links">
          <button type="button" className="btn btn--quiet" onClick={onResults}>
            {t.weekly.recap.results}
          </button>
          <button type="button" className="btn btn--quiet" onClick={onLater}>
            {t.weekly.recap.later}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Le récap, chargé : mes tentatives, mon rang final, et mon trophée dans les mesures de la semaine. */
export function WeeklyRecap({
  weekId,
  lang,
  mode,
  onGo,
  onResults,
  onLater,
}: { weekId: string; lang: string; mode: GameMode } & Pick<WeeklyRecapViewProps, 'onGo' | 'onResults' | 'onLater'>) {
  const [recap, setRecap] = useState<RecapData | null>(null)
  const [trophy, setTrophy] = useState<WeeklyTrophy | null>(null)
  useEffect(() => {
    let live = true
    fetchWeeklyRecap(weekId, lang).then((next) => live && setRecap(next ?? { attempts: [], best: null, rank: null, players: 0, ranks: [] }))
    Promise.all([fetchWeeklyBoard(weekId, lang, 200), fetchWeeklyMeasures(weekId, lang)]).then(([board, measures]) => {
      const me = board?.find((row) => row.me)
      if (!live || !me || !measures) return
      setTrophy(awardWeeklyTrophies(measures).find((award) => award.playerId === me.playerId) ?? null)
    })
    return () => {
      live = false
    }
  }, [weekId, lang])
  return <WeeklyRecapView mode={mode} recap={recap} trophy={trophy} onGo={onGo} onResults={onResults} onLater={onLater} />
}
