import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The fonts ship with the bundle: Playgama refuses a game that loads anything from outside its archive.
import '@fontsource-variable/jost/index.css'
import { App } from './App'
import { loadMessages } from './i18n'
import { host } from './platform'
import { gameReady, initPlaygama, restoreSavedProgress } from './platform/playgama'
import { armSound } from './lib/sound'
import { loadLocale } from './state/locale'
import { applyTheme, loadTheme } from './state/theme'
import { drawPageBarOnIos, tightenUnderKeyboard } from './portalPage'
import './styles.css'
import './crazygames.css'

/**
 * The Playgama build's entry (`playgama.html`, `npm run playgama:build`): the
 * CrazyGames version's page — same frame, same styles — behind Playgama's
 * Bridge instead of the CrazyGames SDK. The Bridge answers first: nothing
 * loads before it, the progress it holds must be in localStorage before the
 * profile is read, and its language decides the first screen's.
 */
const root = createRoot(document.getElementById('root')!)

document.documentElement.dataset.build = import.meta.env.VITE_BUILD ?? 'dev'

tightenUnderKeyboard()
drawPageBarOnIos()

void (async () => {
  await initPlaygama()
  await restoreSavedProgress()
  // Before the first paint, so a dark-theme player never sees a light flash.
  applyTheme(loadTheme())
  await loadMessages(loadLocale(host.languages()) ?? host.fallbackLocale ?? 'en').catch(() => undefined)
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  // The home screen is drawn on the next frame: only then is the game playable.
  requestAnimationFrame(() => requestAnimationFrame(gameReady))
  armSound()
})()
