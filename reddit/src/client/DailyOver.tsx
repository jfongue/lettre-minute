import { showLoginPrompt } from '@devvit/web/client'
import { useState } from 'react'
import { tierGrid } from '../../../src/domain/daily'
import { capitalized } from '../../../src/domain/text'
import { categoryText, formatNumber, useT } from '../../../src/i18n'
import { sound } from '../../../src/lib/sound'
import { TierTag } from '../../../src/ui/bauhaus'
import type { DailyPostData, DailyResult, PlayResponse, Standing } from '../shared/api'
import { postShare } from './api'

type ShareState = 'idle' | 'sending' | 'shared' | 'failed'

interface DailyOverProps {
  data: DailyPostData
  result: DailyResult
  /** Null while the server has not answered, or when it could not. */
  standing: Standing | null
  /** The game entered the board: first of the day, by a logged-in reader. */
  counted: boolean
  /** The server answered, whatever it said. */
  sent: boolean
  username: string | null
  board: Pick<PlayResponse, 'top' | 'players'> | null
  onAgain(): void
}

/** The end of the daily game: the score, the words, where the reader stands, and the share. */
export function DailyOver({ data, result, standing, counted, sent, username, board, onAgain }: DailyOverProps) {
  const t = useT()
  const [share, setShare] = useState<ShareState>('idle')
  const unique = new Set(standing?.unique ?? [])
  const alone = result.words.filter((word) => unique.has(`${word.categoryId}:${word.key}`))

  const shareScore = () => {
    sound.click()
    setShare('sending')
    postShare(t.daily.shareText(data.number, result.score, tierGrid(result.words)))
      .then((answer) => setShare(answer.ok ? 'shared' : 'failed'))
      .catch(() => setShare('failed'))
  }

  return (
    <div className="sheet daily-over">
      <p className="eyebrow">
        {t.daily.title} {t.daily.number(data.number)}
      </p>
      <h1 className="daily-score">
        <span className="daily-score-label">{t.daily.score}</span>
        <span className="daily-score-value">{formatNumber(t, result.score)}</span>
      </h1>
      {standing && (
        <p className="daily-rank">
          {t.daily.rank(standing.rank, standing.total)}
          {standing.streak > 1 && <span> · {t.daily.streak(standing.streak)}</span>}
        </p>
      )}
      {sent && !counted && username && <p className="note">{t.daily.practice}</p>}
      {sent && !username && (
        <p className="daily-login">
          {t.daily.loggedOut}{' '}
          <button type="button" className="btn btn--quiet" onClick={() => showLoginPrompt()}>
            {t.daily.logIn}
          </button>
        </p>
      )}

      {alone.length > 0 && (
        <section className="daily-block">
          <h2 className="eyebrow">{t.daily.unique(alone.length)}</h2>
          <p className="daily-alone">{alone.map((word) => capitalized(word.display)).join(' · ')}</p>
        </section>
      )}

      <section className="daily-block">
        <h2 className="eyebrow">{t.daily.words}</h2>
        {result.words.length === 0 ? (
          <p className="note">{t.daily.noWords}</p>
        ) : (
          <ul className="daily-words">
            {result.words.map((word) => (
              <li key={`${word.categoryId}:${word.key}`}>
                <span className="daily-word">{capitalized(word.display)}</span>
                <span className="daily-word-category">{categoryText(t, word.categoryId).label}</span>
                <TierTag tier={word.tier} />
                <span className="daily-word-points">+{word.points}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {board && board.top.length > 0 && (
        <section className="daily-block">
          <h2 className="eyebrow">
            {t.daily.board} · {t.daily.players(board.players)}
          </h2>
          <ol className="daily-board">
            {board.top.map((row, at) => (
              <li key={`${row.name}:${at}`} className={row.name === username ? 'daily-board-me' : undefined}>
                <span className="daily-board-rank">{at + 1}</span>
                <span className="daily-board-name">
                  u/{row.name}
                  {row.name === username && ` (${t.daily.you})`}
                </span>
                <span className="daily-board-score">{formatNumber(t, row.score)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {username && counted && <pre className="daily-grid" aria-hidden="true">{tierGrid(result.words)}</pre>}
      <div className="daily-actions">
        {username && counted && (
          <button
            type="button"
            className="btn btn--red"
            disabled={share === 'sending' || share === 'shared'}
            onClick={shareScore}
          >
            {share === 'shared' ? t.daily.shared : t.daily.share}
          </button>
        )}
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            sound.click()
            onAgain()
          }}
        >
          {t.daily.again}
        </button>
      </div>
      {share === 'failed' && <p className="note" role="status">{t.daily.shareFailed}</p>}
    </div>
  )
}
