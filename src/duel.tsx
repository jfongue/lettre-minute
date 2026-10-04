import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
// The fonts ship with the bundle: a page opened offline must not fall back to Georgia.
import '@fontsource-variable/jost/index.css'
import { detectLocale, loadMessages, MessagesContext, messagesFor, type Locale } from './i18n'
import { armSound } from './lib/sound'
import { loadLocale } from './state/locale'
import { applyTheme, loadTheme } from './state/theme'
import { DuelScreen } from './ui/DuelScreen'
import './styles.css'
import './duel.css'

/**
 * The duel, as its own page (duel.html): the table prototype plays against the
 * house players without a server, so it needs no home screen, no account and no
 * run flow — only the dictionaries of the five categories it deals. It joins
 * `index.html` with a tile once the online table lands.
 */

// Before the first paint, so a dark-theme player never sees a light flash.
applyTheme(loadTheme())

/** The language the page reads: the player's, French until it arrives. */
function Duel({ locale }: { locale: Locale }) {
  const [messages, setMessages] = useState(() => messagesFor(locale))

  useEffect(() => {
    let live = true
    loadMessages(locale)
      .then((loaded) => {
        if (live) setMessages(loaded)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [locale])

  return (
    <MessagesContext.Provider value={messages}>
      <DuelScreen lang={locale} />
    </MessagesContext.Provider>
  )
}

const root = createRoot(document.getElementById('root')!)
void loadMessages(loadLocale() ?? detectLocale(navigator.languages) ?? 'fr')
  .catch(() => undefined)
  .then(() => {
    document.documentElement.lang = loadLocale() ?? detectLocale(navigator.languages) ?? 'fr'
    root.render(
      <StrictMode>
        <Duel locale={loadLocale() ?? detectLocale(navigator.languages) ?? 'fr'} />
      </StrictMode>,
    )
  })

armSound()
