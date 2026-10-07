import { showLoginPrompt } from '@devvit/web/client'
import { useState } from 'react'
import { tierGrid } from '../../../src/domain/daily'
import type { Run } from '../../../src/domain/run'
import { capitalized } from '../../../src/domain/text'
import { categoryText, formatNumber, useT } from '../../../src/i18n'
import { sound } from '../../../src/lib/sound'
import { LetterMark, TierTag } from '../../../src/ui/bauhaus'
import { categoryMotif } from '../../../src/ui/motifs'
import { Reveal } from '../../../src/ui/Reveal'
import type { DailyPostData, DailyResult, PlayResponse, Standing } from '../shared/api'
import { postShare } from './api'

type ShareState = 'idle' | 'sending' | 'shared' | 'failed'

interface DailyOverProps {
  data: DailyPostData
  /** The run just played, revealed word by word as the app does; absent when the result comes back from the server. */
  run: Run | null
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

/**
 * The end of the daily game in the app's two beats: the reveal of the score
 * and each word (`Reveal`, the app's own), then the summary — where the reader
 * stands on the post, the words nobody else found, and the share.
 */
export function DailyOver({ run, ...summary }: DailyOverProps) {
  const [revealed, setRevealed] = useState(run === null)
  if (run && !revealed) return <Reveal run={run} previousBest={null} hidden={[]} peeks={0} onNext={() => setRevealed(true)} />
  return <Summary {...summary} />
}

function Summary({ data, result, standing, counted, sent, username, board, onAgain }: Omit<DailyOverProps, 'run'>) {
  const t = useT()
  const [share, setShare] = useState<ShareState>('idle')
  const unique = new Set(standing?.unique ?? [])
  const alone = result.words.filter((word) => unique.has(`${word.categoryId}:${word.key}`))
  const grid = tierGrid(result.words)

  const shareScore = () => {
    sound.click()
    setShare('sending')
    postShare(t.daily.shareText(data.number, result.score, grid))
      .then((answer) => setShare(answer.ok ? 'shared' : 'failed'))
      .catch(() => setShare('failed'))
  }

  return (
    <div className="sheet daily-over cascade">
      <header className="reveal-score">
        <p className="eyebrow">
          {t.daily.title} {t.daily.number(data.number)}
        </p>
        <h1 className="score-final">{formatNumber(t, result.score)}</h1>
        <p className="score-poster-unit">{t.over.points}</p>
        {standing && (
          <p className="daily-rank">
            {t.daily.rank(standing.rank, standing.total)}
            {standing.streak > 1 && ` · ${t.daily.streak(standing.streak)}`}
          </p>
        )}
      </header>

      {sent && !counted && username && <p className="note">{t.daily.practice}</p>}
      {sent && !username && (
        <div className="panel daily-login">
          <p>{t.daily.loggedOut}</p>
          <button type="button" className="btn btn--blue" onClick={() => showLoginPrompt()}>
            {t.daily.logIn}
          </button>
        </div>
      )}

      {board && board.top.length > 0 && (
        <section className="panel">
          <div className="spread">
            <p className="section-title">{t.daily.board}</p>
            <p className="note">{t.daily.players(board.players)}</p>
          </div>
          <div className="standings">
            {board.top.map((row, index) => (
              <div
                key={`${row.name}:${index}`}
                className={`standing${index === 0 ? ' standing--leader' : ''}${row.name === username ? ' standing--me' : ''}`}
              >
                <span className="rank">{index + 1}</span>
                <span className="name">{row.name === username ? t.daily.you : `u/${row.name}`}</span>
                <span className="points">{formatNumber(t, row.score)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {alone.length > 0 && (
        <section className="panel">
          <p className="section-title">{t.daily.unique(alone.length)}</p>
          <p className="daily-alone">{alone.map((word) => capitalized(word.display)).join(' · ')}</p>
        </section>
      )}

      <section className="panel">
        <p className="section-title">{t.daily.words}</p>
        {result.words.length === 0 ? (
          <p className="note">{t.daily.noWords}</p>
        ) : (
          <ol className="reveal-words">
            {result.words.map((word) => (
              <li key={`${word.categoryId}:${word.key}`} className="reveal-word">
                <LetterMark letter={word.letter} motif={categoryMotif(word.categoryId)} size="sm" />
                <span className="reveal-word-text">
                  {word.approximate && <span className="note">≈ </span>}
                  {capitalized(word.display)}
                  <span className="reveal-word-category">{categoryText(t, word.categoryId).label}</span>
                </span>
                {!word.approximate && word.tier !== 'courant' && <TierTag tier={word.tier} />}
                <span className="reveal-word-points">+{word.points}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {username && counted && grid !== '' && (
        <pre className="daily-grid" aria-hidden="true">
          {grid}
        </pre>
      )}
      <div className="stack">
        {username && counted && (
          <button
            type="button"
            className="btn btn--red btn--block"
            disabled={share === 'sending' || share === 'shared'}
            onClick={shareScore}
          >
            {share === 'shared' ? t.daily.shared : t.daily.share}
          </button>
        )}
        {share === 'failed' && (
          <p className="note note--warn" role="status">
            {t.daily.shareFailed}
          </p>
        )}
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => {
            sound.click()
            onAgain()
          }}
        >
          {t.daily.again}
        </button>
      </div>
    </div>
  )
}
