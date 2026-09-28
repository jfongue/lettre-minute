import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The fonts ship with the bundle: an app opened offline for the first time
// must not fall back to Georgia.
import '@fontsource-variable/jost/index.css'
import { App } from './App'
import { startNativeShell } from './lib/native'
import { armSound } from './lib/sound'
import { startTracking } from './lib/track'
import { applyTheme, loadTheme } from './state/theme'
import './styles.css'

// Before the first paint, so a dark-theme player never sees a light flash.
applyTheme(loadTheme())
// Before the first render too: an error thrown while mounting is worth a line.
startTracking()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

startNativeShell()
armSound()
