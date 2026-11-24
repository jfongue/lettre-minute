import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The fonts ship with the bundle: Y8's frame must not wait on Google Fonts.
import '@fontsource-variable/jost/index.css'
import { App } from './App'
import { loadMessages } from './i18n'
import { host } from './platform'
import { initY8, restoreSavedProgress } from './platform/y8'
import { armSound } from './lib/sound'
import { loadLocale } from './state/locale'
import { drawPageBarOnIos, tightenUnderKeyboard } from './portalPage'
import { applyTheme, loadTheme } from './state/theme'
import './styles.css'
// Y8 frames the game as CrazyGames does: the same frame styles serve both.
import './crazygames.css'

/**
 * The Y8 build's entry (`y8.html`, `npm run y8:build`): the CrazyGames
 * version's page behind Y8's SDK instead of the portal's. The SDK answers
 * first — a signed-in player's cloud save must be in localStorage before the
 * profile is read, and Y8's language decides the first screen's. No usage
 * tracking: the server takes a guest's events from CrazyGames alone (0084).
 */
const root = createRoot(document.getElementById('root')!)

document.documentElement.dataset.build = import.meta.env.VITE_BUILD ?? 'dev'

tightenUnderKeyboard()
drawPageBarOnIos()

void loadMessages(loadLocale() ?? 'en').catch(() => undefined)

void (async () => {
  await initY8()
  await restoreSavedProgress()
  // Before the first paint, so a dark-theme player never sees a light flash.
  applyTheme(loadTheme())
  await loadMessages(loadLocale(host.languages()) ?? host.fallbackLocale ?? 'en').catch(() => undefined)
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  armSound()
})()
