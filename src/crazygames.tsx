import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The fonts ship with the bundle: the portal's iframe must not wait on Google Fonts.
import '@fontsource-variable/jost/index.css'
import { App } from './App'
import { loadMessages } from './i18n'
import { host } from './platform'
import { initCrazyGames, loadingStart, loadingStop, restoreSavedProgress } from './platform/crazygames'
import { armSound } from './lib/sound'
import { startTracking } from './lib/track'
import { loadLocale } from './state/locale'
import { drawPageBarOnIos, tightenUnderKeyboard } from './portalPage'
import { applyTheme, loadTheme } from './state/theme'
import './styles.css'
import './crazygames.css'

/**
 * The CrazyGames build's entry (`crazygames.html`, `npm run crazygames:build`):
 * the app itself, minus the phone's shell, behind the portal's SDK. The SDK answers first — the saved progress it holds must be
 * in localStorage before the profile is read, and its language decides the
 * first screen's.
 */
const root = createRoot(document.getElementById('root')!)

// Le commit dont ce paquet vient, sur le document : la page du portail sert le
// build qu'elle a revu, pas celui qu'on vient de téléverser, et c'est ce que
// `npm run crazygames:live` lit pour dire lequel des deux on regarde.
document.documentElement.dataset.build = import.meta.env.VITE_BUILD ?? 'dev'

tightenUnderKeyboard()
drawPageBarOnIos()

// The likely language's texts are fetched while the SDK wakes, which takes a
// few hundred milliseconds: the SDK's own answer, read after, usually finds
// them loaded.
void loadMessages(loadLocale() ?? 'en').catch(() => undefined)

void (async () => {
  await initCrazyGames()
  loadingStart()
  // The guest's opens and runs reach the dashboard without an account (0084).
  startTracking()
  await restoreSavedProgress()
  // Before the first paint, so a dark-theme player never sees a light flash.
  applyTheme(loadTheme())
  await loadMessages(loadLocale(host.languages()) ?? host.fallbackLocale ?? 'en').catch(() => undefined)
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  loadingStop()
  armSound()
})()
