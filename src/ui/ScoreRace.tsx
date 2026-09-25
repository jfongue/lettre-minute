import { useState, type PointerEvent } from 'react'
import { settledScoreAt, type Standing } from '../domain/challenge'
import { RUN_SECONDS } from '../domain/run'
import { formatNumber, useT } from '../i18n'
import type { ChallengePlayer } from '../lib/cloud'

// Fixed order, the palest last: yellow and pink read poorly on paper, so a
// small race never needs them, and the legend always names every line.
const LINE_COLORS = ['var(--blue)', 'var(--red)', 'var(--green)', 'var(--ink)', 'var(--yellow)', 'var(--pink)', 'var(--ink-soft)', 'var(--ink-faint)']

const WIDTH = 320
const HEIGHT = 160
const PAD = { top: 10, right: 12, bottom: 22, left: 34 }

/** Every player's settled score, second by second: who led when, and where the run was won. */
export function ScoreRace({ standings, player }: { standings: readonly Standing[]; player(id: string): ChallengePlayer | undefined }) {
  const t = useT()
  const [hover, setHover] = useState<number | null>(null)
  if (standings.length < 2) return null

  // Silence holds the clock: a run can validate past the sixtieth second.
  const last = Math.ceil(Math.max(RUN_SECONDS, ...standings.flatMap((standing) => standing.words.map((word) => word.at))))
  const top = Math.max(10, ...standings.map((standing) => standing.score))
  const x = (second: number) => PAD.left + (second / last) * (WIDTH - PAD.left - PAD.right)
  const y = (score: number) => HEIGHT - PAD.bottom - (score / top) * (HEIGHT - PAD.top - PAD.bottom)
  const seconds = Array.from({ length: last + 1 }, (_, second) => second)
  // A colour follows the player, not the rank: overtaking must not repaint the lines.
  const order = [...standings].sort((a, b) => a.playerId.localeCompare(b.playerId))
  const color = (id: string) => LINE_COLORS[order.findIndex((standing) => standing.playerId === id) % LINE_COLORS.length]!

  const step = (standing: Standing) => {
    let path = `M${x(0)} ${y(0)}`
    let score = 0
    for (const second of seconds.slice(1)) {
      const next = settledScoreAt(standing.words, second)
      if (next !== score) {
        path += `H${x(second)}V${y(next)}`
        score = next
      }
    }
    return `${path}H${x(last)}`
  }

  const track = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const at = ((event.clientX - box.left) / box.width) * WIDTH
    const second = Math.round(((at - PAD.left) / (WIDTH - PAD.left - PAD.right)) * last)
    setHover(Math.max(0, Math.min(last, second)))
  }
  const name = (id: string) => {
    const who = player(id)
    return who?.me ? t.challenge.you : (who?.name ?? '')
  }
  const ticks = [0, 15, 30, 45, 60].filter((tick) => tick <= last)

  return (
    <section className="panel score-race">
      <div className="spread">
        <p className="section-title">{t.challenge.raceTitle}</p>
        <p className="note">{hover === null ? t.challenge.raceHint : t.challenge.raceAt(hover)}</p>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="score-race-chart"
        role="img"
        aria-label={t.challenge.raceTitle}
        data-no-swipe
        onPointerMove={track}
        onPointerDown={track}
        onPointerLeave={() => setHover(null)}
      >
        {[0, top / 2, top].map((value) => (
          <g key={value}>
            <line className="score-race-grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(value)} y2={y(value)} />
            <text className="score-race-axis" x={PAD.left - 6} y={y(value) + 3} textAnchor="end">
              {Math.round(value)}
            </text>
          </g>
        ))}
        {ticks.map((tick) => (
          <text key={tick} className="score-race-axis" x={x(tick)} y={HEIGHT - 6} textAnchor="middle">
            {tick}s
          </text>
        ))}
        {order.map((standing) => (
          <path
            key={standing.playerId}
            d={step(standing)}
            className={`score-race-line${player(standing.playerId)?.me ? ' score-race-line--me' : ''}`}
            style={{ stroke: color(standing.playerId) }}
          />
        ))}
        {hover !== null && (
          <line className="score-race-cross" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={HEIGHT - PAD.bottom} />
        )}
      </svg>
      <ul className="score-race-legend">
        {standings.map((standing) => (
          <li key={standing.playerId}>
            <span className="score-race-swatch" style={{ background: color(standing.playerId) }} aria-hidden="true" />
            <span className="score-race-name">{name(standing.playerId)}</span>
            <span className="score-race-value">
              {formatNumber(t, hover === null ? standing.score : settledScoreAt(standing.words, hover))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
