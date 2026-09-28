import { Suspense, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { completeLeaderboard, myPlace, PERIODS, STATS, type Leaderboard, type PeriodId, type PlacedRow, type StatId } from '../domain/leaderboards'
import { formatNumber, useT } from '../i18n'
import { fetchLeaderboard } from '../lib/cloud'
import type { LoadInsights } from '../debug/Insights'
import { lazyScreen } from './lazyScreen'
import { Avatar } from './Avatar'
import { Shape } from './bauhaus'
import { onTint, type ShapeKind, type Tint } from './motifs'
import { PlayerName } from './PlayerSheet'

// A developer's tool behind five taps: no player should download it.
const Insights = lazyScreen(() => import('../debug/Insights').then((module) => module.Insights))

const LOOKS: Record<StatId, { kind: ShapeKind; tint: Tint }> = {
  best: { kind: 'star', tint: 'yellow' },
  points: { kind: 'circle', tint: 'red' },
  runs: { kind: 'bars', tint: 'blue' },
  words: { kind: 'steps', tint: 'green' },
  discoveries: { kind: 'sun', tint: 'pink' },
  combo: { kind: 'zigzag', tint: 'red' },
  added: { kind: 'cross', tint: 'blue' },
}

/** Undefined while it is asked for, null when the server did not answer. */
type Loaded = Leaderboard | null | undefined

export type LoadLeaderboard = (stat: StatId, period: PeriodId) => Promise<Leaderboard | null>

async function loadFromServer(stat: StatId, period: PeriodId): Promise<Leaderboard | null> {
  const board = await fetchLeaderboard(stat, period)
  return board && completeLeaderboard(stat, period, board)
}

interface LeaderboardsPageProps {
  /** An anonymous player reads the boards but stands on none of them. */
  named: boolean
  /** The dictionary the advanced boards read their pairs in: the interface's. */
  lang: string
  /** The debug board passes its own made-up boards. */
  load?: LoadLeaderboard
  /** Cinq tapes sur « Classements » : les classements avancés, sous la page. */
  advanced?: boolean
  /** La planche nourrit les classements avancés de ses propres chiffres. */
  loadInsights?: LoadInsights
  /** Ferme le mode débug, pour ne pas le garder sous les yeux. */
  onCloseAdvanced?(): void
}

/**
 * Seven measures, one page each on a snapping horizontal track as on the
 * home screen: the swipe is the browser's own. Each board is asked for when
 * it is reached, with its neighbours, and kept for the page's life.
 */
export function LeaderboardsPage({
  named,
  lang,
  load = loadFromServer,
  advanced = false,
  loadInsights,
  onCloseAdvanced,
}: LeaderboardsPageProps) {
  const t = useT()
  const [period, setPeriod] = useState<PeriodId>('day')
  const [active, setActive] = useState(0)
  const [boards, setBoards] = useState<Record<string, Loaded>>({})
  const track = useRef<HTMLDivElement>(null)
  const chips = useRef<HTMLDivElement>(null)
  const asked = useRef(new Set<string>())
  // The track is as tall as the board in view: a board of fifty would
  // otherwise leave a short one floating over a long blank.
  const [height, setHeight] = useState<number | undefined>(undefined)
  useLayoutEffect(() => {
    const panel = track.current?.children[active] as HTMLElement | undefined
    if (!panel) return
    const observer = new ResizeObserver(() => setHeight(panel.offsetHeight))
    observer.observe(panel)
    return () => observer.disconnect()
  }, [active])

  const ask = (stat: StatId, force = false) => {
    const key = `${stat}:${period}`
    if (asked.current.has(key) && !force) return
    asked.current.add(key)
    setBoards((now) => ({ ...now, [key]: undefined }))
    load(stat, period).then((board) => setBoards((now) => ({ ...now, [key]: board })))
  }

  useEffect(() => {
    for (const index of [active, active + 1, active - 1]) {
      const stat = STATS[index]
      if (stat) ask(stat)
    }
    // `ask` reads `period` and `load`, both among the dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, period, load])

  useEffect(() => {
    // Not `scrollIntoView`, which would also slide the drawer around it.
    const row = chips.current
    const chip = row?.children[active] as HTMLElement | undefined
    if (row && chip) row.scrollTo({ left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' })
  }, [active])

  const show = (index: number) => {
    const element = track.current
    if (element) element.scrollTo({ left: index * element.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className="leaderboards" data-no-swipe>
      <div className="layer-tabs leaderboards-periods" role="tablist">
        {PERIODS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={period === id}
            className={`layer-tab${period === id ? ' layer-tab--on' : ''}`}
            onClick={() => setPeriod(id)}
          >
            {t.leaderboards.periods[id]}
          </button>
        ))}
      </div>

      <div className="leaderboards-chips" ref={chips}>
        {STATS.map((stat, index) => {
          const look = LOOKS[stat]
          const on = index === active
          return (
            <button
              key={stat}
              type="button"
              className={`leaderboards-chip${on ? ' leaderboards-chip--on' : ''}`}
              style={on ? ({ background: `var(--${look.tint})`, color: `var(--${onTint(look.tint)})` } as CSSProperties) : undefined}
              aria-pressed={on}
              onClick={() => show(index)}
            >
              <span className="leaderboards-chip-art" style={{ color: on ? 'currentColor' : `var(--${look.tint})` }}>
                <Shape kind={look.kind} tint={on ? onTint(look.tint) : look.tint} />
              </span>
              {t.leaderboards.stats[stat].label}
            </button>
          )
        })}
      </div>

      {!named && <p className="note">{t.leaderboards.anonymous}</p>}

      <div
        className="board-track leaderboards-track"
        ref={track}
        style={{ height }}
        onScroll={(event) => {
          const element = event.currentTarget
          setActive(Math.min(STATS.length - 1, Math.max(0, Math.round(element.scrollLeft / element.clientWidth))))
        }}
      >
        {STATS.map((stat) => (
          <section className="board leaderboard" key={stat} aria-label={t.leaderboards.stats[stat].label}>
            <p className="note leaderboard-caption">{t.leaderboards.stats[stat].caption}</p>
            <BoardBody stat={stat} period={period} board={boards[`${stat}:${period}`]} named={named} onRetry={() => ask(stat, true)} />
          </section>
        ))}
      </div>

      {advanced && (
        <Suspense fallback={null}>
          <Insights lang={lang} period={period} load={loadInsights} onClose={onCloseAdvanced} />
        </Suspense>
      )}
    </div>
  )
}

function BoardBody({
  stat,
  period,
  board,
  named,
  onRetry,
}: {
  stat: StatId
  period: PeriodId
  board: Loaded
  named: boolean
  onRetry(): void
}) {
  const t = useT()
  if (board === undefined) return <p className="note board-empty">…</p>
  if (board === null)
    return (
      <div className="board-empty stack">
        <p className="note">{t.leaderboards.offline}</p>
        <button type="button" className="btn btn--quiet" onClick={onRetry}>
          {t.leaderboards.retry}
        </button>
      </div>
    )
  if (board.rows.length === 0) return <p className="note board-empty">{t.leaderboards.empty[period]}</p>

  const podium = board.rows.slice(0, 3)
  const rest = board.rows.slice(3)
  const me = myPlace(board)
  const unit = t.leaderboards.stats[stat].unit
  return (
    <>
      <ol className="podium leaderboard-podium">
        {podium.map((row, index) => (
          <li key={`${row.name}-${index}`} className={`podium-step podium-step--${index + 1}${row.mine ? ' leaderboard-step--me' : ''}`}>
            <Avatar choice={row.avatar} size="sm" />
            <span className="podium-rank">{row.place}</span>
            <span className={`podium-word${podiumNameClass(row.name)}`} title={row.name}>
              <Name row={row} />
            </span>
            <span className="note">
              {formatNumber(t, row.value)} {unit(row.value)}
            </span>
          </li>
        ))}
      </ol>

      {rest.length > 0 && (
        <div className="standings">
          {rest.map((row, index) => (
            <Line key={`${row.name}-${index}`} row={row} unit={unit} />
          ))}
        </div>
      )}

      {named && (
        <div className="leaderboard-me">
          {me ? (
            board.me ? (
              <Line row={board.me} unit={unit} />
            ) : (
              <p className="note">
                {t.leaderboards.you} · <strong>{t.boards.ordinal(me.place)}</strong>
              </p>
            )
          ) : (
            <p className="note">{t.leaderboards.absent}</p>
          )}
        </div>
      )}
    </>
  )
}

/**
 * The podium's three columns are narrow: the longest names step down one size or
 * two so they still read whole, and `.podium-word` ellipsises whatever is left.
 */
function podiumNameClass(name: string): string {
  if (name.length > 16) return ' podium-word--smaller'
  return name.length > 10 ? ' podium-word--small' : ''
}

function Name({ row }: { row: PlacedRow }) {
  return row.mine ? (
    <>{row.name}</>
  ) : (
    <PlayerName name={row.name} avatar={row.avatar}>
      {row.name}
    </PlayerName>
  )
}

function Line({ row, unit }: { row: PlacedRow; unit(count: number): string }) {
  const t = useT()
  return (
    <div className={`standing${row.mine ? ' standing--me' : ''}`}>
      <span className="rank">{row.place}</span>
      <Avatar choice={row.avatar} size="sm" />
      <span className="name">
        <Name row={row} />
      </span>
      <span className="points">
        {formatNumber(t, row.value)} <small>{unit(row.value)}</small>
      </span>
    </div>
  )
}
