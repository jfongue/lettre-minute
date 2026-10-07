import '@fontsource-variable/jost/index.css'
import './splash.css'

import { requestExpandedMode } from '@devvit/web/client'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { categoryText, formatNumber, loadMessages, MessagesContext, useT } from '../../../src/i18n'
import type { DayResponse } from '../shared/api'
import { fetchDay } from './api'
import { postData, postLocale } from './post'
import { useMessages } from './useMessages'

/**
 * The post as the feed shows it: tap only, no scroll, no dictionary — Reddit
 * asks this screen to paint within a second. The game itself opens expanded.
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
    <main className="splash">
      <header className="splash-head">
        <h1 className="splash-title">{t.daily.title}</h1>
        {data && <span className="splash-number">{t.daily.number(data.number)}</span>}
      </header>
      <p className="splash-tagline">{t.daily.tagline}</p>
      {data && (
        <section className="splash-lineup" aria-label={t.daily.today}>
          {data.categories.map((id) => (
            <span key={id} className="splash-chip">
              {categoryText(t, id).label}
            </span>
          ))}
        </section>
      )}
      <p className="splash-crowd">
        {day === null ? ' ' : day.players === 0 ? t.daily.noneYet : t.daily.players(day.players)}
        {best && <span className="splash-best">{t.daily.best(best.score, best.name)}</span>}
      </p>
      <button type="button" className="splash-play" onClick={(event) => requestExpandedMode(event.nativeEvent, 'game')}>
        {day?.played ? t.daily.seeResult : t.daily.play}
      </button>
      {day?.played && (
        <p className="splash-score">
          {t.daily.score} · {formatNumber(t, day.played.score)}
        </p>
      )}
    </main>
  )
}

function Root() {
  const messages = useMessages(postLocale(postData()))
  return (
    <MessagesContext.Provider value={messages}>
      <Splash />
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
