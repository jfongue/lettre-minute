import { Suspense, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { completeLeaderboard, myPlace, OPEN_STATS, PERIODS, STATS, type Leaderboard, type PeriodId, type PlacedRow, type StatId } from '../domain/leaderboards'
import { metricOf, weekNumber, weekOf, weeklyMode, type WeeklyMetric } from '../domain/weekly'
import { formatNumber, useT } from '../i18n'
import { fetchLeaderboard, fetchWeeklyBoard, fetchWeeklyWinners, type WeeklyBoardRow, type WeeklyWinnerRow } from '../lib/cloud'
import type { LoadDashboard } from '../debug/Dashboard'
import { lazyScreen } from './lazyScreen'
import { Avatar } from './Avatar'
import { BoardSwitch, type BoardFamily } from './BoardSwitch'
import { Shape } from './bauhaus'
import { onTint, type ShapeKind, type Tint } from './motifs'
import { PlayerName } from './PlayerSheet'

// A developer's tool behind five taps: no player should download it.
const Dashboard = lazyScreen(() => import('../debug/Dashboard').then((module) => module.Dashboard))

const LOOKS: Record<StatId, { kind: ShapeKind; tint: Tint }> = {
  best: { kind: 'star', tint: 'yellow' },
  points: { kind: 'circle', tint: 'red' },
  runs: { kind: 'bars', tint: 'blue' },
  words: { kind: 'steps', tint: 'green' },
  discoveries: { kind: 'sun', tint: 'pink' },
  combo: { kind: 'zigzag', tint: 'red' },
  added: { kind: 'cross', tint: 'blue' },
  moderation: { kind: 'lens', tint: 'green' },
}

/** Undefined while it is asked for, null when the server did not answer. */
type Loaded = Leaderboard | null | undefined

/** Les deux familles de la page : les mesures des parties, puis le défi du moment. */
type FamilyId = BoardFamily
/** Le défi se lit par volet, pas par période : la semaine en cours, ou le total. */
const WEEK_PANES = ['current', 'total'] as const
type WeekPane = (typeof WEEK_PANES)[number]

export type LoadLeaderboard = (stat: StatId, period: PeriodId) => Promise<Leaderboard | null>

async function loadFromServer(stat: StatId, period: PeriodId): Promise<Leaderboard | null> {
  const board = await fetchLeaderboard(stat, period)
  return board && completeLeaderboard(stat, period, board)
}

interface LeaderboardsPageProps {
  /** An anonymous player reads the boards but stands on none of them. */
  named: boolean
  /**
   * A guest of a host without anonymous accounts (CrazyGames): their own line,
   * « Moi », counted on the device, and the host's sign-in rather than an account to create.
   */
  guest?: boolean
  /** The host's own sign-in prompt, offered to a guest. */
  onSignIn?(): void
  /** Le joueur juge des mots : il voit en plus le classement des sessions de modération. */
  moderator?: boolean
  /** Le tiroir tient la famille : son commutateur est sur la ligne du titre. */
  family?: FamilyId
  onFamily?(next: FamilyId): void
  /** The debug board passes its own made-up boards. */
  load?: LoadLeaderboard
  /** Cinq tapes sur « Classements » : le tableau de bord, par-dessus la page. */
  advanced?: boolean
  /** La planche nourrit le tableau de bord de ses propres chiffres. */
  loadDashboard?: LoadDashboard
  /** Ferme le tableau de bord. */
  onCloseAdvanced?(): void
}

/**
 * Seven measures, one page each on a snapping horizontal track as on the
 * home screen: the swipe is the browser's own. Each board is asked for when
 * it is reached, with its neighbours, and kept for the page's life.
 */
export function LeaderboardsPage({
  named,
  guest = false,
  onSignIn,
  moderator = false,
  family: familyProp,
  onFamily,
  load = loadFromServer,
  advanced = false,
  loadDashboard,
  onCloseAdvanced,
}: LeaderboardsPageProps) {
  const t = useT()
  // Les sessions de modération ne se montrent qu'à qui juge : la piste en porte
  // une de moins pour tout le monde.
  const stats: readonly StatId[] = moderator ? STATS : OPEN_STATS
  // Le défi se range par langue et par semaine : l'interface donne les deux.
  const lang = t.tag.split('-')[0]!
  const weekId = weekOf(Date.now()).weekId
  const weekMetric = metricOf(weeklyMode(weekId))
  const [period, setPeriod] = useState<PeriodId>('day')
  const [active, setActive] = useState(0)
  const [ownFamily, setOwnFamily] = useState<FamilyId>('runs')
  // Le commutateur vit sur la ligne du titre, dans le tiroir : la page suit ce
  // qu'on lui donne, et décide seule ailleurs (planche debug).
  const family = familyProp ?? ownFamily
  const setFamily = onFamily ?? setOwnFamily
  const [pane, setPane] = useState<WeekPane>('current')
  const [boards, setBoards] = useState<Record<string, Loaded>>({})
  const [week, setWeek] = useState<WeeklyBoardRow[] | null | undefined>(undefined)
  const [winners, setWinners] = useState<WeeklyWinnerRow[] | null | undefined>(undefined)
  const track = useRef<HTMLDivElement>(null)
  const chips = useRef<HTMLDivElement>(null)
  const asked = useRef(new Set<string>())
  const askedWeek = useRef(new Set<WeekPane>())
  // The track is as tall as the board in view: a board of fifty would
  // otherwise leave a short one floating over a long blank.
  const [height, setHeight] = useState<number | undefined>(undefined)
  useLayoutEffect(() => {
    const panel = track.current?.children[active] as HTMLElement | undefined
    if (!panel) return
    const observer = new ResizeObserver(() => setHeight(panel.offsetHeight))
    observer.observe(panel)
    return () => observer.disconnect()
    // La piste des parties est remontée au retour du défi : on la remesure.
  }, [active, family])

  const ask = (stat: StatId, force = false) => {
    const key = `${stat}:${period}`
    if (asked.current.has(key) && !force) return
    asked.current.add(key)
    setBoards((now) => ({ ...now, [key]: undefined }))
    load(stat, period).then((board) => setBoards((now) => ({ ...now, [key]: board })))
  }

  // Le défi se lit par volets et se garde pour la vie de la page, comme les autres.
  const askWeek = (view: WeekPane, force = false) => {
    if (askedWeek.current.has(view) && !force) return
    askedWeek.current.add(view)
    if (view === 'current') {
      setWeek(undefined)
      fetchWeeklyBoard(weekId, lang).then(setWeek)
    } else {
      setWinners(undefined)
      fetchWeeklyWinners(lang).then(setWinners)
    }
  }

  // Kept for the page's life, but not across a sign-in made from the page
  // itself: the guest's boards would stay, their « Moi » line with them,
  // until the player left the page. Declared before the effects that ask.
  useEffect(() => {
    asked.current.clear()
    askedWeek.current.clear()
  }, [named, guest])

  useEffect(() => {
    if (family === 'weekly') askWeek(pane)
    // `askWeek` lit la langue et la semaine, toutes deux dans les dépendances.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family, pane, lang, weekId, named, guest])

  useEffect(() => {
    for (const index of [active, active + 1, active - 1]) {
      const stat = stats[index]
      if (stat) ask(stat)
    }
    // `ask` reads `period` and `load`, both among the dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, period, load, moderator, named, guest])

  useEffect(() => {
    // Not `scrollIntoView`, which would also slide the drawer around it.
    const row = chips.current
    const chip = row?.children[active] as HTMLElement | undefined
    if (row && chip) row.scrollTo({ left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' })
  }, [active, family])

  const show = (index: number) => {
    const element = track.current
    if (element) element.scrollTo({ left: index * element.clientWidth, behavior: 'smooth' })
  }

  // La piste des parties est recréée au retour du défi : elle se remet sur la
  // mesure en vue, sans glisser, sinon elle rouvrirait sur la première.
  useEffect(() => {
    const element = track.current
    if (element) element.scrollLeft = active * element.clientWidth
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family])

  return (
    <div className="leaderboards" data-no-swipe>
      {!familyProp && <BoardSwitch family={family} onFamily={setFamily} />}
      {guest ? (
        <div className="leaderboards-guest">
          <p className="note">{t.leaderboards.guest}</p>
          {onSignIn && (
            <button type="button" className="btn btn--quiet" data-track="host-sign-in" onClick={onSignIn}>
              {t.leaderboards.signIn}
            </button>
          )}
        </div>
      ) : (
        !named && <p className="note">{t.leaderboards.anonymous}</p>
      )}

      {family === 'runs' ? (
        <div className="board-swap" key="runs">
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
            {stats.map((stat, index) => {
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

          <div
            className="board-track leaderboards-track"
            ref={track}
            style={{ height }}
            onScroll={(event) => {
              const element = event.currentTarget
              setActive(Math.min(stats.length - 1, Math.max(0, Math.round(element.scrollLeft / element.clientWidth))))
            }}
          >
            {stats.map((stat) => (
              <section className="board leaderboard" key={stat} aria-label={t.leaderboards.stats[stat].label}>
                <p className="note leaderboard-caption">{t.leaderboards.stats[stat].caption}</p>
                <BoardBody stat={stat} period={period} board={boards[`${stat}:${period}`]} named={named || guest} onRetry={() => ask(stat, true)} />
              </section>
            ))}
          </div>
        </div>
      ) : (
        <div className="board-swap" key="weekly">
          <div className="layer-tabs leaderboards-periods" role="tablist">
            {WEEK_PANES.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={pane === id}
                className={`layer-tab${pane === id ? ' layer-tab--on' : ''}`}
                onClick={() => setPane(id)}
              >
                {id === 'current' ? t.leaderboards.weekly.current : t.leaderboards.weekly.total}
              </button>
            ))}
          </div>

          <section
            className="board leaderboard"
            aria-label={pane === 'current' ? t.leaderboards.weekly.current : t.leaderboards.weekly.total}
          >
            <p className="note leaderboard-caption">
              {pane === 'current' ? t.leaderboards.weekly.currentCaption : t.leaderboards.weekly.totalCaption}
            </p>
            {pane === 'current' ? (
              <WeeklyBoardBody board={week} metric={weekMetric} onRetry={() => askWeek('current', true)} />
            ) : (
              <WinnersBody rows={winners} onRetry={() => askWeek('total', true)} />
            )}
          </section>
        </div>
      )}

      {advanced && (
        <Suspense fallback={null}>
          <Dashboard load={loadDashboard} onClose={onCloseAdvanced ?? (() => {})} />
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
  /** The player has a line of their own on the board, or is told they have none yet. */
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
 * Le défi de la semaine en cours : le classement que `weekly_board` rend, avec
 * la carte du podium et la ligne du joueur, comme les autres tableaux. Sa
 * métrique est celle de la semaine : des points, ou des secondes tenues.
 */
function WeeklyBoardBody({
  board,
  metric,
  onRetry,
}: {
  board: WeeklyBoardRow[] | null | undefined
  metric: WeeklyMetric
  onRetry(): void
}) {
  const t = useT()
  if (board === undefined) return <p className="note board-empty">…</p>
  if (board === null)
    return (
      <div className="board-empty stack">
        <p className="note">{t.leaderboards.weekly.offline}</p>
        <button type="button" className="btn btn--quiet" onClick={onRetry}>
          {t.leaderboards.retry}
        </button>
      </div>
    )
  if (board.length === 0) return <p className="note board-empty">{t.leaderboards.empty.week}</p>

  const unit = metric === 'survival' ? t.leaderboards.weekly.survival : t.leaderboards.weekly.score
  const rows: PlacedRow[] = board.map((row) => ({ place: row.rank, name: row.name, avatar: row.avatar, value: row.value, mine: row.me }))
  const podium = rows.slice(0, 3)
  const rest = rows.slice(3)
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
              {formatNumber(t, row.value)} {unit}
            </span>
          </li>
        ))}
      </ol>

      {rest.length > 0 && (
        <div className="standings">
          {rest.map((row, index) => (
            <Line key={`${row.name}-${index}`} row={row} unit={() => unit} />
          ))}
        </div>
      )}
    </>
  )
}

/**
 * Le défi passé : le gagnant de chaque semaine close, la plus récente d'abord.
 * La colonne de gauche est le numéro de la semaine, celle de droite sa valeur
 * et son unité — les points et les secondes ne se rangent pas ensemble.
 */
function WinnersBody({ rows, onRetry }: { rows: WeeklyWinnerRow[] | null | undefined; onRetry(): void }) {
  const t = useT()
  if (rows === undefined) return <p className="note board-empty">…</p>
  if (rows === null)
    return (
      <div className="board-empty stack">
        <p className="note">{t.leaderboards.weekly.offline}</p>
        <button type="button" className="btn btn--quiet" onClick={onRetry}>
          {t.leaderboards.retry}
        </button>
      </div>
    )
  if (rows.length === 0) return <p className="note board-empty">{t.leaderboards.weekly.empty}</p>

  return (
    <div className="standings">
      {rows.map((row) => {
        // Le premier défi joué est la semaine n° 1 : l'époque compte pour zéro.
        const week = weekNumber(row.weekId) + 1
        const unit = row.metric === 'survival' ? t.leaderboards.weekly.survival : t.leaderboards.weekly.score
        return (
          <div className="standing" key={row.weekId}>
            <span className="rank" title={t.leaderboards.weekly.week(week)}>
              {week}
            </span>
            <Avatar choice={row.avatar} size="sm" />
            <span className="name">
              <PlayerName name={row.name} avatar={row.avatar}>
                {row.name}
              </PlayerName>
            </span>
            <span className="points">
              {formatNumber(t, row.value)} <small>{unit}</small>
            </span>
          </div>
        )
      })}
    </div>
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
