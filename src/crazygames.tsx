import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The fonts ship with the bundle: the portal's iframe must not wait on Google Fonts.
import '@fontsource-variable/jost/index.css'
import { App } from './App'
import { loadMessages } from './i18n'
import { host } from './platform'
import { initCrazyGames, loadingStart, loadingStop, restoreSavedProgress } from './platform/crazygames'
import { armSound } from './lib/sound'
import { loadLocale } from './state/locale'
import { applyTheme, loadTheme } from './state/theme'
import './styles.css'
import './crazygames.css'

/**
 * The CrazyGames build's entry (`crazygames.html`, `npm run crazygames:build`):
 * the app itself, minus the phone's shell and usage tracking, behind the
 * portal's SDK. The SDK answers first — the saved progress it holds must be
 * in localStorage before the profile is read, and its language decides the
 * first screen's.
 */
const root = createRoot(document.getElementById('root')!)

// The portal's iframe keeps its height under a phone's keyboard, which covers
// the bottom of the run instead: while a run's field has the focus on a touch
// screen, crazygames.css tightens the run above the keys. The class lingers a
// moment after a blur, so a tap on Skip or Enter that hands the focus back to
// the field does not make the screen jump twice.
const touch = window.matchMedia('(pointer: coarse)')
let loosen: ReturnType<typeof setTimeout> | undefined
document.addEventListener('focusin', (event) => {
  if (!touch.matches || !(event.target instanceof HTMLInputElement) || !event.target.hasAttribute('data-keys')) return
  clearTimeout(loosen)
  document.documentElement.setAttribute('data-typing', '')
})
document.addEventListener('focusout', () => {
  clearTimeout(loosen)
  loosen = setTimeout(() => {
    if (!(document.activeElement instanceof HTMLInputElement && document.activeElement.hasAttribute('data-keys'))) document.documentElement.removeAttribute('data-typing')
  }, 400)
})

void (async () => {
  await initCrazyGames()
  loadingStart()
  restoreSavedProgress()
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
