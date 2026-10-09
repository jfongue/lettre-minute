import { useEffect, useMemo, useRef, useState, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { listedHistory, mergeHistory, summarize, type RunRecord } from '../domain/history'
import type { HiddenAnswer, RevealBudget } from '../domain/perks'
import { capitalized, normalizeWord } from '../domain/text'
import type { Profile } from '../domain/progression'
import { categoryText, formatNumber, useT, type Messages } from '../i18n'
import { Figure, LetterMark } from './bauhaus'
import { HiddenAnswers } from './HiddenAnswers'
import { categoryMotif } from './motifs'
import { CategoryIcon } from './CategoryIcon'
import { fetchChallenge, type BanOutcome, type ChallengeSummary } from '../lib/cloud'
import { challengeTitle, isHidden, loadWinners, rememberWinner, winnerOf, type ChallengeWinner } from '../state/challenges'
import { useHiddenChallenges } from '../state/useHiddenChallenges'
import { useBackDismiss } from './useBackDismiss'
import { useLongPress } from './useLongPress'

/** Rows added each time the history is asked for more, from the device or the account. */
const PAGE = 30

/** A word a moderator can flag: one the run said, or one its prompts still had. */
export interface FlagWord {
  categoryId: string
  /** The dictionary's own key (`WordEntry.key`), which is what a ban targets. */
  word: string
  display: string
}

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
  /** The run's summary open from the start, which the debug board shows directly. */
  openRun?: RunRecord
  onChallenge(id: string): void
  /** Relit les parties du compte : la page la redemande à chaque ouverture. */
  onRefresh?(): Promise<unknown>
  /** Absent without a server, which keeps no leaderboard. */
  onBoards?(): void
  /** The account's runs older than `before`, one page at a time; absent without a server. */
  loadOlder?(before: number, limit: number): Promise<RunRecord[] | null>
  /** What a past run's summary needs to show the words it could have taken. */
  recap: RecapActions
}

export interface RecapActions {
  /** The words the run's skipped prompts still had, read from its dictionaries. */
  hiddenFor(run: RunRecord): Promise<readonly HiddenAnswer[]>
  budget: RevealBudget
  onPeek(): void
  onAd(): void
  /**
   * Signals one of the run's words — said, or still hidden — to the other
   * moderators, with the reason the card asks for; absent for a player who is
   * not one, which is what keeps the recap from offering it.
   */
  onFlag?(run: RunRecord, word: FlagWord, reason: string): Promise<BanOutcome>
}

