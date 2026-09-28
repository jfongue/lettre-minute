import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The fonts ship with the bundle: an app opened offline for the first time
// must not fall back to Georgia.
import '@fontsource-variable/jost/index.css'
import { App } from './App'
import { loadMessages } from './i18n'
import { startNativeShell } from './lib/native'
import { armSound } from './lib/sound'
import { startTracking } from './lib/track'
import { loadLocale } from './state/locale'
import { applyTheme, loadTheme } from './state/theme'
import './styles.css'

// Before the first paint, so a dark-theme player never sees a light flash.
applyTheme(loadTheme())
// Before the first render too: an error thrown while mounting is worth a line.
startTracking()

// The player's language ships in its own chunk: read it before the first
// render, or the home screen would paint in French and switch.
const root = createRoot(document.getElementById('root')!)
void loadMessages(loadLocale() ?? 'fr')
  .catch(() => undefined)
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    // Hidden once React has something to paint, not before: the launch screen
    // would give way to an empty page.
    startNativeShell()
  })

armSound()
