import { useMemo, useState } from 'react'
import { summarize, type RunRecord } from '../domain/history'
import { capitalized } from '../domain/text'
import type { Profile } from '../domain/progression'
import { categoryText, formatNumber, useT, type Messages } from '../i18n'
import { Figure } from './bauhaus'
import { categoryMotif } from './motifs'
import { CategoryIcon } from './CategoryIcon'
import type { ChallengeSummary } from '../lib/cloud'
import { challengeStatus, challengeTitle, isHidden, unhideChallenge } from '../state/challenges'
import { useHiddenChallenges } from '../state/useHiddenChallenges'

/** Rows added each time the full history is asked for more. */
const PAGE = 50

function formatDate(t: Messages, at: number): string {
  return new Date(at).toLocaleString(t.tag, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

interface StatsPageProps {
  history: readonly RunRecord[]
  profile: Profile
  /** Null without an account: no challenge was ever hidden. */
  challenges: readonly ChallengeSummary[] | null
  onChallenge(id: string): void
}

export function StatsPage({ history, profile, challenges, onChallenge }: StatsPageProps) {
  const t = useT()
  return (
    <>
      {history.length === 0 ? <p className="note">{t.stats.empty}</p> : <RunStats history={history} profile={profile} />}
      {challenges && <HiddenChallenges challenges={challenges} onOpen={onChallenge} />}
    </>
  )
}

/** The challenges swiped away from the home screen, behind a toggle: one tap brings one back. */
function HiddenChallenges({ challenges, onOpen }: { challenges: readonly ChallengeSummary[]; onOpen(id: string): void }) {
  const t = useT()
  const hidden = useHiddenChallenges()
  const [open, setOpen] = useState(false)
  const list = challenges.filter((challenge) => isHidden(hidden, challenge))
  if (list.length === 0) return null
  return (
    <section className="stack">
      <button type="button" className="btn btn--ghost btn--block" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t.stats.hiddenChallenges(list.length)}
      </button>
      {open && (
        <ul className="run-list">
          {list.map((challenge) => (
            <li key={challenge.id}>
              <button type="button" className="btn btn--quiet menu-start" onClick={() => onOpen(challenge.id)}>
                {challengeTitle(t, challenge)}
              </button>
              <span className="note">
                {t.challenge.status[challengeStatus(challenge)]} · {formatDate(t, challenge.createdAt)}
              </span>
              <button type="button" className="btn btn--quiet btn--muted" onClick={() => unhideChallenge(hidden, challenge.id)}>
                {t.stats.unhide}
              </button>
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
  const older = history.slice(summary.recent.length)
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
        <RunList runs={summary.recent} />
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