export function StatsPage({
  history,
  profile,
  challenges,
  focusChallenges = false,
  openRun,
  onChallenge,
  onRefresh,
  onBoards,
  loadOlder,
  recap,
}: StatsPageProps) {
  const t = useT()
  const [opened, setOpened] = useState<RunRecord | null>(openRun ?? null)
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

  if (opened) return <RunRecap run={opened} actions={recap} onBack={() => setOpened(null)} />
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
        <RunStats history={history} profile={profile} loadOlder={loadOlder} onOpen={setOpened} />
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

function RunStats({
  history,
  profile,
  loadOlder,
  onOpen,
}: {
  history: readonly RunRecord[]
  profile: Profile
  loadOlder?: StatsPageProps['loadOlder']
  onOpen(run: RunRecord): void
}) {
  const t = useT()
  const summary = useMemo(() => summarize(history), [history])
  const [shown, setShown] = useState(0)
  const [fetched, setFetched] = useState<readonly RunRecord[]>([])
  const [exhausted, setExhausted] = useState(!loadOlder)
  const [loading, setLoading] = useState(false)
  // The account's page is asked from the last one it gave, not from the
  // device's oldest: a page made only of runs the device already had would
  // otherwise be asked for again and again.
  const cursor = useRef<number | null>(null)

  const all = useMemo(() => (fetched.length > 0 ? mergeHistory(history, fetched) : [...history]), [history, fetched])
  const trend = summary.trend === null ? null : Math.round(summary.trend)
  const listed = listedHistory(all)
  const older = all.slice(listed.length)
  // The profile's record may predate the history, and a merged account's may come from elsewhere.
  const best = Math.max(profile.bestScore, ...history.map((run) => run.score))

  const more = () => {
    const next = shown + PAGE
    setShown(next)
    if (older.length >= next || exhausted || loading || !loadOlder) return
    const before = Math.min(cursor.current ?? Infinity, all[all.length - 1]?.at ?? Date.now())
    setLoading(true)
    loadOlder(before, PAGE)
      .then((page) => {
        if (!page) return
        if (page.length < PAGE) setExhausted(true)
        const last = page[page.length - 1]
        if (last) cursor.current = last.at
        setFetched((current) => [...current, ...page])
      })
      .finally(() => setLoading(false))
  }

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
        <RunList runs={listed} onOpen={onOpen} />
        {shown > 0 && <RunList runs={older.slice(0, shown)} onOpen={onOpen} />}
        {loading && <p className="note">{t.loading}</p>}
        {(shown < older.length || !exhausted || shown > 0) && (
          <div className="stats-more">
            {(shown < older.length || !exhausted) && !loading && (
              <button type="button" className="btn btn--quiet menu-start" onClick={more}>
                {t.stats.more}
              </button>
            )}
            {shown > 0 && (
              <button type="button" className="btn btn--quiet btn--muted menu-start" onClick={() => setShown(0)}>
                {t.stats.hideHistory}
              </button>
            )}
          </div>
        )}
      </section>

      {summary.topWords.length > 0 && (
        <section className="stack">
          <p className="section-title">{t.stats.topWords}</p>
          <ol className="top-words">
            {summary.topWords.map((word, index) => (
              <li key={`${word.word}-${index}`}>
                <span className="top-words-rank">{index + 1}</span>
                <span className="top-words-word">{capitalized(word.display)}</span>
                <span className="note">{t.stats.times(word.count)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {summary.categories.length > 0 && (
        <section className="stack">
          <p className="section-title">{t.stats.byCategory}</p>
          <ul className="category-stats">
            {summary.categories.map((stats) => {
              const motif = categoryMotif(stats.categoryId)
              const decimal = (value: number) => value.toLocaleString(t.tag, { maximumFractionDigits: 1 })
              const perWord = stats.words > 0 ? stats.points / stats.words : 0
              return (
                <li key={stats.categoryId}>
                  <span className="category-stats-head">
                    <CategoryIcon categoryId={stats.categoryId} tint={motif.tint} className="category-shape" />
                    <span className="category-stats-name">
                      <span className="category-label">{categoryText(t, stats.categoryId).label}</span>
                      <span className="note">{t.stats.categoryLine(stats.runs, stats.words)}</span>
                    </span>
                    <strong className="category-stats-points">
                      {formatNumber(t, stats.points)} <small>{t.stats.points}</small>
                    </strong>
                  </span>
                  <span className="category-stats-chips">
                    <span className="category-stats-chip">{t.stats.perWord(decimal(perWord))}</span>
                    {stats.averageSeconds !== null && (
                      <span className="category-stats-chip">{t.stats.secondsPerWord(decimal(stats.averageSeconds))}</span>
                    )}
                    {stats.passRate !== null && (
                      <span className="category-stats-chip">{t.stats.passRate(formatNumber(t, Math.round(stats.passRate * 100)))}</span>
                    )}
                  </span>
                  {stats.bestWord && (
                    <span className="note">{t.stats.bestWord(capitalized(stats.bestWord.display), stats.bestWord.points)}</span>
                  )}
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

function RunList({ runs, onOpen }: { runs: readonly RunRecord[]; onOpen(run: RunRecord): void }) {
  const t = useT()
  return (
    <ul className="run-list">
      {runs.map((run) => (
        <li key={`${run.at}-${run.score}`} className="run-list-item">
          <button type="button" className="run-list-open" onClick={() => onOpen(run)}>
            <span className="run-list-when note">{formatDate(t, run.at)}</span>
            <span className="note">{t.stats.runLine(run.words.length, run.bestCombo)}</span>
            <strong className="run-list-score">
              {formatNumber(t, run.score)} <small>{t.stats.points}</small>
            </strong>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** A past run's summary: the words it found, then those its skipped prompts still had. */
function RunRecap({ run, actions, onBack }: { run: RunRecord; actions: RecapActions; onBack(): void }) {
  const t = useT()
  // Runs recorded before their prompts were kept have nothing to hide.
  const [hidden, setHidden] = useState<readonly HiddenAnswer[] | null>(run.prompts ? null : [])
  const hiddenFor = useRef(actions.hiddenFor)
  const [flagged, setFlagged] = useState<FlagWord | null>(null)
  const onFlag = actions.onFlag

  useEffect(() => {
    if (!run.prompts) return
    let live = true
    hiddenFor.current(run)
      .then((answers) => live && setHidden(answers))
      .catch(() => live && setHidden([]))
    return () => {
      live = false
    }
  }, [run])

  // A word only leaves the game at the next dictionary build: the flag opens a
  // card rather than acting on the tap that ends it.
  const press = useLongPress<FlagWord>((word) => setFlagged(word))

  return (
    <div className="stack run-recap">
      <button type="button" className="btn btn--quiet menu-start run-recap-back" onClick={onBack}>
        ← {t.menu.back}
      </button>
      <header className="run-recap-head">
        <span className="note">{formatDate(t, run.at)}</span>
        <strong className="run-recap-score">
          {formatNumber(t, run.score)} <small>{t.stats.points}</small>
        </strong>
        <span className="note">{t.stats.runLine(run.words.length, run.bestCombo)}</span>
      </header>
      {onFlag && <p className="note">{t.moderation.flag.hint}</p>}
      {run.words.length > 0 && (
        <section className="stack">
          <p className="section-title">{t.stats.recapWords}</p>
          <ol className="reveal-words">
            {run.words.map((word, index) => (
              <li key={`${word.word}-${index}`} className="reveal-word" {...(onFlag ? press(word) : {})}>
                <LetterMark letter={normalizeWord(word.display).charAt(0).toUpperCase()} motif={categoryMotif(word.categoryId)} size="sm" />
                <span className="reveal-word-text">
                  {capitalized(word.display)}
                  <span className="reveal-word-category">{categoryText(t, word.categoryId).label}</span>
                </span>
                <span className="reveal-word-points">+{formatNumber(t, word.points)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {hidden === null ? (
        <p className="note">{t.loading}</p>
      ) : (
        hidden.length > 0 && (
          <HiddenAnswers
            hidden={hidden}
            budget={actions.budget}
            onPeek={actions.onPeek}
            onAd={actions.onAd}
            onFlag={onFlag && ((answer) => setFlagged(answer))}
          />
        )
      )}
      {flagged && onFlag && (
        <FlagWordCard
          word={flagged}
          category={categoryText(t, flagged.categoryId).label}
          onFlag={(reason) => onFlag(run, flagged, reason)}
          onClose={() => setFlagged(null)}
        />
      )}
    </div>
  )
}

/**
 * A word of the recap flagged for removal: the moderator confirms and says why,
 * and the others judge it in « Mes demandes » — as many votes as an addition,
 * with his reason on the card. Exported so the debug board can show it alone.
 */
export function FlagWordCard({
  word,
  category,
  onFlag,
  onClose,
}: {
  word: FlagWord
  category: string
  onFlag(reason: string): Promise<BanOutcome>
  onClose(): void
}) {
  const t = useT()
  const [step, setStep] = useState<'ask' | 'busy' | BanOutcome>('ask')
  const [reason, setReason] = useState('')
  useBackDismiss(onClose)

  const confirm = async () => {
    setStep('busy')
    setStep(await onFlag(reason))
  }

  return createPortal(
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="flag-word-title">
      <div className="offer-pop-scrim" onClick={onClose} />
      <div className="offer-pop">
        <h2 id="flag-word-title" className="offer-pop-title">
          {t.moderation.flag.title}
        </h2>
        {step === 'ask' || step === 'busy' ? (
          <>
            <p>{t.moderation.flag.lead(capitalized(word.display), category)}</p>
            <label className="flag-reason" htmlFor="flag-reason">
              <span className="note">{t.moderation.flag.reasonLabel}</span>
              <textarea
                id="flag-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t.moderation.flag.reasonPlaceholder}
                maxLength={140}
                rows={2}
              />
            </label>
            <div className="offer-pop-actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                {t.cancel}
              </button>
              <button type="button" className="btn btn--red" onClick={confirm} disabled={step === 'busy'}>
                {t.moderation.flag.confirm}
              </button>
            </div>
          </>
        ) : (
          <>
            <p>{t.moderation.flag.said[step]}</p>
            <button type="button" className="btn btn--ghost btn--block" onClick={onClose}>
              {t.moderation.flag.close}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
