import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The fonts ship with the bundle: an app opened offline for the first time
// must not fall back to Georgia.
import '@fontsource-variable/jost/index.css'
import { App } from './App'
import { startNativeShell } from './lib/native'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

startNativeShell()
