import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { GameMode } from '../domain/modes'
import { awardWeeklyTrophies, metricOf, type WeeklyMeasures } from '../domain/weekly'
import { useT } from '../i18n'
import {
  REACTIONS,
  fetchWeeklyBoard,
  fetchWeeklyMeasures,
  fetchWeeklyReactionCounts,
  reactInWeekly,
  type ReactionEmoji,
  type WeeklyBoardRow,
  type WeeklyReactionCount,
} from '../lib/cloud'
import { sound } from '../lib/sound'
import { capitalized } from '../domain/text'
import { Avatar } from './Avatar'
import { Burst } from './bauhaus'
import { PlayerName } from './PlayerSheet'
import { onTint } from './motifs'
import { MODE_TINTS, ModeGlyph, timeLeft, useNow, valueText } from './WeeklyParts'
import { WEEKLY_TROPHY_TINTS, WeeklyTrophyIcon } from './WeeklyTrophyIcon'
import { useFeature } from './features'

const PAGE = 15

export interface WeeklyResultsViewProps {
  mode: GameMode
  closed: boolean
  closesAt: number
  now?: number
  /** Null : le serveur n'a pas répondu. */
  rows: readonly WeeklyBoardRow[] | null | 'loading'
  /** Combien de joueurs ont joué, quand le classement n'en montre qu'une partie. */
  total?: number
  measures: readonly WeeklyMeasures[]
  counts: readonly WeeklyReactionCount[]
  canReact: boolean
  onReact(target: string, emoji: ReactionEmoji | null): void
  onRetry(): void
  onBack(): void
  onPlay?(): void
}

