import { useEffect, useMemo, useRef, useState, type Ref } from 'react'
import { listedHistory, summarize, type RunRecord } from '../domain/history'
import { capitalized } from '../domain/text'
import type { Profile } from '../domain/progression'
import { categoryText, formatNumber, useT, type Messages } from '../i18n'
import { Figure } from './bauhaus'
import { categoryMotif } from './motifs'
import { CategoryIcon } from './CategoryIcon'
import { fetchChallenge, type ChallengeSummary } from '../lib/cloud'
import { challengeTitle, isHidden, loadWinners, rememberWinner, winnerOf, type ChallengeWinner } from '../state/challenges'
import { useHiddenChallenges } from '../state/useHiddenChallenges'

/** Rows added each time the full history is asked for more. */
const PAGE = 50

function formatDate(t: Messages, at: number): string {
  return new Date(at).toLocaleString(t.tag, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

interface StatsPageProps {
  history: readonly RunRecord[]
  profile: Profile
  /** Null without an account: no challenge was ever set aside. */
  challenges: readonly ChallengeSummary[] | null
  /** Opened from the home screen's challenges: the old ones show, unfolded. */
  focusChallenges?: boolean
  onChallenge(id: string): void
  /** Relit les parties du compte : la page la redemande à chaque ouverture. */
  onRefresh?(): Promise<unknown>
  /** Absent without a server, which keeps no leaderboard. */
  onBoards?(): void
}

export function StatsPage({ history, profile, challenges, focusChallenges = false, onChallenge, onRefresh, onBoards }: StatsPageProps) {
  const t = useT()
  // Une lecture en cours ne dit pas « tu n'as rien joué » : elle attend son
  // tour. Sans rappel, la page n'a que ce que l'appareil a gardé.
  const [reading, setReading] = useState(Boolean(onRefresh) && history.length === 0)

  useEffect(() => {
    if (!onRefresh) return
    let live = true
    onRefresh().finally(() => {
      if (live) setReading(false)
    })
    return () => {
      live = false
    }
  }, [onRefresh])

  return (
    <>
      {onBoards && (
        <button type="button" className="btn btn--blue btn--block" onClick={onBoards}>
          {t.boards.all}
        </button>
      )}
      {history.length === 0 ? (
        <p className="note">{reading ? t.loading : t.stats.empty}</p>
      ) : (
        <RunStats history={history} profile={profile} />
      )}
      {challenges && <OldChallenges challenges={challenges} focus={focusChallenges} onOpen={onChallenge} />}
    </>
  )
}

/**
 * The challenges set aside — read, or swiped off the home screen — and who
 * took each. `focus` opens the list and brings it into view: the home
 * screen's challenge title leads here.
 */
function OldChallenges({
  challenges,
  focus,
  onOpen,
}: {
  challenges: readonly ChallengeSummary[]
  focus: boolean
  onOpen(id: string): void
}) {
  const hidden = useHiddenChallenges()
  const [open, setOpen] = useState(focus)
  const [winners, setWinners] = useState(loadWinners)
  const section = useRef<HTMLElement>(null)
  const list = challenges.filter((challenge) => isHidden(hidden, challenge))

  useEffect(() => {
    if (focus) section.current?.scrollIntoView({ block: 'start' })
  }, [focus])

  // Swiped away unread, or read before the device kept winners: asked one at a time.
  const missing = open ? list.filter((challenge) => challenge.finished && !(challenge.id in winners)).map((challenge) => challenge.id) : []
  const wanted = missing.join(',')
  useEffect(() => {
    if (!wanted) return
    let live = true
    ;(async () => {
      for (const id of wanted.split(',')) {
        const detail = await fetchChallenge(id)
        if (!live) return
        if (!detail) continue
        rememberWinner(id, winnerOf(detail))
        setWinners(loadWinners())
      }
    })()
    return () => {
      live = false
    }
  }, [wanted])

  if (list.length === 0) return null
  return (
    <OldChallengeList
      ref={section}
      rows={list.map((challenge) => ({ challenge, winner: winners[challenge.id] }))}
      open={open}
      onToggle={() => setOpen(!open)}
      onOpen={onOpen}
    />
  )
}

export interface OldChallengeRow {
  challenge: ChallengeSummary
  /** Undefined while it is being asked for, null when nobody played. */
  winner: ChallengeWinner | null | undefined
}

/** The list once read: the debug board shows it without a server. */
export function OldChallengeList({
  ref,
  rows,
  open,
  onToggle,
  onOpen,
}: {
  ref?: Ref<HTMLElement>
  rows: readonly OldChallengeRow[]
  open: boolean
  onToggle(): void
  onOpen(id: string): void
}) {
  const t = useT()
  return (
    <section className="stack" ref={ref}>
      <button type="button" className="btn btn--ghost btn--block" aria-expanded={open} onClick={onToggle}>
        {t.stats.oldChallenges(rows.length)}
      </button>
      {open && (
        <ul className="run-list old-challenges">
          {rows.map(({ challenge, winner }) => (
            <li key={challenge.id}>
              <span className="old-challenge-id">
                <button type="button" className="btn btn--quiet menu-start" onClick={() => onOpen(challenge.id)}>
                  {challengeTitle(t, challenge)}
                </button>
                <span className="note">{formatDate(t, challenge.createdAt)}</span>
              </span>
              <strong className={`old-challenge-winner${winner?.me ? ' old-challenge-winner--me' : ''}`}>
                {winner === undefined
                  ? '…'
                  : winner === null
                    ? t.stats.noWinner
                    : `${winner.me ? t.stats.youWon : t.stats.wonBy(winner.name)} · ${formatNumber(t, winner.score)} ${t.stats.points}`}
              </strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RunStats({ history, profile }: { history: readonly RunRecord[]; profile: Profile }) {
  const t = useT()
  const summary = useMemo(() => summarize(history), [history])
  const [shown, setShown] = useState(0)

  const trend = summary.trend === null ? null : Math.round(summary.trend)
  const listed = listedHistory(history)
  const older = history.slice(listed.length)
  // The profile's record may predate the history, and a merged account's may come from elsewhere.
  const best = Math.max(profile.bestScore, ...history.map((run) => run.score))

  return (
    <>
      <div className="figures stats-figures">
        <Figure tint="yellow" value={formatNumber(t, Math.round(summary.recentAverage))} label={t.stats.average} />
        <Figure tint="blue" value={formatNumber(t, best)} label={t.stats.best} />
        {trend !== null && (
          <Figure tint={trend >= 0 ? 'green' : 'red'} value={`${trend >= 0 ? '+' : '−'}${formatNumber(t, Math.abs(trend))}`} label={t.stats.trend} />
        )}
      </div>

      <section className="stack">
        <p className="section-title">{t.stats.recent}</p>
        <RunList runs={listed} />
        {older.length > 0 && (
          <>
            {shown > 0 && <RunList runs={older.slice(0, shown)} />}
            <div className="stats-more">
              {shown < older.length && (
                <button type="button" className="btn btn--quiet menu-start" onClick={() => setShown(shown + PAGE)}>
                  {shown === 0 ? t.stats.history(history.length) : t.stats.more}
                </button>
              )}
              {shown > 0 && (
                <button type="button" className="btn btn--quiet btn--muted menu-start" onClick={() => setShown(0)}>
                  {t.stats.hideHistory}
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {summary.topWords.length > 0 && (
        <section className="stack">
          <p className="section-title">{t.stats.topWords}</p>
          <ol className="podium">
            {summary.topWords.map((word, index) => (
              <li key={`${word.word}-${index}`} className={`podium-step podium-step--${index + 1}`}>
                <span className="podium-rank">{index + 1}</span>
                <span className="podium-word">{capitalized(word.display)}</span>
                <span className="note">{t.stats.times(word.count)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {summary.categories.length > 0 && (
        <section className="stack">
          <p className="section-title">{t.stats.byCategory}</p>
          <ul className="categories category-stats">
            {summary.categories.map((stats) => {
              const motif = categoryMotif(stats.categoryId)
              const perWord = stats.words > 0 ? stats.points / stats.words : 0
              return (
                <li key={stats.categoryId}>
                  <CategoryIcon categoryId={stats.categoryId} tint={motif.tint} className="category-shape" />
                  <span className="category-stats-body">
                    <span className="category-label">{categoryText(t, stats.categoryId).label}</span>
                    <span className="note">{t.stats.categoryLine(stats.runs, stats.words)}</span>
                    {stats.bestWord && (
                      <span className="note">{t.stats.bestWord(capitalized(stats.bestWord.display), stats.bestWord.points)}</span>
                    )}
                    {stats.averageSeconds !== null && (
                      <span className="note">
                        {t.stats.timePerWord(stats.averageSeconds.toLocaleString(t.tag, { maximumFractionDigits: 1 }))}
                      </span>
                    )}
                  </span>
                  <span className="category-stats-figure">
                    <strong>{formatNumber(t, stats.points)}</strong>
                    <span className="note">{t.stats.perWord(perWord.toLocaleString(t.tag, { maximumFractionDigits: 1 }))}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {profile.runs > history.length && <p className="note">{t.stats.partial}</p>}
    </>
  )
}

function RunList({ runs }: { runs: readonly RunRecord[] }) {
  const t = useT()
  return (
    <ul className="run-list">
      {runs.map((run) => (
        <li key={`${run.at}-${run.score}`}>
          <span className="run-list-when note">{formatDate(t, run.at)}</span>
          <span className="note">{t.stats.runLine(run.words.length, run.bestCombo)}</span>
          <strong className="run-list-score">
            {formatNumber(t, run.score)} <small>{t.stats.points}</small>
          </strong>
        </li>
      ))}
    </ul>
  )
}
