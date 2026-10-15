import { StrictMode, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/jost/index.css'
import { DashboardView } from './debug/Dashboard'
import type { Snapshot } from './debug/snapshot'
import { MessagesContext, messagesFor } from './i18n'
import { fetchDashboard } from './lib/cloud'
import { applyTheme, loadTheme } from './state/theme'
import './styles.css'

/**
 * The dashboard as its own page (dashboard/index.html, /lettre-minute/dashboard
 * on the web), open to anyone without an account: `admin_analytics` answers the
 * `anon` role since 0086, from a copy refreshed every ten minutes that the
 * administrator reads too (0087, 0088). Only the slot drill-down, which names
 * players, stays the administrator's — a signed-in admin still gets it.
 */

applyTheme(loadTheme())

function Page() {
  const [data, setData] = useState<Snapshot | null | undefined>(undefined)
  const load = useCallback(() => {
    setData(undefined)
    void fetchDashboard().then(setData)
  }, [])
  useEffect(load, [load])
  return (
    <div className="dashboard">
      <DashboardView data={data} onReload={load} />
    </div>
  )
}

// French, like the dashboard's own labels: the category names come from the i18n.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MessagesContext.Provider value={messagesFor('fr')}>
      <Page />
    </MessagesContext.Provider>
  </StrictMode>,
)