/** Les résultats du défi, provisoires pendant la semaine et définitifs une fois close. */
export function WeeklyResultsView({
  mode,
  closed,
  closesAt,
  now,
  rows,
  total,
  measures,
  counts,
  canReact,
  onReact,
  onRetry,
  onBack,
  onPlay,
}: WeeklyResultsViewProps) {
  const t = useT()
  const clock = useNow(now)
  const metric = metricOf(mode)
  const [shown, setShown] = useState(PAGE)
  const tint = MODE_TINTS[mode]
  const list = useMemo<readonly WeeklyBoardRow[]>(() => (Array.isArray(rows) ? (rows as readonly WeeklyBoardRow[]) : []), [rows])
  const byId = useMemo(() => new Map(list.map((row) => [row.playerId, row])), [list])
  const awards = useMemo(() => awardWeeklyTrophies(measures), [measures])
  const podium = list.slice(0, 3)
  const me = list.find((row) => row.me)
  const rest = list.slice(3)
  const players = Math.max(total ?? 0, list.length)
  const unit = metric === 'survival' ? t.weekly.unitSeconds : t.weekly.unitPoints

  const bar = (target: string) => <ReactionBar target={target} counts={counts} canReact={canReact} onReact={onReact} />

  return (
    <div className="sheet cascade wk-results">
      <div className="subpage-head">
        <button type="button" className="subpage-back" onClick={onBack} aria-label={t.weekly.results.back}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="subpage-title">{t.weekly.results.title}</h1>
      </div>

      <section className="wk-results-head" style={{ background: `var(--${tint})`, color: `var(--${onTint(tint)})` } as CSSProperties}>
        <span className="wk-results-mark">
          <ModeGlyph mode={mode} />
        </span>
        <div className="wk-results-text">
          <strong>{t.modes[mode]}</strong>
          <span>{closed ? t.weekly.results.final : t.weekly.results.provisional}</span>
          {!closed && <span className="wk-hero-time">{t.weekly.ends(timeLeft(t, clock, closesAt))}</span>}
        </div>
      </section>

      {rows === 'loading' && (
        <p className="note" role="status">
          {t.loading}
        </p>
      )}
      {rows === null && (
        <div className="stack">
          <p className="note note--warn">{t.weekly.results.loadFailed}</p>
          <button type="button" className="btn btn--ghost" onClick={onRetry}>
            {t.weekly.results.retry}
          </button>
        </div>
      )}
      {Array.isArray(rows) && list.length === 0 && <p className="note">{t.weekly.results.empty}</p>}

      {podium.length > 0 && (
        <section className="stack">
          <div className="spread">
            <p className="section-title">{t.weekly.results.podium}</p>
            <p className="note">{t.weekly.results.players(players)}</p>
          </div>
          <ol className="wk-podium">
            {[1, 0, 2].map((place) => {
              const row = podium[place]
              if (!row) return <li key={place} className="wk-podium-slot wk-podium-slot--empty" aria-hidden="true" />
              return (
                <li key={row.playerId} className={`wk-podium-slot wk-podium-slot--${place + 1}`} style={{ '--i': place } as CSSProperties}>
                  {place === 0 && closed && <Burst />}
                  <Avatar choice={row.avatar} size="md" />
                  <span className="wk-podium-name">
                    {row.me ? (
                      t.weekly.you
                    ) : (
                      <PlayerName name={row.name} avatar={row.avatar}>
                        {row.name}
                      </PlayerName>
                    )}
                  </span>
                  <strong className="wk-podium-value">{valueText(t, row.value, metric)}</strong>
                  <span className="wk-podium-step">{place + 1}</span>
                  {bar(`podium:${place + 1}`)}
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {me && (
        <section className="wk-me" aria-label={t.weekly.results.mine}>
          <span className="wk-kicker">{t.weekly.results.mine}</span>
          <div className="wk-me-row">
            <strong className="wk-me-rank">{t.weekly.screen.rankOf(me.rank, Math.max(players, me.rank))}</strong>
            <span className="wk-me-value">{valueText(t, me.value, metric)}</span>
            <span className="note">{t.weekly.results.attempts(me.attempts)}</span>
          </div>
        </section>
      )}

      <section className="stack">
        <p className="section-title">{t.weekly.results.trophies}</p>
        {awards.length === 0 ? (
          <p className="note">{t.weekly.results.noTrophies}</p>
        ) : (
          <>
            <ul className="trophies">
              {awards.map((award, index) => {
                const who = byId.get(award.playerId)
                const [name, line] = t.weekly.trophy[award.id]
                const tone = WEEKLY_TROPHY_TINTS[award.id]
                return (
                  <li key={award.id} className="trophy-item wk-trophy" style={{ '--i': index } as CSSProperties}>
                    <span className="trophy">
                      <span className="trophy-mark" style={{ background: `var(--${tone})` }} aria-hidden="true">
                        <WeeklyTrophyIcon id={award.id} tint={onTint(tone)} />
                      </span>
                      <span className="trophy-text">
                        <strong>{name}</strong>
                        <span>
                          {who && <Avatar choice={who.avatar} size="sm" />}
                          <span className="trophy-who">{who ? (who.me ? t.weekly.you : who.name) : '…'}</span>
                        </span>
                        <span className="note">{line(award.value, capitalized(award.word ?? ''), unit)}</span>
                      </span>
                    </span>
                    {bar(`trophy:${award.id}`)}
                  </li>
                )
              })}
            </ul>
            <p className="note">{canReact ? t.weekly.results.trophiesHint : t.weekly.results.reactOnly}</p>
          </>
        )}
      </section>

      {rest.length > 0 && (
        <section className="stack">
          <p className="section-title">{t.weekly.results.board}</p>
          <ol className="wk-board" start={4}>
            {rest.slice(0, shown).map((row) => (
              <li key={row.playerId} className={`wk-board-row${row.me ? ' wk-board-row--me' : ''}`}>
                <span className="rank">{row.rank}</span>
                <Avatar choice={row.avatar} size="sm" />
                <span className="name">
                  {row.me ? (
                    t.weekly.you
                  ) : (
                    <PlayerName name={row.name} avatar={row.avatar}>
                      {row.name}
                    </PlayerName>
                  )}
                </span>
                <span className="points">{valueText(t, row.value, metric)}</span>
                {bar(`player:${row.playerId}`)}
              </li>
            ))}
          </ol>
          {shown < rest.length && (
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setShown(shown + PAGE)}>
              {t.weekly.results.more}
            </button>
          )}
        </section>
      )}

      {onPlay && !closed && (
        <button type="button" className="btn btn--blue btn--block" onClick={onPlay}>
          {t.weekly.results.play}
        </button>
      )}
      <button type="button" className="btn btn--ghost btn--block" onClick={onBack}>
        {t.weekly.results.back}
      </button>
    </div>
  )
}

/**
 * Les réactions d'une cible, agrégées : un jeton par emoji et son compte, le
 * mien en relief, et un petit sélecteur pour en poser une. Des centaines de
 * réactions ne pèsent pas plus qu'une ligne.
 */
function ReactionBar({
  target,
  counts,
  canReact,
  onReact,
}: {
  target: string
  counts: readonly WeeklyReactionCount[]
  canReact: boolean
  onReact(target: string, emoji: ReactionEmoji | null): void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const here = counts.filter((count) => count.target === target && count.count > 0)
  const mine = here.find((count) => count.mine)?.emoji ?? null
  if (here.length === 0 && !canReact) return null
  const pick = (emoji: ReactionEmoji) => {
    if (mine !== emoji) sound.react()
    onReact(target, mine === emoji ? null : emoji)
    setOpen(false)
  }
  return (
    <div className="wk-react">
      {here.map((count) => (
        <button
          key={count.emoji}
          type="button"
          className={`wk-chip${count.mine ? ' wk-chip--mine' : ''}`}
          disabled={!canReact}
          aria-pressed={count.mine}
          onClick={() => pick(count.emoji)}
        >
          <span aria-hidden="true">{count.emoji}</span>
          <small>{count.count}</small>
        </button>
      ))}
      {canReact && (
        <button type="button" className="wk-chip wk-chip--add" aria-label={t.weekly.results.react} aria-expanded={open} onClick={() => setOpen(!open)}>
          +
        </button>
      )}
      {open && (
        <div className="reaction-menu wk-react-menu" role="menu" aria-label={t.weekly.results.react}>
          {REACTIONS.map((emoji, index) => (
            <button
              key={emoji}
              type="button"
              role="menuitemradio"
              aria-checked={mine === emoji}
              className={`reaction-pick${mine === emoji ? ' reaction-pick--on' : ''}`}
              style={{ '--i': index } as CSSProperties}
              onClick={() => pick(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Les résultats, chargés : classement, mesures des trophées et comptes de réactions. */
export function WeeklyResults({
  weekId,
  lang,
  mode,
  closed,
  closesAt,
  played,
  onBack,
  onPlay,
}: {
  weekId: string
  lang: string
  mode: GameMode
  closed: boolean
  closesAt: number
  /** Le joueur a une tentative cette semaine : lui seul réagit. */
  played: boolean
  onBack(): void
  onPlay?(): void
}) {
  const [rows, setRows] = useState<readonly WeeklyBoardRow[] | null | 'loading'>('loading')
  const [measures, setMeasures] = useState<readonly WeeklyMeasures[]>([])
  const [counts, setCounts] = useState<readonly WeeklyReactionCount[]>([])
  const reacting = useFeature('reactions')
  const load = useCallback(() => {
    setRows('loading')
    fetchWeeklyBoard(weekId, lang, 100).then(setRows)
    fetchWeeklyMeasures(weekId, lang).then((next) => setMeasures(next ?? []))
    fetchWeeklyReactionCounts(weekId, lang).then((next) => setCounts(next ?? []))
  }, [weekId, lang])
  useEffect(() => {
    window.scrollTo(0, 0)
    load()
  }, [load])

  // Optimiste : le compte bouge à la tape, et revient si le serveur refuse.
  const react = useCallback(
    (target: string, emoji: ReactionEmoji | null) => {
      const before = counts
      const mineHere = counts.find((count) => count.target === target && count.mine)
      let next = counts
        .map((count) => (count === mineHere ? { ...count, count: count.count - 1, mine: false } : count))
        .filter((count) => count.count > 0)
      if (emoji) {
        const existing = next.find((count) => count.target === target && count.emoji === emoji)
        next = existing
          ? next.map((count) => (count === existing ? { ...count, count: count.count + 1, mine: true } : count))
          : [...next, { target, emoji, count: 1, mine: true }]
      }
      setCounts(next)
      reactInWeekly(weekId, lang, target, emoji).then((ok) => ok || setCounts(before))
    },
    [counts, weekId, lang],
  )

  return (
    <WeeklyResultsView
      mode={mode}
      closed={closed}
      closesAt={closesAt}
      rows={rows}
      measures={measures}
      counts={counts}
      canReact={reacting && played}
      onReact={react}
      onRetry={load}
      onBack={onBack}
      onPlay={onPlay}
    />
  )
}
