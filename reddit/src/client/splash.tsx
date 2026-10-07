import '@fontsource-variable/jost/index.css'
import '../../../src/styles.css'
import './splash.css'

import { requestExpandedMode } from '@devvit/web/client'
import { StrictMode, useEffect, useState, type CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import { RUN_SECONDS } from '../../../src/domain/run'
import { categoryText, formatNumber, loadMessages, MessagesContext, useT } from '../../../src/i18n'
import { Shape } from '../../../src/ui/bauhaus'
import { CategoryIcon } from '../../../src/ui/CategoryIcon'
import { categoryMotif, onTint, type ShapeKind, type Tint } from '../../../src/ui/motifs'
import type { DayResponse } from '../shared/api'
import { fetchDay } from './api'
import { postData, postLocale } from './post'
import { useMessages } from './useMessages'

type Cell = [kind: ShapeKind, tint: Tint, ground: Tint, motion?: 'turn' | 'pulse' | 'spin']

// The app's home poster (`POSTER`, src/ui/HomeScreen.tsx), copied rather than
// imported: that screen brings the whole app and its server client along.
const POSTER: readonly Cell[] = [
  ['quarter', 'yellow', 'blue', 'turn'],
  ['circle', 'red', 'paper', 'pulse'],
  ['bars', 'ink', 'pink'],
  ['arch', 'green', 'yellow', 'turn'],
  ['triangle', 'blue', 'paper', 'turn'],
  ['half', 'paper', 'red', 'turn'],
  ['sun', 'red', 'yellow', 'spin'],
  ['diamond', 'yellow', 'ink', 'turn'],
  ['circle', 'pink', 'green', 'pulse'],
  ['quarter', 'blue', 'pink', 'turn'],
]

/**
 * Cream on red reads at 3.6:1, under what Lighthouse asks of a small label:
 * black on red, as `.btn--red` already does in the app.
 */
const labelInk = (tint: Tint): Tint => (tint === 'red' ? 'black' : onTint(tint))

/**
 * The post as the feed shows it, the app's home in small: the poster, the
 * title, the day's lineup and the play button. Tap only and no scroll, as
 * Reddit asks of an inline post; the game itself opens expanded.
 */
function Splash() {
  const t = useT()
  const data = postData()
  const [day, setDay] = useState<DayResponse | null>(null)

  useEffect(() => {
    fetchDay().then(setDay).catch(() => undefined)
  }, [])

  const best = day?.top[0]
  return (
    <div className="sheet splash">
      <div className="poster" aria-hidden="true">
        {POSTER.map(([kind, tint, ground, motion], index) => (
          <span key={index} className="poster-cell" style={{ background: `var(--${ground})`, '--i': index } as CSSProperties}>
            <span className={`motion${motion ? ` motion-${motion}` : ''}`}>
              <Shape kind={kind} tint={tint} />
            </span>
          </span>
        ))}
      </div>

      <header className="masthead splash-masthead">
        <h1 className="title">
          <span>{t.appName[0]}</span>
          <span>{t.appName[1]}</span>
        </h1>
        <p className="eyebrow">
          {data ? `${t.daily.number(data.number)} · ` : ''}
          {t.home.tagline(RUN_SECONDS)}
        </p>
      </header>

      {data && (
        <ul className="splash-lineup" aria-label={t.daily.today}>
          {data.categories.map((id) => {
            const motif = categoryMotif(id)
            const ink = labelInk(motif.tint)
            return (
              <li key={id} style={{ background: `var(--${motif.tint})`, color: `var(--${ink})` }}>
                <CategoryIcon categoryId={id} tint={ink} className="splash-lineup-icon" />
                {categoryText(t, id).label}
              </li>
            )
          })}
        </ul>
      )}

      <p className="note splash-crowd">
        {day === null
          ? ' '
          : day.played
            ? `${t.daily.score} · ${formatNumber(t, day.played.score)}`
            : best
              ? `${t.daily.players(day.players)} · ${t.daily.best(best.score, best.name)}`
              : t.daily.noneYet}
      </p>

      <button
        type="button"
        className="btn btn--play btn--block"
        onClick={(event) => requestExpandedMode(event.nativeEvent, 'game')}
      >
        <span>{day?.played ? t.daily.seeResult : t.daily.play}</span>
        <span className="play-glyph" aria-hidden="true">
          <Shape kind="circle" tint="yellow" />
          <span className="motion play-triangle">
            <Shape kind="triangle" tint="red" />
          </span>
        </span>
      </button>
    </div>
  )
}

function Root() {
  const [data] = useState(postData)
  const messages = useMessages(postLocale(data))
  return (
    <MessagesContext.Provider value={messages}>
      <main className="stage splash-stage">
        <Splash />
      </main>
    </MessagesContext.Provider>
  )
}

const locale = postLocale(postData())
document.documentElement.lang = locale
void loadMessages(locale)
  .catch(() => undefined)
  .then(() =>
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <Root />
      </StrictMode>,
    ),
  )
